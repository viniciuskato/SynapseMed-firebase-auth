import { QuestionReactionValue } from '../types';
import { StorageService, getStorageUser } from '../services/storage';
import { SupabaseQuestionReactionsRepository } from './SupabaseQuestionReactionsRepository';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { enqueue } from '../services/syncQueue';
import { ReactionSetOpPayload } from '../services/syncHandlers';

export interface QuestionReactionsRepository {
  getMyReaction(questionId: string): Promise<QuestionReactionValue | null>;
  setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void>;
  removeReaction(questionId: string): Promise<void>;
}

class LocalStorageQuestionReactionsRepository implements QuestionReactionsRepository {
  async getMyReaction(questionId: string): Promise<QuestionReactionValue | null> {
    return StorageService.getQuestionReactions()[questionId] ?? null;
  }
  async setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void> {
    StorageService.setQuestionReaction(questionId, reaction);
  }
  async removeReaction(questionId: string): Promise<void> {
    StorageService.removeQuestionReaction(questionId);
  }
}

// Categoria 8 (reações) — Prompt 07-F. Contrato já era um "set" idempotente
// desde a criação (upsert por `unique (user_id, question_id)`, índice único
// COMUM, não parcial — ver AGENTS.md armadilha #14): reenviar o MESMO valor
// converge sempre para o mesmo estado, remover uma reação já removida nunca
// é erro. O que faltava era retry/visibilidade — antes desta correção, uma
// falha de rede em `setReaction`/`removeReaction` era engolida em `catch {}`
// sem nenhuma tentativa nova, deixando o servidor divergente do local
// indefinidamente. Agora o valor já decidido no cliente (nunca um toggle
// calculado a partir de leitura desatualizada — a UI decide o próximo estado
// ANTES de chamar este repositório) entra na fila de sincronização
// (`src/services/syncQueue.ts`), com o mesmo mecanismo de retry/backoff/
// reconciliação online já usado por favoritos/progresso de leitura.
class ResilientQuestionReactionsRepository implements QuestionReactionsRepository {
  private supa = new SupabaseQuestionReactionsRepository();
  private local = new LocalStorageQuestionReactionsRepository();

  async getMyReaction(questionId: string): Promise<QuestionReactionValue | null> {
    if (!isSupabaseConfigured) return this.local.getMyReaction(questionId);
    try {
      return await this.supa.getMyReaction(questionId);
    } catch {
      return this.local.getMyReaction(questionId);
    }
  }

  async setReaction(questionId: string, reaction: QuestionReactionValue): Promise<void> {
    this.local.setReaction(questionId, reaction);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: ReactionSetOpPayload = { questionId, reaction };
      enqueue(userId, 'reaction_set', payload);
    }
  }

  async removeReaction(questionId: string): Promise<void> {
    this.local.removeReaction(questionId);
    const userId = getStorageUser();
    if (isSupabaseConfigured && userId) {
      const payload: ReactionSetOpPayload = { questionId, reaction: null };
      enqueue(userId, 'reaction_set', payload);
    }
  }
}

export const questionReactionsRepository: QuestionReactionsRepository = new ResilientQuestionReactionsRepository();
