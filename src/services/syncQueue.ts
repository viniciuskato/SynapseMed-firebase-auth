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
// StorageService. Isso já impede um item da fila de A ser confundido com um
// item da fila de B (chaves de localStorage diferentes). O risco real
// corrigido em 07-B é outro: o cliente Supabase é um único objeto global
// autenticado com UMA sessão por vez — mesmo que a fila de A esteja
// corretamente isolada em localStorage, `flush(A)` chamando os handlers
// enquanto a sessão ativa no navegador é a de B enviaria a operação de A
// autenticada COMO B (RLS grava sob `auth.uid()` = B). Por isso `runFlush`
// verifica a sessão ativa do Supabase antes de cada operação (ver
// `getActiveSupabaseUserId`) — só processa a fila de um usuário quando ele é
// também o usuário autenticado no momento, e eventos periódicos
// (`flushAllKnown`) só tocam a fila do usuário ativo, nunca varrem todos os
// UIDs conhecidos indiscriminadamente.
// ============================================================================

import { supabase } from '../lib/supabaseClient';

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
const flushPromises = new Map<string, Promise<void>>();
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

/**
 * Fallback RFC 4122 v4 válido usando `crypto.getRandomValues` (disponível em
 * todo navegador com `crypto`, mesmo quando `crypto.randomUUID` não existe —
 * contextos não seguros/HTTPS antigos). Nunca usar `Math.random()` sozinho
 * aqui: as RPCs recebem `client_op_id` como coluna `uuid` do Postgres — um
 * identificador fora do formato (`op-<timestamp>-<random>`, como era antes)
 * é rejeitado pelo driver antes mesmo de chegar à validação do servidor.
 */
function uuidV4FromRandomValues(): string | null {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') return null;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Lança se nenhuma fonte criptográfica de aleatoriedade estiver disponível — nunca gera um id incompatível com a coluna `uuid`. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const fallback = uuidV4FromRandomValues();
  if (fallback) return fallback;
  throw new Error(
    'Não foi possível gerar um identificador de sincronização seguro (crypto indisponível neste navegador).'
  );
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

/**
 * Enfileira uma operação e dispara uma tentativa de sincronização em segundo
 * plano (best-effort, não bloqueia quem chamou). Quem precisa do resultado
 * real do servidor (ou de esperar a conclusão) deve usar `enqueueAndTry`.
 *
 * Se não houver fonte de aleatoriedade criptográfica disponível para gerar um
 * `client_op_id` válido (ver `uuid()`), a operação NÃO é persistida na fila —
 * enviar um id incompatível com a coluna `uuid` do Postgres seria pior que
 * não enviar nada. O dado local (gravado antes desta chamada, nos
 * repositórios) permanece intacto; só a tentativa de sincronização é perdida
 * e reportada com uma mensagem compreensível.
 */
export function enqueue<TPayload>(userId: string, category: string, payload: TPayload, clientOpId?: string): SyncOp<TPayload> {
  knownUserIds.add(userId);
  const now = new Date().toISOString();

  let id: string;
  try {
    id = clientOpId ?? uuid();
  } catch (e) {
    const failedOp: SyncOp<TPayload> = {
      id: '',
      userId,
      category,
      payload,
      createdAt: now,
      updatedAt: now,
      state: 'failed',
      attempts: 0,
      lastError: { kind: 'unknown', message: String((e as Error)?.message || e) },
    };
    console.error('sync-queue: operação não enfileirada (falha ao gerar client_op_id)', e);
    return failedOp;
  }

  const op: SyncOp<TPayload> = {
    id,
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
 * completo com bibliografia) em vez de só o otimista local.
 *
 * Espera especificamente pela CONCLUSÃO desta operação (não só por "um
 * flush terminar") — inclusive quando outra chamada já colocou um flush deste
 * usuário em andamento (`flush` deduplica por usuário e devolve a mesma
 * Promise para todo chamador concorrente; ver `flush`). Duas chamadas
 * concorrentes a `enqueueAndTry` para o mesmo usuário portanto sempre
 * recebem o resultado da SUA PRÓPRIA operação, nunca `null` só porque a
 * outra já estava em voo.
 *
 * Se a operação falhar de forma definitiva (validação/permissão/schema),
 * ficar retentável mas sem rede/sessão disponível, ou não concluir dentro do
 * prazo de espera, devolve `null` — quem chamou usa o resultado local
 * otimista já gravado; a fila continua tentando em segundo plano quando
 * aplicável.
 */
export async function enqueueAndTry<TPayload>(
  userId: string,
  category: string,
  payload: TPayload,
  clientOpId?: string,
  timeoutMs = 20_000
): Promise<unknown | null> {
  const op = enqueue(userId, category, payload, clientOpId);
  if (!op.id || op.state === 'failed') return null; // client_op_id não pôde ser gerado — nada a esperar

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await flush(userId);
    const settled = loadQueue(userId).find((o) => o.id === op.id);
    if (!settled) return null; // não deveria acontecer (pruneSynced preserva até synced ler o result) — defensivo
    if (settled.state === 'synced') return settled.result ?? null;
    if (settled.state === 'failed') return null; // falha permanente (validation/permission/schema) — não insistir
    // 'pending'/'syncing' aqui significa: offline, aguardando backoff, ou um
    // flush concorrente ainda processando outra operação antes da nossa —
    // continuar tentando até o prazo, sem busy-loop apertado.
    if (settled.nextRetryAt && new Date(settled.nextRetryAt).getTime() > Date.now()) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break; // offline: não adianta insistir agora
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return null; // timeout/offline — fila preserva a operação para reconciliação posterior
}

/** UID autenticado no Supabase agora, ou `null` (sem sessão, sessão expirada, ou erro ao consultar). */
async function getActiveSupabaseUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session.user.id;
  } catch {
    return null;
  }
}

/**
 * Reprocessa a fila pendente/retentável de um usuário. Deduplica por
 * usuário: se já existe um flush em andamento para este `userId`, devolve a
 * MESMA Promise em vez de retornar imediatamente sem esperar — isso é o que
 * corrige `enqueueAndTry` retornando cedo quando um flush concorrente já
 * estava em voo (bloqueio 1). A dedupe é feita de forma síncrona (função não
 * `async`, `Promise` registrada no Map antes de qualquer `await`) para que
 * duas chamadas a `flush(userId)` no mesmo tick (ex.: `enqueue` disparando
 * `void flush(userId)` e, em seguida, `enqueueAndTry` chamando `flush`
 * de novo) sempre observem a mesma entrada no Map.
 */
export function flush(userId: string): Promise<void> {
  if (!userId) return Promise.resolve();
  const existing = flushPromises.get(userId);
  if (existing) return existing;
  const p = runFlush(userId).finally(() => {
    flushPromises.delete(userId);
  });
  flushPromises.set(userId, p);
  return p;
}

async function runFlush(userId: string): Promise<void> {
  // Isolamento entre usuários (bloqueio 2): a fila de `userId` só pode ser
  // enviada enquanto ele for também o usuário autenticado no Supabase AGORA.
  // Isso é reavaliado a cada operação da fila (não só uma vez no início),
  // porque um logout pode acontecer no meio do processamento — uma operação
  // já em voo no momento do logout não é cancelada (o token já foi anexado à
  // requisição no envio; ver docs/SINCRONIZACAO-CONFIAVEL.md), mas nenhuma
  // operação SEGUINTE da fila é enviada depois que a sessão muda. A fila de
  // `userId` nunca é tocada/apagada/reatribuída quando a checagem falha — só
  // fica pendente para quando ele voltar a ser o usuário ativo.
  let ops = loadQueue(userId);
  let changed = false;
  const now = Date.now();

  // Qualquer operação encontrada em 'syncing' no INÍCIO de um flush é
  // resíduo de uma sessão anterior que recarregou/fechou a aba no meio do
  // envio (o estado 'syncing' só existe durante o `await handler(...)` logo
  // abaixo, nunca persiste entre execuções deste módulo) — nunca fica presa
  // indefinidamente. Reenviar é seguro mesmo se a primeira tentativa tiver
  // sido aplicada no servidor: as RPCs são idempotentes por `client_op_id`.
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].state === 'syncing') {
      ops[i] = { ...ops[i], state: 'pending', updatedAt: new Date().toISOString() };
      changed = true;
    }
  }
  if (changed) saveQueue(userId, ops);

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.state === 'synced') continue;
    if (op.state === 'failed' && !isRetryable(op.lastError?.kind ?? 'unknown')) continue;
    if (op.nextRetryAt && new Date(op.nextRetryAt).getTime() > now) continue;

    const handler = handlers.get(op.category);
    if (!handler) continue; // categoria sem handler registrado nesta sessão (ex.: código antigo) — não trava a fila

    const activeUserId = await getActiveSupabaseUserId();
    if (activeUserId !== userId) {
      // Sessão ativa não é mais (ou ainda não é) a dona desta fila — para de
      // processar esta fila agora, sem tocar em nenhuma operação. Nunca
      // reatribui `op.userId`, nunca marca como falha (não é um erro da
      // operação, é uma troca de sessão).
      return;
    }

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

/**
 * Chamada por eventos periódicos/globais (`online`, `visibilitychange`,
 * heartbeat) — nunca deve varrer todos os UIDs conhecidos no navegador
 * (bloqueio 2): consulta a sessão ativa do Supabase UMA vez e só dispara
 * `flush` para esse usuário, e só se ele tiver fila conhecida nesta sessão
 * de navegador. Usuários conhecidos que não são o ativo simplesmente não são
 * tocados por estes eventos — a fila deles só é reprocessada quando eles
 * voltarem a fazer login (`onActiveUserChanged`).
 */
async function flushAllKnown(): Promise<void> {
  const activeUserId = await getActiveSupabaseUserId();
  if (!activeUserId || !knownUserIds.has(activeUserId)) return;
  void flush(activeUserId);
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
