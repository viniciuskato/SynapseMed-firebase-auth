import { StorageService } from '../services/storage';
import { SupabaseBookmarksRepository } from './SupabaseBookmarksRepository';

export interface BookmarksRepository {
  getBookmarks(): Promise<{
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  }>;
  toggleBookmark(type: 'questions' | 'compendiums' | 'flashcards', id: string): Promise<boolean>;
}

// Não implementa mais `BookmarksRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageBookmarksRepository {
  getBookmarks(): {
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  } {
    return StorageService.getBookmarks();
  }
  toggleBookmark(type: 'questions' | 'compendiums' | 'flashcards', id: string): boolean {
    return StorageService.toggleBookmark(type, id);
  }
}

export const bookmarksRepository: BookmarksRepository = new SupabaseBookmarksRepository();
