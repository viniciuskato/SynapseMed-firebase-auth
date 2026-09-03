import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  BookOpen,
  HelpCircle,
  Layers,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Compendium, Question, Flashcard } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  compendiums: Compendium[];
  questions: Question[];
  flashcards: Flashcard[];
  onNavigateToCompendium: (compendiumId: string, sectionId?: string) => void;
  onNavigateToQuestion: (questionId: string) => void;
  onNavigateToFlashcards: (filterTag?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  compendiums,
  questions,
  flashcards,
  onNavigateToCompendium,
  onNavigateToQuestion,
  onNavigateToFlashcards,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'compendium' | 'question' | 'card'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Toggle search
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return { compendiums: [], questions: [], cards: [] };
    const q = query.toLowerCase().trim();

    const matchedCompendiums = compendiums.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.sections.some((s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
    );

    const matchedQuestions = questions.filter(
      (ques) =>
        ques.clinicalVignette.toLowerCase().includes(q) ||
        ques.questionStem.toLowerCase().includes(q) ||
        ques.generalCommentary.toLowerCase().includes(q) ||
        ques.tags.some((t) => t.toLowerCase().includes(q))
    );

    const matchedCards = flashcards.filter(
      (fc) =>
        fc.front.toLowerCase().includes(q) ||
        fc.back.toLowerCase().includes(q) ||
        fc.mechanismHighlight.toLowerCase().includes(q) ||
        fc.tags.some((t) => t.toLowerCase().includes(q))
    );

    return {
      compendiums: matchedCompendiums,
      questions: matchedQuestions,
      cards: matchedCards,
    };
  }, [query, compendiums, questions, flashcards]);

  if (!isOpen) return null;

  const totalResults =
    results.compendiums.length +
    results.questions.length +
    results.cards.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 gap-3">
          <Search className="w-5 h-5 text-teal-600 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Pesquisar mecanismo, doença, droga (ex: sepse, ICFEr, noradrenalina, GINA)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-slate-50/70 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Tudo ({totalResults})
          </button>
          <button
            onClick={() => setActiveFilter('compendium')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
              activeFilter === 'compendium'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Compêndios ({results.compendiums.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('question')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
              activeFilter === 'question'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Questões ({results.questions.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('card')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
              activeFilter === 'card'
                ? 'bg-teal-700 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flashcards ({results.cards.length})</span>
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!query.trim() ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-medium">Digite pelo menos 2 letras para pesquisar no acervo médico completo.</p>
              <div className="flex justify-center gap-2 pt-2 text-xs text-slate-400">
                <span>Sugestões:</span>
                <button onClick={() => setQuery('ICFEr')} className="underline text-teal-600">ICFEr</button>
                <button onClick={() => setQuery('Sepse')} className="underline text-teal-600">Sepse</button>
                <button onClick={() => setQuery('Asma')} className="underline text-teal-600">Asma</button>
                <button onClick={() => setQuery('PBE')} className="underline text-teal-600">PBE</button>
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-semibold">Nenhum resultado encontrado para "{query}".</p>
              <p className="text-xs text-slate-400 mt-1">Tente pesquisar por palavras-chave clínicas ou nomes de fármacos.</p>
            </div>
          ) : (
            <>
              {/* Compendiums Match */}
              {(activeFilter === 'all' || activeFilter === 'compendium') && results.compendiums.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Compêndios Teóricos & Diretrizes</span>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {results.compendiums.map((comp) => (
                      <button
                        key={comp.id}
                        onClick={() => {
                          onNavigateToCompendium(comp.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 hover:border-teal-300 hover:bg-teal-50/50 transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-800">
                            {comp.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{comp.subtitle}</p>
                          <span className="text-[10px] text-teal-600 font-medium">
                            {comp.sections.length} seções • {comp.estimatedReadTimeMinutes} min de leitura
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions Match */}
              {(activeFilter === 'all' || activeFilter === 'question') && results.questions.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Banco de Questões Comentadas</span>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {results.questions.map((qItem) => (
                      <button
                        key={qItem.id}
                        onClick={() => {
                          onNavigateToQuestion(qItem.id);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-0.5 max-w-[85%]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                              {qItem.institution} {qItem.year}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Dificuldade: {qItem.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium line-clamp-2">
                            {qItem.questionStem}
                          </p>
                          <p className="text-[10px] text-slate-500 line-clamp-1">
                            {qItem.highYieldSummary}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Flashcards Match */}
              {(activeFilter === 'all' || activeFilter === 'card') && results.cards.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Flashcards de Repetição Espaçada</span>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {results.cards.map((fc) => (
                      <button
                        key={fc.id}
                        onClick={() => {
                          onNavigateToFlashcards(fc.tags[0]);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-0.5 max-w-[85%]">
                          <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                            {fc.front}
                          </p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {fc.mechanismHighlight || fc.back}
                          </p>
                          <div className="flex gap-1">
                            {fc.tags.map((t) => (
                              <span key={t} className="text-[9px] px-1 bg-slate-100 text-slate-600 rounded">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Pressione <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono">ESC</kbd> para fechar</span>
          <span className="text-teal-700 font-medium">Pesquisa unificada em 3 bancos de dados</span>
        </div>
      </div>
    </div>
  );
};
