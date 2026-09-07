import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Layers,
  BookMarked,
  Database,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (view: string) => void;
  dueCardsCount?: number;
  errorLogCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  dueCardsCount = 0,
  errorLogCount = 0,
}) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Do not show on deep reading or during full exam sessions to keep immersion
  if (activeView === 'compendium-reader' || activeView === 'simulado-session') {
    return null;
  }

  const navItems = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'compendiums',
      label: 'Biblioteca',
      icon: BookOpen,
      badge: null,
    },
    {
      id: 'questions',
      label: 'Questões',
      icon: HelpCircle,
      badge: null,
    },
    {
      id: 'flashcards',
      label: 'Cards',
      icon: Layers,
      badge: dueCardsCount > 0 ? dueCardsCount : null,
      badgeColor: 'bg-teal-600 text-white',
    },
    {
      id: 'errors',
      label: 'Erros',
      icon: BookMarked,
      badge: errorLogCount > 0 ? errorLogCount : null,
      badgeColor: 'bg-rose-600 text-white',
    },
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: 'CMS',
            icon: Database,
            badge: null,
          },
        ]
      : []),
  ];

  return (
    <nav
      id="mobile-floating-dock"
      aria-label="Navegação Principal Móvel"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-md md:hidden bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-xl border border-slate-200/90 dark:border-[#243452] shadow-xl shadow-slate-900/10 dark:shadow-black/50 rounded-2xl p-1.5 flex items-center justify-around transition-all animate-in fade-in slide-in-from-bottom-2"
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
            className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer min-w-[52px] ${
              isActive
                ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/70 dark:border-teal-800/60 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon
                className={`w-4 h-4 transition-transform ${
                  isActive ? 'scale-110 text-teal-600 dark:text-teal-400' : ''
                }`}
              />
              {item.badge && (
                <span
                  className={`absolute -top-1.5 -right-2 px-1 text-[9px] font-bold rounded-full ${item.badgeColor} min-w-[14px] h-[14px] flex items-center justify-center shadow-2xs`}
                >
                  {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
