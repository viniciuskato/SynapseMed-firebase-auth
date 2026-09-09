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
import { QuestionAnswerRecord } from '../types';

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
}
