import { QuestionReviewResult, QuestionReviewReference } from '../types';

// Payload jsonb devolvido por submit_question_attempt e get_question_review
// (mesmo formato nas duas RPCs, ver 20260903120100_rls_policies.sql,
// 20260906120000_question_review_rpc.sql e
// 20260907140000_question_references_in_review.sql — esta última acrescentou
// o campo `references`).
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
  references?: {
    source_id: string;
    citation_text: string;
    tipo: string;
    verificacao: string;
    identificadores?: Record<string, string> | null;
  }[];
}

// Constrói um link só a partir de um identificador reconhecido e presente —
// nunca inventa URL/DOI/página para uma fonte que não os tem.
export function urlFromIdentificadores(identificadores?: Record<string, string> | null): string | undefined {
  if (!identificadores) return undefined;
  if (identificadores.url) return identificadores.url;
  if (identificadores.doi) return `https://doi.org/${identificadores.doi}`;
  if (identificadores.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${identificadores.pmid}/`;
  if (identificadores.pmcid) return `https://www.ncbi.nlm.nih.gov/pmc/articles/${identificadores.pmcid}/`;
  return undefined;
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
    references: (payload.references ?? []).map(
      (r): QuestionReviewReference => ({
        sourceId: r.source_id,
        citationText: r.citation_text,
        tipo: r.tipo,
        verificacao: r.verificacao,
        url: urlFromIdentificadores(r.identificadores),
      })
    ),
  };
}
