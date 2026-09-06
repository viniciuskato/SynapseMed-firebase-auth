import React from 'react';
import { Clock, ShieldCheck, Mail, CheckCircle2, ArrowRight, LogOut, Users, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AwaitingApprovalViewProps {
  onReturnToLogin?: () => void;
}

/**
 * Tela visual de "Acesso aguardando aprovação" preparada para o fluxo privado futuro:
 * Cadastro → Confirmação de e-mail → Aguardando aprovação pelo moderador → Acesso liberado.
 * Atualmente mantida desacoplada para revisão prévia sem alterar regras ou fluxos de auth.
 */
export const AwaitingApprovalView: React.FC<AwaitingApprovalViewProps> = ({ onReturnToLogin }) => {
  const { user, profile, logout } = useAuth();
  const userEmail = user?.email || profile?.email || 'seu-email@exemplo.com';
  const userName = profile?.displayName || user?.user_metadata?.display_name || 'Colega';

  const handleLogout = async () => {
    if (onReturnToLogin) {
      onReturnToLogin();
    } else {
      await logout();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 space-y-6 text-center">
        {/* Brand Icon */}
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-900 dark:bg-[#d4924a] text-white dark:text-[#111010] flex items-center justify-center text-2xl font-serif-reading font-bold shadow-md">
          Ψ
        </div>

        {/* Title and Status Badge */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-800/60">
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
            <span>Beta Privada · Aguardando Aprovação</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Olá, {userName}! Seu cadastro foi recebido.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            O SynapseMed é uma biblioteca médica e ambiente de estudos restrito a um grupo seleto de convidados. Seu e-mail já foi validado e está em fila de autorização pela moderação.
          </p>
        </div>

        {/* Verified Email Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <Mail className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">{userEmail}</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> E-mail verificado
          </span>
        </div>

        {/* Step-by-Step Flow Explainer */}
        <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-left space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Fluxo de Acesso Seguro
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-teal-200 dark:border-teal-800 text-slate-700 dark:text-slate-200">
              <span className="font-bold block text-teal-700 dark:text-teal-400 text-[10px]">Passo 1</span>
              <span>Cadastro inicial</span>
              <span className="text-emerald-600 block text-[10px] font-bold mt-1">✓ Concluído</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-teal-200 dark:border-teal-800 text-slate-700 dark:text-slate-200">
              <span className="font-bold block text-teal-700 dark:text-teal-400 text-[10px]">Passo 2</span>
              <span>Confirmação e-mail</span>
              <span className="text-emerald-600 block text-[10px] font-bold mt-1">✓ Concluído</span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold shadow-xs">
              <span className="font-bold block text-amber-700 dark:text-amber-400 text-[10px]">Passo 3</span>
              <span>Moderação privada</span>
              <span className="text-amber-700 dark:text-amber-400 block text-[10px] font-bold mt-1">Em análise</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500">
              <span className="font-bold block text-[10px]">Passo 4</span>
              <span>Acesso liberado</span>
              <span className="block text-[10px] mt-1">Próxima etapa</span>
            </div>
          </div>
        </div>

        {/* Information box */}
        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span>Assim que o autor autorizar seu perfil, o acervo completo estará disponível.</span>
        </div>

        {/* Action Button */}
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
