import { StorageService } from '../services/storage';
import { SupabaseReadingProgressRepository } from './SupabaseReadingProgressRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

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
    const localRes = await this.local.toggleSectionRead(compendiumId, sectionId, totalSections);
    if (isSupabaseConfigured) {
      try { return await this.supa.toggleSectionRead(compendiumId, sectionId, totalSections); } catch {}
    }
    return localRes;
  }
}

export const readingProgressRepository: ReadingProgressRepository = new ResilientReadingProgressRepository();
