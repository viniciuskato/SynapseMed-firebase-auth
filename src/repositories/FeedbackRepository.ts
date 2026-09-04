import { UserFeedback } from '../types';
import { StorageService } from '../services/storage';

export interface FeedbackRepository {
  getFeedbacks(): UserFeedback[];
  saveFeedback(feedback: UserFeedback): void;
}

class LocalStorageFeedbackRepository implements FeedbackRepository {
  getFeedbacks(): UserFeedback[] {
    return StorageService.getFeedbacks();
  }
  saveFeedback(feedback: UserFeedback): void {
    StorageService.saveFeedback(feedback);
  }
}

export const feedbackRepository: FeedbackRepository = new LocalStorageFeedbackRepository();
