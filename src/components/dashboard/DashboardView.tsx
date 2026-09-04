import React, { useMemo } from 'react';
import {
  Flame,
  Layers,
  BookOpen,
  HelpCircle,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Brain,
  Clock,
  BookMarked,
  Compass,
  Activity,
  UserCheck,
  Calendar,
  RotateCcw,
  Target,
  ChevronRight,
} from 'lucide-react';
import { Discipline, Theme, Question, Compendium, Flashcard } from '../../types';
import { StorageService } from '../../services/storage';
import { answersRepository } from '../../repositories/AnswersRepository';
import { readingProgressRepository } from '../../repositories/ReadingProgressRepository';
import { errorNotebookRepository } from '../../repositories/ErrorNotebookRepository';
import { isCardDueToday } from '../../services/srsAlgorithm';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardViewProps {
  disciplines: Discipline[];
  themes: Theme[];
  questions: Question[];
  compendiums: Compendium[];
  flashcards: Flashcard[];
  onSelectView: (view: string) => void;
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onOpenQuestion: (questionId: string) => void;
  onStartSRS: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  disciplines,
  themes,
  questions,
  compendiums,
  flashcards,
  onSelectView,
  onOpenCompendium,
  onOpenQuestion,
  onStartSRS,
}) => {
  const { user, profile } = useAuth();
  const userName = profile?.displayName || user?.displayName || 'Colega';

  // Persistence data (isolado por UID)
  const stats = StorageService.getStats();
  const answers = answersRepository.getAnswers();
  const readingProgress = readingProgressRepository.getReadingProgress();
  const errorLogs = errorNotebookRepository.getErrorLogs();

  const answersArray = Object.values(answers);
  const totalAnswered = answersArray.length;
  const totalCorrect = answersArray.filter((a) => a.isCorrect).length;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Flashcards programados para hoje
  const dueCards = useMemo(() => {
    return flashcards.filter((fc) => isCardDueToday(fc));
  }, [flashcards]);

  // "Continuar de onde parou" (Real User Progress)
  const continueReading = useMemo(() => {
    const startedCompendiums = compendiums
      .map((comp) => {
        const prog = readingProgress[comp.id];
        return {
          compendium: comp,
          percent: prog?.percent || 0,
          readSectionsCount: prog?.readSectionIds?.length || 0,
          lastSectionId: prog?.readSectionIds?.slice(-1)[0] || comp.sections[0]?.id,
        };
      })
      .filter((item) => item.percent > 0 && item.percent < 100)
      .sort((a, b) => b.percent - a.percent);

    return startedCompendiums[0] || null;
  }, [compendiums, readingProgress]);

  // Materiais estudados recentemente
  const recentlyStudied = useMemo(() => {
    return compendiums
      .filter((comp) => (readingProgress[comp.id]?.percent || 0) > 0)
      .slice(0, 3);
  }, [compendiums, readingProgress]);

  // Materiais novos ou atualizados (ordenados por lastUpdated)
  const updatedMaterials = useMemo(() => {
    return [...compendiums]
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 4);
  }, [compendiums]);

  // Lacunas identificadas a partir dos erros reais
  const recentMistakes = useMemo(() => {
    return answersArray
      .filter((a) => !a.isCorrect)
      .slice(-3)
      .reverse();
  }, [answersArray]);

  // Meta diária de estudos
  const dailyTarget = 15;
  const todayStr = new Date().toISOString().split('T')[0];
  const questionsAnsweredToday = answersArray.filter((a) => a.timestamp?.startsWith(todayStr)).length;
  const currentDailyActivity = questionsAnsweredToday + (stats.cardsReviewedToday || 0);
  const dailyProgressPercent = Math.min(100, Math.round((currentDailyActivity / dailyTarget) * 100));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* ── 1. Saudação personalizada & Apresentação da Plataforma ── */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-teal-400 text-xs font-semibold border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span>Beta Privada · Ambiente de Estudos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif-reading font-bold tracking-tight text-white">
            Olá, {userName}! Bem-vindo ao SynapseMed.
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Seu acervo médico completo está liberado. Acompanhe seu progresso de leitura, resolva questões comentadas e mantenha o circuito de repetição espaçada em dia.
          </p>
        </div>

        {/* Ações rápidas principais */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={() => onSelectView('compendiums')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Biblioteca Médica</span>
          </button>
          <button
            onClick={() => onSelectView('questions')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Resolver Questões</span>
          </button>
        </div>
      </div>

      {/* ── 2. "Continuar de onde parou" / Estado Inicial ─────────── */}
      {continueReading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-teal-200/80 dark:border-teal-900/50 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider text-[10px]">Continuar de onde parou</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {continueReading.percent}% concluído
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-serif-reading font-bold text-slate-900 dark:text-slate-100 truncate">
              {continueReading.compendium.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {continueReading.compendium.subtitle}
            </p>
          </div>

          <button
            onClick={() =>
              onOpenCompendium(
                continueReading.compendium.id,
                continueReading.lastSectionId
              )
            }
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>Retomar Leitura</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : totalAnswered === 0 && recentlyStudied.length === 0 ? (
        /* Estado inicial claro para usuários sem histórico */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-5 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Pronto para iniciar sua trilha de estudos?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                Você ainda não registrou leituras ou questões neste perfil. Escolha uma especialidade abaixo ou resolva sua primeira questão comentada para ativar suas estatísticas de desempenho.
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectView('compendiums')}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            Abrir Biblioteca
          </button>
        </div>
      ) : null}

      {/* ── 3. Painel de Métricas e Desempenho Real ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ofensiva */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ofensiva</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.streakDays} <span className="text-xs font-normal text-slate-400">dias seguidos</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {stats.streakDays > 0 ? 'Ritmo de estudos mantido' : 'Inicie sua sequência hoje'}
          </p>
        </div>

        {/* Flashcards SRS de Hoje */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Revisões Hoje</span>
            <Brain className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-700 dark:text-teal-400">
            {dueCards.length} <span className="text-xs font-normal text-slate-400">cards pendentes</span>
          </div>
          <button
            onClick={onStartSRS}
            className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            {dueCards.length > 0 ? 'Revisar agora →' : 'Em dia ✓'}
          </button>
        </div>

        {/* Desempenho Recente */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Acurácia Geral</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalAnswered > 0 ? `${accuracy}%` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {totalAnswered > 0 ? `${totalCorrect} acertos de ${totalAnswered}` : 'Nenhuma questão respondida'}
          </p>
        </div>

        {/* Metas Diárias */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Meta Diária</span>
            <Target className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {currentDailyActivity}/{dailyTarget} <span className="text-xs font-normal text-slate-400">atividades</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-purple-600 h-full rounded-full transition-all"
              style={{ width: `${dailyProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 4. Lacunas identificadas a partir dos erros ────────────── */}
      {recentMistakes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-3 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900/50">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Lacunas Identificadas a Partir dos Erros
              </h3>
            </div>

            <button
              onClick={() => onSelectView('errors')}
              className="text-xs font-semibold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Abrir Caderno de Erros ({errorLogs.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            O SynapseMed mapeou os erros recentes nas questões para sugerir a revisão de mecanismos teóricos:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentMistakes.map((ans, idx) => {
              const q = questions.find((item) => item.id === ans.questionId);
              const th = themes.find((t) => t.id === q?.themeId);
              const comp = compendiums.find((c) => c.id === q?.compendiumRefId);

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                      {th?.name || 'Clínica Médica'}
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                      {q?.questionStem || 'Questão registrada com erro'}
                    </p>
                  </div>

                  {comp && (
                    <button
                      onClick={() => onOpenCompendium(comp.id, q?.compendiumSectionId)}
                      className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Revisar compêndio</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Biblioteca Médica por Especialidade ─────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Biblioteca por Especialidade Médica
            </h2>
          </div>
          <button
            onClick={() => onSelectView('compendiums')}
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver acervo completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {disciplines.map((disc) => {
            const count = compendiums.filter((c) => c.disciplineId === disc.id).length;
            return (
              <button
                key={disc.id}
                onClick={() => onSelectView('compendiums')}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500/70 p-4 text-left transition-all cursor-pointer shadow-xs group"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/60 group-hover:text-teal-700 dark:group-hover:text-teal-300 flex items-center justify-center mb-2.5 transition-colors">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 leading-tight">
                  {disc.name}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  {count} {count === 1 ? 'material' : 'materiais'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 6. Materiais Novos ou Atualizados & Materiais Recentes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materiais Atualizados Recentemente */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Materiais Novos e Atualizados
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Curadoria editorial</span>
          </div>

          <div className="space-y-3">
            {updatedMaterials.map((comp) => {
              const disc = disciplines.find((d) => d.id === comp.disciplineId);
              return (
                <div
                  key={comp.id}
                  onClick={() => onOpenCompendium(comp.id)}
                  className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 transition-colors cursor-pointer group flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="font-semibold text-teal-700 dark:text-teal-400 uppercase">
                        {disc?.name}
                      </span>
                      <span>•</span>
                      <span>{comp.lastUpdated}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 truncate">
                      {comp.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {comp.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400 group-hover:text-teal-600 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{comp.estimatedReadTimeMinutes} min</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Materiais Estudados Recentemente */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Estudados Recentemente
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Seu histórico</span>
          </div>

          {recentlyStudied.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum compêndio iniciado ainda.
              </p>
              <button
                onClick={() => onSelectView('compendiums')}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Explorar biblioteca de compêndios →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentlyStudied.map((comp) => {
                const prog = readingProgress[comp.id];
                return (
                  <div
                    key={comp.id}
                    onClick={() => onOpenCompendium(comp.id)}
                    className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 transition-colors cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 truncate">
                        {comp.title}
                      </h4>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-teal-600 h-full rounded-full transition-all"
                          style={{ width: `${prog?.percent || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block">
                        {prog?.percent || 0}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">concluído</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
