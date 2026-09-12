import React from 'react';
import { ShieldAlert, Mail, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Tela exibida quando o perfil (`profiles.status`) está `blocked`, ou tem um
 * valor ausente/inesperado que não seja explicitamente `active`/`pending`.
 * Gate fail-closed: nenhum desses estados renderiza a aplicação normal,
 * mesmo para um perfil com `role === 'admin'`.
 */
export const BlockedAccountView: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const userEmail = user?.email || profile?.email || 'seu-email@exemplo.com';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 elev-xl p-6 sm:p-8 space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center elev-md shadow-rose-600/30">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800/60">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Acesso bloqueado</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Este perfil não tem acesso ao NexusMed no momento.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Seu acesso foi bloqueado pela moderação. Se você acredita que isso é um engano, entre em contato com o autor do projeto.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2.5 text-xs text-left">
          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate font-medium text-slate-700 dark:text-slate-300">{userEmail}</span>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
