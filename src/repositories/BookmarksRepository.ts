import { StorageService } from '../services/storage';
import { SupabaseBookmarksRepository } from './SupabaseBookmarksRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface BookmarksRepository {
  getBookmarks(): Promise<{
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  }>;
  toggleBookmark(type: 'questions' | 'compendiums' | 'flashcards', id: string): Promise<boolean>;
}

class LocalStorageBookmarksRepository implements BookmarksRepository {
  async getBookmarks(): Promise<{
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  }> {
    return StorageService.getBookmarks();
  }
  async toggleBookmark(type: 'questions' | 'compendiums' | 'flashcards', id: string): Promise<boolean> {
    return StorageService.toggleBookmark(type, id);
  }
}

class ResilientBookmarksRepository implements BookmarksRepository {
  private supa = new SupabaseBookmarksRepository();
  private local = new LocalStorageBookmarksRepository();

  async getBookmarks(): Promise<{
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  }> {
    if (!isSupabaseConfigured) return this.local.getBookmarks();
    try {
      return await this.supa.getBookmarks();
    } catch {
      return this.local.getBookmarks();
    }
  }

  async toggleBookmark(type: 'questions' | 'compendiums' | 'flashcards', id: string): Promise<boolean> {
    const localRes = await this.local.toggleBookmark(type, id);
    if (isSupabaseConfigured) {
      try { return await this.supa.toggleBookmark(type, id); } catch {}
    }
    return localRes;
  }
}

export const bookmarksRepository: BookmarksRepository = new ResilientBookmarksRepository();
