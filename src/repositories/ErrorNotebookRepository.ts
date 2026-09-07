import { ErrorLogItem } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseErrorNotebookRepository } from './SupabaseErrorNotebookRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface ErrorNotebookRepository {
  getErrorLogs(): Promise<ErrorLogItem[]>;
  updateErrorLog(errorItem: ErrorLogItem): Promise<void>;
}

class LocalStorageErrorNotebookRepository implements ErrorNotebookRepository {
  async getErrorLogs(): Promise<ErrorLogItem[]> {
    return StorageService.getErrorLogs();
  }
  async updateErrorLog(errorItem: ErrorLogItem): Promise<void> {
    StorageService.updateErrorLog(errorItem);
  }
}

class ResilientErrorNotebookRepository implements ErrorNotebookRepository {
  private supa = new SupabaseErrorNotebookRepository();
  private local = new LocalStorageErrorNotebookRepository();

  async getErrorLogs(): Promise<ErrorLogItem[]> {
    if (!isSupabaseConfigured) return this.local.getErrorLogs();
    try {
      return await this.supa.getErrorLogs();
    } catch {
      return this.local.getErrorLogs();
    }
  }

  async updateErrorLog(errorItem: ErrorLogItem): Promise<void> {
    this.local.updateErrorLog(errorItem);
    if (isSupabaseConfigured) {
      try { await this.supa.updateErrorLog(errorItem); } catch {}
    }
  }
}

export const errorNotebookRepository: ErrorNotebookRepository = new ResilientErrorNotebookRepository();
