import { QuestionReviewResult } from '../types';

// Payload jsonb devolvido por submit_question_attempt e get_question_review
// (mesmo formato nas duas RPCs, ver 20260903120100_rls_policies.sql e
// 20260906120000_question_review_rpc.sql).
interface QuestionReviewPayload {
  is_correct: boolean;
  correct_option_id: string;
  general_commentary: string;
  high_yield_summary: string;
  options: {
    option_id: string;
    letter: string;
    is_correct: boolean;
    explanation: string;
  }[];
}

export function mapQuestionReviewPayload(payload: QuestionReviewPayload): QuestionReviewResult {
  return {
    isCorrect: payload.is_correct,
    correctOptionId: payload.correct_option_id,
    generalCommentary: payload.general_commentary ?? '',
    highYieldSummary: payload.high_yield_summary ?? '',
    options: (payload.options ?? []).map((o) => ({
      optionId: o.option_id,
      letter: o.letter as QuestionReviewResult['options'][number]['letter'],
      isCorrect: o.is_correct,
      explanation: o.explanation ?? '',
    })),
  };
}
