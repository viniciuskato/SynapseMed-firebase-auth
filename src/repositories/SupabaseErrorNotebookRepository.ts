import { ErrorLogItem } from '../types';
import { supabase } from '../lib/supabaseClient';

// ============================================================================
// Fase 4 — Supabase-backed ErrorNotebookRepository
// ============================================================================
//
// Mesma observação de `SupabaseMaterialsRepository.ts`: não declara
// `implements ErrorNotebookRepository` porque essa interface é síncrona
// (localStorage) e uma implementação Supabase real é assíncrona por
// natureza. Os métodos espelham os nomes/parâmetros da interface original,
// retornando Promise<T> em vez de T. Não é usada pelo singleton
// `errorNotebookRepository` consumido pelo app.
//
// Mapeamento de campos (frontend <-> banco):
//
// ErrorLogItem <-> error_notebook (+ question_options para as letras)
//   id <-> id | questionId <-> question_id | timestamp <-> created_at
//   errorReason <-> error_reason | userNotes <-> user_notes
//   resolved <-> resolved
//   selectedOption/correctOption (letras) <-> resolvidas via
//     question_options.letter a partir de selected_option_id/correct_option_id
//     (error_notebook guarda uuids, não letras).
//
// LACUNAS / DECISÕES CONHECIDAS:
//  - INSERT em error_notebook está revogado de `authenticated` de propósito:
//    a única forma de uma linha existir é a RPC `submit_question_attempt`
//    (ver SupabaseAnswersRepository.ts). Esta classe nunca insere.
//  - UPDATE está restrito por GRANT de coluna a `resolved` e `user_notes`
//    apenas (rls_policies.sql linha ~907) — correct_option_id nunca pode ser
//    alterado pelo cliente. `updateErrorLog` só envia essas duas colunas.
// ============================================================================

interface ErrorNotebookRow {
  id: string;
  question_id: string;
  created_at: string;
  error_reason: ErrorLogItem['errorReason'];
  user_notes: string;
  resolved: boolean;
  selected_option_id: string;
  correct_option_id: string;
}

export class SupabaseErrorNotebookRepository {
  async getErrorLogs(): Promise<ErrorLogItem[]> {
    const { data, error } = await supabase
      .from('error_notebook')
      .select('id, question_id, created_at, error_reason, user_notes, resolved, selected_option_id, correct_option_id')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as ErrorNotebookRow[];
    if (rows.length === 0) return [];

    const optionIds = Array.from(new Set(rows.flatMap((r) => [r.selected_option_id, r.correct_option_id])));
    const { data: options, error: optErr } = await supabase
      .from('question_options')
      .select('id, letter')
      .in('id', optionIds);
    if (optErr) throw optErr;

    const letterById = new Map((options ?? []).map((o) => [o.id, o.letter]));

    return rows.map((r) => ({
      id: r.id,
      questionId: r.question_id,
      timestamp: r.created_at,
      selectedOption: letterById.get(r.selected_option_id) ?? '',
      correctOption: letterById.get(r.correct_option_id) ?? '',
      errorReason: r.error_reason,
      userNotes: r.user_notes,
      resolved: r.resolved,
    }));
  }

  async updateErrorLog(errorItem: ErrorLogItem): Promise<void> {
    const { error } = await supabase
      .from('error_notebook')
      .update({ resolved: errorItem.resolved, user_notes: errorItem.userNotes })
      .eq('id', errorItem.id);
    if (error) throw error;
  }
}

export const supabaseErrorNotebookRepository = new SupabaseErrorNotebookRepository();
