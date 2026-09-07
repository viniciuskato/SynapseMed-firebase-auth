import { SimuladoSessionData } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseSimuladosRepository } from './SupabaseSimuladosRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export interface SimuladosRepository {
  getSimulados(): Promise<SimuladoSessionData[]>;
  saveSimuladoSession(session: SimuladoSessionData): Promise<void>;
  getSimuladoHistory(): Promise<SimuladoSessionData[]>;
}

class LocalStorageSimuladosRepository implements SimuladosRepository {
  async getSimulados(): Promise<SimuladoSessionData[]> {
    return StorageService.getSimulados();
  }
  async saveSimuladoSession(session: SimuladoSessionData): Promise<void> {
    StorageService.saveSimuladoSession(session);
  }
  async getSimuladoHistory(): Promise<SimuladoSessionData[]> {
    return StorageService.getSimuladoHistory();
  }
}

class ResilientSimuladosRepository implements SimuladosRepository {
  private supa = new SupabaseSimuladosRepository();
  private local = new LocalStorageSimuladosRepository();

  async getSimulados(): Promise<SimuladoSessionData[]> {
    if (!isSupabaseConfigured) return this.local.getSimulados();
    try {
      return await this.supa.getSimulados();
    } catch {
      return this.local.getSimulados();
    }
  }

  async saveSimuladoSession(session: SimuladoSessionData): Promise<void> {
    this.local.saveSimuladoSession(session);
    if (isSupabaseConfigured) {
      try { await this.supa.saveSimuladoSession(session); } catch {}
    }
  }

  async getSimuladoHistory(): Promise<SimuladoSessionData[]> {
    if (!isSupabaseConfigured) return this.local.getSimuladoHistory();
    try {
      return await this.supa.getSimuladoHistory();
    } catch {
      return this.local.getSimuladoHistory();
    }
  }
}

export const simuladosRepository: SimuladosRepository = new ResilientSimuladosRepository();
