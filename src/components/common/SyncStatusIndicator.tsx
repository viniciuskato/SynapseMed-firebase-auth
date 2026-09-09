import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSyncQueueStatus } from '../../hooks/useSyncQueueStatus';
import { retryAllFailed } from '../../services/syncQueue';

// ============================================================================
// Indicador discreto de sincronização (Prompt 07-A).
//
// Não mostra "salvo" quando só o localStorage recebeu o dado — os estados
// possíveis são: sincronizado (nada pendente), aguardando sincronização
// (pendente, sem erro), sincronizando (em voo) e falha (exige ação: relogar
// ou tentar novamente). Nunca expõe mensagem técnica/stack/id de registro.
// ============================================================================

export const SyncStatusIndicator: React.FC = () => {
  const { user } = useAuth();
  const status = useSyncQueueStatus(user?.id ?? null);
  const [open, setOpen] = useState(false);

  if (status.status === 'synced' && status.pending === 0 && status.failed === 0) {
    return null; // nada pendente: não polui a interface com "tudo certo" o tempo todo
  }

  const config = (() => {
    switch (status.status) {
      case 'syncing':
        return { icon: RefreshCw, spin: true, label: 'Sincronizando…', tone: 'text-sky-600 dark:text-sky-400' };
      case 'pending':
        return { icon: CloudOff, spin: false, label: 'Aguardando sincronização', tone: 'text-amber-600 dark:text-amber-400' };
      case 'error':
        return {
          icon: AlertTriangle,
          spin: false,
          label: status.failedNeedsLogin ? 'Faça login novamente para sincronizar' : 'Falha ao sincronizar — toque para tentar de novo',
          tone: 'text-rose-600 dark:text-rose-400',
        };
      default:
        return { icon: Check, spin: false, label: 'Sincronizado', tone: 'text-emerald-600 dark:text-emerald-400' };
    }
  })();

  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.tone} hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
        aria-label={config.label}
        title={config.label}
      >
        <Icon size={14} className={config.spin ? 'animate-spin' : ''} aria-hidden="true" />
        <span className="hidden sm:inline">{config.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg elev-md bg-[var(--surface,white)] dark:bg-slate-800 border border-black/5 dark:border-white/10 p-3 text-xs z-50">
          <p className="font-semibold mb-1 flex items-center gap-1"><Cloud size={14} /> Sincronização</p>
          <ul className="space-y-0.5 text-slate-600 dark:text-slate-300">
            {status.pending > 0 && <li>{status.pending} item(ns) aguardando envio</li>}
            {status.syncing > 0 && <li>{status.syncing} item(ns) sincronizando agora</li>}
            {status.failed > 0 && <li>{status.failed} item(ns) com falha</li>}
          </ul>
          {status.failedNeedsLogin && (
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              Sua sessão expirou. Saia e entre novamente para reenviar o que ficou pendente — nada foi perdido.
            </p>
          )}
          {status.failed > 0 && !status.failedNeedsLogin && (
            <button
              type="button"
              onClick={() => user && retryAllFailed(user.id)}
              className="mt-2 w-full rounded-md bg-sky-600 text-white py-1.5 font-medium hover:bg-sky-700"
            >
              Tentar novamente
            </button>
          )}
          {status.failedNeedsSupport > 0 && (
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Alguns itens não puderam ser enviados neste momento. Continue estudando normalmente — seu progresso local está preservado.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
