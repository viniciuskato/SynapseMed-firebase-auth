// ============================================================================
// syncQueue — fila persistente de operações pendentes de sincronização
// ============================================================================
//
// Substitui o padrão anterior "grava local, tenta espelhar no Supabase,
// engole erro em catch{}" (ver AGENTS.md, armadilha sobre Resilient*Repository)
// por uma fila com estado visível, retentativa com backoff e classificação de
// erro. Cada operação carrega um `clientOpId` (uuid) que o servidor usa como
// chave de idempotência — reenviar a mesma operação (retry, reload com fila
// pendente, reconciliação) nunca duplica o efeito no banco.
//
// Escopo desta entrega (Prompt 07-A): infraestrutura compartilhada + uso
// completo nas categorias de maior risco (tentativas de questão/XP,
// flashcards/SRS). Outras categorias (notas, favoritos, progresso de leitura,
// simulados, reações, feedback) ainda usam o padrão antigo — ver
// docs/SINCRONIZACAO-CONFIAVEL.md para o plano de migração.
//
// Isolamento por usuário: a fila é uma chave de localStorage por UID
// (`synapse_<uid>_sync_queue_v1`), no mesmo padrão de isolamento já usado por
// StorageService. Uma operação só é enviada enquanto o usuário ativo no
// momento do flush for o mesmo que a criou — login em outra conta no mesmo
// navegador nunca envia operação de outro usuário (ver `flush`).
// ============================================================================

export type SyncOpState = 'pending' | 'syncing' | 'synced' | 'failed';

export type SyncErrorKind = 'network' | 'auth' | 'permission' | 'validation' | 'schema' | 'unknown';

export interface SyncOp<TPayload = unknown> {
  id: string; // client_op_id — chave de idempotência enviada ao servidor
  userId: string;
  category: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
  state: SyncOpState;
  attempts: number;
  nextRetryAt?: string;
  lastError?: { kind: SyncErrorKind; message: string };
  result?: unknown; // último resultado bem-sucedido do servidor (para UI otimista convergir)
}

export interface SyncQueueSummary {
  pending: number;
  syncing: number;
  failed: number;
  failedNeedsLogin: boolean;
  failedNeedsSupport: number;
  synced: number;
  status: 'synced' | 'pending' | 'syncing' | 'error';
}

type Handler = (payload: any, clientOpId: string) => Promise<unknown>;

const MAX_RETRYABLE_ATTEMPTS = 8;
const SYNCED_RETENTION = 30; // mantém só as últimas N ops sincronizadas, para não crescer sem limite
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 10 * 60_000;

const handlers = new Map<string, Handler>();
const flushingUsers = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
const knownUserIds = new Set<string>();
let periodicTimerStarted = false;

function queueKey(userId: string): string {
  return `synapse_${userId}_sync_queue_v1`;
}

function loadQueue(userId: string): SyncOp[] {
  try {
    const raw = localStorage.getItem(queueKey(userId));
    return raw ? (JSON.parse(raw) as SyncOp[]) : [];
  } catch (e) {
    console.error('sync-queue: falha ao ler fila local', e);
    return [];
  }
}

function saveQueue(userId: string, ops: SyncOp[]): void {
  try {
    localStorage.setItem(queueKey(userId), JSON.stringify(ops));
  } catch (e) {
    console.error('sync-queue: falha ao gravar fila local', e);
  }
  notify(userId);
}

function notify(userId: string): void {
  listeners.get(userId)?.forEach((fn) => fn());
}

export function registerHandler(category: string, handler: Handler): void {
  handlers.set(category, handler);
}

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Classifica o erro para decidir a política de retentativa. Não usar a
 * mensagem bruta na interface — só a categoria.
 */
export function classifySyncError(err: any): SyncErrorKind {
  if (!err) return 'unknown';
  const msg = String(err?.message || err);
  const code = err?.code || err?.status;

  if (
    err?.name === 'AuthApiError' ||
    code === 401 ||
    code === 'PGRST301' ||
    /jwt|token expirado|not authenticated|refresh_token|invalid_grant/i.test(msg)
  ) {
    return 'auth';
  }
  if (code === '42501' || code === 403 || /permission denied|row-level security|RLS/i.test(msg)) {
    return 'permission';
  }
  if (
    code === 'PGRST204' ||
    code === 'PGRST202' ||
    /column .* does not exist|function .* does not exist|schema cache|relation .* does not exist/i.test(msg)
  ) {
    return 'schema';
  }
  if (
    code === 'P0001' ||
    code === '22P02' ||
    code === '23514' ||
    /apenas estudantes ativos|não pertence|inválid|excede o tamanho|fora do intervalo|não encontrada|não está publicada|invalid input syntax/i.test(
      msg
    )
  ) {
    return 'validation';
  }
  if (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    /failed to fetch|network|timeout|econnreset|load failed/i.test(msg)
  ) {
    return 'network';
  }
  return 'unknown';
}

function isRetryable(kind: SyncErrorKind): boolean {
  return kind === 'network' || kind === 'unknown';
}

export function needsLogin(op: SyncOp): boolean {
  return op.state === 'failed' && op.lastError?.kind === 'auth';
}

export function needsSupport(op: SyncOp): boolean {
  return op.state === 'failed' && (op.lastError?.kind === 'permission' || op.lastError?.kind === 'schema');
}

/** Enfileira uma operação e tenta sincronizar imediatamente (best-effort, não bloqueia quem chamou). */
export function enqueue<TPayload>(userId: string, category: string, payload: TPayload, clientOpId?: string): SyncOp<TPayload> {
  knownUserIds.add(userId);
  const now = new Date().toISOString();
  const op: SyncOp<TPayload> = {
    id: clientOpId ?? uuid(),
    userId,
    category,
    payload,
    createdAt: now,
    updatedAt: now,
    state: 'pending',
    attempts: 0,
  };
  const ops = loadQueue(userId);
  ops.push(op);
  saveQueue(userId, ops);
  void flush(userId);
  return op;
}

/**
 * Tenta uma operação imediatamente e devolve o resultado do servidor quando
 * bem-sucedido — usado por quem quer o resultado "de verdade" (ex.: gabarito
 * completo com bibliografia) em vez de só o otimista local. Se falhar, a
 * operação já fica na fila para reconciliação posterior; quem chamou recebe
 * `null` e deve usar o resultado local otimista.
 */
export async function enqueueAndTry<TPayload>(
  userId: string,
  category: string,
  payload: TPayload,
  clientOpId?: string
): Promise<unknown | null> {
  const op = enqueue(userId, category, payload, clientOpId);
  await flush(userId);
  const ops = loadQueue(userId);
  const settled = ops.find((o) => o.id === op.id);
  return settled?.state === 'synced' ? settled.result ?? null : null;
}

/** Reprocessa a fila pendente/retentável de um usuário. Sem efeito se outro flush já estiver em andamento para o mesmo usuário. */
export async function flush(userId: string): Promise<void> {
  if (!userId) return;
  if (flushingUsers.has(userId)) return;
  flushingUsers.add(userId);
  try {
    let ops = loadQueue(userId);
    let changed = false;
    const now = Date.now();

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.state === 'synced') continue;
      if (op.state === 'failed' && !isRetryable(op.lastError?.kind ?? 'unknown')) continue;
      if (op.nextRetryAt && new Date(op.nextRetryAt).getTime() > now) continue;

      const handler = handlers.get(op.category);
      if (!handler) continue; // categoria sem handler registrado nesta sessão (ex.: código antigo) — não trava a fila

      ops[i] = { ...op, state: 'syncing', updatedAt: new Date().toISOString() };
      changed = true;
      saveQueue(userId, ops);

      try {
        const result = await handler(op.payload, op.id);
        ops = loadQueue(userId);
        const idx = ops.findIndex((o) => o.id === op.id);
        if (idx >= 0) {
          ops[idx] = { ...ops[idx], state: 'synced', result, updatedAt: new Date().toISOString(), lastError: undefined };
        }
      } catch (err) {
        const kind = classifySyncError(err);
        ops = loadQueue(userId);
        const idx = ops.findIndex((o) => o.id === op.id);
        if (idx >= 0) {
          const attempts = ops[idx].attempts + 1;
          const retryable = isRetryable(kind) && attempts < MAX_RETRYABLE_ATTEMPTS;
          const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
          ops[idx] = {
            ...ops[idx],
            state: retryable ? 'pending' : 'failed',
            attempts,
            nextRetryAt: retryable ? new Date(Date.now() + backoff).toISOString() : undefined,
            lastError: { kind, message: String((err as any)?.message || err) },
            updatedAt: new Date().toISOString(),
          };
        }
        // Erro de auth: não adianta continuar tentando as próximas operações agora.
        if (kind === 'auth') {
          saveQueue(userId, pruneSynced(ops));
          return;
        }
      }
      saveQueue(userId, ops);
    }

    if (changed) saveQueue(userId, pruneSynced(loadQueue(userId)));
  } finally {
    flushingUsers.delete(userId);
  }
}

function pruneSynced(ops: SyncOp[]): SyncOp[] {
  const synced = ops.filter((o) => o.state === 'synced').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  if (synced.length <= SYNCED_RETENTION) return ops;
  const toDrop = new Set(synced.slice(0, synced.length - SYNCED_RETENTION).map((o) => o.id));
  return ops.filter((o) => !toDrop.has(o.id));
}

/** Marca uma operação com falha permanente para nova tentativa manual (botão "Tentar novamente"). */
export function retryFailedOp(userId: string, opId: string): void {
  const ops = loadQueue(userId);
  const idx = ops.findIndex((o) => o.id === opId);
  if (idx < 0) return;
  ops[idx] = { ...ops[idx], state: 'pending', nextRetryAt: undefined, attempts: 0 };
  saveQueue(userId, ops);
  void flush(userId);
}

export function retryAllFailed(userId: string): void {
  const ops = loadQueue(userId);
  let changed = false;
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].state === 'failed') {
      ops[i] = { ...ops[i], state: 'pending', nextRetryAt: undefined, attempts: 0 };
      changed = true;
    }
  }
  if (changed) saveQueue(userId, ops);
  void flush(userId);
}

export function getSummary(userId: string | null): SyncQueueSummary {
  if (!userId) return { pending: 0, syncing: 0, failed: 0, failedNeedsLogin: false, failedNeedsSupport: 0, synced: 0, status: 'synced' };
  const ops = loadQueue(userId);
  const pending = ops.filter((o) => o.state === 'pending').length;
  const syncing = ops.filter((o) => o.state === 'syncing').length;
  const failed = ops.filter((o) => o.state === 'failed').length;
  const failedNeedsLogin = ops.some(needsLogin);
  const failedNeedsSupport = ops.filter(needsSupport).length;
  const synced = ops.filter((o) => o.state === 'synced').length;
  let status: SyncQueueSummary['status'] = 'synced';
  if (syncing > 0) status = 'syncing';
  else if (failed > 0) status = 'error';
  else if (pending > 0) status = 'pending';
  return { pending, syncing, failed, failedNeedsLogin, failedNeedsSupport, synced, status };
}

export function getOps(userId: string): SyncOp[] {
  return loadQueue(userId);
}

export function subscribe(userId: string, listener: () => void): () => void {
  knownUserIds.add(userId);
  if (!listeners.has(userId)) listeners.set(userId, new Set());
  listeners.get(userId)!.add(listener);
  void flush(userId);
  return () => listeners.get(userId)?.delete(listener);
}

/**
 * Chamado pelo StorageService a cada troca de usuário ativo (login, logout,
 * troca de conta). Nunca envia a fila de um usuário sob a sessão de outro —
 * só dispara reconciliação para o UID que acabou de ficar ativo.
 */
export function onActiveUserChanged(userId: string | null): void {
  if (userId) {
    knownUserIds.add(userId);
    void flush(userId);
  }
}

function flushAllKnown(): void {
  knownUserIds.forEach((userId) => void flush(userId));
}

function startPeriodicReconciliation(): void {
  if (periodicTimerStarted || typeof window === 'undefined') return;
  periodicTimerStarted = true;

  window.addEventListener('online', flushAllKnown);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushAllKnown();
  });
  window.setInterval(flushAllKnown, 60_000);
}

startPeriodicReconciliation();
