import { StorageService } from '../services/storage';
import { SupabaseNotesRepository } from './SupabaseNotesRepository';

export interface NotesRepository {
  getNotes(): Promise<Record<string, string>>;
  saveNote(targetId: string, noteText: string): Promise<void>;
}

// Não implementa mais `NotesRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageNotesRepository {
  getNotes(): Record<string, string> {
    return StorageService.getNotes();
  }
  saveNote(targetId: string, noteText: string): void {
    StorageService.saveNote(targetId, noteText);
  }
}

export const notesRepository: NotesRepository = new SupabaseNotesRepository();
