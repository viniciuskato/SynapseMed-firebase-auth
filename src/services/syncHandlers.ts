// ============================================================================
// syncHandlers — registra, por categoria, como uma operação da fila
// (src/services/syncQueue.ts) é efetivamente enviada ao Supabase.
//
// Cada handler é responsável só pelo envio; classificação de erro e
// retentativa são genéricas (ver syncQueue.classifySyncError). Importado uma
// única vez (side-effect de registro) a partir de src/App.tsx.
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { registerHandler } from './syncQueue';
import { supabaseFlashcardsRepository } from '../repositories/SupabaseFlashcardsRepository';
import { QuestionAnswerRecord, ErrorLogItem, SimuladoSessionData } from '../types';

export interface QuestionAttemptOpPayload {
  questionId: string;
  selectedOption: QuestionAnswerRecord['selectedOption'];
  timeSpentSeconds: number;
  errorReason?: QuestionAnswerRecord['errorReason'];
  userNotes?: string;
  answerMode?: QuestionAnswerRecord['answerMode'];
  answerStrategy?: QuestionAnswerRecord['answerStrategy'];
}

export interface FlashcardReviewOpPayload {
  flashcardId: string;
  rating: 1 | 2 | 3 | 4;
}

export interface FlashcardUpsertOpPayload {
  flashcard: Parameters<typeof supabaseFlashcardsRepository.saveFlashcard>[0];
}

export interface FlashcardDeleteOpPayload {
  id: string;
}

export interface FlashcardSrsUpsertOpPayload {
  flashcardId: string;
  srs: Parameters<typeof supabaseFlashcardsRepository.updateFlashcardSRS>[1];
}

export type BookmarkType = 'questions' | 'compendiums' | 'flashcards';
export interface BookmarkSetOpPayload {
  type: BookmarkType;
  id: string;
  desired: boolean;
}

export interface ReadingProgressSetOpPayload {
  compendiumId: string;
  sectionId: string;
  isRead: boolean;
  totalSections: number;
}

export interface NoteUpsertOpPayload {
  targetId: string;
  noteText: string;
}

export interface ErrorNotebookUpdateOpPayload {
  errorItem: ErrorLogItem;
}

export interface SimuladoSaveOpPayload {
  session: SimuladoSessionData;
}

const BOOKMARK_COLUMN: Record<BookmarkType, 'question_id' | 'material_id' | 'flashcard_id'> = {
  questions: 'question_id',
  compendiums: 'material_id',
  flashcards: 'flashcard_id',
};

const NOTE_TARGET_TABLES: Array<{ table: string; column: 'material_id' | 'material_section_id' | 'question_id' | 'flashcard_id' }> = [
  { table: 'materials', column: 'material_id' },
  { table: 'material_sections', column: 'material_section_id' },
  { table: 'questions', column: 'question_id' },
  { table: 'flashcards', column: 'flashcard_id' },
];

async function resolveNoteColumn(targetId: string) {
  for (const { table, column } of NOTE_TARGET_TABLES) {
    const { data, error } = await supabase.from(table).select('id').eq('id', targetId).maybeSingle();
    if (error) throw error;
    if (data) return column;
  }
  throw new Error(`nota: não foi possível determinar o tipo de destino para targetId=${targetId}`);
}

let registered = false;

export function registerSyncHandlers(): void {
  if (registered) return;
  registered = true;

  registerHandler('question_attempt', async (payload: QuestionAttemptOpPayload, clientOpId) => {
    const { data: option, error: optErr } = await supabase
      .from('question_options')
      .select('id')
      .eq('question_id', payload.questionId)
      .eq('letter', payload.selectedOption)
      .single();
    if (optErr) throw optErr;

    const { data, error } = await supabase.rpc('submit_question_attempt', {
      p_question_id: payload.questionId,
      p_selected_option_id: option.id,
      p_time_spent_seconds: payload.timeSpentSeconds,
      p_error_reason: payload.errorReason ?? null,
      p_user_notes: payload.userNotes ?? null,
      p_answer_mode: payload.answerMode ?? null,
      p_answer_strategy: payload.answerStrategy ?? null,
      p_client_op_id: clientOpId,
    });
    if (error) throw error;
    return data;
  });

  registerHandler('flashcard_review', async (payload: FlashcardReviewOpPayload, clientOpId) => {
    const { data, error } = await supabase.rpc('submit_flashcard_review', {
      p_flashcard_id: payload.flashcardId,
      p_rating: payload.rating,
      p_client_op_id: clientOpId,
    });
    if (error) throw error;
    return data;
  });

  registerHandler('flashcard_upsert', async (payload: FlashcardUpsertOpPayload) => {
    return supabaseFlashcardsRepository.saveFlashcard(payload.flashcard);
  });

  registerHandler('flashcard_delete', async (payload: FlashcardDeleteOpPayload) => {
    await supabaseFlashcardsRepository.deleteFlashcard(payload.id);
    return null;
  });

  registerHandler('flashcard_srs_upsert', async (payload: FlashcardSrsUpsertOpPayload) => {
    await supabaseFlashcardsRepository.updateFlashcardSRS(payload.flashcardId, payload.srs);
    return null;
  });

  // Favoritos (categoria 5): contrato mudou de "toggle" (não seguro para
  // retry — reenviar depois de uma falha de rede podia inverter o estado
  // errado, ver AGENTS.md armadilha #14) para "set" explícito. O estado
  // desejado já foi decidido no cliente no momento do clique (antes de
  // qualquer chamada de rede); reenviar o MESMO `desired` é sempre um no-op
  // seguro, nunca um segundo toggle.
  registerHandler('bookmark_set', async (payload: BookmarkSetOpPayload) => {
    const column = BOOKMARK_COLUMN[payload.type];
    if (payload.desired) {
      // `bookmarks` usa índices únicos PARCIAIS (`where <coluna> is not
      // null`) — o upsert do PostgREST não consegue inferir um índice
      // parcial como alvo de ON CONFLICT (ver nota na migration de notas),
      // então garantimos idempotência checando existência antes de inserir,
      // em vez de upsert. Reenviar `desired: true` quando já existe é um
      // no-op seguro (nunca duplica: RLS + índice único barram, e o SELECT
      // prévio já evita a maioria das tentativas de duplicar).
      const { data: existing, error: selErr } = await supabase
        .from('bookmarks')
        .select('id')
        .eq(column, payload.id)
        .maybeSingle();
      if (selErr) throw selErr;
      if (existing) return null;

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const { error } = await supabase.from('bookmarks').insert({ user_id: userData.user?.id, [column]: payload.id });
      // Corrida real entre duas chamadas concorrentes: a segunda pode
      // colidir com o índice único mesmo depois do SELECT não encontrar
      // nada — tratado como sucesso (o estado desejado, "favoritado", já
      // está satisfeito), nunca propagado como erro de retry.
      if (error && error.code !== '23505') throw error;
    } else {
      const { error } = await supabase.from('bookmarks').delete().eq(column, payload.id);
      if (error) throw error;
    }
    return null;
  });

  // Progresso de leitura (categoria 6): mesma mudança de contrato de toggle
  // -> set explícito, mas o merge do array em si acontece no SERVIDOR
  // (RPC set_section_read, migration sync_reliability_categorias_3_a_7) —
  // nunca um array calculado no cliente a partir de um estado que pode já
  // estar desatualizado (dois dispositivos marcando seções diferentes não
  // podem se sobrescrever, ver docs/SINCRONIZACAO-CONFIAVEL.md).
  registerHandler('reading_progress_set', async (payload: ReadingProgressSetOpPayload) => {
    const { data, error } = await supabase.rpc('set_section_read', {
      p_material_id: payload.compendiumId,
      p_section_id: payload.sectionId,
      p_is_read: payload.isRead,
      p_total_sections: payload.totalSections,
    });
    if (error) throw error;
    return data;
  });

  // Notas (categoria 4): upsert real (single round-trip, atômico) em vez do
  // delete+insert anterior — ver índices únicos (sem `where`, de propósito —
  // compatíveis com onConflict do PostgREST) na mesma migration.
  // "Última gravação vence" é aceitável aqui pelo mesmo motivo documentado
  // para o conteúdo do flashcard: o próprio dono editando a própria nota,
  // sem edição concorrente esperada na prática.
  registerHandler('note_upsert', async (payload: NoteUpsertOpPayload) => {
    const column = await resolveNoteColumn(payload.targetId);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const { error } = await supabase
      .from('notes')
      .upsert(
        { user_id: userData.user?.id, [column]: payload.targetId, note_text: payload.noteText },
        { onConflict: `user_id,${column}` }
      );
    if (error) throw error;
    return null;
  });

  // Caderno de erros (categoria 3): só atualiza resolved/user_notes por id
  // (a linha em si é sempre derivada de submit_question_attempt — nunca
  // criada pelo cliente). Update por id é idempotente por natureza (reenviar
  // os mesmos valores tem o mesmo efeito) — só precisava de retry/visibilidade,
  // não de um `client_op_id` novo.
  registerHandler('error_notebook_update', async (payload: ErrorNotebookUpdateOpPayload) => {
    const { error } = await supabase
      .from('error_notebook')
      .update({ resolved: payload.errorItem.resolved, user_notes: payload.errorItem.userNotes })
      .eq('id', payload.errorItem.id);
    if (error) throw error;
    return null;
  });

  // Simulados (categoria 7): RPC transacional (save_simulado_session) — tudo
  // ou nada, idempotente por construção (substituição total do mesmo
  // payload sempre chega ao mesmo estado final), ver migration
  // sync_reliability_categorias_3_a_7.
  registerHandler('simulado_save', async (payload: SimuladoSaveOpPayload) => {
    const session = payload.session;
    const answerEntries = Object.entries(session.answers);

    // O estado local guarda a letra (A-E), a RPC espera o uuid real da
    // alternativa — resolvido aqui (mesma consulta que
    // SupabaseSimuladosRepository já fazia antes desta entrega).
    let optionIdByQuestionAndLetter = new Map<string, string>();
    if (answerEntries.length > 0) {
      const questionIds = answerEntries.map(([qid]) => qid);
      const { data: options, error: optErr } = await supabase
        .from('question_options')
        .select('id, question_id, letter')
        .in('question_id', questionIds);
      if (optErr) throw optErr;
      optionIdByQuestionAndLetter = new Map(
        (options ?? []).map((o) => [`${o.question_id}:${o.letter}`, o.id])
      );
    }

    const answers = answerEntries
      .map(([questionId, ans]) => ({
        question_id: questionId,
        selected_option_id: optionIdByQuestionAndLetter.get(`${questionId}:${ans.selectedOption}`),
        time_spent_seconds: ans.timeSpent,
      }))
      .filter((a) => !!a.selected_option_id);

    const { error } = await supabase.rpc('save_simulado_session', {
      p_session: {
        id: session.id,
        name: session.config?.name,
        config: session.config,
        started_at: session.startedAt,
        completed_at: session.completedAt ?? null,
        score: session.score ?? null,
        total_time_seconds: session.totalTimeSeconds,
        questions: session.questionIds.map((qid, i) => ({ question_id: qid, position: i })),
        answers,
      },
    });
    if (error) throw error;
    return null;
  });
}
