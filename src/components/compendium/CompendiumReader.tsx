import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Clock,
  BookOpen,
  HelpCircle,
  Layers,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Share2,
  Highlighter,
  MessageSquare,
  FileText,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Info,
  Compass,
  Activity,
} from 'lucide-react';
import { Compendium, CompendiumSection, Discipline, Theme } from '../../types';
import { StorageService } from '../../services/storage';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scrollPercent, setScrollPercent] = useState(0);

  // Track scroll percentage for the top progress bar
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

  // Load progress and notes
  useEffect(() => {
    const progress = StorageService.getReadingProgress();
    const compProgress = progress[compendium.id];
    if (compProgress) {
      setReadSectionIds(compProgress.readSectionIds);
    }
    const bookmarks = StorageService.getBookmarks();
    setIsBookmarked(bookmarks.compendiums.includes(compendium.id));

    const notes = StorageService.getNotes();
    setUserNote(notes[compendium.id] || '');

    if (targetSectionId) {
      setActiveSectionId(targetSectionId);
      const elem = document.getElementById(targetSectionId);
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }
  }, [compendium.id, targetSectionId]);

  const handleToggleRead = (sectionId: string) => {
    const newPercent = StorageService.toggleSectionRead(
      compendium.id,
      sectionId,
      compendium.sections.length
    );
    const progress = StorageService.getReadingProgress();
    setReadSectionIds(progress[compendium.id]?.readSectionIds || []);

    if (newPercent === 100) {
      showToast('Parabéns! Você completou 100% da leitura deste material.');
    }
  };

  const handleToggleBookmark = () => {
    const bookmarked = StorageService.toggleBookmark('compendiums', compendium.id);
    setIsBookmarked(bookmarked);
    showToast(bookmarked ? 'Material salvo nos favoritos' : 'Removido dos favoritos');
  };

  const handleSaveNote = () => {
    StorageService.saveNote(compendium.id, userNote);
    showToast('Anotação pessoal salva com sucesso!');
  };

  const handleCreateFlashcardFromSection = (sec: CompendiumSection) => {
    StorageService.saveFlashcard({
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
    showToast('Flashcard inteligente criado e adicionado ao seu SRS!');
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const readingPercent = Math.round(
    (readSectionIds.length / Math.max(1, compendium.sections.length)) * 100
  );

  const isAtlas = compendium.mode !== 'mecanismos';

  return (
    <div className="min-h-screen bg-[#f4f0e8] dark:bg-[#111010] text-[#2a2620] dark:text-[#e2ddd6] transition-colors pb-24">
      {/* ── Top Reading Progress Bar (Base de Estudos Standard) ───── */}
      <div
        className="fixed top-0 left-0 h-[3px] bg-[#d4924a] z-50 transition-all duration-100"
        style={{ width: `${scrollPercent}%` }}
      />

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1919] text-[#e2ddd6] px-4 py-3 rounded-xl shadow-2xl border border-[#333131] text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <Sparkles className="w-4 h-4 text-[#d4924a] shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ── Subheader / Sticky Control Bar ──────────────────────── */}
      <div className="sticky top-[61px] z-20 bg-[#f4f0e8]/90 dark:bg-[#111010]/90 backdrop-blur-md border-b border-stone-300/80 dark:border-[#333131] px-4 sm:px-8 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg border border-stone-300 dark:border-[#333131] hover:bg-stone-200 dark:hover:bg-[#222121] text-stone-700 dark:text-stone-300 transition-colors shrink-0"
              title="Voltar ao Índice"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="truncate">
              <span className="text-[10px] font-mono-code uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 block truncate">
                {discipline?.name} · {theme?.name}
              </span>
              <h2 className="text-xs sm:text-sm font-serif-reading font-semibold text-stone-900 dark:text-[#e2ddd6] truncate">
                {compendium.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowNoteDrawer(!showNoteDrawer)}
              className={`p-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                showNoteDrawer
                  ? 'bg-amber-100 dark:bg-[#2a1810] text-amber-900 dark:text-[#d4924a] border-amber-300 dark:border-[#d4924a]'
                  : 'bg-white dark:bg-[#1a1919] border-stone-300 dark:border-[#333131] text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
              title="Anotações pessoais"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anotações</span>
            </button>

            <button
              onClick={handleToggleBookmark}
              className={`p-2 rounded-lg border transition-colors ${
                isBookmarked
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600'
                  : 'bg-white dark:bg-[#1a1919] border-stone-300 dark:border-[#333131] text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
              title={isBookmarked ? 'Favoritado' : 'Favoritar'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>

            <button
              onClick={() => onOpenQuestionsForTheme(compendium.themeId)}
              className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Resolver Questões</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout Container ──────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Left Sticky Navigation Sidebar (4 cols) ─────────────── */}
        <div className="lg:col-span-4 hidden lg:block">
          <div className="sticky top-[120px] space-y-4">
            {/* Sidebar Card */}
            <div className="bg-white dark:bg-[#1a1919] border border-stone-300 dark:border-[#333131] rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-stone-200 dark:border-[#333131] pb-2">
                <span className="text-[10px] font-mono-code uppercase font-bold tracking-widest text-stone-500 dark:text-stone-400">
                  Índice de Seções
                </span>
                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  {readSectionIds.length}/{compendium.sections.length} concluídas
                </span>
              </div>

              {/* Progress bar in card */}
              <div className="w-full bg-stone-200 dark:bg-[#222121] h-1.5 rounded-full overflow-hidden mb-4">
                <div
                  className="bg-[#d4924a] h-full transition-all duration-300"
                  style={{ width: `${readingPercent}%` }}
                />
              </div>

              {/* Sections list */}
              <div className="space-y-1 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                {compendium.sections.map((sec, idx) => {
                  const isRead = readSectionIds.includes(sec.id);
                  const isCurrent = activeSectionId === sec.id;

                  return (
                    <button
                      key={sec.id}
                      onClick={() => {
                        setActiveSectionId(sec.id);
                        const elem = document.getElementById(sec.id);
                        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-start gap-2.5 ${
                        isCurrent
                          ? 'bg-[#2a1810] dark:bg-[#2a1810] text-[#d4924a] font-bold border border-[#d4924a]/40'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#222121]'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-mono-code ${
                          isRead
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-stone-200 dark:bg-[#333131] text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        {isRead ? '✓' : idx + 1}
                      </span>
                      <span className="line-clamp-2 leading-relaxed">{sec.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Action Bridge */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1a1919] border border-stone-300 dark:border-[#333131] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-[#e2ddd6]">
                <Sparkles className="w-3.5 h-3.5 text-[#d4924a]" />
                <span>Fixação & Retenção Ativa</span>
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                Transforme os conceitos lidos em flashcards do algoritmo SM-2 ou teste seus conhecimentos práticos.
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={() => onOpenFlashcardsForTheme(compendium.themeId)}
                  className="w-full py-1.5 px-3 rounded-lg border border-stone-300 dark:border-[#333131] hover:bg-stone-100 dark:hover:bg-[#222121] text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-[#5b8dd9]" />
                  <span>Revisar Flashcards</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Content Article Area (8 cols) ─────────────────── */}
        <div className="lg:col-span-8 space-y-8">
          {/* Header Banner (Editorial Style) */}
          <div className="bg-white dark:bg-[#1a1919] rounded-xl border border-stone-300 dark:border-[#333131] p-6 sm:p-8 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                  isAtlas ? 'badge-atlas' : 'badge-mec'
                }`}
              >
                {isAtlas ? 'Compêndio de Área' : 'Mecanismo Fisiopatológico'}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-stone-100 dark:bg-[#222121] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#333131]">
                {discipline?.name || 'Medicina'}
              </span>
              <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 ml-auto font-mono-code">
                <Clock className="w-3.5 h-3.5" />
                <span>{compendium.estimatedReadTimeMinutes} min</span>
              </div>
            </div>

            <h1 className="font-serif-reading text-2xl sm:text-3xl font-bold text-stone-900 dark:text-[#e2ddd6] leading-tight">
              {compendium.title}
            </h1>
            <p className="font-serif-reading text-stone-600 dark:text-stone-400 text-sm sm:text-base mt-2.5 leading-relaxed italic">
              {compendium.subtitle}
            </p>

            {/* Tags */}
            {compendium.tags && compendium.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-stone-100 dark:border-[#222121]">
                {compendium.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 dark:bg-[#222121] text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#222121] flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400 font-mono-code">
              <span>Curadoria: <strong className="text-stone-700 dark:text-stone-300">{compendium.author}</strong></span>
              <span>Revisão: {compendium.lastUpdated}</span>
            </div>
          </div>

          {/* Conceptual Dependencies Panel (if present) */}
          {compendium.dependencies && compendium.dependencies.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#1a1919] border border-stone-300 dark:border-[#333131]">
              <span className="text-[10px] font-mono-code uppercase font-bold tracking-widest text-stone-500 dark:text-stone-400 block mb-2">
                Pré-Requisitos & Nós de Conexão
              </span>
              <div className="flex flex-wrap gap-2">
                {compendium.dependencies.map((dep, idx) => (
                  <div
                    key={idx}
                    className="text-xs px-3 py-1 rounded-lg bg-stone-100 dark:bg-[#222121] border border-stone-200 dark:border-[#333131] text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
                  >
                    <Compass className="w-3 h-3 text-[#d4924a]" />
                    <span>{dep.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Drawer */}
          {showNoteDrawer && (
            <div className="bg-amber-50 dark:bg-[#2a1810] border border-amber-200 dark:border-[#d4924a]/50 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-[#d4924a] font-bold text-xs">
                  <MessageSquare className="w-4 h-4" />
                  <span>Caderno de Anotações Pessoais</span>
                </div>
                <button
                  onClick={() => setShowNoteDrawer(false)}
                  className="text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 font-medium"
                >
                  Fechar
                </button>
              </div>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Escreva suas correlações clínicas, associações fisiopatológicas ou dúvidas..."
                rows={4}
                className="w-full text-xs p-3 rounded-lg border border-amber-200 dark:border-[#d4924a]/40 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleSaveNote}
                  className="px-3 py-1.5 bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] rounded-lg text-xs font-bold transition-colors"
                >
                  Salvar Anotação
                </button>
              </div>
            </div>
          )}

          {/* ── Sections List ────────────────────────────────────────── */}
          <div className="space-y-8">
            {compendium.sections.map((sec, idx) => {
              const isRead = readSectionIds.includes(sec.id);

              return (
                <article
                  key={sec.id}
                  id={sec.id}
                  className={`bg-white dark:bg-[#1a1919] rounded-xl border p-6 sm:p-8 shadow-xs transition-all ${
                    activeSectionId === sec.id
                      ? 'border-[#d4924a] ring-1 ring-[#d4924a]/20'
                      : 'border-stone-300 dark:border-[#333131]'
                  }`}
                >
                  {/* Section Top Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-stone-200 dark:border-[#222121]">
                    <span className="text-xs font-bold text-amber-900 dark:text-[#d4924a] font-mono-code">
                      {sec.mechanismTag || `Seção ${idx + 1}`}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCreateFlashcardFromSection(sec)}
                        className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-[#222121] hover:bg-stone-200 dark:hover:bg-[#333131] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#333131] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Criar Flashcard com os pontos desta seção"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#5b8dd9]" />
                        <span>Gerar Flashcard</span>
                      </button>

                      <button
                        onClick={() => handleToggleRead(sec.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isRead
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-stone-100 dark:bg-[#222121] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#333131] border border-stone-200 dark:border-[#333131]'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            isRead ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'
                          }`}
                        />
                        <span>{isRead ? 'Lida' : 'Marcar Lida'}</span>
                      </button>
                    </div>
                  </div>

                  <h3 className="font-serif-reading text-xl font-bold text-stone-900 dark:text-[#e2ddd6] mb-4">
                    {sec.title}
                  </h3>

                  {/* Formatted Content */}
                  <div className="font-serif-reading text-stone-800 dark:text-[#e2ddd6] text-sm sm:text-base leading-relaxed space-y-4">
                    {sec.content.split('\n\n').map((paragraph, pIdx) => {
                      // Table rendering
                      if (paragraph.startsWith('|')) {
                        const rows = paragraph.split('\n').filter((r) => r.trim());
                        return (
                          <div key={pIdx} className="overflow-x-auto my-4 font-sans">
                            <table className="w-full text-xs text-left border-collapse border border-stone-200 dark:border-[#333131] rounded-lg overflow-hidden">
                              <tbody>
                                {rows.map((row, rIdx) => {
                                  const cols = row.split('|').map((c) => c.trim()).filter((c) => c);
                                  if (row.includes('---')) return null;
                                  return (
                                    <tr
                                      key={rIdx}
                                      className={
                                        rIdx === 0
                                          ? 'bg-stone-100 dark:bg-[#222121] font-bold text-stone-900 dark:text-[#e2ddd6]'
                                          : 'border-t border-stone-200 dark:border-[#333131] hover:bg-stone-50 dark:hover:bg-[#222121]/50'
                                      }
                                    >
                                      {cols.map((col, cIdx) => (
                                        <td key={cIdx} className="p-2.5 border border-stone-200 dark:border-[#333131]">
                                          {col}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      return (
                        <p key={pIdx} className="whitespace-pre-line">
                          {paragraph}
                        </p>
                      );
                    })}
                  </div>

                  {/* Key Takeaways Box */}
                  {sec.keyTakeaways && sec.keyTakeaways.length > 0 && (
                    <div className="mt-6 p-4 rounded-lg bg-stone-50 dark:bg-[#222121] border border-stone-200 dark:border-[#333131] border-l-3 border-l-[#d4924a]">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-[#d4924a] uppercase tracking-wider mb-2 font-mono-code">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Pontos-Chave & Mecanismos Essenciais</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300 font-sans">
                        {sec.keyTakeaways.map((takeaway, tIdx) => (
                          <li key={tIdx} className="flex items-start gap-2">
                            <span className="text-[#d4924a] font-bold leading-none">•</span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Clinical Pearl */}
                  {sec.clinicalPearl && (
                    <div className="mt-4 p-4 rounded-lg bg-[#2a1810] border border-[#d4924a]/30 border-l-3 border-l-[#c0604a] flex items-start gap-3">
                      <div className="p-1 rounded bg-[#d4924a]/20 text-[#d4924a] shrink-0 mt-0.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#d4924a] block mb-0.5 font-mono-code uppercase tracking-wider">
                          Pérola Clínica & Aplicação
                        </span>
                        <p className="text-xs text-[#e2ddd6] leading-relaxed font-sans">
                          {sec.clinicalPearl}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Warning Alert */}
                  {sec.warningAlert && (
                    <div className="mt-4 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 border-l-3 border-l-rose-500 flex items-start gap-3">
                      <div className="p-1 rounded bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-rose-900 dark:text-rose-300 block mb-0.5 font-mono-code uppercase tracking-wider">
                          Armadilha / Atenção Redobrada
                        </span>
                        <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-sans">
                          {sec.warningAlert}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* References Section */}
          <div className="bg-white dark:bg-[#1a1919] rounded-xl border border-stone-300 dark:border-[#333131] p-6 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-3 flex items-center gap-1.5 font-mono-code">
              <FileText className="w-3.5 h-3.5" />
              <span>Referências Bibliográficas & Diretrizes Oficiais</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 font-serif-reading">
              {compendium.references.map((ref, rIdx) => (
                <li key={rIdx} className="flex items-start gap-2">
                  <span className="text-stone-400 font-mono text-[10px]">[{rIdx + 1}]</span>
                  <span>{ref}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
