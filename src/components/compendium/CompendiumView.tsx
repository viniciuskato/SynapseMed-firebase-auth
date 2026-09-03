import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Bookmark,
  HelpCircle,
  Compass,
  Activity,
  LayoutGrid,
  List,
  Highlighter,
  MessageSquare,
  UserCheck,
  Calendar,
  Layers,
  Filter,
  Stethoscope,
  Pill,
  FileCheck2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Compendium, Discipline, Theme, StudyLens, EditorialStatus } from '../../types';
import { StorageService } from '../../services/storage';

interface CompendiumViewProps {
  compendiums: Compendium[];
  disciplines: Discipline[];
  themes: Theme[];
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onOpenQuestionsForTheme: (themeId: string) => void;
  initialDisciplineId?: string;
}

export const STUDY_LENSES: { id: StudyLens; label: string; description: string; icon: any }[] = [
  {
    id: 'fisiopatologia',
    label: 'Fisiopatologia & Mecanismos',
    description: 'Cascatas moleculares, etiologia e fisiopatologia aprofundada',
    icon: Activity,
  },
  {
    id: 'diagnostico',
    label: 'Diagnóstico & Semiologia',
    description: 'Critérios diagnósticos, exames complementares e raciocínio clínico',
    icon: Stethoscope,
  },
  {
    id: 'conduta',
    label: 'Conduta & Diretrizes',
    description: 'Algoritmos terapêuticos, protocolos de manejo e metas clínicas',
    icon: Compass,
  },
  {
    id: 'farmacologia',
    label: 'Farmacologia Clínica',
    description: 'Mecanismos de ação, posologia, contraindicações e efeitos adversos',
    icon: Pill,
  },
  {
    id: 'alto_rendimento',
    label: 'Alto Rendimento para Provas',
    description: 'Pontos de corte, pegadinhas de bancas e conceitos mais cobrados',
    icon: Sparkles,
  },
];

export const CompendiumView: React.FC<CompendiumViewProps> = ({
  compendiums,
  disciplines,
  themes,
  onOpenCompendium,
  onOpenQuestionsForTheme,
  initialDisciplineId,
}) => {
  // Navigation State: Especialidade -> Lente de Estudo -> Material
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(
    initialDisciplineId || 'all'
  );
  const [selectedLens, setSelectedLens] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EditorialStatus>('all');

  // Persistence data
  const readingProgress = StorageService.getReadingProgress();
  const bookmarks = StorageService.getBookmarks();
  const highlights = StorageService.getHighlights();
  const notes = StorageService.getNotes();

  // Helper to infer lens if not explicitly set
  const getCompendiumLens = (comp: Compendium): StudyLens => {
    if (comp.studyLens) return comp.studyLens;
    const text = `${comp.title} ${comp.subtitle} ${(comp.tags || []).join(' ')}`.toLowerCase();
    if (text.includes('fármaco') || text.includes('farmaco') || text.includes('medicamento') || text.includes('droga')) {
      return 'farmacologia';
    }
    if (text.includes('diagnóstic') || text.includes('semiologia') || text.includes('sinais')) {
      return 'diagnostico';
    }
    if (text.includes('conduta') || text.includes('manejo') || text.includes('diretriz') || text.includes('tratamento')) {
      return 'conduta';
    }
    if (comp.mode === 'atlas') {
      return 'alto_rendimento';
    }
    return 'fisiopatologia';
  };

  // Helper to infer status
  const getCompendiumStatus = (comp: Compendium): EditorialStatus => {
    if (comp.editorialStatus) return comp.editorialStatus;
    return 'completo';
  };

  // Filtered compendiums based on discipline, lens, search, and status
  const filteredCompendiums = useMemo(() => {
    return compendiums.filter((comp) => {
      // 1. Especialidade
      if (selectedDisciplineId !== 'all' && comp.disciplineId !== selectedDisciplineId) {
        return false;
      }

      // 2. Lente de Estudo
      if (selectedLens !== 'all') {
        const lens = getCompendiumLens(comp);
        if (lens !== selectedLens) return false;
      }

      // 3. Status Editorial
      if (statusFilter !== 'all') {
        const st = getCompendiumStatus(comp);
        if (st !== statusFilter) return false;
      }

      // 4. Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const theme = themes.find((t) => t.id === comp.themeId);
        const matchesTitle = comp.title.toLowerCase().includes(q);
        const matchesSubtitle = comp.subtitle.toLowerCase().includes(q);
        const matchesAuthor = comp.author?.toLowerCase().includes(q);
        const matchesTheme = theme?.name.toLowerCase().includes(q);
        const matchesTags = comp.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesContent = comp.sections.some(
          (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
        );
        return matchesTitle || matchesSubtitle || matchesAuthor || matchesTheme || matchesTags || matchesContent;
      }

      return true;
    });
  }, [compendiums, selectedDisciplineId, selectedLens, statusFilter, searchQuery, themes]);

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

  const activeDiscipline = disciplines.find((d) => d.id === selectedDisciplineId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Page Header: Biblioteca Médica ────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-serif-reading font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Biblioteca Médica
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Acervo Aberto
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Navegue por especialidade clínica e selecione a lente de estudo para aprofundar mecanismos fisiopatológicos, diretrizes e correlações com questões comentadas.
            </p>
          </div>

          {/* View mode toggle (Grid vs List) */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Exibição em Cartões"
              aria-label="Modo cartões"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Exibição em Lista Editorial"
              aria-label="Modo lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── NAVEGAÇÃO ESTRUTURADA ETAPA 1: Especialidades Médicas ──── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-400">
            <Compass className="w-3.5 h-3.5 text-teal-600" />
            1. Especialidade Médica
          </span>
          <span className="text-[11px] font-normal text-slate-400">
            {activeDiscipline ? activeDiscipline.name : 'Todas as áreas'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            onClick={() => setSelectedDisciplineId('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all cursor-pointer ${
              selectedDisciplineId === 'all'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            Todas ({compendiums.length})
          </button>
          {disciplines.map((disc) => {
            const count = compendiums.filter((c) => c.disciplineId === disc.id).length;
            const isSelected = selectedDisciplineId === disc.id;
            return (
              <button
                key={disc.id}
                onClick={() => setSelectedDisciplineId(disc.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{disc.name}</span>
                <span className={`text-[10px] opacity-75 font-normal ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── NAVEGAÇÃO ESTRUTURADA ETAPA 2: Lente de Estudo ─────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-400">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            2. Lente de Estudo
          </span>
          {selectedLens !== 'all' && (
            <button
              onClick={() => setSelectedLens('all')}
              className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
            >
              Limpar lente
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STUDY_LENSES.map((lens) => {
            const Icon = lens.icon;
            const isSelected = selectedLens === lens.id;
            return (
              <button
                key={lens.id}
                onClick={() => setSelectedLens(isSelected ? 'all' : lens.id)}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  )}
                </div>
                <div>
                  <h4
                    className={`text-xs font-bold leading-tight ${
                      isSelected
                        ? 'text-teal-900 dark:text-teal-200'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {lens.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {lens.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search & Secondary Filters Bar ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por tema, conduta, fármaco, autor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Status Filter & Results counter */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-medium px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Todos os status</option>
              <option value="completo">Completo</option>
              <option value="em_atualizacao">Em atualização</option>
              <option value="em_revisao">Em revisão</option>
            </select>
          </div>

          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {filteredCompendiums.length} {filteredCompendiums.length === 1 ? 'material' : 'materiais'}
          </span>
        </div>
      </div>

      {/* ── NAVEGAÇÃO ESTRUTURADA ETAPA 3: Materiais e Compêndios ──── */}
      {filteredCompendiums.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 space-y-3">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhum compêndio encontrado
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Tente selecionar "Todas as áreas", redefinir a lente de estudo ou buscar por termos mais genéricos.
          </p>
          <button
            onClick={() => {
              setSelectedDisciplineId('all');
              setSelectedLens('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Redefinir Filtros
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── MODO CARTÕES (GRID) ──────────────────────────────────── */
        <div className="space-y-8">
          {(Object.entries(groupedCompendiums) as [string, Compendium[]][]).map(([discId, items]) => {
            const disc = disciplines.find((d) => d.id === discId);

            return (
              <div key={discId} className="space-y-3">
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {disc?.name || discId.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {items.length} {items.length === 1 ? 'material' : 'materiais'}
                    </span>
                  </div>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((comp) => {
                    const compProgress = readingProgress[comp.id] || { readSectionIds: [], percent: 0 };
                    const isBookmarked = bookmarks.compendiums.includes(comp.id);
                    const compHighlights = highlights[comp.id] || [];
                    const hasNote = Boolean(notes[comp.id]);
                    const lens = getCompendiumLens(comp);
                    const lensMeta = STUDY_LENSES.find((l) => l.id === lens);
                    const status = getCompendiumStatus(comp);

                    return (
                      <div
                        key={comp.id}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-teal-500/60 dark:hover:border-teal-500/60 p-5 shadow-xs transition-all flex flex-col justify-between group"
                      >
                        <div className="space-y-3">
                          {/* Top Meta: Lente + Read Time + Status */}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 gap-1.5">
                            <span className="font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/50 dark:border-teal-800/50 truncate max-w-[140px]">
                              {lensMeta?.label.split('&')[0].trim() || 'Fisiopatologia'}
                            </span>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {comp.estimatedReadTimeMinutes} min
                              </span>
                              {isBookmarked && (
                                <Bookmark className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                              )}
                            </div>
                          </div>

                          {/* Title & Subtitle */}
                          <div>
                            <h4
                              onClick={() => onOpenCompendium(comp.id)}
                              className="font-serif-reading text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 cursor-pointer transition-colors leading-snug"
                            >
                              {comp.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {comp.subtitle}
                            </p>
                          </div>

                          {/* Editorial & Update Meta */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                <UserCheck className="w-3 h-3 text-teal-600" />
                                <span className="truncate max-w-[150px]">{comp.author}</span>
                              </span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Calendar className="w-3 h-3" />
                                {comp.lastUpdated}
                              </span>
                            </div>

                            {/* Tags & Highlights/Notes Pill */}
                            <div className="flex items-center justify-between gap-1 pt-1">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  status === 'completo'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : status === 'em_atualizacao'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {status === 'completo'
                                  ? 'Completo'
                                  : status === 'em_atualizacao'
                                  ? 'Em atualização'
                                  : 'Em revisão'}
                              </span>

                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                {compHighlights.length > 0 && (
                                  <span className="flex items-center gap-0.5" title="Destaques salvos">
                                    <Highlighter className="w-3 h-3 text-amber-500" />
                                    {compHighlights.length}
                                  </span>
                                )}
                                {hasNote && (
                                  <span className="flex items-center gap-0.5" title="Anotação vinculada">
                                    <MessageSquare className="w-3 h-3 text-teal-500" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions & Progress */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                compProgress.percent === 100
                                  ? 'text-emerald-500'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                            <span>{compProgress.percent > 0 ? `${compProgress.percent}% lido` : 'Não lido'}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onOpenQuestionsForTheme(comp.themeId)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              title="Resolver questões sobre este tema"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenCompendium(comp.id)}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span>Ler</span>
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
      ) : (
        /* ── MODO LISTA EDITORIAL (LIST) ─────────────────────────── */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 shadow-xs">
          {filteredCompendiums.map((comp) => {
            const disc = disciplines.find((d) => d.id === comp.disciplineId);
            const compProgress = readingProgress[comp.id] || { readSectionIds: [], percent: 0 };
            const isBookmarked = bookmarks.compendiums.includes(comp.id);
            const compHighlights = highlights[comp.id] || [];
            const hasNote = Boolean(notes[comp.id]);
            const lens = getCompendiumLens(comp);
            const lensMeta = STUDY_LENSES.find((l) => l.id === lens);
            const status = getCompendiumStatus(comp);

            return (
              <div
                key={comp.id}
                className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      {disc?.name}
                    </span>
                    <span>•</span>
                    <span className="text-teal-700 dark:text-teal-400 font-medium">
                      {lensMeta?.label}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {comp.estimatedReadTimeMinutes} min
                    </span>
                    <span>•</span>
                    <span
                      className={`font-semibold px-2 py-0.2 rounded-full ${
                        status === 'completo'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {status === 'completo' ? 'Completo' : 'Em atualização'}
                    </span>
                  </div>

                  <h4
                    onClick={() => onOpenCompendium(comp.id)}
                    className="font-serif-reading text-base font-bold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer transition-colors leading-tight"
                  >
                    {comp.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {comp.subtitle}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span>Curadoria: <strong className="font-medium text-slate-600 dark:text-slate-300">{comp.author}</strong></span>
                    <span>Atualizado: {comp.lastUpdated}</span>
                    {compHighlights.length > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Highlighter className="w-3 h-3" /> {compHighlights.length} destaques
                      </span>
                    )}
                    {hasNote && (
                      <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                        <MessageSquare className="w-3 h-3" /> Anotação
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Actions & Reading Progress */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <div className="text-right hidden md:block">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                      {compProgress.percent}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {compProgress.readSectionIds.length}/{comp.sections.length} seções
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenQuestionsForTheme(comp.themeId)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Questões deste tema"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onOpenCompendium(comp.id)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Acessar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
