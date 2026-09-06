import { UserFeedback } from '../types';
import { supabase } from '../lib/supabaseClient';
import { FeedbackRepository } from './FeedbackRepository';

// ============================================================================
// Fase 4-5 wiring — Supabase-backed FeedbackRepository
// ============================================================================
//
// `FeedbackRepository` foi convertida para assíncrona e esta classe passou a
// declarar `implements FeedbackRepository` e a ser o singleton
// `feedbackRepository` consumido pelo app.
//
// Mapeamento de campos (frontend <-> banco):
//
// UserFeedback <-> feedback
//   id <-> id | type <-> type | title <-> title | description <-> description
//   createdAt <-> created_at | userId <-> user_id
//
//   Campo do frontend SEM equivalente no schema atual (não persistido —
//   lacuna conhecida, não um bug de mapeamento):
//     userEmail (tabela `feedback` não tem coluna de e-mail; `getFeedbacks`
//     sempre devolve userEmail: null).
//
//   `saveFeedback` sempre grava user_id = usuário autenticado da sessão
//   atual, ignorando um `feedback.userId` eventualmente vindo de fora: a
//   policy `feedback_owner_insert` exige `user_id = auth.uid()`, então
//   qualquer outro valor falharia por RLS mesmo que fosse enviado.
// ============================================================================

interface FeedbackRow {
  id: string;
  user_id: string;
  type: UserFeedback['type'];
  title: string;
  description: string;
  created_at: string;
}

export class SupabaseFeedbackRepository implements FeedbackRepository {
  async getFeedbacks(): Promise<UserFeedback[]> {
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    return ((data ?? []) as FeedbackRow[]).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: null,
    }));
  }

  async saveFeedback(feedback: UserFeedback): Promise<void> {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;

    const { error } = await supabase.from('feedback').insert({
      id: feedback.id,
      user_id: userData.user?.id,
      type: feedback.type,
      title: feedback.title,
      description: feedback.description,
    });
    if (error) throw error;
  }
}

export const supabaseFeedbackRepository = new SupabaseFeedbackRepository();
