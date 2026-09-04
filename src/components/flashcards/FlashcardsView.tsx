import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  Filter,
  Brain,
  Trash2,
} from 'lucide-react';
import { Flashcard, Discipline, Theme } from '../../types';
import { isCardDueToday } from '../../services/srsAlgorithm';
import { flashcardsRepository } from '../../repositories/FlashcardsRepository';

interface FlashcardsViewProps {
  flashcards: Flashcard[];
  disciplines: Discipline[];
  themes: Theme[];
  onStartReview: (cardsToReview: Flashcard[]) => void;
  onOpenCreateModal: () => void;
  onOpenCompendium: (compendiumId: string) => void;
  onFlashcardUpdated: () => void;
  filterThemeId?: string;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  flashcards,
  disciplines,
  themes,
  onStartReview,
  onOpenCreateModal,
  onOpenCompendium,
  onFlashcardUpdated,
  filterThemeId,
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [selectedTheme, setSelectedTheme] = useState<string>(filterThemeId || 'all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'due' | 'learning' | 'mastered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [flippedCardIds, setFlippedCardIds] = useState<string[]>([]);

  const dueCards = useMemo(() => {
    return flashcards.filter((fc) => isCardDueToday(fc));
  }, [flashcards]);

  const filteredCards = useMemo(() => {
    return flashcards.filter((fc) => {
      if (selectedDiscipline !== 'all' && fc.disciplineId !== selectedDiscipline) {
        return false;
      }
      if (selectedTheme !== 'all' && fc.themeId !== selectedTheme) {
        return false;
      }
      if (selectedStatus === 'due' && !isCardDueToday(fc)) {
        return false;
      }
      if (selectedStatus === 'learning' && fc.srs?.state !== 'learning' && fc.srs?.state !== 'new') {
        return false;
      }
      if (selectedStatus === 'mastered' && fc.srs?.state !== 'mastered') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFront = fc.front.toLowerCase().includes(q);
        const matchesBack = fc.back.toLowerCase().includes(q);
        const matchesMech = (fc.mechanismHighlight || '').toLowerCase().includes(q);
        return matchesFront || matchesBack || matchesMech;
      }
      return true;
    });
  }, [flashcards, selectedDiscipline, selectedTheme, selectedStatus, searchQuery]);

  const toggleFlip = (id: string) => {
    if (flippedCardIds.includes(id)) {
      setFlippedCardIds(flippedCardIds.filter((cid) => cid !== id));
    } else {
      setFlippedCardIds([...flippedCardIds, id]);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    flashcardsRepository.deleteFlashcard(cardId);
    onFlashcardUpdated();
  };

  // Group stats by discipline
  const disciplineStats = useMemo(() => {
    return disciplines.map((disc) => {
      const discCards = flashcards.filter((c) => c.disciplineId === disc.id);
      const discDue = discCards.filter((c) => isCardDueToday(c));
      return {
        discipline: disc,
        total: discCards.length,
        due: discDue.length,
      };
    });
  }, [disciplines, flashcards]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-400/30">
            <Brain className="w-3.5 h-3.5" />
            <span>Repetição Espaçada Inteligente (SRS)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Flashcards com Algoritmo SM-2 Baseado em Evidências
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Memorize diretrizes, critérios diagnósticos e farmacodinâmica de forma duradoura. Cada cartão traz o mecanismo fisiopatológico resumido e link direto para o compêndio.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => onStartReview(dueCards.length > 0 ? dueCards : flashcards)}
            disabled={flashcards.length === 0}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>
              {dueCards.length > 0
                ? `Revisar ${dueCards.length} Cards Pendentes Hoje`
                : 'Revisar Todos os Cards'}
            </span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Flashcard</span>
          </button>
        </div>
      </div>

      {/* Discipline Decks Preview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {disciplineStats.map(({ discipline, total, due }) => (
          <div
            key={discipline.id}
            onClick={() => {
              setSelectedDiscipline(discipline.id);
              setSelectedTheme('all');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedDiscipline === discipline.id
                ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-600/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="text-[11px] font-bold text-slate-900 block truncate">
              {discipline.name}
            </span>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">{total} cards</span>
              {due > 0 ? (
                <span className="px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px]">
                  {due} hoje
                </span>
              ) : (
                <span className="text-emerald-600 text-[10px] font-medium">Em dia</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Pesquisar por conceito, droga, mecanismo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0 text-xs">
          {[
            { id: 'all', label: `Todos (${flashcards.length})` },
            { id: 'due', label: `Pendentes Hoje (${dueCards.length})` },
            {
              id: 'learning',
              label: `Em Aprendizado (${
                flashcards.filter((c) => c.srs?.state === 'learning' || c.srs?.state === 'new').length
              })`,
            },
            {
              id: 'mastered',
              label: `Dominados (${
                flashcards.filter((c) => c.srs?.state === 'mastered').length
              })`,
            },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id as any)}
              className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all ${
                selectedStatus === st.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Flashcards List */}
      {filteredCards.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
          <Layers className="w-8 h-8 mx-auto text-slate-300" />
          <p className="font-semibold text-sm">Nenhum flashcard encontrado com estes filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const isFlipped = flippedCardIds.includes(card.id);
            const disc = disciplines.find((d) => d.id === card.disciplineId);
            const th = themes.find((t) => t.id === card.themeId);
            const isDue = isCardDueToday(card);

            return (
              <div
                key={card.id}
                onClick={() => toggleFlip(card.id)}
                className={`bg-white rounded-3xl border transition-all p-5 shadow-xs flex flex-col justify-between cursor-pointer group select-none min-h-[220px] ${
                  isFlipped
                    ? 'border-teal-300 bg-teal-50/20'
                    : 'border-slate-200 hover:border-teal-200 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/60">
                      {disc?.name || 'Medicina'}
                    </span>
                    <div className="flex items-center gap-1">
                      {isDue && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                          Revisar Hoje
                        </span>
                      )}
                      {card.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCard(card.id);
                          }}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                          title="Excluir card personalizado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs font-serif-reading mt-2">
                    {!isFlipped ? (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Pergunta / Conceito:
                        </span>
                        <p className="font-bold text-slate-900 leading-snug">
                          {card.front}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block mb-1">
                          Resposta & Mecanismo:
                        </span>
                        <p className="text-slate-800 leading-relaxed font-medium">
                          {card.back}
                        </p>
                        {card.mechanismHighlight && (
                          <div className="p-2 bg-teal-50 rounded-xl text-[11px] text-teal-900 border border-teal-200/60">
                            <strong>Destaque:</strong> {card.mechanismHighlight}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Intervalo: {card.srs?.intervalDays ?? 0}d</span>
                  </span>
                  <span className="text-teal-700 font-semibold group-hover:underline">
                    {isFlipped ? 'Voltar à pergunta' : 'Virar para ver resposta'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
