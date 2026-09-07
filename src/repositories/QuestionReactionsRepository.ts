import { QuestionReactionValue } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseQuestionReactionsRepository } from './SupabaseQuestionReactionsRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface QuestionReactionsRepository {
  getMyReaction(questionId: string): Promise<QuestionReactionValue | null>;
  setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void>;
  removeReaction(questionId: string): Promise<void>;
}

class LocalStorageQuestionReactionsRepository implements QuestionReactionsRepository {
  async getMyReaction(questionId: string): Promise<QuestionReactionValue | null> {
    return StorageService.getQuestionReactions()[questionId] ?? null;
  }
  async setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void> {
    StorageService.setQuestionReaction(questionId, reaction);
  }
  async removeReaction(questionId: string): Promise<void> {
    StorageService.removeQuestionReaction(questionId);
  }
}

class ResilientQuestionReactionsRepository implements QuestionReactionsRepository {
  private supa = new SupabaseQuestionReactionsRepository();
  private local = new LocalStorageQuestionReactionsRepository();

  async getMyReaction(questionId: string): Promise<QuestionReactionValue | null> {
    if (!isSupabaseConfigured) return this.local.getMyReaction(questionId);
    try {
      return await this.supa.getMyReaction(questionId);
    } catch {
      return this.local.getMyReaction(questionId);
    }
  }

  async setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void> {
    this.local.setReaction(questionId, reaction);
    if (isSupabaseConfigured) {
      try { await this.supa.setReaction(questionId, reaction); } catch {}
    }
  }

  async removeReaction(questionId: string): Promise<void> {
    this.local.removeReaction(questionId);
    if (isSupabaseConfigured) {
      try { await this.supa.removeReaction(questionId); } catch {}
    }
  }
}

export const questionReactionsRepository: QuestionReactionsRepository = new ResilientQuestionReactionsRepository();
