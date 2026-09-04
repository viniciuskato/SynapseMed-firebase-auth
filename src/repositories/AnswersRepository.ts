import { QuestionAnswerRecord } from '../types';
import { StorageService } from '../services/storage';

export interface AnswersRepository {
  getAnswers(): Record<string, QuestionAnswerRecord>;
  recordAnswer(record: QuestionAnswerRecord): void;
}

class LocalStorageAnswersRepository implements AnswersRepository {
  getAnswers(): Record<string, QuestionAnswerRecord> {
    return StorageService.getAnswers();
  }
  recordAnswer(record: QuestionAnswerRecord): void {
    StorageService.recordAnswer(record);
  }
}

export const answersRepository: AnswersRepository = new LocalStorageAnswersRepository();
