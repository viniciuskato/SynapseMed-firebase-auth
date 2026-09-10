import { SimuladoSessionData } from '../types';
import { StorageService, getStorageUser } from '../services/storage';
import { SupabaseSimuladosRepository } from './SupabaseSimuladosRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { enqueue } from '../services/syncQueue';
import { SimuladoSaveOpPayload } from '../services/syncHandlers';

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
    // Grava local primeiro (nunca perde o resultado do simulado). Envio ao
    // Supabase passa pela fila e por uma RPC transacional
    // (`save_simulado_session`, migration sync_reliability_categorias_3_a_7)
    // em vez das 4 operações separadas sem transação de antes (upsert de
    // simulations + delete/insert de simulation_questions + insert de
    // simulation_answers) — uma falha entre essas etapas deixava o simulado
    // sem perguntas/respostas no servidor, sem erro visível (catch{}
    // silencioso) e sem retry. A RPC substitui tudo numa única transação
    // (tudo ou nada) e é idempotente por construção: reenviar o MESMO
    // payload sempre chega ao mesmo estado final (substituição total, não um
    // evento incremental) — não precisa de client_op_id para correção.
    this.local.saveSimuladoSession(session);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: SimuladoSaveOpPayload = { session };
      enqueue(userId, 'simulado_save', payload);
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
