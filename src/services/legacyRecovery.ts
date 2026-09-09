// ============================================================================
// legacyRecovery — recuperação de progresso local anterior a esta entrega
// (Prompt 07-A, Etapa 5).
//
// Roda uma vez por usuário a cada login (chamado por StorageService.setActiveUser),
// e faz uma "simulação" antes de enviar: primeiro lê o que já existe no
// servidor, calcula o que é só local, e só então enfileira (nunca insere
// diretamente) — a fila (syncQueue) trata o resto: idempotência, retry,
// estado visível. Nunca apaga localStorage; um item marcado como "já
// verificado" (ledger local) simplesmente não é reexaminado nas próximas
// sessões, mesmo que o envio tenha falhado (a fila continua tentando).
//
// Limitação conhecida: só cobre as categorias já implementadas nesta etapa
// (tentativas de questão e flashcards custom com id compatível). Demais
// categorias permanecem sem recuperação automática — ver
// docs/SINCRONIZACAO-CONFIAVEL.md, Etapa 5.
// ============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { StorageService } from './storage';
import { enqueue } from './syncQueue';

interface RecoveryLedger {
  answers: string[];
  flashcards: string[];
}

function ledgerKey(uid: string): string {
  return `synapse_${uid}_sync_legacy_recovered_v1`;
}

function loadLedger(uid: string): RecoveryLedger {
  try {
    const raw = localStorage.getItem(ledgerKey(uid));
    if (!raw) return { answers: [], flashcards: [] };
    const parsed = JSON.parse(raw);
    return { answers: parsed.answers ?? [], flashcards: parsed.flashcards ?? [] };
  } catch {
    return { answers: [], flashcards: [] };
  }
}

function saveLedger(uid: string, ledger: RecoveryLedger): void {
  try {
    localStorage.setItem(ledgerKey(uid), JSON.stringify(ledger));
  } catch (e) {
    console.error('legacy-recovery: falha ao gravar ledger de recuperação', e);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recoverLegacyLocalProgress(uid: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const ledger = loadLedger(uid);
    let ledgerChanged = false;

    // --- Tentativas de questão respondidas offline/antes desta entrega ---
    const localAnswers = StorageService.getAnswers();
    const pendingAnswerIds = Object.keys(localAnswers).filter((id) => !ledger.answers.includes(id));

    if (pendingAnswerIds.length > 0) {
      const { data: remoteRows, error } = await supabase.from('question_attempts').select('question_id');
      if (error) throw error; // não marca o ledger se a checagem falhar — tenta de novo no próximo login

      const remoteIds = new Set((remoteRows ?? []).map((r: { question_id: string }) => r.question_id));
      for (const questionId of pendingAnswerIds) {
        if (!remoteIds.has(questionId)) {
          const record = localAnswers[questionId];
          enqueue(uid, 'question_attempt', {
            questionId,
            selectedOption: record.selectedOption,
            timeSpentSeconds: record.timeSpentSeconds ?? 0,
            errorReason: record.errorReason,
            userNotes: record.userNotes,
            answerMode: record.answerMode,
            answerStrategy: record.answerStrategy,
          });
        }
        ledger.answers.push(questionId);
        ledgerChanged = true;
      }
    }

    // --- Flashcards personalizados criados offline/antes desta entrega ---
    // Só cards com id em formato uuid (o schema exige); cards antigos criados
    // pelo LocalStorageFlashcardsRepository com id não-uuid não têm como ser
    // recuperados automaticamente sem duplicar sob um novo id — ficam
    // documentados como limitação, não descartados do localStorage.
    const localCustomCards = StorageService.getFlashcards().filter((f) => f.isCustom && UUID_RE.test(f.id));
    const pendingCards = localCustomCards.filter((f) => !ledger.flashcards.includes(f.id));

    if (pendingCards.length > 0) {
      const { data: remoteCards, error } = await supabase.from('flashcards').select('id');
      if (error) throw error;

      const remoteIds = new Set((remoteCards ?? []).map((r: { id: string }) => r.id));
      for (const card of pendingCards) {
        if (!remoteIds.has(card.id)) {
          enqueue(uid, 'flashcard_upsert', { flashcard: card });
        }
        ledger.flashcards.push(card.id);
        ledgerChanged = true;
      }
    }

    if (ledgerChanged) saveLedger(uid, ledger);
  } catch (err) {
    console.warn('legacy-recovery: falha ao verificar progresso local pendente (tentará no próximo login)', err);
  }
}
