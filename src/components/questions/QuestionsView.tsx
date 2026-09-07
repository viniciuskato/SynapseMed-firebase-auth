import React, { useState, useMemo, useEffect } from 'react';
import {
  HelpCircle,
  Search,
  Filter,
  Sparkles,
  Timer,
  Bookmark,
  CheckCircle2,
  XCircle,
  Plus,
  BookOpen,
} from 'lucide-react';
import { Question, Discipline, Theme, MedicalCycle, DifficultyLevel, QuestionAnswerRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { bookmarksRepository } from '../../repositories/BookmarksRepository';
import { answersRepository } from '../../repositories/AnswersRepository';
import { QuestionCard } from './QuestionCard';

interface QuestionsViewProps {
  questions: Question[];
  disciplines: Discipline[];
  themes: Theme[];
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onOpenCreateSimulado: () => void;
  filterThemeId?: string;
  focusQuestionId?: string;
}

export const QuestionsView: React.FC<QuestionsViewProps> = ({
  questions,
  disciplines,
  themes,
  onOpenCompendium,
  onOpenCreateSimulado,
  filterThemeId,
  focusQuestionId,
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [selectedTheme, setSelectedTheme] = useState<string>(filterThemeId || 'all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'unanswered' | 'correct' | 'incorrect' | 'bookmarked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [answers, setAnswers] = useState<Record<string, QuestionAnswerRecord>>({});
  const [bookmarks, setBookmarks] = useState<{
    questions: string[];
    compendiums: string[];
    flashcards: string[];
  }>({ questions: [], compendiums: [], flashcards: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [nextAnswers, nextBookmarks] = await Promise.all([
        answersRepository.getAnswers(),
        bookmarksRepository.getBookmarks(),
      ]);
      if (cancelled) return;
      setAnswers(nextAnswers);
      setBookmarks(nextBookmarks);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If focusQuestionId exists, locate it
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (focusQuestionId && q.id === focusQuestionId) return true;

      if (selectedDiscipline !== 'all' && q.disciplineId !== selectedDiscipline) {
        return false;
      }
      if (selectedTheme !== 'all' && q.themeId !== selectedTheme) {
        return false;
      }
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false;
      }

      // Status filter
      const ans = answers[q.id];
      if (selectedStatus === 'unanswered' && ans) return false;
      if (selectedStatus === 'correct' && (!ans || !ans.isCorrect)) return false;
      if (selectedStatus === 'incorrect' && (!ans || ans.isCorrect)) return false;
      if (selectedStatus === 'bookmarked' && !bookmarks.questions.includes(q.id)) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesStem = q.questionStem.toLowerCase().includes(query);
        const matchesVignette = q.clinicalVignette.toLowerCase().includes(query);
        const matchesInstitution = q.institution.toLowerCase().includes(query);
        const matchesTags = q.tags.some((t) => t.toLowerCase().includes(query));
        return matchesStem || matchesVignette || matchesInstitution || matchesTags;
      }

      return true;
    });
  }, [
    questions,
    selectedDiscipline,
    selectedTheme,
    selectedDifficulty,
    selectedStatus,
    searchQuery,
    answers,
    bookmarks,
    focusQuestionId,
  ]);

  const mistakesCount = (Object.values(answers) as QuestionAnswerRecord[]).filter((a) => !a.isCorrect).length;

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-teal-950 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white elev-md border border-teal-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-400/30">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Banco de Questões Médicas Comentadas · +35 XP por acerto</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Treino Deliberado Alternativa por Alternativa
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Cada questão traz a justificativa individual de por que cada distrator está incorreto. Ao errar, navegue diretamente à seção correspondente do compêndio e adicione o flashcard à sua rotina de repetição espaçada.
          </p>
        </div>

        <button
          onClick={onOpenCreateSimulado}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs elev-lg shadow-teal-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Timer className="w-4 h-4" />
          <span>Criar Simulado Personalizado</span>
        </button>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-[#243452] p-5 elev-xs space-y-4">
        {/* Top filter row: Search & Status Pills */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-96 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Pesquisar por vinheta clínica, banca (USP, ENARE)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#243452] bg-slate-50 dark:bg-[#142038] focus:bg-white dark:focus:bg-[#1A2845] focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Status buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto text-xs pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Todas as Questões' },
              { id: 'unanswered', label: 'Não Respondidas' },
              { id: 'incorrect', label: `Erros (${mistakesCount})` },
              { id: 'correct', label: 'Acertadas' },
              { id: 'bookmarked', label: 'Favoritas' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all cursor-pointer ${
                  selectedStatus === st.id
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white elev-xs'
                    : 'bg-slate-100 dark:bg-[#142038] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1A2845]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom filter row: Discipline, Theme, Difficulty */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Discipline Select */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">Disciplina:</span>
            <select
              value={selectedDiscipline}
              onChange={(e) => {
                setSelectedDiscipline(e.target.value);
                setSelectedTheme('all');
              }}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#243452] bg-slate-50 dark:bg-[#142038] text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
            >
              <option value="all">Todas</option>
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Theme Select */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">Tema:</span>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#243452] bg-slate-50 dark:bg-[#142038] text-slate-800 dark:text-slate-200 font-medium focus:outline-none max-w-xs truncate"
            >
              <option value="all">Todos os Temas</option>
              {themes
                .filter((t) => selectedDiscipline === 'all' || t.disciplineId === selectedDiscipline)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Difficulty Select */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">Dificuldade:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#243452] bg-slate-50 dark:bg-[#142038] text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
            >
              <option value="all">Todas</option>
              <option value="facil">Fácil</option>
              <option value="medio">Média</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(selectedDiscipline !== 'all' ||
            selectedTheme !== 'all' ||
            selectedDifficulty !== 'all' ||
            selectedStatus !== 'all' ||
            searchQuery) && (
            <button
              onClick={() => {
                setSelectedDiscipline('all');
                setSelectedTheme('all');
                setSelectedDifficulty('all');
                setSelectedStatus('all');
                setSearchQuery('');
              }}
              className="text-teal-700 hover:underline font-semibold ml-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Results Header Count */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-2">
        <span>
          Exibindo <strong className="text-slate-800 dark:text-slate-200">{filteredQuestions.length} questões</strong>
        </span>
        <span className="text-teal-600 dark:text-teal-400 font-semibold">
          Modo Estudo: Responda para ver a justificativa por alternativa (+35 XP)
        </span>
      </div>

      {/* Questions Stack */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-[#243452] p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
          <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
            Nenhuma questão encontrada com estes filtros.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Tente ajustar a disciplina ou status selecionado.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              discipline={disciplines.find((d) => d.id === q.disciplineId)}
              theme={themes.find((t) => t.id === q.themeId)}
              onOpenCompendium={onOpenCompendium}
            />
          ))}
        </div>
      )}
    </div>
  );
};
