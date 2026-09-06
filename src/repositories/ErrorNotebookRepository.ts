import { ErrorLogItem } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseErrorNotebookRepository } from './SupabaseErrorNotebookRepository';

export interface ErrorNotebookRepository {
  getErrorLogs(): Promise<ErrorLogItem[]>;
  updateErrorLog(errorItem: ErrorLogItem): Promise<void>;
}

// Não implementa mais `ErrorNotebookRepository` (agora assíncrona) — mantida
// como código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageErrorNotebookRepository {
  getErrorLogs(): ErrorLogItem[] {
    return StorageService.getErrorLogs();
  }
  updateErrorLog(errorItem: ErrorLogItem): void {
    StorageService.updateErrorLog(errorItem);
  }
}

export const errorNotebookRepository: ErrorNotebookRepository = new SupabaseErrorNotebookRepository();
