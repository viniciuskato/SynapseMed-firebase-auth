import { QuestionAnswerRecord, QuestionReviewResult, Question } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseAnswersRepository } from './SupabaseAnswersRepository';

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
    const localResult = await this.local.recordAnswer(record);
    if (isSupabaseConfigured) {
      try {
        return await this.supa.recordAnswer(record);
      } catch {
        return localResult;
      }
    }
    return localResult;
  }
}

export const answersRepository: AnswersRepository = new ResilientAnswersRepository();
