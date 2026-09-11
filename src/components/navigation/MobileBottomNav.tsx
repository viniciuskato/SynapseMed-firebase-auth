import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LastReadingSession } from '../../types';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (view: string) => void;
  dueCardsCount?: number;
  errorLogCount?: number;
  lastReadingSession?: LastReadingSession | null;
  onResumeReading?: () => void;
  onOpenSearch?: () => void;
  onOpenCreateSimulado?: () => void;
  theme?: string;
  onToggleTheme?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  dueCardsCount = 0,
  lastReadingSession,
  onResumeReading,
}) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Caderno de Erros agora fica integrado em Início (dados do usuário)
  const navItems = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: LayoutDashboard,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'compendiums',
      label: 'Biblioteca',
      icon: BookOpen,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'questions',
      label: 'Questões',
      icon: HelpCircle,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'flashcards',
      label: 'Cards',
      icon: Layers,
      badge: dueCardsCount > 0 ? dueCardsCount : null,
      badgeColor: 'bg-teal-600 text-white',
    },
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: 'CMS',
            icon: Database,
            badge: null,
            badgeColor: '',
          },
        ]
      : []),
  ];

  const isReading = activeView === 'compendium-reader';
  const isSimuladoSession = activeView === 'simulado-session';

  return (
    <div className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[94vw] flex flex-col items-center gap-2 pointer-events-none">
      {/* Pílula flutuante de retomada rápida quando fora do leitor */}
      {lastReadingSession && !isReading && !isSimuladoSession && (
        <button
          type="button"
          onClick={onResumeReading}
          className="pointer-events-auto px-4 py-1.5 rounded-full bg-slate-900/70 dark:bg-slate-950/70 backdrop-blur-2xl border border-teal-500/40 dark:border-teal-400/40 text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg hover:bg-slate-900/85 active:scale-[0.98] transition-all cursor-pointer group"
          title={`Retomar leitura: ${lastReadingSession.compendiumTitle}`}
        >
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
          <span className="text-teal-300 font-bold uppercase tracking-wider text-[9px] shrink-0">
            Retomar:
          </span>
          <span className="truncate max-w-[160px] sm:max-w-[240px]">
            {lastReadingSession.compendiumTitle}
          </span>
          <ArrowRight className="w-3 h-3 text-teal-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* Dock Flutuante Transparente Unificado */}
      <nav
        id="mobile-floating-dock"
        aria-label="Navegação Principal"
        className="pointer-events-auto flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl bg-white/45 dark:bg-slate-950/45 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeView === item.id ||
            (item.id === 'questions' &&
              (activeView === 'simulados' || activeView === 'simulado-session')) ||
            (item.id === 'compendiums' && activeView === 'compendium-reader') ||
            (item.id === 'flashcards' && activeView === 'flashcard-session');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 sm:px-4 rounded-xl transition-all cursor-pointer min-w-[56px] sm:min-w-[64px] ${
                isActive
                  ? 'bg-teal-600/15 dark:bg-teal-400/20 text-teal-800 dark:text-teal-200 font-bold border border-teal-500/30 dark:border-teal-400/40 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/10 border border-transparent font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'scale-110 text-teal-600 dark:text-teal-400' : ''
                  }`}
                />
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 px-1 text-[9px] font-bold rounded-full ${item.badgeColor} min-w-[14px] h-[14px] flex items-center justify-center shadow-xs`}
                  >
                    {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] mt-0.5 tracking-tight truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
