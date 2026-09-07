import { Question, QuestionReviewResult } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseQuestionsRepository } from './SupabaseQuestionsRepository';

import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface QuestionsRepository {
  getQuestions(): Promise<Question[]>;
  saveQuestions(questions: Question[]): Promise<void>;
  saveQuestion(question: Question): Promise<void>;
  deleteQuestion(id: string): Promise<void>;
  saveCustomQuestion(question: Question): Promise<void>;
  getQuestionReview(questionId: string): Promise<QuestionReviewResult>;
  publishQuestion(id: string): Promise<void>;
  unpublishQuestion(id: string): Promise<void>;
}

class LocalStorageQuestionsRepository implements QuestionsRepository {
  async getQuestions(): Promise<Question[]> {
    return StorageService.getQuestions();
  }
  async saveQuestions(questions: Question[]): Promise<void> {
    StorageService.saveQuestions(questions);
  }
  async saveQuestion(question: Question): Promise<void> {
    StorageService.saveQuestion(question);
  }
  async deleteQuestion(id: string): Promise<void> {
    StorageService.deleteQuestion(id);
  }
  async saveCustomQuestion(question: Question): Promise<void> {
    StorageService.saveCustomQuestion(question);
  }
  async getQuestionReview(questionId: string): Promise<QuestionReviewResult> {
    const question = StorageService.getQuestions().find((q) => q.id === questionId);
    const options = question?.options ?? [];
    const correct = options.find((o) => o.isCorrect);
    return {
      isCorrect: true,
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
  async publishQuestion(_id: string): Promise<void> {}
  async unpublishQuestion(_id: string): Promise<void> {}
}

class ResilientQuestionsRepository implements QuestionsRepository {
  private supa = new SupabaseQuestionsRepository();
  private local = new LocalStorageQuestionsRepository();

  async getQuestions(): Promise<Question[]> {
    if (!isSupabaseConfigured) return this.local.getQuestions();
    try {
      const res = await this.supa.getQuestions();
      return res && res.length > 0 ? res : this.local.getQuestions();
    } catch {
      return this.local.getQuestions();
    }
  }

  async saveQuestions(questions: Question[]): Promise<void> {
    this.local.saveQuestions(questions);
    if (isSupabaseConfigured) {
      try { await this.supa.saveQuestions(questions); } catch {}
    }
  }

  async saveQuestion(question: Question): Promise<void> {
    this.local.saveQuestion(question);
    if (isSupabaseConfigured) {
      try { await this.supa.saveQuestion(question); } catch {}
    }
  }

  async deleteQuestion(id: string): Promise<void> {
    this.local.deleteQuestion(id);
    if (isSupabaseConfigured) {
      try { await this.supa.deleteQuestion(id); } catch {}
    }
  }

  async saveCustomQuestion(question: Question): Promise<void> {
    this.local.saveCustomQuestion(question);
    if (isSupabaseConfigured) {
      try { await this.supa.saveCustomQuestion(question); } catch {}
    }
  }

  async getQuestionReview(questionId: string): Promise<QuestionReviewResult> {
    if (!isSupabaseConfigured) return this.local.getQuestionReview(questionId);
    try {
      return await this.supa.getQuestionReview(questionId);
    } catch {
      return this.local.getQuestionReview(questionId);
    }
  }

  async publishQuestion(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try { await this.supa.publishQuestion(id); } catch {}
    }
  }

  async unpublishQuestion(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try { await this.supa.unpublishQuestion(id); } catch {}
    }
  }
}

export const questionsRepository: QuestionsRepository = new ResilientQuestionsRepository();
