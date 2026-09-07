import { UserFeedback } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseFeedbackRepository } from './SupabaseFeedbackRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface FeedbackRepository {
  getFeedbacks(): Promise<UserFeedback[]>;
  saveFeedback(feedback: UserFeedback): Promise<void>;
}

class LocalStorageFeedbackRepository implements FeedbackRepository {
  async getFeedbacks(): Promise<UserFeedback[]> {
    return StorageService.getFeedbacks();
  }
  async saveFeedback(feedback: UserFeedback): Promise<void> {
    StorageService.saveFeedback(feedback);
  }
}

class ResilientFeedbackRepository implements FeedbackRepository {
  private supa = new SupabaseFeedbackRepository();
  private local = new LocalStorageFeedbackRepository();

  async getFeedbacks(): Promise<UserFeedback[]> {
    if (!isSupabaseConfigured) return this.local.getFeedbacks();
    try {
      return await this.supa.getFeedbacks();
    } catch {
      return this.local.getFeedbacks();
    }
  }

  async saveFeedback(feedback: UserFeedback): Promise<void> {
    this.local.saveFeedback(feedback);
    if (isSupabaseConfigured) {
      try { await this.supa.saveFeedback(feedback); } catch {}
    }
  }
}

export const feedbackRepository: FeedbackRepository = new ResilientFeedbackRepository();
