import { Flashcard, FlashcardSRS, Question } from '../types';
import { StorageService, getStorageUser } from '../services/storage';
import { SupabaseFlashcardsRepository } from './SupabaseFlashcardsRepository';
import { enqueue, enqueueAndTry } from '../services/syncQueue';
import { FlashcardReviewOpPayload, FlashcardCreateFromQuestionOpPayload } from '../services/syncHandlers';

import { isSupabaseConfigured } from '../lib/supabaseClient';

interface FlashcardReviewRpcResult {
  interval_days: number;
  repetition_count: number;
  ease_factor: number;
  next_due_date: string;
  last_reviewed_date: string | null;
  state: FlashcardSRS['state'];
  reviewed_at: string;
  rating: 1 | 2 | 3 | 4;
}

function rpcResultToSRS(prev: FlashcardSRS, r: FlashcardReviewRpcResult): FlashcardSRS {
  return {
    intervalDays: r.interval_days,
    repetitionCount: r.repetition_count,
    easeFactor: Number(r.ease_factor),
    nextDueDate: r.next_due_date,
    lastReviewedDate: r.last_reviewed_date ?? undefined,
    state: r.state,
    reviewHistory: [...(prev.reviewHistory || []), { date: r.reviewed_at, rating: r.rating }],
  };
}

export interface FlashcardsRepository {
  getFlashcards(): Promise<Flashcard[]>;
  saveFlashcards(flashcards: Flashcard[]): Promise<void>;
  saveFlashcard(flashcard: Flashcard): Promise<Flashcard>;
  deleteFlashcard(id: string): Promise<void>;
  getDueFlashcards(): Promise<Flashcard[]>;
  updateFlashcardSRS(cardId: string, srs: any): Promise<void>;
  createFlashcardFromQuestion(question: Question): Promise<Flashcard>;
  reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Promise<Flashcard | null>;
}

class LocalStorageFlashcardsRepository implements FlashcardsRepository {
  async getFlashcards(): Promise<Flashcard[]> {
    return StorageService.getFlashcards();
  }
  async saveFlashcards(flashcards: Flashcard[]): Promise<void> {
    StorageService.saveFlashcards(flashcards);
  }
  async saveFlashcard(flashcard: Flashcard): Promise<Flashcard> {
    return StorageService.saveFlashcard(flashcard);
  }
  async deleteFlashcard(id: string): Promise<void> {
    StorageService.deleteFlashcard(id);
  }
  async getDueFlashcards(): Promise<Flashcard[]> {
    return StorageService.getDueFlashcards();
  }
  async updateFlashcardSRS(cardId: string, srs: any): Promise<void> {
    StorageService.updateFlashcardSRS(cardId, srs);
  }
  async createFlashcardFromQuestion(question: Question): Promise<Flashcard> {
    return StorageService.createFlashcardFromQuestion(question);
  }
  async reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Promise<Flashcard | null> {
    return StorageService.reviewFlashcard(cardId, rating);
  }
}

class ResilientFlashcardsRepository implements FlashcardsRepository {
  private supa = new SupabaseFlashcardsRepository();
  private local = new LocalStorageFlashcardsRepository();

  async getFlashcards(): Promise<Flashcard[]> {
    if (!isSupabaseConfigured) return this.local.getFlashcards();
    try {
      const res = await this.supa.getFlashcards();
      return res && res.length > 0 ? res : this.local.getFlashcards();
    } catch {
      return this.local.getFlashcards();
    }
  }

  // As gravações abaixo passam pela fila de sincronização (syncQueue): grava
  // local primeiro (nunca perde o card/estado do estudante), enfileira com
  // client_op_id idempotente e deixa retry/backoff/estado visível cuidarem do
  // resto — não é mais um catch{} silencioso. `saveFlashcard`/`deleteFlashcard`
  // já eram naturalmente idempotentes (upsert/delete por id gerado no
  // cliente); `reviewFlashcard` é o caso sensível a ordem/concorrência (ver
  // docs/SINCRONIZACAO-CONFIAVEL.md) e por isso usa uma RPC dedicada que
  // recalcula o SRS no servidor a partir do estado autoritativo atual.

  async saveFlashcards(flashcards: Flashcard[]): Promise<void> {
    this.local.saveFlashcards(flashcards);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      for (const f of flashcards) enqueue(userId, 'flashcard_upsert', { flashcard: f });
    }
  }

  async saveFlashcard(flashcard: Flashcard): Promise<Flashcard> {
    const localRes = await this.local.saveFlashcard(flashcard);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      enqueue(userId, 'flashcard_upsert', { flashcard });
    }
    return localRes;
  }

  async deleteFlashcard(id: string): Promise<void> {
    this.local.deleteFlashcard(id);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      enqueue(userId, 'flashcard_delete', { id });
    }
  }

  async getDueFlashcards(): Promise<Flashcard[]> {
    if (!isSupabaseConfigured) return this.local.getDueFlashcards();
    try {
      const res = await this.supa.getDueFlashcards();
      return res && res.length > 0 ? res : this.local.getDueFlashcards();
    } catch {
      return this.local.getDueFlashcards();
    }
  }

  async updateFlashcardSRS(cardId: string, srs: any): Promise<void> {
    // Só usado para ajustes administrativos de estado (não é um evento de
    // revisão auditável — isso é reviewFlashcard). Upsert direto na tabela de
    // estado, idempotente por natureza (chave primária = flashcard_id).
    this.local.updateFlashcardSRS(cardId, srs);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      enqueue(userId, 'flashcard_srs_upsert', { flashcardId: cardId, srs });
    }
  }

  async createFlashcardFromQuestion(question: Question): Promise<Flashcard> {
    // Deduplicação por questionOriginId (Prompt 11-A/11-B, gate 7 + 11-B2):
    // antes de criar, verifica se já existe um flashcard do usuário atual
    // com o mesmo `questionOriginId` — via `getFlashcards()` (traz do
    // Supabase quando configurado, com fallback local), para pegar também
    // um card já criado por OUTRO dispositivo e ainda sincronizado. Isso
    // cobre o caso comum (sequencial) sem round-trip extra, mas NÃO é
    // suficiente sob concorrência real — duas abas podem passar por este
    // `find` ao mesmo tempo e ambas verem "ausente" (corrida comprovada por
    // teste automatizado, ver docs/diretoria/retornos/11-B2.txt). A garantia
    // real é a RPC `create_flashcard_from_question` (11-B2): idempotente por
    // id (replay) e com unicidade autoritativa (user_id, question_origin_id)
    // no servidor via advisory lock + índice único — mesmo que este `find`
    // deixe passar duas criações concorrentes, a chamada ao servidor abaixo
    // sempre converge para o MESMO flashcard canônico, nunca duplica.
    const current = await this.getFlashcards();
    const existing = current.find((f) => f.questionOriginId === question.id);
    if (existing) return existing;

    const localRes = await this.local.createFlashcardFromQuestion(question);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: FlashcardCreateFromQuestionOpPayload = { flashcard: localRes };
      const serverResult = await enqueueAndTry(userId, 'flashcard_create_from_question', payload);
      if (serverResult) {
        const canonical = serverResult as Flashcard;
        if (canonical.id !== localRes.id) {
          // Perdemos a corrida: outra aba/dispositivo já tinha criado o
          // flashcard desta questão. Descarta o card local otimista (nunca
          // enviado como 'synced', então não aparece em nenhuma UI que
          // dependa do servidor) e persiste o canônico no lugar, para que
          // getFlashcards()/localStorage convirjam com o servidor.
          this.local.deleteFlashcard(localRes.id);
          await this.local.saveFlashcard(canonical);
        }
        return canonical;
      }
    }
    return localRes;
  }

  async reviewFlashcard(cardId: string, rating: 1 | 2 | 3 | 4): Promise<Flashcard | null> {
    const localRes = await this.local.reviewFlashcard(cardId, rating);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId && localRes) {
      const payload: FlashcardReviewOpPayload = { flashcardId: cardId, rating };
      const serverResult = await enqueueAndTry(userId, 'flashcard_review', payload);
      if (serverResult) {
        const converged: Flashcard = { ...localRes, srs: rpcResultToSRS(localRes.srs, serverResult as FlashcardReviewRpcResult) };
        this.local.saveFlashcard(converged);
        return converged;
      }
    }
    return localRes;
  }
}

export const flashcardsRepository: FlashcardsRepository = new ResilientFlashcardsRepository();
