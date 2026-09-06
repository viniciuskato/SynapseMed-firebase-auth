import { UserFeedback } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseFeedbackRepository } from './SupabaseFeedbackRepository';

export interface FeedbackRepository {
  getFeedbacks(): Promise<UserFeedback[]>;
  saveFeedback(feedback: UserFeedback): Promise<void>;
}

// Não implementa mais `FeedbackRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageFeedbackRepository {
  getFeedbacks(): UserFeedback[] {
    return StorageService.getFeedbacks();
  }
  saveFeedback(feedback: UserFeedback): void {
    StorageService.saveFeedback(feedback);
  }
}

export const feedbackRepository: FeedbackRepository = new SupabaseFeedbackRepository();
