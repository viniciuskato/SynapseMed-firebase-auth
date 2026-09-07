import { StorageService } from '../services/storage';
import { SupabaseNotesRepository } from './SupabaseNotesRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface NotesRepository {
  getNotes(): Promise<Record<string, string>>;
  saveNote(targetId: string, noteText: string): Promise<void>;
}

class LocalStorageNotesRepository implements NotesRepository {
  async getNotes(): Promise<Record<string, string>> {
    return StorageService.getNotes();
  }
  async saveNote(targetId: string, noteText: string): Promise<void> {
    StorageService.saveNote(targetId, noteText);
  }
}

class ResilientNotesRepository implements NotesRepository {
  private supa = new SupabaseNotesRepository();
  private local = new LocalStorageNotesRepository();

  async getNotes(): Promise<Record<string, string>> {
    if (!isSupabaseConfigured) return this.local.getNotes();
    try {
      return await this.supa.getNotes();
    } catch {
      return this.local.getNotes();
    }
  }

  async saveNote(targetId: string, noteText: string): Promise<void> {
    this.local.saveNote(targetId, noteText);
    if (isSupabaseConfigured) {
      try { await this.supa.saveNote(targetId, noteText); } catch {}
    }
  }
}

export const notesRepository: NotesRepository = new ResilientNotesRepository();
