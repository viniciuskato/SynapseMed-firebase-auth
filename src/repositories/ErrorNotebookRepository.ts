import { ErrorLogItem } from '../types';
import { StorageService } from '../services/storage';

export interface ErrorNotebookRepository {
  getErrorLogs(): ErrorLogItem[];
  updateErrorLog(errorItem: ErrorLogItem): void;
}

class LocalStorageErrorNotebookRepository implements ErrorNotebookRepository {
  getErrorLogs(): ErrorLogItem[] {
    return StorageService.getErrorLogs();
  }
  updateErrorLog(errorItem: ErrorLogItem): void {
    StorageService.updateErrorLog(errorItem);
  }
}

export const errorNotebookRepository: ErrorNotebookRepository = new LocalStorageErrorNotebookRepository();
