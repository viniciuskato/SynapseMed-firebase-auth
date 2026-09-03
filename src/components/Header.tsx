import React, { useState, useEffect } from 'react';
import {
  Search,
  Flame,
  Layers,
  Crown,
  Sparkles,
  Settings,
  CheckCircle2,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { UserPlan, UserStats, ThemeMode } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  currentPlan: UserPlan;
  onOpenPlanModal: () => void;
  onTogglePlanQuick: () => void;
  onOpenSearch: () => void;
  stats: UserStats;
  dueCardsCount: number;
  activeView: string;
  onSelectView: (view: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPlan,
  onOpenPlanModal,
  onTogglePlanQuick,
  onOpenSearch,
  stats,
  dueCardsCount,
  activeView,
  onSelectView,
  theme,
  onToggleTheme,
}) => {
  const { user, profile, logout } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Fechar o menu de usuário com a tecla Escape
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userDropdownOpen]);

  const accuracyPercent =
    stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0;

  const displayName = profile?.displayName || user?.displayName || 'Estudante';
  const photoURL = profile?.photoURL || user?.photoURL || null;
  const isAdmin = profile?.role === 'admin';

  // Iniciais para fallback do avatar
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-colors max-w-full">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => onSelectView('dashboard')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-900 dark:bg-[#d4924a] text-white dark:text-[#111010] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform font-serif-reading font-bold text-base">
              Ψ
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-serif-reading font-bold text-base sm:text-lg tracking-tight text-stone-900 dark:text-[#e2ddd6] group-hover:text-amber-800 dark:group-hover:text-[#d4924a] transition-colors">
                  SynapseMed
                </span>
                <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 dark:bg-[#2a1810] text-amber-900 dark:text-[#d4924a] border border-amber-300 dark:border-[#d4924a]/40 font-mono-code">
                  Medicina
                </span>
              </div>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 hidden sm:block font-sans">
                Compêndios de Área & Mecanismos Fisiopatológicos
              </p>
            </div>
          </button>
        </div>

        {/* Center: Global Search Bar Trigger */}
        <div className="flex-1 max-w-md hidden md:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-slate-500 dark:text-slate-400 text-sm transition-all text-left shadow-inner cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm truncate">
                Buscar compêndios, questões, temas, drogas...
              </span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded shadow-xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Metrics, Plan Badges, Theme Toggle & User Info */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile search button */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 sm:p-2 md:hidden text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            title="Buscar"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Quick Streak & SRS Due Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 rounded-xl px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
            <div
              className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
              title="Ofensiva de estudos diários"
            >
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{stats.streakDays}d</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => onSelectView('flashcards')}
              className="flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              title="Cards para revisar hoje"
            >
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{dueCardsCount} cards</span>
            </button>
            {stats.totalAnswered > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div
                  className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                  title="Taxa de acertos geral"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{accuracyPercent}%</span>
                </div>
              </>
            )}
          </div>

          {/* Theme Selector (Claro / Escuro) */}
          <button
            onClick={onToggleTheme}
            id="header-theme-toggle"
            className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center shadow-xs"
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* Plan Badge / Switcher */}
          {currentPlan === 'premium' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenPlanModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-semibold text-xs shadow-xs hover:shadow-amber-500/20 hover:brightness-105 transition-all cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 fill-slate-950" />
                <span className="hidden sm:inline">PREMIUM PRO</span>
                <span className="sm:hidden text-[11px] font-bold">PRO</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenPlanModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Assinar Premium</span>
                <span className="sm:hidden text-[11px] font-bold">Upgrade</span>
              </button>
            </div>
          )}

          {/* Admin CMS Direct Shortcut - EXIBIDO SOMENTE SE ROLE === 'ADMIN' */}
          {isAdmin && (
            <button
              onClick={() => onSelectView('admin')}
              className={`p-1.5 sm:p-2 rounded-xl border text-xs font-medium transition-colors items-center gap-1 cursor-pointer hidden sm:flex ${
                activeView === 'admin'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-teal-600 dark:border-teal-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Painel Administrativo & Editor de Conteúdo Médico"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Admin CMS</span>
            </button>
          )}

          {/* Perfil do Usuário Autenticado & Botão Sair */}
          <div className="relative">
            <button
              id="btn-user-profile-menu"
              type="button"
              onClick={() => setUserDropdownOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={userDropdownOpen}
              aria-controls="user-profile-dropdown"
              aria-label="Menu do perfil de usuário"
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer bg-white/80 dark:bg-slate-900/80 focus:outline-hidden focus:ring-2 focus:ring-teal-500/40"
              title="Menu do Usuário"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold font-sans">
                  {initials || <UserIcon className="w-4 h-4" />}
                </div>
              )}
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight max-w-[110px] truncate">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  {isAdmin ? (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> Admin
                    </span>
                  ) : (
                    'Estudante'
                  )}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                  userDropdownOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown Menu com Perfil e Botão Sair */}
            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div
                  id="user-profile-dropdown"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="btn-user-profile-menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 transition-colors animate-in fade-in"
                >
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.email || profile?.email || 'Conta Google'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Papel: {isAdmin ? 'Administrador' : 'Estudante'}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelectView('admin');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Painel Admin / CMS</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    id="btn-logout"
                    onClick={async () => {
                      setUserDropdownOpen(false);
                      await logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
