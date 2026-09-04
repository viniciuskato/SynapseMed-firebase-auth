import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
  List,
  X,
  Sparkles,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Compendium, CompendiumSection, Discipline, Theme } from '../../types';
import { StorageService } from '../../services/storage';
import { bookmarksRepository } from '../../repositories/BookmarksRepository';
import { notesRepository } from '../../repositories/NotesRepository';
import { flashcardsRepository } from '../../repositories/FlashcardsRepository';
import { SafeMarkdown } from '../common/SafeMarkdown';

interface CompendiumReaderProps {
  compendium: Compendium;
  disciplines: Discipline[];
  themes: Theme[];
  onBack: () => void;
  onOpenQuestionsForTheme: (themeId: string) => void;
  onOpenFlashcardsForTheme: (themeId: string) => void;
  targetSectionId?: string;
}

export const CompendiumReader: React.FC<CompendiumReaderProps> = ({
  compendium,
  disciplines,
  themes,
  onBack,
  onOpenQuestionsForTheme,
  onOpenFlashcardsForTheme,
  targetSectionId,
}) => {
  const discipline = disciplines.find((d) => d.id === compendium.disciplineId);
  const theme = themes.find((t) => t.id === compendium.themeId);

  const [activeSectionId, setActiveSectionId] = useState<string>(
    targetSectionId || compendium.sections[0]?.id || ''
  );
  const [readSectionIds, setReadSectionIds] = useState<string[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [userNote, setUserNote] = useState('');
  const [showNoteDrawer, setShowNoteDrawer] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  // Track scroll percentage
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const current = (window.scrollY / totalHeight) * 100;
        setScrollPercent(Math.min(100, Math.max(0, current)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load reading progress, bookmark and notes
  useEffect(() => {
    const progress = StorageService.getReadingProgress();
    const compProgress = progress[compendium.id];
    if (compProgress) {
      setReadSectionIds(compProgress.readSectionIds);
    }
    const bookmarks = bookmarksRepository.getBookmarks();
    setIsBookmarked(bookmarks.compendiums.includes(compendium.id));

    const notes = notesRepository.getNotes();
    setUserNote(notes[compendium.id] || '');

    if (targetSectionId) {
      setActiveSectionId(targetSectionId);
      const elem = document.getElementById(targetSectionId);
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }
  }, [compendium.id, targetSectionId]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggleRead = (sectionId: string) => {
    const newPercent = StorageService.toggleSectionRead(
      compendium.id,
      sectionId,
      compendium.sections.length
    );
    const progress = StorageService.getReadingProgress();
    setReadSectionIds(progress[compendium.id]?.readSectionIds || []);

    if (newPercent === 100) {
      showToast('Leitura concluída com sucesso!');
    }
  };

  const handleToggleBookmark = () => {
    const bookmarked = bookmarksRepository.toggleBookmark('compendiums', compendium.id);
    setIsBookmarked(bookmarked);
    showToast(bookmarked ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
  };

  const handleSaveNote = () => {
    notesRepository.saveNote(compendium.id, userNote);
    showToast('Anotação salva com sucesso');
  };

  const handleCreateFlashcardFromSection = (sec: CompendiumSection) => {
    flashcardsRepository.saveFlashcard({
      id: `fc-sec-${Date.now()}`,
      disciplineId: compendium.disciplineId,
      themeId: compendium.themeId,
      compendiumRefId: compendium.id,
      front: `[${discipline?.name || 'Medicina'}] ${sec.title}`,
      back: sec.keyTakeaways.join('\n• '),
      mechanismHighlight: sec.clinicalPearl || sec.keyTakeaways[0] || '',
      tags: [discipline?.name || 'Geral', theme?.name || 'Teoria', 'Compêndio'],
      difficulty: 'medio',
      isCustom: true,
      srs: {
        intervalDays: 1,
        repetitionCount: 1,
        easeFactor: 2.5,
        nextDueDate: new Date().toISOString(),
        state: 'new',
        reviewHistory: [],
      },
    });
    showToast('Flashcard criado para o seu SRS');
  };

  const scrollToSection = (secId: string) => {
    setActiveSectionId(secId);
    setIsIndexOpen(false);
    const elem = document.getElementById(secId);
    if (elem) {
      const yOffset = -80;
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Validating metadata: omit or show "Revisão editorial pendente" if missing
  const authorDisplay = compendium.author?.trim()
    ? compendium.author
    : 'Revisão editorial pendente';

  const lastUpdatedDisplay = compendium.lastUpdated?.trim()
    ? compendium.lastUpdated
    : 'Revisão editorial pendente';

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B1220] text-[#172033] dark:text-[#E5E7EB] transition-colors pb-24">
      {/* ── Top Reading Progress Bar ─────────────────────────────── */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-[#0F766E] dark:bg-[#14B8A6] z-50 transition-all duration-100"
        style={{ width: `${scrollPercent}%` }}
      />

      {/* ── Toast Notification ───────────────────────────────────── */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#111827] dark:bg-[#182235] text-[#E5E7EB] px-4 py-2.5 rounded-lg shadow-lg border border-[#263244] text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ── Sticky Subheader / Top Action Bar ─────────────────────── */}
      <div className="sticky top-[53px] z-20 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xs border-b border-[#E2E8F0] dark:border-[#263244] px-4 sm:px-6 py-2 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Back & Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#263244] hover:bg-slate-50 dark:hover:bg-[#182235] text-[#64748B] dark:text-[#94A3B8] transition-colors shrink-0 cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="truncate">
              <span className="text-[11px] font-semibold text-[#0F766E] dark:text-[#14B8A6] uppercase tracking-wider block truncate">
                {discipline?.name} · {theme?.name}
              </span>
              <h2 className="text-xs sm:text-sm font-semibold text-[#172033] dark:text-[#E5E7EB] truncate">
                {compendium.title}
              </h2>
            </div>
          </div>

          {/* Simple Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Índice lateral toggle */}
            <button
              onClick={() => setIsIndexOpen((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                isIndexOpen
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-[#14B8A6] border-teal-200 dark:border-teal-800'
                  : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#263244] text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#182235]'
              }`}
              title="Índice de seções"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Índice</span>
            </button>

            {/* Anotações */}
            <button
              onClick={() => setShowNoteDrawer((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                showNoteDrawer
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-[#14B8A6] border-teal-200 dark:border-teal-800'
                  : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#263244] text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#182235]'
              }`}
              title="Anotações pessoais"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anotações</span>
            </button>

            {/* Favoritar */}
            <button
              onClick={handleToggleBookmark}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isBookmarked
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 text-[#0F766E] dark:text-[#14B8A6]'
                  : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#263244] text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#182235]'
              }`}
              title={isBookmarked ? 'Favoritado' : 'Favoritar'}
            >
              <Bookmark
                className={`w-3.5 h-3.5 ${
                  isBookmarked ? 'fill-[#0F766E] dark:fill-[#14B8A6]' : ''
                }`}
              />
            </button>

            {/* Resolver questões */}
            <button
              onClick={() => onOpenQuestionsForTheme(compendium.themeId)}
              className="px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-teal-800 dark:bg-[#14B8A6] dark:hover:bg-teal-400 text-white dark:text-[#0B1220] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Resolver questões</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Drawer / Lateral Index (Mobile: Drawer | Desktop: Overlay or Slide) ── */}
      {isIndexOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsIndexOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed top-0 left-0 z-50 w-72 sm:w-80 h-full bg-white dark:bg-[#111827] border-r border-[#E2E8F0] dark:border-[#263244] shadow-xl p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#263244]">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-[#E5E7EB]">
                    Índice do Artigo
                  </span>
                </div>
                <button
                  onClick={() => setIsIndexOpen(false)}
                  className="p-1 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#182235] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress info */}
              <div className="py-3 text-xs text-[#64748B] dark:text-[#94A3B8] flex items-center justify-between">
                <span>Progresso de leitura</span>
                <span className="font-semibold text-[#172033] dark:text-[#E5E7EB]">
                  {readSectionIds.length}/{compendium.sections.length} seções
                </span>
              </div>

              {/* List of sections */}
              <nav className="space-y-1 mt-2 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
                {compendium.sections.map((sec, idx) => {
                  const isRead = readSectionIds.includes(sec.id);
                  const isCurrent = activeSectionId === sec.id;

                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                        isCurrent
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-[#14B8A6] font-semibold'
                          : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#182235] hover:text-[#172033] dark:hover:text-[#E5E7EB]'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                          isRead
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-100 dark:bg-[#182235] text-[#64748B] dark:text-[#94A3B8]'
                        }`}
                      >
                        {isRead ? '✓' : idx + 1}
                      </span>
                      <span className="line-clamp-2 leading-relaxed">{sec.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        </>
      )}

      {/* ── Central Editorial Article (max-width between 760 and 820px) ───── */}
      <main className="max-w-[780px] w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Anotações Pessoais Panel */}
        {showNoteDrawer && (
          <div className="mb-8 p-4 sm:p-5 rounded-xl border border-[#E2E8F0] dark:border-[#263244] bg-white dark:bg-[#111827] shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#172033] dark:text-[#E5E7EB]">
                <MessageSquare className="w-4 h-4 text-[#0F766E] dark:text-[#14B8A6]" />
                <span>Anotações Pessoais</span>
              </div>
              <button
                onClick={() => setShowNoteDrawer(false)}
                className="text-xs text-[#64748B] dark:text-[#94A3B8] hover:underline cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="Escreva suas correlações clínicas, associações fisiopatológicas ou observações..."
              rows={4}
              className="w-full text-sm p-3 rounded-lg border border-[#E2E8F0] dark:border-[#263244] bg-[#F6F7F9] dark:bg-[#182235] text-[#172033] dark:text-[#E5E7EB] placeholder:text-[#94A3B8] focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            />
            <div className="mt-2.5 flex justify-end">
              <button
                onClick={handleSaveNote}
                className="px-3 py-1.5 bg-[#0F766E] hover:bg-teal-800 dark:bg-[#14B8A6] dark:hover:bg-teal-400 text-white dark:text-[#0B1220] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Salvar anotação
              </button>
            </div>
          </div>
        )}

        {/* ── Article Header (Without outer card) ───────────────────── */}
        <header className="mb-10 pb-8 border-b border-[#E2E8F0] dark:border-[#263244]">
          {/* Breadcrumb & Category */}
          <div className="text-xs font-semibold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6] mb-2">
            {discipline?.name || 'Medicina'} · {theme?.name}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#172033] dark:text-[#E5E7EB] leading-[1.2]">
            {compendium.title}
          </h1>

          {/* Subtitle */}
          {compendium.subtitle && (
            <p className="text-base sm:text-lg text-[#64748B] dark:text-[#94A3B8] font-normal leading-relaxed mt-3">
              {compendium.subtitle}
            </p>
          )}

          {/* Typographic Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8] mt-4 pt-3">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{compendium.estimatedReadTimeMinutes || 10} min de leitura</span>
            </span>
            <span>•</span>
            <span>{authorDisplay}</span>
            <span>•</span>
            <span>Atualizado: {lastUpdatedDisplay}</span>
          </div>

          {/* Tags */}
          {compendium.tags && compendium.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {compendium.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-[#182235] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#263244]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* ── Article Sections (Clean spacing, no big wrapper cards) ── */}
        <div className="space-y-12">
          {compendium.sections.map((sec, idx) => {
            const isRead = readSectionIds.includes(sec.id);

            return (
              <section
                key={sec.id}
                id={sec.id}
                className="pb-10 border-b border-[#E2E8F0] dark:border-[#263244] last:border-b-0"
              >
                {/* Section Sub-header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6]">
                    {sec.mechanismTag || `Seção ${idx + 1}`}
                  </span>

                  {/* Inline actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCreateFlashcardFromSection(sec)}
                      className="px-2 py-1 rounded-md text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#182235] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Gerar flashcard com os pontos desta seção"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
                      <span className="hidden sm:inline">Gerar flashcard</span>
                    </button>

                    <button
                      onClick={() => handleToggleRead(sec.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isRead
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-[#0F766E] dark:text-[#14B8A6]'
                          : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#182235]'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          isRead ? 'text-teal-600 dark:text-teal-400' : 'text-[#94A3B8]'
                        }`}
                      />
                      <span>{isRead ? 'Lida' : 'Marcar lida'}</span>
                    </button>
                  </div>
                </div>

                {/* Section Title */}
                <h2 className="text-xl sm:text-2xl font-bold text-[#172033] dark:text-[#E5E7EB] mb-4">
                  {sec.title}
                </h2>

                {/* Section Content with Safe Markdown (no dangerouslySetInnerHTML) */}
                <div className="text-[17px] leading-[1.7] text-[#172033] dark:text-[#E5E7EB]">
                  <SafeMarkdown content={sec.content} />
                </div>

                {/* Key Takeaways Callout (Teal border only) */}
                {sec.keyTakeaways && sec.keyTakeaways.length > 0 && (
                  <div className="mt-6 p-4 rounded-r-lg border-l-4 border-[#0F766E] dark:border-[#14B8A6] bg-teal-500/5 dark:bg-teal-500/10">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0F766E] dark:text-[#14B8A6] mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pontos-chave & Mecanismos</span>
                    </div>
                    <ul className="space-y-1.5 text-sm text-[#172033] dark:text-[#E5E7EB]">
                      {sec.keyTakeaways.map((takeaway, tIdx) => (
                        <li key={tIdx} className="flex items-start gap-2">
                          <span className="text-[#0F766E] dark:text-[#14B8A6] mt-0.5 shrink-0">•</span>
                          <span>{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Clinical Pearl Callout (Amber border only) */}
                {sec.clinicalPearl && (
                  <div className="mt-4 p-4 rounded-r-lg border-l-4 border-[#F59E0B] bg-amber-500/5 dark:bg-amber-500/10 flex items-start gap-3">
                    <Lightbulb className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B] block mb-0.5">
                        Pérola clínica & Aplicação
                      </span>
                      <p className="text-sm text-[#172033] dark:text-[#E5E7EB] leading-relaxed">
                        {sec.clinicalPearl}
                      </p>
                    </div>
                  </div>
                )}

                {/* Warning Alert (Red border only) */}
                {sec.warningAlert && (
                  <div className="mt-4 p-4 rounded-r-lg border-l-4 border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">
                        Atenção redobrada
                      </span>
                      <p className="text-sm text-[#172033] dark:text-[#E5E7EB] leading-relaxed">
                        {sec.warningAlert}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* ── Discreet Action Bar for "Fixação & Retenção Ativa" ───── */}
        <div className="my-10 p-4 sm:p-5 rounded-xl border border-[#E2E8F0] dark:border-[#263244] bg-white dark:bg-[#111827] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#172033] dark:text-[#E5E7EB]">
              Fixação e Retenção Ativa
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Consolide os conceitos deste material resolvendo questões e revisando flashcards.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenFlashcardsForTheme(compendium.themeId)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#263244] hover:bg-slate-50 dark:hover:bg-[#182235] text-[#172033] dark:text-[#E5E7EB] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#14B8A6]" />
              <span>Flashcards</span>
            </button>

            <button
              onClick={() => onOpenQuestionsForTheme(compendium.themeId)}
              className="px-3 py-1.5 rounded-lg bg-[#0F766E] hover:bg-teal-800 dark:bg-[#14B8A6] dark:hover:bg-teal-400 text-white dark:text-[#0B1220] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Resolver questões</span>
            </button>
          </div>
        </div>

        {/* ── References ───────────────────────────────────────────── */}
        {compendium.references && compendium.references.length > 0 && (
          <footer className="pt-6 border-t border-[#E2E8F0] dark:border-[#263244]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-3">
              Referências Bibliográficas & Diretrizes
            </h4>
            <ul className="space-y-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              {compendium.references.map((ref, rIdx) => (
                <li key={rIdx} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-[#94A3B8]">[{rIdx + 1}]</span>
                  <span>{ref}</span>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </main>
    </div>
  );
};
