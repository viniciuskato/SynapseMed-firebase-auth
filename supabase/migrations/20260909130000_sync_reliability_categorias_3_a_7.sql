-- ============================================================================
-- Sincronização confiável entre dispositivos — Prompt 07-E
-- Categorias 3-7 do backlog de sincronização (ver docs/SINCRONIZACAO-CONFIAVEL.md)
-- ============================================================================
--
-- Continuação do Prompt 07 (categorias 1/2 publicadas em 07-D). Esta
-- migration cobre:
--
-- 1. Notas: `saveNote` fazia delete+insert em duas viagens separadas ao
--    banco, sem constraint de unicidade — uma falha entre o delete e o
--    insert (ou uma corrida real entre dois dispositivos) podia deixar 0 ou
--    2 linhas para o mesmo alvo. Acrescenta os mesmos índices únicos
--    parciais que `bookmarks` já tem (um por coluna de alvo mutuamente
--    exclusiva), permitindo trocar delete+insert por um único upsert
--    atômico no cliente.
--
-- 2. Progresso de leitura: `toggleSectionRead` fazia leitura do array atual
--    no cliente, calculava o array novo localmente e regravava por inteiro —
--    dois dispositivos marcando SEÇÕES DIFERENTES como lidas quase ao mesmo
--    tempo podiam fazer um sobrescrever o progresso do outro ("última
--    gravação vence" apagando progresso válido, o que o Prompt 07-E proíbe
--    explicitamente). Nova RPC `set_section_read` faz o merge de campo
--    (adicionar/remover um único id) ATOMICAMENTE no servidor, com
--    `select ... for update` serializando duas chamadas concorrentes para o
--    mesmo (usuário, compêndio) — nunca um cálculo de array baseado em
--    estado que o cliente já não tem mais.
--
-- 3. Simulados: `saveSimuladoSession` fazia 4 operações separadas (upsert de
--    `simulations`, delete de `simulation_questions`, insert de
--    `simulation_questions`, insert de `simulation_answers`) sem
--    transação — uma falha entre o delete e os inserts (rede caindo no meio,
--    já visto no padrão Resilient*Repository) deixava o simulado sem
--    perguntas/respostas no servidor, sem erro visível (catch{} silencioso)
--    e sem retry. Nova RPC `save_simulado_session` substitui a sessão
--    inteira numa única transação (tudo ou nada) — idempotente por
--    construção, já que é sempre uma substituição total do mesmo payload,
--    não um evento incremental.
--
-- Favoritos (categoria 5) e caderno de erros (categoria 3) NÃO precisam de
-- migration: favoritos já tem os índices únicos necessários desde o schema
-- inicial (só o CLIENTE precisa parar de fazer um "toggle" cego — ver
-- BookmarksRepository.ts) e caderno de erros só permite UPDATE de duas
-- colunas por id, já idempotente por natureza (mesmo update replicado tem o
-- mesmo efeito).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Notas: índices únicos (sem `where`, ao contrário de public.bookmarks)
-- ----------------------------------------------------------------------------
--
-- `bookmarks` usa índices únicos PARCIAIS (`where <coluna> is not null`).
-- Aqui usamos índices únicos SEM predicado de propósito: o upsert do
-- PostgREST/supabase-js (`.upsert(..., { onConflict })`) só consegue inferir
-- um índice como alvo de `ON CONFLICT` quando ele não é parcial — um índice
-- parcial exigiria repetir o `WHERE` na cláusula `ON CONFLICT`, que o cliente
-- JS não tem como expressar. Um índice único comum em (user_id, <coluna>)
-- funciona igual para o nosso propósito: `NULL` nunca colide com `NULL` num
-- índice único do Postgres, então as linhas cujo `material_id`/etc. é nulo
-- (nota é sobre outra coluna) nunca violam este índice entre si — só
-- REALMENTE impede duas notas do mesmo usuário para o MESMO alvo não-nulo,
-- que é o único caso que importa.
create unique index notes_user_material_uq on public.notes (user_id, material_id);
create unique index notes_user_material_section_uq on public.notes (user_id, material_section_id);
create unique index notes_user_question_uq on public.notes (user_id, question_id);
create unique index notes_user_flashcard_uq on public.notes (user_id, flashcard_id);

-- ----------------------------------------------------------------------------
-- 2. Progresso de leitura: RPC de merge atômico por seção
-- ----------------------------------------------------------------------------

create or replace function public.set_section_read(
  p_material_id uuid,
  p_section_id uuid,
  p_is_read boolean,
  p_total_sections int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current uuid[];
  v_updated uuid[];
  v_percent int;
begin
  if app.current_profile_status(v_uid) is distinct from 'active' then
    raise exception 'apenas estudantes ativos podem registrar progresso de leitura';
  end if;
  if p_total_sections is null or p_total_sections <= 0 then
    raise exception 'total_sections deve ser maior que zero';
  end if;
  if not exists (select 1 from public.materials where id = p_material_id) then
    raise exception 'compêndio não encontrado: %', p_material_id;
  end if;

  -- Garante que a linha existe antes do lock — evita duas inserções
  -- concorrentes colidirem sem uma linha para travar com FOR UPDATE.
  insert into public.reading_progress (user_id, material_id, read_section_ids, percent)
  values (v_uid, p_material_id, '{}', 0)
  on conflict (user_id, material_id) do nothing;

  -- Serializa duas chamadas concorrentes para o mesmo (usuário, compêndio):
  -- a segunda só lê depois que a primeira commitar, sempre a partir do
  -- estado real mais recente — nunca de um array que o cliente calculou
  -- antes de saber da mudança feita por outro dispositivo.
  select read_section_ids into v_current
  from public.reading_progress
  where user_id = v_uid and material_id = p_material_id
  for update;

  if p_is_read then
    select array_agg(distinct x) into v_updated
    from unnest(coalesce(v_current, '{}') || array[p_section_id]) as x;
  else
    v_updated := array_remove(coalesce(v_current, '{}'), p_section_id);
  end if;

  v_percent := round((coalesce(array_length(v_updated, 1), 0)::numeric / p_total_sections) * 100);

  update public.reading_progress
  set read_section_ids = v_updated,
      percent = v_percent,
      updated_at = pg_catalog.now()
  where user_id = v_uid and material_id = p_material_id;

  return jsonb_build_object('read_section_ids', to_jsonb(v_updated), 'percent', v_percent);
end;
$$;

revoke all on function public.set_section_read(uuid, uuid, boolean, int) from public, anon;
grant execute on function public.set_section_read(uuid, uuid, boolean, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Simulados: RPC transacional de substituição total da sessão
-- ----------------------------------------------------------------------------
--
-- p_session: {
--   id, name, config (jsonb livre), started_at, completed_at, score,
--   total_time_seconds,
--   questions: [{ question_id, position }],
--   answers: [{ question_id, selected_option_id, time_spent_seconds }]
-- }
-- Resposta cujo question_id não está em `questions`, ou cujo
-- selected_option_id não pertence à questão, é ignorada (mesma tolerância
-- que o cliente já tinha) — nunca aborta a transação inteira por um item
-- inconsistente isolado.

create or replace function public.save_simulado_session(p_session jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_simulation_id uuid := (p_session->>'id')::uuid;
  v_question jsonb;
  v_answer jsonb;
  v_sq_id uuid;
  v_expected_question_id uuid;
  v_option_question_id uuid;
begin
  if app.current_profile_status(v_uid) is distinct from 'active' then
    raise exception 'apenas estudantes ativos podem gravar sessões de simulado';
  end if;
  if v_simulation_id is null then
    raise exception 'id da sessão de simulado é obrigatório';
  end if;

  insert into public.simulations
    (id, user_id, name, config, started_at, completed_at, score, total_time_seconds)
  values (
    v_simulation_id,
    v_uid,
    coalesce(p_session->>'name', p_session->'config'->>'name', 'Simulado'),
    coalesce(p_session->'config', '{}'::jsonb),
    coalesce((p_session->>'started_at')::timestamptz, pg_catalog.now()),
    (p_session->>'completed_at')::timestamptz,
    (p_session->>'score')::numeric,
    coalesce((p_session->>'total_time_seconds')::int, 0)
  )
  on conflict (id) do update set
    name = excluded.name,
    config = excluded.config,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    score = excluded.score,
    total_time_seconds = excluded.total_time_seconds
  where public.simulations.user_id = v_uid;

  if not found then
    raise exception 'sessão de simulado não pertence ao usuário autenticado';
  end if;

  -- Substituição total das perguntas/respostas — sempre dentro da MESMA
  -- transação da função (nunca uma etapa isolada que pode falhar sozinha e
  -- deixar o simulado sem perguntas no servidor).
  delete from public.simulation_answers
  where simulation_question_id in (
    select id from public.simulation_questions where simulation_id = v_simulation_id
  );
  delete from public.simulation_questions where simulation_id = v_simulation_id;

  for v_question in select * from jsonb_array_elements(coalesce(p_session->'questions', '[]'::jsonb))
  loop
    insert into public.simulation_questions (simulation_id, question_id, position)
    values (v_simulation_id, (v_question->>'question_id')::uuid, (v_question->>'position')::int)
    returning id into v_sq_id;

    select a into v_answer
    from jsonb_array_elements(coalesce(p_session->'answers', '[]'::jsonb)) a
    where (a->>'question_id')::uuid = (v_question->>'question_id')::uuid
    limit 1;

    continue when v_answer is null;

    select question_id into v_option_question_id
    from public.question_options
    where id = (v_answer->>'selected_option_id')::uuid;

    -- Resposta inconsistente (alternativa não pertence à questão) é
    -- ignorada, não aborta a sessão inteira — mesma tolerância do cliente
    -- anterior (comentário original em SupabaseSimuladosRepository.ts).
    continue when v_option_question_id is distinct from (v_question->>'question_id')::uuid;

    insert into public.simulation_answers (simulation_question_id, selected_option_id, time_spent_seconds)
    values (v_sq_id, (v_answer->>'selected_option_id')::uuid, coalesce((v_answer->>'time_spent_seconds')::int, 0));
  end loop;
end;
$$;

revoke all on function public.save_simulado_session(jsonb) from public, anon;
grant execute on function public.save_simulado_session(jsonb) to authenticated;
