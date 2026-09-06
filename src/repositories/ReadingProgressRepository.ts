import { StorageService } from '../services/storage';
import { SupabaseReadingProgressRepository } from './SupabaseReadingProgressRepository';

export interface ReadingProgressRepository {
  getReadingProgress(): Promise<Record<string, { readSectionIds: string[]; percent: number }>>;
  toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): Promise<number>;
}

// Não implementa mais `ReadingProgressRepository` (agora assíncrona) —
// mantida como código morto, documentado, sem uso pelo singleton (ver Etapa
// Fase 4-5 wiring).
class LocalStorageReadingProgressRepository {
  getReadingProgress(): Record<string, { readSectionIds: string[]; percent: number }> {
    return StorageService.getReadingProgress();
  }
  toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): number {
    return StorageService.toggleSectionRead(compendiumId, sectionId, totalSections);
  }
}

export const readingProgressRepository: ReadingProgressRepository = new SupabaseReadingProgressRepository();
