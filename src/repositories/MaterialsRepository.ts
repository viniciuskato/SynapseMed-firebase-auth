import { Discipline, Theme, Compendium } from '../types';
import { StorageService } from '../services/storage';

export interface MaterialsRepository {
  getDisciplines(): Discipline[];
  saveDisciplines(disciplines: Discipline[]): void;
  getThemes(): Theme[];
  saveThemes(themes: Theme[]): void;
  getCompendiums(): Compendium[];
  saveCompendiums(compendiums: Compendium[]): void;
  saveCompendium(compendium: Compendium): void;
  deleteCompendium(id: string): void;
}

class LocalStorageMaterialsRepository implements MaterialsRepository {
  getDisciplines(): Discipline[] {
    return StorageService.getDisciplines();
  }
  saveDisciplines(disciplines: Discipline[]): void {
    StorageService.saveDisciplines(disciplines);
  }
  getThemes(): Theme[] {
    return StorageService.getThemes();
  }
  saveThemes(themes: Theme[]): void {
    StorageService.saveThemes(themes);
  }
  getCompendiums(): Compendium[] {
    return StorageService.getCompendiums();
  }
  saveCompendiums(compendiums: Compendium[]): void {
    StorageService.saveCompendiums(compendiums);
  }
  saveCompendium(compendium: Compendium): void {
    StorageService.saveCompendium(compendium);
  }
  deleteCompendium(id: string): void {
    StorageService.deleteCompendium(id);
  }
}

export const materialsRepository: MaterialsRepository = new LocalStorageMaterialsRepository();
