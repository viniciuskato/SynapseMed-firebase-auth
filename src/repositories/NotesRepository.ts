import { StorageService } from '../services/storage';

export interface NotesRepository {
  getNotes(): Record<string, string>;
  saveNote(targetId: string, noteText: string): void;
}

class LocalStorageNotesRepository implements NotesRepository {
  getNotes(): Record<string, string> {
    return StorageService.getNotes();
  }
  saveNote(targetId: string, noteText: string): void {
    StorageService.saveNote(targetId, noteText);
  }
}

export const notesRepository: NotesRepository = new LocalStorageNotesRepository();
