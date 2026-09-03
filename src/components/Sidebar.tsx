import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Stethoscope,
  Layers,
  Timer,
  BookMarked,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Database,
} from 'lucide-react';
import { UserPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  currentPlan: UserPlan;
  onOpenPlanModal: () => void;
  errorLogCount: number;
  dueCardsCount: number;
  unansweredQuestionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  currentPlan,
  onOpenPlanModal,
  errorLogCount,
  dueCardsCount,
  unansweredQuestionsCount,
}) => {
  const mainNav = [
    {
      id: 'dashboard',
      label: 'Painel & Diagnóstico',
      icon: LayoutDashboard,
      badge: null,
      description: 'Evolução e rotas de revisão',
    },
    {
      id: 'compendiums',
      label: 'Compêndios Teóricos',
      icon: BookOpen,
      badge: 'Teoria & Guias',
      description: 'Mecanismos e diretrizes',
    },
    {
      id: 'questions',
      label: 'Banco de Questões',
      icon: HelpCircle,
      badge: unansweredQuestionsCount > 0 ? `${unansweredQuestionsCount} novas` : null,
      description: 'Comentadas alternativa por alternativa',
    },
    {
      id: 'clinical-cases',
      label: 'Casos Clínicos',
      icon: Stethoscope,
      badge: 'Interativo',
      description: 'Raciocínio diagnóstico passo a passo',
    },
    {
      id: 'flashcards',
      label: 'Flashcards SRS',
      icon: Layers,
      badge: dueCardsCount > 0 ? `${dueCardsCount} hoje` : null,
      badgeColor: 'bg-teal-500 text-white',
      description: 'Repetição espaçada inteligente',
    },
    {
      id: 'simulados',
      label: 'Simulados & Listas',
      icon: Timer,
      badge: null,
      description: 'Provas personalizadas e cronometradas',
    },
    {
      id: 'errors',
      label: 'Caderno de Erros',
      icon: BookMarked,
      badge: errorLogCount > 0 ? `${errorLogCount} itens` : null,
      badgeColor: 'bg-rose-500 text-white',
      description: 'Análise de falhas e lacunas',
    },
  ];

  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col bg-slate-50/80 dark:bg-slate-900/60 border-r border-slate-200/80 dark:border-slate-800 min-h-[calc(100vh-61px)] p-4 justify-between transition-colors">
      <div className="space-y-6">
        {/* Navigation Group */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Ambiente de Estudo</span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 font-semibold px-1.5 py-0.5 rounded border border-teal-200/60 dark:border-teal-800/60">
              Integrado
            </span>
          </div>

          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-sm shadow-teal-900/20'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeColor || 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* The "Synapse Loop" Visual Explainer */}
        <div className="bg-white dark:bg-slate-800/90 border border-teal-100 dark:border-slate-700/80 rounded-2xl p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-xs mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>O Efeito Sinapse</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2.5">
            Questão errada <span className="text-teal-600 dark:text-teal-400 font-medium">→</span> Compêndio <span className="text-teal-600 dark:text-teal-400 font-medium">→</span> Flashcard SRS <span className="text-teal-600 dark:text-teal-400 font-medium">→</span> Domínio clínico.
          </p>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span className="font-medium text-slate-600 dark:text-slate-300">Retenção ativa</span>
            <span className="text-teal-600 dark:text-teal-400 font-bold">+85% eficácia</span>
          </div>
        </div>

        {/* Administration Section - Visível apenas para administradores */}
        {isAdmin && (
          <div>
            <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Gestão & Curadoria
            </div>
            <button
              onClick={() => onSelectView('admin')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'admin'
                  ? 'bg-slate-900 dark:bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span>Painel Admin & CMS</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom: Plan Banner or Upgrade Prompt */}
      <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
        {currentPlan === 'premium' ? (
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/70 dark:border-amber-800/50 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Acesso Premium Pro</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
              Acervo ilimitado, simulados avançados e SRS de alta performance ativos.
            </p>
            <button
              onClick={onOpenPlanModal}
              className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
            >
              <span>Gerenciar plano</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/30 border border-teal-200/80 dark:border-teal-800/60 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Plano Gratuito</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2.5">
              Desbloqueie todo o acervo de compêndios, questões ilimitadas e repetição espaçada.
            </p>
            <button
              onClick={onOpenPlanModal}
              className="w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <span>Upgrade Pro</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
