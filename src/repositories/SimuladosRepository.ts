import { SimuladoSessionData } from '../types';
import { StorageService } from '../services/storage';
import { SupabaseSimuladosRepository } from './SupabaseSimuladosRepository';

export interface SimuladosRepository {
  getSimulados(): Promise<SimuladoSessionData[]>;
  saveSimuladoSession(session: SimuladoSessionData): Promise<void>;
  getSimuladoHistory(): Promise<SimuladoSessionData[]>;
}

// Não implementa mais `SimuladosRepository` (agora assíncrona) — mantida
// como código morto, documentado, sem uso pelo singleton (ver Etapa Fase 4-5 wiring).
class LocalStorageSimuladosRepository {
  getSimulados(): SimuladoSessionData[] {
    return StorageService.getSimulados();
  }
  saveSimuladoSession(session: SimuladoSessionData): void {
    StorageService.saveSimuladoSession(session);
  }
  getSimuladoHistory(): SimuladoSessionData[] {
    return StorageService.getSimuladoHistory();
  }
}

export const simuladosRepository: SimuladosRepository = new SupabaseSimuladosRepository();
