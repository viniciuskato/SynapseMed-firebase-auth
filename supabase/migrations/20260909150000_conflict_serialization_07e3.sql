-- ============================================================================
-- Sincronização confiável entre dispositivos — Prompt 07-E3
-- Serialização real da chave lógica ANTES de a linha existir
-- ============================================================================
--
-- A diretoria identificou três riscos residuais na revisão do 07-E2 (commits
-- 69f9c36/e35beee), todos com a mesma causa raiz: uma checagem de estado
-- (existe linha? já está terminal?) feita ANTES de haver qualquer coisa para
-- travar com `select ... for update`, permitindo que duas transações
-- concorrentes vejam o mesmo estado "não existe"/"não terminal" e ambas
-- prossigam.
--
-- 1. `upsert_note`: `select ... for update` só bloqueia uma linha JÁ
--    EXISTENTE. Duas primeiras criações concorrentes da MESMA nota lógica
--    (mesmo usuário + mesmo alvo) não travam nada uma da outra — a segunda
--    podia sobrescrever a primeira sem nenhuma detecção, porque a checagem de
--    conflito só disparava quando `p_base_updated_at` não era nulo (ver
--    migration 20260909140000, comentário "sem base conhecida... procede
--    normalmente" — esse é EXATAMENTE o buraco: as duas primeiras criações
--    concorrentes sempre têm base nula, por definição, pois nenhum dos dois
--    dispositivos nunca leu uma versão do servidor).
--
-- 2. `save_simulado_session`: a guarda de estado terminal (`completed_at`
--    já preenchido) era lida ANTES do `insert ... on conflict`. O `on
--    conflict do update` em si serializa a ESCRITA (o Postgres bloqueia a
--    segunda transação na violação de chave até a primeira commitar), mas
--    NUNCA reavalia a guarda de negócio que já tinha sido lida antes —
--    então a segunda transação, liberada depois do lock implícito do índice,
--    aplicava seu próprio `completed_at` sem saber que a primeira já tinha
--    fechado a sessão.
--
-- Correção adotada para os dois: `pg_advisory_xact_lock`, derivado de um hash
-- da chave lógica (usuário + alvo), adquirido como a PRIMEIRA coisa que a
-- função faz — antes de qualquer leitura de estado. Por quê isto serializa de
-- verdade (não é otimista, não depende de nenhuma corrida ganhar por sorte):
--   - `pg_advisory_xact_lock` é uma exclusão mútua real do Postgres: uma
--     segunda transação pedindo a MESMA chave literalmente pausa (bloqueia no
--     scheduler) até a primeira liberar o lock — o que só acontece no
--     COMMIT/ROLLBACK da transação que o pediu. Cada chamada de RPC via
--     PostgREST é sua própria transação, então "a transação termina" aqui
--     significa "a chamada RPC completa" — nunca fica preso entre chamadas.
--   - Como a leitura de estado (existe linha? está terminal?) só acontece
--     DEPOIS de adquirir o lock, a segunda chamada nunca lê um estado
--     "desatualizado por definição" (a foto de antes da primeira decidir) —
--     ela só prossegue depois que a primeira já commitou por completo, e lê
--     o estado real e final que a primeira deixou.
--   - `hashtextextended(chave, 0)` reduz a chave lógica (texto arbitrário) a
--     um bigint determinístico — mesma chave lógica sempre produz o mesmo
--     lock id, chaves diferentes (usuários/alvos diferentes) quase nunca
--     colidem (64 bits) e, mesmo numa colisão de hash rara, o pior caso é
--     serialização "de mais" (duas chaves diferentes disputando o mesmo
--     lock por acidente) — nunca menos.
--
-- Consequência observável para notas: duas primeiras criações concorrentes
-- da mesma nota lógica com textos DIFERENTES agora NUNCA resultam em uma
-- sobrescrevendo a outra silenciosamente — a segunda (a que esperou o lock)
-- sempre recebe `conflict: true` e o texto da primeira, para fundir no
-- cliente (ver correção em src/services/syncHandlers.ts, mesmo prompt). Isso
-- é uma MUDANÇA DE COMPORTAMENTO deliberada em relação ao 07-E2 (que tratava
-- `p_base_updated_at is null` como "sempre sobrescreve, sem checar") — a
-- diretoria julgou esse comportamento anterior como o próprio risco a
-- corrigir, não um efeito colateral aceitável.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Notas: lock da chave lógica antes de qualquer leitura
-- ----------------------------------------------------------------------------

create or replace function public.upsert_note(
  p_material_id uuid default null,
  p_material_section_id uuid default null,
  p_question_id uuid default null,
  p_flashcard_id uuid default null,
  p_note_text text default null,
  p_base_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lock_key bigint;
  v_existing record;
  v_final_text text;
  v_final_updated_at timestamptz;
begin
  if app.current_profile_status(v_uid) is distinct from 'active' then
    raise exception 'apenas estudantes ativos podem gravar notas';
  end if;
  if num_nonnulls(p_material_id, p_material_section_id, p_question_id, p_flashcard_id) <> 1 then
    raise exception 'informe exatamente um alvo para a nota';
  end if;
  if p_note_text is null then
    raise exception 'note_text é obrigatório';
  end if;

  -- Adquire posse exclusiva da chave lógica (usuário + alvo) ANTES de
  -- qualquer leitura — mesmo quando a linha ainda não existe. Liberado
  -- automaticamente ao fim desta chamada (commit da transação implícita da
  -- RPC). Ver cabeçalho da migration para a justificativa de serialização.
  v_lock_key := pg_catalog.hashtextextended(
    'note:' || v_uid::text || ':' ||
    coalesce(p_material_id::text, '') || ':' ||
    coalesce(p_material_section_id::text, '') || ':' ||
    coalesce(p_question_id::text, '') || ':' ||
    coalesce(p_flashcard_id::text, ''),
    0
  );
  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);

  -- Releitura do estado atual DEPOIS de adquirir o lock (nunca antes) — se
  -- outra chamada criou/alterou a linha enquanto esta esperava o lock, esta
  -- leitura já enxerga esse resultado committed. O `for update` é mantido
  -- como defesa em profundidade (qualquer escritor futuro que não passe por
  -- esta RPC ainda seria bloqueado por ele), embora o advisory lock acima já
  -- baste para serializar chamadas concorrentes a esta função.
  select id, note_text, updated_at into v_existing
  from public.notes
  where user_id = v_uid
    and material_id is not distinct from p_material_id
    and material_section_id is not distinct from p_material_section_id
    and question_id is not distinct from p_question_id
    and flashcard_id is not distinct from p_flashcard_id
  for update;

  -- Conflito real: a linha já existe com um texto DIFERENTE do que está
  -- sendo salvo agora, e este dispositivo:
  --   (a) tem uma base conhecida mais antiga que a versão atual do servidor
  --       (comportamento já existente desde o 07-E2), OU
  --   (b) NÃO tem base nenhuma conhecida (`p_base_updated_at` nulo) — bloqueio
  --       07-E3 #1: isto cobre exatamente as duas primeiras criações
  --       concorrentes para o mesmo alvo (as duas sempre partem de base
  --       nula, por definição — nenhum dos dois dispositivos jamais leu uma
  --       versão do servidor). Antes desta correção, base nula sempre
  --       sobrescrevia sem checar nada — o próprio risco que este prompt
  --       corrige.
  if v_existing.id is not null
     and v_existing.note_text is distinct from p_note_text
     and (p_base_updated_at is null or v_existing.updated_at > p_base_updated_at) then
    return jsonb_build_object(
      'conflict', true,
      'server_text', v_existing.note_text,
      'server_updated_at', v_existing.updated_at
    );
  end if;

  if v_existing.id is not null then
    update public.notes
    set note_text = p_note_text, updated_at = pg_catalog.clock_timestamp()
    where id = v_existing.id
    returning note_text, updated_at into v_final_text, v_final_updated_at;
  else
    insert into public.notes (user_id, material_id, material_section_id, question_id, flashcard_id, note_text, updated_at)
    values (v_uid, p_material_id, p_material_section_id, p_question_id, p_flashcard_id, p_note_text, pg_catalog.clock_timestamp())
    returning note_text, updated_at into v_final_text, v_final_updated_at;
  end if;

  return jsonb_build_object('conflict', false, 'note_text', v_final_text, 'updated_at', v_final_updated_at);
end;
$$;

revoke all on function public.upsert_note(uuid, uuid, uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.upsert_note(uuid, uuid, uuid, uuid, text, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Simulados: lock da chave lógica antes da guarda de estado terminal
-- ----------------------------------------------------------------------------

create or replace function public.save_simulado_session(p_session jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_simulation_id uuid := (p_session->>'id')::uuid;
  v_incoming_completed_at timestamptz := (p_session->>'completed_at')::timestamptz;
  v_lock_key bigint;
  v_existing record;
  v_question jsonb;
  v_answer jsonb;
  v_sq_id uuid;
  v_option_question_id uuid;
begin
  if app.current_profile_status(v_uid) is distinct from 'active' then
    raise exception 'apenas estudantes ativos podem gravar sessões de simulado';
  end if;
  if v_simulation_id is null then
    raise exception 'id da sessão de simulado é obrigatório';
  end if;

  -- Bloqueio 07-E3 #2: adquire posse exclusiva da chave lógica (usuário +
  -- sessão de simulado) ANTES de ler a guarda de estado terminal — nunca
  -- depois. O `insert ... on conflict do update` abaixo já serializava a
  -- ESCRITA em si (a segunda transação bloqueia na violação de índice até a
  -- primeira commitar), mas nunca reavaliava a guarda de negócio que já
  -- tinha sido lida antes de chegar lá. Com o lock adquirido primeiro, a
  -- segunda chamada só prossegue depois que a primeira tiver commitado POR
  -- COMPLETO (guarda + insert/update + substituição de perguntas/respostas),
  -- e a guarda abaixo lê o estado real e final que a primeira deixou — nunca
  -- uma foto de antes de qualquer decisão.
  v_lock_key := pg_catalog.hashtextextended('simulado:' || v_uid::text || ':' || v_simulation_id::text, 0);
  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);

  -- Só considera a linha existente se pertencer ao usuário autenticado — se
  -- pertencer a outro usuário, o `insert ... on conflict ... where user_id =
  -- v_uid` abaixo (inalterado desde o 07-E) já rejeita a gravação com o erro
  -- de ownership correto; não queremos que a guarda de estado terminal de
  -- OUTRO usuário influencie essa decisão nem vaze informação sobre a sessão
  -- de outro usuário.
  select completed_at into v_existing
  from public.simulations
  where id = v_simulation_id and user_id = v_uid
  for update;

  -- Estado terminal protegido: uma sessão já finalizada só aceita um reenvio
  -- EXATAMENTE igual (retry real depois de falha de rede — o cliente sempre
  -- reenvia o mesmo `completed_at` congelado no momento da finalização,
  -- nunca gera um novo). Qualquer `completed_at` diferente (inclusive nulo,
  -- ou seja "voltar a estar em andamento") é rejeitado — nunca sobrescreve
  -- silenciosamente um resultado já fechado.
  if v_existing.completed_at is not null
     and v_existing.completed_at is distinct from v_incoming_completed_at then
    raise exception 'sessao_ja_finalizada: esta sessão de simulado já foi finalizada em outro envio e não pode ser sobrescrita';
  end if;

  insert into public.simulations
    (id, user_id, name, config, started_at, completed_at, score, total_time_seconds)
  values (
    v_simulation_id,
    v_uid,
    coalesce(p_session->>'name', p_session->'config'->>'name', 'Simulado'),
    coalesce(p_session->'config', '{}'::jsonb),
    coalesce((p_session->>'started_at')::timestamptz, pg_catalog.now()),
    v_incoming_completed_at,
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
