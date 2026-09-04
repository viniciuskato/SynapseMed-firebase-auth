import { Question } from '../types';
import { StorageService } from '../services/storage';

export interface QuestionsRepository {
  getQuestions(): Question[];
  saveQuestions(questions: Question[]): void;
  saveQuestion(question: Question): void;
  deleteQuestion(id: string): void;
  saveCustomQuestion(question: Question): void;
}

class LocalStorageQuestionsRepository implements QuestionsRepository {
  getQuestions(): Question[] {
    return StorageService.getQuestions();
  }
  saveQuestions(questions: Question[]): void {
    StorageService.saveQuestions(questions);
  }
  saveQuestion(question: Question): void {
    StorageService.saveQuestion(question);
  }
  deleteQuestion(id: string): void {
    StorageService.deleteQuestion(id);
  }
  saveCustomQuestion(question: Question): void {
    StorageService.saveCustomQuestion(question);
  }
}

export const questionsRepository: QuestionsRepository = new LocalStorageQuestionsRepository();
