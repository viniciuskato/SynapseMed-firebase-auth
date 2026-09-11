-- ============================================================================
-- SynapseMed — Prompt 11-B2: idempotência real da criação de flashcard a
-- partir de questão (SRS automático) sob concorrência.
--
-- Problema (achado por reprodução com duas conexões concorrentes da mesma
-- conta, ver docs/diretoria/retornos/11-B2.txt): FlashcardsRepository.
-- createFlashcardFromQuestion fazia read-before-create no CLIENTE — lê
-- `getFlashcards()`, procura por `questionOriginId`; se ausente, cria um
-- flashcard novo com id gerado no cliente. Duas abas/dispositivos podem ler
-- "ausente" na mesma janela de tempo e criar dois flashcards distintos para
-- a mesma questão do mesmo usuário — sem nenhuma garantia autoritativa no
-- servidor, a corrida é real (comprovada, não hipotética).
--
-- Correção:
-- 1. Índice único (não-parcial, ver AGENTS.md armadilha #14) em
--    (user_id, question_origin_id) — NULLs não colidem entre si em um índice
--    único comum, então flashcards personalizados sem origem de questão
--    continuam livres para se repetir sem dedupe indevido.
-- 2. RPC `create_flashcard_from_question`, atômica e idempotente: usa o
--    PRÓPRIO id gerado no cliente como chave de replay (reenviar a mesma
--    operação com o mesmo id é sempre um no-op seguro que devolve a linha
--    já existente) e um `pg_advisory_xact_lock` por (user_id,
--    question_origin_id) para serializar criadores concorrentes — o segundo
--    a chegar encontra a linha já criada pelo primeiro (dentro do lock) e
--    devolve o flashcard CANÔNICO em vez de criar um duplicado.
-- ============================================================================

create unique index if not exists flashcards_user_question_origin_uq
  on public.flashcards (user_id, question_origin_id);

create or replace function public.create_flashcard_from_question(
  p_id uuid,
  p_discipline_id uuid,
  p_theme_id uuid,
  p_material_id uuid,
  p_question_origin_id uuid,
  p_front text,
  p_back text,
  p_mechanism_highlight text,
  p_tags text[],
  p_difficulty text,
  p_is_custom boolean default false
)
returns public.flashcards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.flashcards;
begin
  if v_uid is null then
    raise exception 'usuário não autenticado' using errcode = '28000';
  end if;

  if p_id is null then
    raise exception 'p_id é obrigatório';
  end if;

  -- Replay: a MESMA operação (mesmo id gerado no cliente) já foi persistida
  -- antes — reenvio da fila após timeout de rede, reload com fila pendente,
  -- etc. Nunca cria uma segunda linha; devolve a existente sem lançar erro.
  select * into v_row from public.flashcards where id = p_id;
  if found then
    if v_row.user_id <> v_uid then
      raise exception 'flashcard já existe e pertence a outro usuário' using errcode = '42501';
    end if;
    return v_row;
  end if;

  if p_question_origin_id is not null then
    -- Serializa criadores concorrentes do mesmo (usuário, questão): a
    -- segunda sessão a obter o lock sempre enxerga a linha que a primeira
    -- acabou de commitar (ou nenhuma, se a primeira ainda não chegou aqui —
    -- nesse caso segue para o INSERT, protegido pelo índice único abaixo
    -- como segunda linha de defesa).
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_question_origin_id::text, 0));

    select * into v_row from public.flashcards
      where user_id = v_uid and question_origin_id = p_question_origin_id
      limit 1;
    if found then
      return v_row; -- outra aba/dispositivo já criou — devolve o canônico
    end if;
  end if;

  insert into public.flashcards (
    id, user_id, discipline_id, theme_id, material_id, question_origin_id,
    front, back, mechanism_highlight, tags, difficulty, is_custom
  ) values (
    p_id, v_uid, p_discipline_id, p_theme_id, p_material_id, p_question_origin_id,
    p_front, p_back, p_mechanism_highlight, coalesce(p_tags, '{}'), p_difficulty, coalesce(p_is_custom, false)
  )
  on conflict (user_id, question_origin_id) do nothing
  returning * into v_row;

  if not found then
    -- Corrida perdida apesar do advisory lock (defensivo — ex.: dois locks
    -- com hashes colidentes em teoria, ou p_question_origin_id nulo nunca
    -- entra aqui de qualquer forma pois nulls nunca conflitam): devolve o
    -- canônico existente em vez de propagar erro ao usuário.
    select * into v_row from public.flashcards
      where user_id = v_uid and question_origin_id = p_question_origin_id
      limit 1;
    if not found then
      raise exception 'falha ao criar flashcard';
    end if;
    return v_row;
  end if;

  insert into public.flashcard_srs_state (flashcard_id) values (p_id)
  on conflict (flashcard_id) do nothing;

  return v_row;
end;
$$;

revoke all on function public.create_flashcard_from_question(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text[], text, boolean
) from public, anon;
grant execute on function public.create_flashcard_from_question(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text[], text, boolean
) to authenticated;
