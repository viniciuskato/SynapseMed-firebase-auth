-- ============================================================================
-- Sincronização confiável entre dispositivos (Prompt 07-A)
-- ============================================================================
--
-- Problema: repositórios "Resilient*" gravavam local e tentavam espelhar no
-- Supabase engolindo erro em catch{} silencioso (ver AGENTS.md). Uma fila de
-- retentativa no cliente (src/services/syncQueue.ts) resolve a visibilidade
-- do erro, mas só é seguro reenviar automaticamente se o servidor for
-- idempotente por operação — do contrário, uma retentativa depois de um
-- timeout (que talvez já tenha sido aplicado no servidor) duplicaria a
-- tentativa de questão (infla XP) ou a revisão de flashcard (distorce o
-- histórico/agendamento do SRS).
--
-- Esta migration acrescenta uma chave de idempotência (`client_op_id`,
-- gerada no cliente por operação) às duas categorias de maior risco:
--
-- 1. question_attempts: `submit_question_attempt` passa a aceitar
--    `p_client_op_id` opcional; se a mesma chave já foi usada por este
--    usuário, devolve o resultado já calculado em vez de inserir de novo.
-- 2. flashcard_reviews: nova RPC `submit_flashcard_review` centraliza o que
--    antes eram duas escritas separadas feitas pelo cliente
--    (`flashcard_srs_state` + `flashcard_reviews`, calculando o próximo
--    estado do SM-2 no próprio navegador). Mover o cálculo para o servidor,
--    dentro de uma transação com `select ... for update`, resolve dois
--    problemas ao mesmo tempo: idempotência (client_op_id) e concorrência
--    (duas revisões do mesmo card offline em dispositivos diferentes deixam
--    de correr risco de sobrescrever uma à outra com "última gravação
--    vence" — cada uma é aplicada sobre o estado real e mais recente no
--    momento em que chega ao servidor, serializada pelo lock de linha).
--
-- Não altera o algoritmo SM-2 em si (só porta a lógica de
-- src/services/srsAlgorithm.ts para SQL) nem o formato dos dados existentes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. question_attempts: idempotência por (user_id, client_op_id)
-- ----------------------------------------------------------------------------

alter table public.question_attempts
  add column client_op_id uuid;

create unique index question_attempts_user_client_op_uq
  on public.question_attempts (user_id, client_op_id)
  where client_op_id is not null;

drop function if exists public.submit_question_attempt(uuid, uuid, int, text, text, text, text);

create or replace function public.submit_question_attempt(
  p_question_id uuid,
  p_selected_option_id uuid,
  p_time_spent_seconds int,
  p_error_reason text default null,
  p_user_notes text default null,
  p_answer_mode text default null,
  p_answer_strategy text default null,
  p_client_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question_status text;
  v_is_correct boolean;
  v_correct_option_id uuid;
  v_result jsonb;
  v_existing_id uuid;
begin
  -- Idempotência: se esta operação (mesmo usuário + mesmo client_op_id) já
  -- foi aplicada, devolve o resultado como se tivesse acabado de rodar, sem
  -- inserir de novo nem tocar error_notebook outra vez. Cobre o caso de a
  -- fila do cliente reenviar uma operação cuja resposta anterior se perdeu
  -- (timeout de rede, aba fechada durante a resposta).
  if p_client_op_id is not null then
    select id into v_existing_id
    from public.question_attempts
    where user_id = v_uid and client_op_id = p_client_op_id;

    if found then
      select qa.is_correct into v_is_correct
      from public.question_attempts qa
      where qa.id = v_existing_id;

      select qo.id into v_correct_option_id
      from public.question_options qo
      join public.question_option_keys qok on qok.option_id = qo.id
      where qo.question_id = p_question_id and qok.is_correct = true;

      select jsonb_build_object(
        'is_correct', v_is_correct,
        'correct_option_id', v_correct_option_id,
        'general_commentary', qak.general_commentary,
        'high_yield_summary', qak.high_yield_summary,
        'options', (
          select jsonb_agg(jsonb_build_object(
            'option_id', qo.id, 'letter', qo.letter,
            'is_correct', qok.is_correct, 'explanation', qok.explanation
          ) order by qo.sort_order)
          from public.question_options qo
          join public.question_option_keys qok on qok.option_id = qo.id
          where qo.question_id = p_question_id
        )
      ) into v_result
      from public.question_answer_keys qak
      where qak.question_id = p_question_id;

      return v_result;
    end if;
  end if;

  if app.current_profile_status(v_uid) is distinct from 'active' then
    raise exception 'apenas estudantes ativos podem responder questões';
  end if;

  if p_time_spent_seconds is null or p_time_spent_seconds < 0 or p_time_spent_seconds > 21600 then
    raise exception 'time_spent_seconds fora do intervalo permitido (0-21600)';
  end if;
  if length(coalesce(p_user_notes, '')) > 2000 then
    raise exception 'user_notes excede o tamanho máximo permitido (2000 caracteres)';
  end if;
  if p_error_reason is not null and p_error_reason not in
     ('lacuna_teorica', 'pegadinha', 'falta_atencao', 'tempo_esgotado', 'raciocinio_clinico')
  then
    raise exception 'error_reason inválido: %', p_error_reason;
  end if;
  if p_answer_mode is not null and p_answer_mode not in ('open_recall', 'multiple_choice') then
    raise exception 'answer_mode inválido: %', p_answer_mode;
  end if;
  if p_answer_strategy is not null and p_answer_strategy not in
     ('recognition', 'elimination', 'false_confidence', 'guess')
  then
    raise exception 'answer_strategy inválido: %', p_answer_strategy;
  end if;

  select status into v_question_status from public.questions where id = p_question_id;
  if not found then
    raise exception 'questão não encontrada: %', p_question_id;
  end if;
  if v_question_status <> 'published' then
    raise exception 'questão não está publicada';
  end if;

  if not exists (
    select 1 from public.question_options
    where id = p_selected_option_id and question_id = p_question_id
  ) then
    raise exception 'alternativa não pertence à questão informada';
  end if;

  select qok.is_correct into v_is_correct
  from public.question_option_keys qok
  where qok.option_id = p_selected_option_id;

  select qo.id into v_correct_option_id
  from public.question_options qo
  join public.question_option_keys qok on qok.option_id = qo.id
  where qo.question_id = p_question_id and qok.is_correct = true;

  insert into public.question_attempts
    (user_id, question_id, selected_option_id, is_correct, time_spent_seconds,
     error_reason, user_notes, answer_mode, answer_strategy, answered_at, client_op_id)
  values
    (v_uid, p_question_id, p_selected_option_id, v_is_correct, p_time_spent_seconds,
     p_error_reason, p_user_notes, p_answer_mode, p_answer_strategy, pg_catalog.now(), p_client_op_id);

  if not v_is_correct then
    insert into public.error_notebook
      (user_id, question_id, selected_option_id, correct_option_id, error_reason, user_notes, resolved)
    values
      (v_uid, p_question_id, p_selected_option_id, v_correct_option_id,
       coalesce(p_error_reason, 'lacuna_teorica'), coalesce(p_user_notes, ''), false);
  end if;

  select jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_option_id', v_correct_option_id,
    'general_commentary', qak.general_commentary,
    'high_yield_summary', qak.high_yield_summary,
    'options', (
      select jsonb_agg(jsonb_build_object(
        'option_id', qo.id, 'letter', qo.letter,
        'is_correct', qok.is_correct, 'explanation', qok.explanation
      ) order by qo.sort_order)
      from public.question_options qo
      join public.question_option_keys qok on qok.option_id = qo.id
      where qo.question_id = p_question_id
    )
  ) into v_result
  from public.question_answer_keys qak
  where qak.question_id = p_question_id;

  return v_result;
end;
$$;

revoke all on function public.submit_question_attempt(uuid, uuid, int, text, text, text, text, uuid) from public, anon;
grant execute on function public.submit_question_attempt(uuid, uuid, int, text, text, text, text, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. flashcard_reviews: idempotência por (flashcard_id, client_op_id) +
--    RPC submit_flashcard_review (SM-2 no servidor, atômico)
-- ----------------------------------------------------------------------------

alter table public.flashcard_reviews
  add column client_op_id uuid;

create unique index flashcard_reviews_card_client_op_uq
  on public.flashcard_reviews (flashcard_id, client_op_id)
  where client_op_id is not null;

create or replace function public.submit_flashcard_review(
  p_flashcard_id uuid,
  p_rating int,
  p_client_op_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_review_id uuid;
  v_srs record;
  v_interval_days int;
  v_repetition_count int;
  v_ease_factor numeric(4,2);
  v_state text;
  v_sm2_quality int;
  v_multiplier numeric;
  v_next_due_date date;
  v_reviewed_at timestamptz;
  v_result jsonb;
begin
  if p_rating is null or p_rating not in (1, 2, 3, 4) then
    raise exception 'rating inválido: deve ser 1, 2, 3 ou 4';
  end if;

  if not exists (
    select 1 from public.flashcards where id = p_flashcard_id and user_id = v_uid
  ) then
    raise exception 'flashcard não encontrado ou não pertence ao usuário';
  end if;

  -- Idempotência: reenviar a mesma revisão (client_op_id repetido) devolve o
  -- estado atual sem aplicar o SM-2 de novo nem duplicar o histórico.
  if p_client_op_id is not null then
    select id into v_existing_review_id
    from public.flashcard_reviews
    where flashcard_id = p_flashcard_id and client_op_id = p_client_op_id;

    if found then
      select interval_days, repetition_count, ease_factor, next_due_date, last_reviewed_date, state
        into v_srs
        from public.flashcard_srs_state
        where flashcard_id = p_flashcard_id;

      select reviewed_at into v_reviewed_at
        from public.flashcard_reviews
        where id = v_existing_review_id;

      return jsonb_build_object(
        'interval_days', v_srs.interval_days,
        'repetition_count', v_srs.repetition_count,
        'ease_factor', v_srs.ease_factor,
        'next_due_date', v_srs.next_due_date,
        'last_reviewed_date', v_srs.last_reviewed_date,
        'state', v_srs.state,
        'reviewed_at', v_reviewed_at,
        'rating', p_rating
      );
    end if;
  end if;

  -- Lock da linha de estado atual: serializa revisões concorrentes do mesmo
  -- card (duas abas, dois dispositivos reconciliando ao mesmo tempo) — a
  -- segunda revisão a chegar sempre parte do estado real deixado pela
  -- primeira, nunca sobrescreve com um cálculo baseado em dado velho.
  select interval_days, repetition_count, ease_factor, state
    into v_srs
    from public.flashcard_srs_state
    where flashcard_id = p_flashcard_id
    for update;

  if not found then
    insert into public.flashcard_srs_state (flashcard_id) values (p_flashcard_id);
    v_srs.interval_days := 0;
    v_srs.repetition_count := 0;
    v_srs.ease_factor := 2.5;
    v_srs.state := 'new';
  end if;

  v_interval_days := coalesce(v_srs.interval_days, 0);
  v_repetition_count := coalesce(v_srs.repetition_count, 0);
  v_ease_factor := coalesce(v_srs.ease_factor, 2.5);

  -- Porte de src/services/srsAlgorithm.ts (calculateNextSRS) — mesma escala
  -- 1-4 -> SM-2 0-5, mesmos limites de ease factor (1.3 a 3.0).
  v_sm2_quality := case p_rating when 1 then 1 when 2 then 3 when 3 then 4 else 5 end;

  if v_sm2_quality < 3 then
    v_repetition_count := 0;
    v_interval_days := 1;
    v_state := 'learning';
  else
    if v_repetition_count = 0 then
      v_interval_days := 1;
    elsif v_repetition_count = 1 then
      v_interval_days := case when p_rating = 4 then 4 else 2 end;
    else
      v_multiplier := case p_rating when 2 then 1.2 when 3 then v_ease_factor else v_ease_factor * 1.3 end;
      v_interval_days := round(v_interval_days * v_multiplier);
    end if;
    v_repetition_count := v_repetition_count + 1;
    v_state := case when v_interval_days >= 21 then 'mastered' else 'review' end;
  end if;

  v_ease_factor := v_ease_factor + (0.1 - (5 - v_sm2_quality) * (0.08 + (5 - v_sm2_quality) * 0.02));
  v_ease_factor := greatest(1.3, least(3.0, round(v_ease_factor, 2)));

  v_reviewed_at := pg_catalog.now();
  v_next_due_date := (v_reviewed_at::date) + v_interval_days;

  update public.flashcard_srs_state
  set interval_days = v_interval_days,
      repetition_count = v_repetition_count,
      ease_factor = v_ease_factor,
      next_due_date = v_next_due_date,
      last_reviewed_date = v_reviewed_at::date,
      state = v_state,
      updated_at = v_reviewed_at
  where flashcard_id = p_flashcard_id;

  insert into public.flashcard_reviews (flashcard_id, reviewed_at, rating, client_op_id)
  values (p_flashcard_id, v_reviewed_at, p_rating, p_client_op_id);

  return jsonb_build_object(
    'interval_days', v_interval_days,
    'repetition_count', v_repetition_count,
    'ease_factor', v_ease_factor,
    'next_due_date', v_next_due_date,
    'last_reviewed_date', v_reviewed_at::date,
    'state', v_state,
    'reviewed_at', v_reviewed_at,
    'rating', p_rating
  );
end;
$$;

revoke all on function public.submit_flashcard_review(uuid, int, uuid) from public, anon;
grant execute on function public.submit_flashcard_review(uuid, int, uuid) to authenticated;
