import { Discipline, Theme, Compendium } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseMaterialsRepository } from './SupabaseMaterialsRepository';

export interface MaterialsRepository {
  getDisciplines(): Promise<Discipline[]>;
  saveDisciplines(disciplines: Discipline[]): Promise<void>;
  getThemes(): Promise<Theme[]>;
  saveThemes(themes: Theme[]): Promise<void>;
  getCompendiums(): Promise<Compendium[]>;
  saveCompendiums(compendiums: Compendium[]): Promise<void>;
  saveCompendium(compendium: Compendium): Promise<void>;
  deleteCompendium(id: string): Promise<void>;
}

// Não implementa mais `MaterialsRepository` (agora assíncrona) — mantida como
// código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageMaterialsRepository {
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

export const materialsRepository: MaterialsRepository = new SupabaseMaterialsRepository();
