-- ============================================================================
-- Sincronização confiável entre dispositivos — Prompt 07-E2
-- Guardas de conflito para notas e simulados
-- ============================================================================
--
-- Revisão de código do commit 69f9c36 (07-E) encontrou dois riscos reais de
-- perda silenciosa que o prompt 07-E2 proíbe explicitamente:
--
-- 1. Notas: `note_upsert` (src/services/syncHandlers.ts) fazia um upsert
--    puro "última gravação vence" sem NENHUMA verificação de que o texto
--    atual no servidor era o mesmo que este dispositivo tinha visto por
--    último. Duas edições concorrentes da MESMA nota em dois dispositivos
--    (ex.: os dois offline ao mesmo tempo, cada um editando a partir do
--    mesmo texto original) resultavam na edição que sincronizasse por
--    último apagando silenciosamente a outra, sem o usuário nunca saber.
--    Corrigido com uma RPC (`upsert_note`) que recebe o `updated_at` que o
--    cliente conhecia como base (`p_base_updated_at`): se o servidor já
--    tiver uma versão mais nova E com texto diferente do que está sendo
--    salvo, a escrita NÃO é aplicada — as duas versões são preservadas (a
--    do servidor é devolvida ao cliente, que funde as duas com uma marcação
--    visível em vez de escolher uma e descartar a outra silenciosamente).
--    Não é um editor colaborativo em tempo real — é só a detecção mínima
--    de conflito pedida pelo prompt ("preservação das duas versões para
--    escolha").
--
-- 2. Simulados: `save_simulado_session` sobrescrevia a sessão inteira
--    (`on conflict (id) do update`) incondicionalmente, sem checar se a
--    sessão já estava em estado TERMINAL (completed_at preenchido). Um
--    rascunho atrasado de um dispositivo mais antigo (ex.: o estudante
--    terminou a prova no celular, mas o notebook — que ficou offline com a
--    mesma sessão em andamento — reconecta depois e reenvia seu próprio
--    "fim de prova" com resultado diferente) sobrescreveria silenciosamente
--    o resultado já fechado. Corrigido protegendo o estado terminal: uma
--    vez que `completed_at` está preenchido, só a MESMA gravação (idêntica,
--    replay de retry real) é aceita como no-op; qualquer tentativa de
--    gravar um `completed_at` diferente (ou nulo) depois disso é rejeitada
--    com um erro classificado como `validation` no cliente (permanente,
--    visível, sem retry infinito — ver `classifySyncError`,
--    `src/services/syncQueue.ts`), nunca uma sobrescrita silenciosa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Notas: upsert com detecção de conflito
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

  select id, note_text, updated_at into v_existing
  from public.notes
  where user_id = v_uid
    and material_id is not distinct from p_material_id
    and material_section_id is not distinct from p_material_section_id
    and question_id is not distinct from p_question_id
    and flashcard_id is not distinct from p_flashcard_id
  for update;

  -- Conflito real: este dispositivo tem uma base conhecida
  -- (`p_base_updated_at`, gravada na última leitura/escrita bem-sucedida),
  -- o servidor já tem uma versão MAIS NOVA que essa base, e o texto que o
  -- servidor tem é diferente do que está sendo salvo agora. Nunca decide
  -- sozinho qual vale — devolve as duas para o cliente preservar ambas.
  if v_existing.id is not null
     and p_base_updated_at is not null
     and v_existing.updated_at > p_base_updated_at
     and v_existing.note_text is distinct from p_note_text then
    return jsonb_build_object(
      'conflict', true,
      'server_text', v_existing.note_text,
      'server_updated_at', v_existing.updated_at
    );
  end if;

  if v_existing.id is not null then
    -- `clock_timestamp()` (tempo real do relógio), não `now()`
    -- (`transaction_timestamp()`, congelado no início da transação) — duas
    -- chamadas a esta função dentro da MESMA transação (ex.: suíte pgTAP
    -- inteira roda numa transação só) precisam de `updated_at` estritamente
    -- crescente para que a comparação de conflito acima funcione; em
    -- produção cada chamada de RPC já é sua própria transação, então isso
    -- também é o valor correto ali.
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
-- 2. Simulados: protege estado terminal (completed_at) de sobrescrita
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

  -- Só considera a linha existente se pertencer ao usuário autenticado —
  -- se pertencer a outro usuário, o `insert ... on conflict ... where
  -- user_id = v_uid` abaixo (inalterado desde o 07-E) já rejeita a
  -- gravação com o erro de ownership correto; não queremos que a guarda de
  -- estado terminal de OUTRO usuário influencie essa decisão nem vaze
  -- informação sobre a sessão de outro usuário.
  select completed_at into v_existing
  from public.simulations
  where id = v_simulation_id and user_id = v_uid
  for update;

  -- Estado terminal protegido: uma sessão já finalizada só aceita um
  -- reenvio EXATAMENTE igual (retry real depois de falha de rede — o
  -- cliente sempre reenvia o mesmo `completed_at` congelado no momento da
  -- finalização, nunca gera um novo). Qualquer `completed_at` diferente
  -- (inclusive nulo, ou seja "voltar a estar em andamento") é rejeitado —
  -- nunca sobrescreve silenciosamente um resultado já fechado (dispositivo
  -- antigo/rascunho atrasado terminando a mesma sessão depois de outro
  -- dispositivo já ter concluído).
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
