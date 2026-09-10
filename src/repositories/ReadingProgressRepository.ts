import { StorageService, getStorageUser } from '../services/storage';
import { SupabaseReadingProgressRepository } from './SupabaseReadingProgressRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { enqueue } from '../services/syncQueue';
import { ReadingProgressSetOpPayload } from '../services/syncHandlers';

export interface ReadingProgressRepository {
  getReadingProgress(): Promise<Record<string, { readSectionIds: string[]; percent: number }>>;
  toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): Promise<number>;
}

class LocalStorageReadingProgressRepository implements ReadingProgressRepository {
  async getReadingProgress(): Promise<Record<string, { readSectionIds: string[]; percent: number }>> {
    return StorageService.getReadingProgress();
  }
  async toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): Promise<number> {
    return StorageService.toggleSectionRead(compendiumId, sectionId, totalSections);
  }
}

class ResilientReadingProgressRepository implements ReadingProgressRepository {
  private supa = new SupabaseReadingProgressRepository();
  private local = new LocalStorageReadingProgressRepository();

  async getReadingProgress(): Promise<Record<string, { readSectionIds: string[]; percent: number }>> {
    if (!isSupabaseConfigured) return this.local.getReadingProgress();
    try {
      return await this.supa.getReadingProgress();
    } catch {
      return this.local.getReadingProgress();
    }
  }

  async toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): Promise<number> {
    // Mesmo problema/solução dos favoritos: `toggleSectionRead` é um toggle
    // na interface, mas nunca pode ser reenviado como toggle ao servidor
    // (reenviar depois de uma falha marcaria/desmarcaria a seção errada). O
    // estado desejado (`isRead`) é decidido aqui, ANTES do toggle local, e é
    // isso que vira um "set" explícito na fila — o merge do array em si
    // acontece no servidor (RPC set_section_read), nunca um array calculado
    // localmente a partir de um progresso que outro dispositivo já pode ter
    // avançado (ver AGENTS.md armadilha #14 e docs/SINCRONIZACAO-CONFIAVEL.md).
    const currentProgress = await this.local.getReadingProgress();
    const wasRead = currentProgress[compendiumId]?.readSectionIds.includes(sectionId) ?? false;
    const desiredIsRead = !wasRead;

    const localPercent = await this.local.toggleSectionRead(compendiumId, sectionId, totalSections);

    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: ReadingProgressSetOpPayload = {
        compendiumId,
        sectionId,
        isRead: desiredIsRead,
        totalSections,
      };
      enqueue(userId, 'reading_progress_set', payload);
    }
    return localPercent;
  }
}

export const readingProgressRepository: ReadingProgressRepository = new ResilientReadingProgressRepository();
