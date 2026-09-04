import { SimuladoSessionData } from '../types';
import { StorageService } from '../services/storage';

export interface SimuladosRepository {
  getSimulados(): SimuladoSessionData[];
  saveSimuladoSession(session: SimuladoSessionData): void;
  getSimuladoHistory(): SimuladoSessionData[];
}

class LocalStorageSimuladosRepository implements SimuladosRepository {
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

export const simuladosRepository: SimuladosRepository = new LocalStorageSimuladosRepository();
