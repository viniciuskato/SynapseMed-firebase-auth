import React, { useMemo } from 'react';
import {
  Flame,
  Layers,
  BookOpen,
  HelpCircle,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Brain,
  Award,
  Timer,
  BookMarked,
} from 'lucide-react';
import { Discipline, Theme, Question, Compendium, Flashcard, ClinicalCase } from '../../types';
import { StorageService } from '../../services/storage';
import { isCardDueToday } from '../../services/srsAlgorithm';

interface DashboardViewProps {
  disciplines: Discipline[];
  themes: Theme[];
  questions: Question[];
  compendiums: Compendium[];
  flashcards: Flashcard[];
  clinicalCases: ClinicalCase[];
  onSelectView: (view: string) => void;
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onOpenQuestion: (questionId: string) => void;
  onOpenCase: (caseId: string) => void;
  onStartSRS: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  disciplines,
  themes,
  questions,
  compendiums,
  flashcards,
  clinicalCases,
  onSelectView,
  onOpenCompendium,
  onOpenQuestion,
  onOpenCase,
  onStartSRS,
}) => {
  const stats = StorageService.getStats();
  const answers = StorageService.getAnswers();
  const readingProgress = StorageService.getReadingProgress();
  const bookmarks = StorageService.getBookmarks();

  const answersArray = Object.values(answers);
  const totalAnswered = answersArray.length;
  const totalCorrect = answersArray.filter((a) => a.isCorrect).length;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const dueCards = useMemo(() => {
    return flashcards.filter((fc) => isCardDueToday(fc));
  }, [flashcards]);

  const mistakesList = useMemo(() => {
    return answersArray.filter((a) => !a.isCorrect);
  }, [answersArray]);

  // Discipline Performance Breakdown
  const disciplinePerformance = useMemo(() => {
    return disciplines.map((disc) => {
      const discQuestions = questions.filter((q) => q.disciplineId === disc.id);
      const discAnswers = answersArray.filter((a) => {
        const q = questions.find((item) => item.id === a.questionId);
        return q?.disciplineId === disc.id;
      });

      const answered = discAnswers.length;
      const correct = discAnswers.filter((a) => a.isCorrect).length;
      const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;

      return {
        discipline: disc,
        totalQuestions: discQuestions.length,
        answered,
        correct,
        accuracy: acc,
      };
    });
  }, [disciplines, questions, answersArray]);

  // Smart Synapse Recommendation
  const smartRecommendation = useMemo(() => {
    if (mistakesList.length > 0) {
      const lastMistake = mistakesList[mistakesList.length - 1];
      const q = questions.find((item) => item.id === lastMistake.questionId);
      if (q) {
        const comp = compendiums.find((c) => c.id === q.compendiumRefId);
        const th = themes.find((t) => t.id === q.themeId);
        return {
          type: 'mistake_remediation',
          title: `Feche sua lacuna em ${th?.name || 'Clínica Médica'}`,
          description: `Você cometeu um erro recente na questão sobre "${q.questionStem.slice(0, 60)}...". Recomendamos revisar o compêndio teórico e fixar os conceitos.`,
          compendiumId: q.compendiumRefId,
          sectionId: q.compendiumSectionId,
          themeName: th?.name,
          compendiumTitle: comp?.title || 'Compêndio Teórico',
        };
      }
    }

    // Default recommendation if no mistakes
    const highYieldComp = compendiums[0];
    return {
      type: 'explore',
      title: 'Destaque de Alta Relevância (High-Yield)',
      description: `Explore o compêndio "${highYieldComp?.title}" para sedimentar a base fisiopatológica e os critérios diagnósticos mais cobrados.`,
      compendiumId: highYieldComp?.id,
      compendiumTitle: highYieldComp?.title || 'Compêndio Teórico',
    };
  }, [mistakesList, questions, compendiums, themes]);

  return (
    <div className="space-y-6">
      {/* Welcome & Study Momentum Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-teal-800/30">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ecossistema de Alta Performance Médica</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, Doutor(a)! Pronto para aprofundar seus estudos hoje?
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Seu circuito de retenção está ativo. Questões comentadas, leitura de mecanismos teóricos e repetição espaçada operam de forma integrada para maximizar sua aprovação.
          </p>
        </div>

        {/* Quick CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={onStartSRS}
            className="px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Layers className="w-4 h-4 fill-slate-950" />
            <span>
              {dueCards.length > 0 ? `Revisar ${dueCards.length} Flashcards` : 'Revisar Flashcards'}
            </span>
          </button>

          <button
            onClick={() => onSelectView('questions')}
            className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Resolver Questões</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/50 shrink-0">
            <Flame className="w-6 h-6 fill-amber-500" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Ofensiva
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {stats.streakDays}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">dias seguidos</span>
            </div>
          </div>
        </div>

        {/* Accuracy */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Acurácia Geral
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">{accuracy}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                ({totalCorrect}/{totalAnswered})
              </span>
            </div>
          </div>
        </div>

        {/* Due Cards */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800/50 shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              SRS Pendente
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-teal-800 dark:text-teal-400">
                {dueCards.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">cards hoje</span>
            </div>
          </div>
        </div>

        {/* Error Notebook */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center gap-4 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800/50 shrink-0">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Caderno de Erros
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-400">
                {mistakesList.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">a revisar</span>
            </div>
          </div>
        </div>
      </div>

      {/* The Synapse Diagnostic & Recommendation Loop */}
      <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden border border-teal-800/40">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2 text-teal-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Recomendação de Estudo Inteligente</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {smartRecommendation.title}
          </h2>

          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            {smartRecommendation.description}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {smartRecommendation.compendiumId && (
              <button
                onClick={() =>
                  onOpenCompendium(
                    smartRecommendation.compendiumId!,
                    smartRecommendation.sectionId
                  )
                }
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Abrir Compêndio: {smartRecommendation.compendiumTitle}</span>
              </button>
            )}

            {mistakesList.length > 0 && (
              <button
                onClick={() => onSelectView('errors')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <BookMarked className="w-4 h-4 text-rose-300" />
                <span>Ver Todos os Erros</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two Columns: Discipline Mastery & Fast Access Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Discipline Performance Bars */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Desempenho & Domínio por Especialidade
              </h3>
            </div>
            <button
              onClick={() => onSelectView('questions')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todas as questões</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {disciplinePerformance.map(({ discipline, totalQuestions, answered, accuracy: acc }) => (
              <div key={discipline.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-200">{discipline.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      ({answered} respondidas de {totalQuestions})
                    </span>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      acc >= 70 ? 'text-emerald-600 dark:text-emerald-400' : acc >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {answered > 0 ? `${acc}% acerto` : 'Sem respostas'}
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all rounded-full ${
                      acc >= 70
                        ? 'bg-emerald-500'
                        : acc >= 50
                        ? 'bg-amber-500'
                        : answered > 0
                        ? 'bg-rose-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    style={{ width: `${Math.max(5, acc)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Quick Hub & Clinical Cases */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <Stethoscope className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Casos Clínicos em Destaque</h3>
            </div>

            <div className="space-y-3">
              {clinicalCases.slice(0, 2).map((cc) => (
                <div
                  key={cc.id}
                  onClick={() => onOpenCase(cc.id)}
                  className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[10px] text-purple-800 dark:text-purple-300 font-bold mb-1">
                    <span>{cc.difficulty.toUpperCase()}</span>
                    <span>~{cc.estimatedMinutes} min</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-900 dark:group-hover:text-purple-300 line-clamp-1">
                    {cc.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    "{cc.chiefComplaint}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onSelectView('clinical-cases')}
              className="w-full py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 text-purple-900 dark:text-purple-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-purple-100 dark:border-purple-900/30"
            >
              <span>Ver Todos os Casos Clínicos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
