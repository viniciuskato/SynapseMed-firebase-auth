import { StorageService, getStorageUser } from '../services/storage';
import { SupabaseBookmarksRepository } from './SupabaseBookmarksRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { enqueue } from '../services/syncQueue';
import { BookmarkSetOpPayload } from '../services/syncHandlers';

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
    // Favoritar/desfavoritar é um "toggle" na interface, mas NÃO pode ser
    // enviado ao servidor como toggle: reenviar a mesma operação depois de
    // uma falha de rede inverteria o estado errado (favoritou -> tenta de
    // novo pensando que falhou -> desfavorita). O toggle acontece só aqui,
    // localmente — o resultado (`desired`, o novo estado já decidido) é o
    // que entra na fila como um "set" explícito, idempotente por natureza:
    // reenviar o MESMO `desired` é sempre um no-op seguro. Ver AGENTS.md
    // armadilha #14 e docs/SINCRONIZACAO-CONFIAVEL.md.
    const desired = await this.local.toggleBookmark(type, id);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: BookmarkSetOpPayload = { type, id, desired };
      enqueue(userId, 'bookmark_set', payload);
    }
    return desired;
  }
}

export const bookmarksRepository: BookmarksRepository = new ResilientBookmarksRepository();
