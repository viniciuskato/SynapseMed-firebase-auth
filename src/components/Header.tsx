import React, { useState, useEffect } from 'react';
import {
  Search,
  Flame,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  ChevronDown,
  MessageSquarePlus,
  Shield,
  Settings,
} from 'lucide-react';
import { UserPlan, UserStats, ThemeMode } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  currentPlan: UserPlan;
  onOpenPlanModal?: () => void;
  onTogglePlanQuick?: () => void;
  onOpenSearch: () => void;
  stats: UserStats;
  dueCardsCount: number;
  activeView: string;
  onSelectView: (view: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenFeedback?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  stats,
  activeView,
  onSelectView,
  theme,
  onToggleTheme,
  onOpenFeedback,
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

  const displayName = profile?.displayName || user?.user_metadata?.display_name || 'Estudante';
  const photoURL = profile?.photoURL || user?.user_metadata?.avatar_url || null;
  const isAdmin = profile?.role === 'admin';

  // Iniciais para fallback do avatar
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs border-b border-[#E2E8F0] dark:border-[#263244] px-4 sm:px-6 py-2.5 transition-colors max-w-full">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectView('dashboard')}
            className="flex items-center gap-2 text-left group focus:outline-hidden cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center font-serif font-bold text-base shadow-xs">
              Ψ
            </div>
            <span className="font-serif font-bold text-lg tracking-tight text-[#172033] dark:text-[#E5E7EB] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
              SynapseMed
            </span>
          </button>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-1.5 bg-[#F6F7F9] dark:bg-[#182235] hover:bg-slate-200/60 dark:hover:bg-[#182235]/80 border border-[#E2E8F0] dark:border-[#263244] rounded-lg text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              <span className="truncate">Buscar compêndios, questões, temas...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263244] rounded">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: One Activity Indicator, Theme Toggle, Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile search icon */}
          <button
            onClick={onOpenSearch}
            className="p-2 md:hidden text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#182235] rounded-lg cursor-pointer"
            title="Buscar"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Um indicador compacto de atividade (Ofensiva em âmbar exclusivo) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-[#F59E0B] text-xs font-semibold"
            title={`${stats.streakDays} dias seguidos de estudo`}
          >
            <Flame className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
            <span>{stats.streakDays}d</span>
          </div>

          {/* Theme Selector (Claro / Escuro) */}
          <button
            onClick={onToggleTheme}
            id="header-theme-toggle"
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#263244] bg-white dark:bg-[#111827] hover:bg-slate-100 dark:hover:bg-[#182235] text-[#64748B] dark:text-[#94A3B8] transition-colors cursor-pointer flex items-center justify-center"
            title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#F59E0B]" />
            ) : (
              <Moon className="w-4 h-4 text-[#172033]" />
            )}
          </button>

          {/* Perfil do Usuário Autenticado */}
          <div className="relative">
            <button
              id="btn-user-profile-menu"
              type="button"
              onClick={() => setUserDropdownOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={userDropdownOpen}
              aria-controls="user-profile-dropdown"
              aria-label="Menu do perfil de usuário"
              className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg border border-[#E2E8F0] dark:border-[#263244] hover:bg-slate-50 dark:hover:bg-[#182235] transition-colors cursor-pointer bg-white dark:bg-[#111827] focus:outline-hidden"
              title="Menu do Usuário"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-[#E2E8F0] dark:border-[#263244]"
                />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
                  {initials || <UserIcon className="w-3.5 h-3.5" />}
                </div>
              )}
              <span className="hidden md:inline text-xs font-medium text-[#172033] dark:text-[#E5E7EB] max-w-[100px] truncate">
                {displayName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] transition-transform ${
                  userDropdownOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown Menu com Perfil, Beta Privada e Botão Sair */}
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
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#263244] shadow-lg py-2 z-50 transition-colors"
                >
                  <div className="px-4 py-2 border-b border-[#E2E8F0] dark:border-[#263244]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#172033] dark:text-[#E5E7EB] truncate">
                        {displayName}
                      </p>
                      <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#182235] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#263244]">
                        Beta privada
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                      {user?.email || profile?.email || 'Conta vinculada'}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelectView('admin');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-[#172033] dark:text-[#E5E7EB] hover:bg-slate-100 dark:hover:bg-[#182235] flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                      <span>Área Editorial / CMS</span>
                    </button>
                  )}

                  {onOpenFeedback && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenFeedback();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-[#172033] dark:text-[#E5E7EB] hover:bg-slate-100 dark:hover:bg-[#182235] flex items-center gap-2 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      <span>Enviar feedback</span>
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
                    className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 cursor-pointer border-t border-[#E2E8F0] dark:border-[#263244] mt-1"
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
