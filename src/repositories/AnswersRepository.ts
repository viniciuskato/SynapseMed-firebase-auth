import { QuestionAnswerRecord, QuestionReviewResult, Question } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseAnswersRepository } from './SupabaseAnswersRepository';

export interface AnswersRepository {
  getAnswers(): Promise<Record<string, QuestionAnswerRecord>>;
  recordAnswer(record: QuestionAnswerRecord): Promise<QuestionReviewResult>;
}

// Não implementa mais `AnswersRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageAnswersRepository {
  getAnswers(): Record<string, QuestionAnswerRecord> {
    return StorageService.getAnswers();
  }
  recordAnswer(record: QuestionAnswerRecord): QuestionReviewResult {
    StorageService.recordAnswer(record);
    // Sem RLS no localStorage: as opções da questão já têm isCorrect/explanation.
    const question: Question | undefined = StorageService.getQuestions().find(
      (q) => q.id === record.questionId
    );
    const options = question?.options ?? [];
    const correct = options.find((o) => o.isCorrect);
    return {
      isCorrect: record.isCorrect,
      correctOptionId: correct?.letter ?? '',
      generalCommentary: question?.generalCommentary ?? '',
      highYieldSummary: question?.highYieldSummary ?? '',
      options: options.map((o) => ({
        optionId: o.letter,
        letter: o.letter,
        isCorrect: o.isCorrect,
        explanation: o.explanation,
      })),
    };
  }
}

export const answersRepository: AnswersRepository = new SupabaseAnswersRepository();
