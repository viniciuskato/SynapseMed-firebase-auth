import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Bookmark,
  Layers,
  HelpCircle,
  FolderOpen,
  Compass,
  Cpu,
  HeartPulse,
  Activity,
  ShieldAlert,
  Pill,
  Microscope,
  Stethoscope,
  Share2,
} from 'lucide-react';
import { Compendium, Discipline, Theme } from '../../types';
import { StorageService } from '../../services/storage';

interface CompendiumViewProps {
  compendiums: Compendium[];
  disciplines: Discipline[];
  themes: Theme[];
  onOpenCompendium: (compendiumId: string) => void;
  onOpenQuestionsForTheme: (themeId: string) => void;
}

export const CompendiumView: React.FC<CompendiumViewProps> = ({
  compendiums,
  disciplines,
  themes,
  onOpenCompendium,
  onOpenQuestionsForTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'todos' | 'atlas' | 'mecanismos'>('todos');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyHighYield, setOnlyHighYield] = useState(false);

  const readingProgress = StorageService.getReadingProgress();
  const bookmarks = StorageService.getBookmarks();

  // Filtered compendiums based on active tab, discipline, search and high yield
  const filteredCompendiums = useMemo(() => {
    return compendiums.filter((comp) => {
      // Tab filter
      if (activeTab === 'atlas' && comp.mode === 'mecanismos') return false;
      if (activeTab === 'mecanismos' && comp.mode !== 'mecanismos') return false;

      // Discipline filter
      if (selectedDisciplineId !== 'all' && comp.disciplineId !== selectedDisciplineId) {
        return false;
      }

      const theme = themes.find((t) => t.id === comp.themeId);
      if (onlyHighYield && !theme?.highYield) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = comp.title.toLowerCase().includes(q);
        const matchesSubtitle = comp.subtitle.toLowerCase().includes(q);
        const matchesTheme = theme?.name.toLowerCase().includes(q);
        const matchesTags = comp.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesContent = comp.sections.some(
          (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
        );
        return matchesTitle || matchesSubtitle || matchesTheme || matchesTags || matchesContent;
      }
      return true;
    });
  }, [compendiums, activeTab, selectedDisciplineId, onlyHighYield, searchQuery, themes]);

  // Group filtered compendiums by discipline
  const groupedCompendiums = useMemo<Record<string, Compendium[]>>(() => {
    const groups: Record<string, Compendium[]> = {};
    filteredCompendiums.forEach((comp) => {
      if (!groups[comp.disciplineId]) {
        groups[comp.disciplineId] = [];
      }
      groups[comp.disciplineId].push(comp);
    });
    return groups;
  }, [filteredCompendiums]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* ── Page Header (Base de Estudos Standard) ────────────────── */}
      <div className="border-b border-slate-200/80 dark:border-stone-800 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif-reading text-2xl sm:text-3xl font-bold tracking-tight text-amber-900 dark:text-[#d4924a]">
              Base de Estudos
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
              Índice de compêndios de área e mecanismos fisiopatológicos · Integrado com SRS Flashcards e Questões
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400">
              {filteredCompendiums.length} {filteredCompendiums.length === 1 ? 'material' : 'materiais'} disponíveis
            </span>
          </div>
        </div>

        {/* ── Main Category Tabs ─────────────────────────────────── */}
        <div className="flex items-center gap-1 mt-6 border-b border-stone-200 dark:border-stone-800 text-xs sm:text-sm font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2.5 transition-all relative border-b-2 -mb-[1px] whitespace-nowrap ${
              activeTab === 'todos'
                ? 'border-[#d4924a] text-amber-900 dark:text-[#d4924a] font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            Todos os materiais
          </button>
          <button
            onClick={() => setActiveTab('atlas')}
            className={`px-4 py-2.5 transition-all relative border-b-2 -mb-[1px] whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'atlas'
                ? 'border-[#5b8dd9] text-sky-800 dark:text-[#5b8dd9] font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <span>Compêndios de área</span>
            <span className="badge-atlas text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
              Atlas
            </span>
          </button>
          <button
            onClick={() => setActiveTab('mecanismos')}
            className={`px-4 py-2.5 transition-all relative border-b-2 -mb-[1px] whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'mecanismos'
                ? 'border-[#c0604a] text-rose-800 dark:text-[#c0604a] font-bold'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <span>Mecanismos</span>
            <span className="badge-mec text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
              Fisio
            </span>
          </button>
        </div>
      </div>

      {/* ── "Como funciona" Informative Box ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#1a1919] border border-stone-200 dark:border-stone-800 border-l-4 border-l-[#5b8dd9] shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#5b8dd9]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-[#5b8dd9]">
              Compêndios de Área
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Mapas de campo e guias estruturados com a visão de conjunto de cada especialidade médica e científica. Nós conceituais, conexões clínicas e navegação panorâmica entre temas essenciais.
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#1a1919] border border-stone-200 dark:border-stone-800 border-l-4 border-l-[#c0604a] shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#c0604a]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-[#c0604a]">
              Mecanismos
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Desdobramento fisiopatológico e farmacodinâmico detalhado: cascatas moleculares, fórmulas e escores, correlações clínicas aplicadas, pontos-chave e links diretos com o banco de questões.
          </p>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1919] rounded-2xl border border-stone-200 dark:border-stone-800 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Filtrar por título, tag, fármaco, autor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Discipline Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setSelectedDisciplineId('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all ${
              selectedDisciplineId === 'all'
                ? 'bg-amber-900 text-white dark:bg-[#d4924a] dark:text-[#111010]'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            Todas as Áreas
          </button>
          {disciplines.map((disc) => (
            <button
              key={disc.id}
              onClick={() => setSelectedDisciplineId(disc.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all ${
                selectedDisciplineId === disc.id
                  ? 'bg-amber-900 text-white dark:bg-[#d4924a] dark:text-[#111010]'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {disc.name}
            </button>
          ))}
        </div>

        {/* High Yield Toggle */}
        <button
          onClick={() => setOnlyHighYield(!onlyHighYield)}
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
            onlyHighYield
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-50'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${onlyHighYield ? 'text-amber-600 fill-amber-500' : 'text-stone-400'}`} />
          <span>Alta Relevância</span>
        </button>
      </div>

      {/* ── Area Groupings & Cards ─────────────────────────────────── */}
      {filteredCompendiums.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1919] rounded-2xl border border-stone-200 dark:border-stone-800 p-12 text-center text-stone-500 space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-stone-400 opacity-50" />
          <p className="font-semibold text-sm">Nenhum compêndio encontrado para estes critérios.</p>
          <p className="text-xs text-stone-400">Tente buscar por termos mais genéricos ou selecionar outra categoria.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {(Object.entries(groupedCompendiums) as [string, Compendium[]][]).map(([discId, items]) => {
            const disc = disciplines.find((d) => d.id === discId);
            const isAtlasMode = items.some((i) => i.mode !== 'mecanismos');

            return (
              <div key={discId} className="space-y-4">
                {/* Area Header */}
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-code text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      {disc?.name || discId.toUpperCase()}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
                        isAtlasMode ? 'badge-atlas' : 'badge-mec'
                      }`}
                    >
                      {isAtlasMode ? 'Compêndio de Área' : 'Mecanismos'}
                    </span>
                  </div>
                  <span className="text-xs text-stone-400">
                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((comp) => {
                    const th = themes.find((t) => t.id === comp.themeId);
                    const compProgress = readingProgress[comp.id] || { readSectionIds: [], percent: 0 };
                    const isBookmarked = bookmarks.compendiums.includes(comp.id);
                    const isAtlas = comp.mode !== 'mecanismos';

                    return (
                      <div
                        key={comp.id}
                        className={`bg-white dark:bg-[#1a1919] hover:dark:bg-[#222121] border border-stone-200 dark:border-stone-800 rounded-lg p-5 transition-all flex flex-col justify-between group shadow-xs hover:border-[#d4924a] ${
                          isAtlas ? 'border-l-4 border-l-[#5b8dd9]' : 'border-l-4 border-l-[#c0604a]'
                        }`}
                      >
                        <div>
                          {/* Top Meta Bar */}
                          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-2">
                            <span className="text-[11px] font-medium">
                              {comp.mode === 'mecanismos' ? 'Mecanismo Fisiopatológico' : 'Compêndio de Área'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isBookmarked && <Bookmark className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />}
                              <span className="flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3 text-stone-400" />
                                {comp.estimatedReadTimeMinutes} min
                              </span>
                            </div>
                          </div>

                          {/* Title & Subtitle */}
                          <h4
                            onClick={() => onOpenCompendium(comp.id)}
                            className="font-serif-reading text-base font-semibold text-stone-900 dark:text-[#e2ddd6] group-hover:text-amber-800 dark:group-hover:text-[#d4924a] cursor-pointer transition-colors leading-snug"
                          >
                            {comp.title}
                          </h4>
                          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {comp.subtitle}
                          </p>

                          {/* Tags Pills */}
                          {comp.tags && comp.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {comp.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 dark:bg-[#222121] text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                compProgress.percent === 100
                                  ? 'text-emerald-500'
                                  : 'text-stone-300 dark:text-stone-600'
                              }`}
                            />
                            <span>{compProgress.percent > 0 ? `${compProgress.percent}% lido` : 'Não iniciado'}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onOpenQuestionsForTheme(comp.themeId)}
                              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
                              title="Fazer questões deste tema"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenCompendium(comp.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <span>Acessar</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
