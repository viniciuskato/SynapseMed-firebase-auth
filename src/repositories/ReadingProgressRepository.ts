import { StorageService } from '../services/storage';

export interface ReadingProgressRepository {
  getReadingProgress(): Record<string, { readSectionIds: string[]; percent: number }>;
  toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): number;
}

class LocalStorageReadingProgressRepository implements ReadingProgressRepository {
  getReadingProgress(): Record<string, { readSectionIds: string[]; percent: number }> {
    return StorageService.getReadingProgress();
  }
  toggleSectionRead(compendiumId: string, sectionId: string, totalSections: number): number {
    return StorageService.toggleSectionRead(compendiumId, sectionId, totalSections);
  }
}

export const readingProgressRepository: ReadingProgressRepository = new LocalStorageReadingProgressRepository();
