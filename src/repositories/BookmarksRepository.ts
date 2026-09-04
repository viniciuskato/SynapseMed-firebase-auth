import { StorageService } from '../services/storage';

export interface BookmarksRepository {
  getBookmarks(): {
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  };
  toggleBookmark(type: 'questions' | 'compendiums' | 'flashcards', id: string): boolean;
}

class LocalStorageBookmarksRepository implements BookmarksRepository {
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

export const bookmarksRepository: BookmarksRepository = new LocalStorageBookmarksRepository();
