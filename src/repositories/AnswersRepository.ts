import { QuestionAnswerRecord, QuestionReviewResult, Question } from '../types';
import { StorageService, getStorageUser } from '../services/storage';
import { SupabaseAnswersRepository } from './SupabaseAnswersRepository';
import { mapQuestionReviewPayload } from './questionReviewMapper';
import { enqueueAndTry } from '../services/syncQueue';
import { QuestionAttemptOpPayload } from '../services/syncHandlers';

import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface AnswersRepository {
  getAnswers(): Promise<Record<string, QuestionAnswerRecord>>;
  recordAnswer(record: QuestionAnswerRecord): Promise<QuestionReviewResult>;
}

class LocalStorageAnswersRepository implements AnswersRepository {
  async getAnswers(): Promise<Record<string, QuestionAnswerRecord>> {
    return StorageService.getAnswers();
  }
  async recordAnswer(record: QuestionAnswerRecord): Promise<QuestionReviewResult> {
    StorageService.recordAnswer(record);
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
      references: [], // LocalStorage não tem sources/question_references — não inventar.
    };
  }
}

class ResilientAnswersRepository implements AnswersRepository {
  private supa = new SupabaseAnswersRepository();
  private local = new LocalStorageAnswersRepository();

  async getAnswers(): Promise<Record<string, QuestionAnswerRecord>> {
    if (!isSupabaseConfigured) return this.local.getAnswers();
    try {
      return await this.supa.getAnswers();
    } catch {
      return this.local.getAnswers();
    }
  }

  async recordAnswer(record: QuestionAnswerRecord): Promise<QuestionReviewResult> {
    // Grava local primeiro (fonte de verdade otimista imediata — nunca perde a
    // resposta do estudante mesmo sem rede). O envio ao Supabase passa pela
    // fila de sincronização (src/services/syncQueue.ts): idempotente por
    // client_op_id, com retry/backoff e estado visível — não é mais um
    // catch{} silencioso. Ver docs/SINCRONIZACAO-CONFIAVEL.md.
    const localResult = await this.local.recordAnswer(record);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: QuestionAttemptOpPayload = {
        questionId: record.questionId,
        selectedOption: record.selectedOption,
        timeSpentSeconds: record.timeSpentSeconds,
        errorReason: record.errorReason,
        userNotes: record.userNotes,
        answerMode: record.answerMode,
        answerStrategy: record.answerStrategy,
      };
      const serverResult = await enqueueAndTry(userId, 'question_attempt', payload);
      if (serverResult) return mapQuestionReviewPayload(serverResult as Parameters<typeof mapQuestionReviewPayload>[0]);
    }
    return localResult;
  }
}

export const answersRepository: AnswersRepository = new ResilientAnswersRepository();
