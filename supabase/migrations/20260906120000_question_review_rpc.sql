-- ============================================================================
-- get_question_review: permite revisitar o gabarito de uma questão já
-- respondida (ex.: caderno de erros, revisão de simulado) sem reabrir
-- SELECT direto em question_option_keys/question_answer_keys (que
-- continuam sem policy de SELECT para estudante, ver
-- 20260903120100_rls_policies.sql linhas 319-321).
--
-- Diferente de submit_question_attempt, esta função NÃO insere em
-- question_attempts nem em error_notebook — é só leitura. O controle de
-- acesso é feito dentro da função (SECURITY DEFINER ignora RLS): só quem
-- já registrou ao menos uma tentativa para a questão, ou um admin ativo,
-- pode pedir a revelação de novo.
--
-- is_correct reflete a tentativa mais recente do próprio usuário para a
-- questão (null quando quem chama é admin sem tentativa própria).
-- ============================================================================

create or replace function public.get_question_review(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_correct boolean;
  v_correct_option_id uuid;
  v_result jsonb;
begin
  if not (
    exists (
      select 1 from public.question_attempts
      where question_id = p_question_id and user_id = v_uid
    )
    or app.is_admin_active(v_uid)
  ) then
    raise exception 'só é possível revisar questões já respondidas';
  end if;

  select qa.is_correct into v_is_correct
  from public.question_attempts qa
  where qa.question_id = p_question_id and qa.user_id = v_uid
  order by qa.answered_at desc
  limit 1;

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
end;
$$;

revoke all on function public.get_question_review(uuid) from public, anon;
grant execute on function public.get_question_review(uuid) to authenticated;
