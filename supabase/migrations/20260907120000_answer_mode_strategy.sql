-- ----------------------------------------------------------------------------
-- Modo de resposta (recall livre vs. múltipla escolha) e estratégia de
-- resposta (como o estudante chegou à alternativa marcada), em toda
-- tentativa. Distinto de error_reason (por que errou, só se aplica a erro):
-- answer_strategy se aplica a toda resposta, certa ou errada.
-- ----------------------------------------------------------------------------

alter table public.question_attempts
  add column answer_mode text check (answer_mode in ('open_recall', 'multiple_choice'));

alter table public.question_attempts
  add column answer_strategy text check (answer_strategy in (
    'recognition', 'elimination', 'false_confidence', 'guess'
  ));

-- Recria submit_question_attempt com os dois parâmetros novos, opcionais e
-- default null (tentativas antigas não têm esse dado). Lógica de validação/
-- inserção existente permanece igual, só acomodando os campos novos.
-- A assinatura muda (dois parâmetros a mais), então o overload antigo
-- precisa ser removido explicitamente — "create or replace" não substitui
-- uma função de assinatura diferente, apenas adiciona um overload novo.
drop function if exists public.submit_question_attempt(uuid, uuid, int, text, text);

create or replace function public.submit_question_attempt(
  p_question_id uuid,
  p_selected_option_id uuid,
  p_time_spent_seconds int,
  p_error_reason text default null,
  p_user_notes text default null,
  p_answer_mode text default null,
  p_answer_strategy text default null
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
begin
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
     error_reason, user_notes, answer_mode, answer_strategy, answered_at)
  values
    (v_uid, p_question_id, p_selected_option_id, v_is_correct, p_time_spent_seconds,
     p_error_reason, p_user_notes, p_answer_mode, p_answer_strategy, pg_catalog.now());

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

revoke all on function public.submit_question_attempt(uuid, uuid, int, text, text, text, text) from public, anon;
grant execute on function public.submit_question_attempt(uuid, uuid, int, text, text, text, text) to authenticated;
