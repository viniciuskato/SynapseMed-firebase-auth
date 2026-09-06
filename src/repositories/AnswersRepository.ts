import { QuestionAnswerRecord } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseAnswersRepository } from './SupabaseAnswersRepository';

export interface AnswersRepository {
  getAnswers(): Promise<Record<string, QuestionAnswerRecord>>;
  recordAnswer(record: QuestionAnswerRecord): Promise<void>;
}

// Não implementa mais `AnswersRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageAnswersRepository {
  getAnswers(): Record<string, QuestionAnswerRecord> {
    return StorageService.getAnswers();
  }
  recordAnswer(record: QuestionAnswerRecord): void {
    StorageService.recordAnswer(record);
  }
}

export const answersRepository: AnswersRepository = new SupabaseAnswersRepository();
