// ============================================================================
// legacyRecovery — recuperação de progresso local anterior a esta entrega
// (Prompt 07-A, Etapa 5; reconciliação por conteúdo corrigida no 07-B).
//
// Roda uma vez por usuário a cada login (chamado por StorageService.setActiveUser),
// e faz uma "simulação" antes de enviar: primeiro lê o que já existe no
// servidor, calcula o que é só local, e só então enfileira (nunca insere
// diretamente) — a fila (syncQueue) trata o resto: idempotência, retry,
// estado visível. Nunca apaga localStorage.
//
// Reconciliação de tentativas de questão (07-B): o servidor guarda um
// HISTÓRICO de tentativas por questão (múltiplas linhas legítimas), enquanto
// o local guarda só a última resposta por questão (sobrescreve). Por isso a
// presença de QUALQUER `question_attempts` remoto para a questão NÃO prova
// que a resposta local mais recente já foi sincronizada — comparamos
// alternativa selecionada + horário (com tolerância) + modo/estratégia
// quando disponíveis nos dois lados. Três desfechos possíveis por questão:
//   1. Nenhuma tentativa remota -> claramente não sincronizada -> enfileira.
//   2. Uma tentativa remota bate com a local -> já sincronizada -> marca
//      recuperada, não enfileira (evita duplicata).
//   3. Tentativas remotas existem mas nenhuma bate -> AMBÍGUO: pode ser uma
//      tentativa local distinta e legítima, ou uma comparação que falhou por
//      dado incompleto. Não decidimos por engano: preserva local, registra a
//      pendência (console.warn — sem UI dedicada nesta entrega) e NÃO marca
//      o ledger como concluído, para ser reexaminado no próximo login.
//
// Operação estável antes do envio: quando decidimos enfileirar (caso 1), o
// `client_op_id` gerado é salvo no ledger IMEDIATAMENTE após `enqueue()` —
// antes de qualquer outra iteração — para que uma interrupção entre
// "decidiu enfileirar" e "servidor confirmou" retome com o MESMO id em vez
// de gerar outro (o que duplicaria a tentativa no servidor). Reload/queda
// depois disso: o próximo login encontra a entrada em `pendingAnswerOps` e
// consulta o estado real da operação na fila (nunca re-decide do zero).
//
// Limitação conhecida: só cobre as categorias já implementadas nesta etapa
// (tentativas de questão e flashcards custom com id compatível). Demais
// categorias permanecem sem recuperação automática — ver
// docs/SINCRONIZACAO-CONFIAVEL.md, Etapa 5.
// ============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { StorageService } from './storage';
import { enqueue, getOps } from './syncQueue';
import { QuestionAnswerRecord } from '../types';

interface RecoveryLedger {
  answers: string[]; // question_id confirmado no servidor — nunca mais reexaminado
  flashcards: string[];
  pendingAnswerOps: Record<string, string>; // question_id -> client_op_id já enfileirado, ainda não confirmado
}

function ledgerKey(uid: string): string {
  return `synapse_${uid}_sync_legacy_recovered_v1`;
}

function loadLedger(uid: string): RecoveryLedger {
  try {
    const raw = localStorage.getItem(ledgerKey(uid));
    if (!raw) return { answers: [], flashcards: [], pendingAnswerOps: {} };
    const parsed = JSON.parse(raw);
    return {
      answers: parsed.answers ?? [],
      flashcards: parsed.flashcards ?? [],
      pendingAnswerOps: parsed.pendingAnswerOps ?? {},
    };
  } catch {
    return { answers: [], flashcards: [], pendingAnswerOps: {} };
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

// Tolerância de horário ao comparar a resposta local com uma tentativa
// remota: o timestamp local é gravado no momento da resposta no navegador, o
// remoto (`answered_at`) é `now()` no servidor no momento em que a fila
// conseguiu enviar — podem divergir por latência de rede/retry, nunca por
// mais que alguns minutos numa sincronização real.
const ATTEMPT_MATCH_WINDOW_MS = 5 * 60_000;

interface RemoteAttemptRow {
  question_id: string;
  answered_at: string;
  answer_mode: QuestionAnswerRecord['answerMode'] | null;
  answer_strategy: QuestionAnswerRecord['answerStrategy'] | null;
  question_options: { letter: string } | { letter: string }[] | null;
}

function extractLetter(joined: RemoteAttemptRow['question_options']): string | null {
  if (!joined) return null;
  if (Array.isArray(joined)) return joined[0]?.letter ?? null;
  return joined.letter ?? null;
}

function isSameAttempt(local: QuestionAnswerRecord, remote: RemoteAttemptRow): boolean {
  const remoteLetter = extractLetter(remote.question_options);
  if (!remoteLetter || remoteLetter !== local.selectedOption) return false;

  const localTs = Date.parse(local.timestamp);
  const remoteTs = Date.parse(remote.answered_at);
  if (!Number.isFinite(localTs) || !Number.isFinite(remoteTs)) return false;
  if (Math.abs(localTs - remoteTs) > ATTEMPT_MATCH_WINDOW_MS) return false;

  if (local.answerMode && remote.answer_mode && local.answerMode !== remote.answer_mode) return false;
  if (local.answerStrategy && remote.answer_strategy && local.answerStrategy !== remote.answer_strategy) return false;

  return true;
}

export async function recoverLegacyLocalProgress(uid: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const ledger = loadLedger(uid);
    let ledgerChanged = false;

    // --- Tentativas de questão respondidas offline/antes desta entrega ---
    const localAnswers = StorageService.getAnswers();
    const currentOps = getOps(uid);

    for (const questionId of Object.keys(localAnswers)) {
      if (ledger.answers.includes(questionId)) continue; // já confirmado no servidor, nunca reexaminar

      const pendingOpId = ledger.pendingAnswerOps[questionId];
      if (pendingOpId) {
        // Já decidimos enfileirar isto numa sessão anterior — nunca gerar
        // outro client_op_id, só consultar o estado real da operação.
        const op = currentOps.find((o) => o.id === pendingOpId);
        if (op?.state === 'synced') {
          ledger.answers.push(questionId);
          delete ledger.pendingAnswerOps[questionId];
          ledgerChanged = true;
        }
        // 'pending'/'syncing'/'failed': nada a fazer aqui — a fila já cuida
        // de retry (se retentável) ou já expõe a falha permanente na UI; não
        // reexaminamos nem reenfileiramos com id novo.
        continue;
      }

      const record = localAnswers[questionId];

      const { data: remoteRows, error } = await supabase
        .from('question_attempts')
        .select('question_id, answered_at, answer_mode, answer_strategy, question_options(letter)')
        .eq('question_id', questionId);
      if (error) continue; // não decide nem marca ledger se a consulta falhar — tenta de novo no próximo login

      const remote = (remoteRows ?? []) as unknown as RemoteAttemptRow[];

      if (remote.length === 0) {
        // Nenhuma tentativa remota para esta questão — claramente não sincronizada.
        const op = enqueue(uid, 'question_attempt', {
          questionId,
          selectedOption: record.selectedOption,
          timeSpentSeconds: record.timeSpentSeconds ?? 0,
          errorReason: record.errorReason,
          userNotes: record.userNotes,
          answerMode: record.answerMode,
          answerStrategy: record.answerStrategy,
        });
        if (op.id) {
          // Registra a operação estável ANTES de qualquer outra iteração —
          // uma interrupção depois disto retoma pelo ramo `pendingOpId` acima,
          // sem gerar client_op_id novo.
          ledger.pendingAnswerOps[questionId] = op.id;
          ledgerChanged = true;
          saveLedger(uid, ledger);
        }
        continue;
      }

      const match = remote.find((r) => isSameAttempt(record, r));
      if (match) {
        // Já existe no servidor uma tentativa equivalente — marca recuperada, não duplica.
        ledger.answers.push(questionId);
        ledgerChanged = true;
        continue;
      }

      // Tentativas remotas existem para a questão, mas nenhuma corresponde à
      // resposta local (alternativa/horário/modo diferentes). Pode ser uma
      // tentativa local distinta e legítima (múltiplas tentativas são
      // permitidas) ou uma comparação inconclusiva — não decidimos por
      // engano. Preserva local, registra a pendência, não marca o ledger.
      console.warn(
        `legacy-recovery: tentativa local da questão ${questionId} não corresponde a nenhuma tentativa remota existente — pendência ambígua preservada localmente para revisão (não enfileirada automaticamente, não marcada como recuperada).`,
        { local: record, remoteCount: remote.length }
      );
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
