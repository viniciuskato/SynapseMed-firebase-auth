import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Stethoscope,
  Layers,
  BookMarked,
  Database,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentPlan?: any;
  onOpenPlanModal?: () => void;
  errorLogCount?: number;
  dueCardsCount?: number;
  unansweredQuestionsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Support either controlled or self-managed collapse state
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('synapse_sidebar_collapsed') === 'true';
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('synapse_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: LayoutDashboard,
    },
    {
      id: 'compendiums',
      label: 'Biblioteca Médica',
      icon: BookOpen,
    },
    {
      id: 'clinical-cases',
      label: 'Casos Clínicos',
      icon: Stethoscope,
    },
    {
      id: 'questions',
      label: 'Provas e Questões',
      icon: HelpCircle,
    },
    {
      id: 'flashcards',
      label: 'Revisão e Flashcards',
      icon: Layers,
    },
    {
      id: 'errors',
      label: 'Caderno de Erros',
      icon: BookMarked,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin',
            label: 'Área Editorial',
            icon: Database,
          },
        ]
      : []),
  ];

  return (
    <aside
      className={`shrink-0 hidden md:flex flex-col bg-white dark:bg-[#111827] border-r border-[#E2E8F0] dark:border-[#263244] min-h-[calc(100vh-53px)] justify-between transition-all duration-200 ${
        isCollapsed ? 'w-16 p-2' : 'w-[230px] p-3'
      }`}
    >
      <div className="space-y-1">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeView === item.id ||
              (item.id === 'questions' &&
                (activeView === 'simulados' || activeView === 'simulado-session')) ||
              (item.id === 'compendiums' && activeView === 'compendium-reader') ||
              (item.id === 'clinical-cases' && activeView === 'clinical-case-detail');

            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg text-xs transition-colors cursor-pointer ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2 text-left'
                } ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-[#14B8A6] font-semibold'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#182235] hover:text-[#172033] dark:hover:text-[#E5E7EB]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? 'text-[#0F766E] dark:text-[#14B8A6]'
                      : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collapse/Expand Toggle Button */}
      <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#263244]">
        <button
          onClick={handleToggle}
          title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          className={`w-full flex items-center rounded-lg text-xs text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#182235] hover:text-[#172033] dark:hover:text-[#E5E7EB] transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'
          }`}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
