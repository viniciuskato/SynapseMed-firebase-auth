import { Question } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseQuestionsRepository } from './SupabaseQuestionsRepository';

export interface QuestionsRepository {
  getQuestions(): Promise<Question[]>;
  saveQuestions(questions: Question[]): Promise<void>;
  saveQuestion(question: Question): Promise<void>;
  deleteQuestion(id: string): Promise<void>;
  saveCustomQuestion(question: Question): Promise<void>;
}

// Não implementa mais `QuestionsRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageQuestionsRepository {
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

export const questionsRepository: QuestionsRepository = new SupabaseQuestionsRepository();
