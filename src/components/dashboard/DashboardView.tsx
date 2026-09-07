import React, { useMemo, useState, useEffect } from 'react';
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
  RotateCcw,
  Target,
  ChevronRight,
  Trophy,
  Award,
  Zap,
  Star,
  Lock,
  Check,
  X,
  Play,
} from 'lucide-react';
import {
  Discipline,
  Theme,
  Question,
  Compendium,
  Flashcard,
  QuestionAnswerRecord,
  ErrorLogItem,
} from '../../types';
import { StorageService } from '../../services/storage';
import { answersRepository } from '../../repositories/AnswersRepository';
import { readingProgressRepository } from '../../repositories/ReadingProgressRepository';
import { errorNotebookRepository } from '../../repositories/ErrorNotebookRepository';
import { isCardDueToday } from '../../services/srsAlgorithm';
import { useAuth } from '../../contexts/AuthContext';
import {
  GamificationService,
  Achievement,
  DailyQuest,
} from '../../services/gamification';

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
  const userName = profile?.displayName || user?.user_metadata?.display_name || 'Colega';

  // Persistence data
  const stats = StorageService.getStats();
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerRecord>>({});
  const [readingProgress, setReadingProgress] = useState<
    Record<string, { readSectionIds: string[]; percent: number }>
  >({});
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [nextAnswers, nextProgress, nextErrorLogs] = await Promise.all([
        answersRepository.getAnswers(),
        readingProgressRepository.getReadingProgress(),
        errorNotebookRepository.getErrorLogs(),
      ]);
      if (cancelled) return;
      setAnswers(nextAnswers);
      setReadingProgress(nextProgress);
      setErrorLogs(nextErrorLogs);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const answersArray: QuestionAnswerRecord[] = useMemo(() => Object.values(answers), [answers]);
  const totalAnswered = answersArray.length;
  const totalCorrect = answersArray.filter((a) => a.isCorrect).length;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Gamificação: Cálculo de XP, Nível e Missões Diárias
  const totalXp = useMemo(() => {
    return GamificationService.calculateXp(answers, stats, readingProgress);
  }, [answers, stats, readingProgress]);

  const levelInfo = useMemo(() => {
    return GamificationService.getLevelInfo(totalXp);
  }, [totalXp]);

  const dailyQuests: DailyQuest[] = useMemo(() => {
    return GamificationService.getDailyQuests(answers, stats, readingProgress);
  }, [answers, stats, readingProgress]);

  const achievements: Achievement[] = useMemo(() => {
    return GamificationService.getAchievements(answers, stats, readingProgress);
  }, [answers, stats, readingProgress]);

  const unlockedAchievementsCount = useMemo(() => {
    return achievements.filter((a) => a.unlocked).length;
  }, [achievements]);

  // Flashcards programados para hoje
  const dueCards = useMemo(() => {
    return flashcards.filter((fc) => isCardDueToday(fc));
  }, [flashcards]);

  // "Continuar de onde parou"
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

  // Materiais novos ou atualizados
  const updatedMaterials = useMemo(() => {
    return [...compendiums]
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 4);
  }, [compendiums]);

  // Lacunas identificadas a partir dos erros
  const recentMistakes = useMemo(() => {
    return answersArray
      .filter((a) => !a.isCorrect)
      .slice(-3)
      .reverse();
  }, [answersArray]);

  const handleClaimCelebration = () => {
    GamificationService.triggerCelebration();
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto space-y-7 pb-12">
      {/* ── 1. Gamified Hero Banner (Utiliza toda a largura no desktop) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950 border border-slate-200/90 dark:border-slate-800/90 shadow-xl p-6 sm:p-8 2xl:p-10 text-slate-900 dark:text-white">
        {/* Glow ambient background elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: User Title & XP Level Info */}
          <div className="space-y-3.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 dark:bg-teal-500/15 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                {levelInfo.currentLevel.badge} Nível {levelInfo.currentLevel.level} · {levelInfo.currentLevel.title}
              </span>

              <button
                onClick={handleClaimCelebration}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/20 dark:hover:bg-amber-500/25 transition-all cursor-pointer group"
                title="Clique para celebrar seu progresso!"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>{totalXp} XP Acumulado</span>
              </button>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 text-orange-700 dark:text-orange-300 text-xs font-bold">
                <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400 animate-flame" />
                <span>{stats.streakDays} dias de ofensiva</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl 2xl:text-4xl font-serif-reading font-bold tracking-tight text-slate-900 dark:text-white">
                Bom dia, <span className="bg-gradient-to-r from-teal-700 to-cyan-700 dark:from-teal-300 dark:to-cyan-200 bg-clip-text text-transparent">{userName}</span>!
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm 2xl:text-base leading-relaxed mt-1.5 max-w-2xl">
                Sua jornada médica está ativa. Resolva casos clínicos, domine a fisiopatologia e suba de nível rumo à residência dos seus sonhos.
              </p>
            </div>

            {/* Level Progress Bar */}
            <div className="pt-1 max-w-xl">
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-teal-700 dark:text-teal-300/90 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-teal-400 text-teal-400" />
                  Progresso do Nível: {levelInfo.levelProgressPercent}%
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {levelInfo.nextLevel
                    ? `Faltam ${levelInfo.xpNeededForNextLevel} XP para ${levelInfo.nextLevel.title}`
                    : 'Nível Máximo Atingido!'}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800/90 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-amber-400 transition-all duration-500 shadow-xs shadow-teal-400/50"
                  style={{ width: `${levelInfo.levelProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right: Quick Action Cards with Vibrant Gradients */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 w-full lg:w-64">
            <button
              onClick={() => onSelectView('questions')}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <HelpCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>Resolver Questões (+50 XP)</span>
            </button>

            <button
              onClick={onStartSRS}
              className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-100 border border-slate-300 dark:border-slate-700/90 hover:border-teal-500/50 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Brain className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Revisar Flashcards ({dueCards.length})</span>
            </button>

            <button
              onClick={() => setShowAchievementsModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Conquistas ({unlockedAchievementsCount}/{achievements.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Bento Grid Principal (8 colunas Conteúdo + 4 colunas Gamificação/Métricas) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
        {/* ═══ COLUNA PRINCIPAL (8 Colunas em telas largas) ═══ */}
        <div className="xl:col-span-8 space-y-7">
          {/* ── Desafios Clínicos Diários (Gamified Quests) ── */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200/90 dark:border-[#243452] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Desafios do Dia
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-semibold">
                      Missões Diárias
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cumpra suas metas para desbloquear bônus de XP e acelerar seu progresso de residente
                  </p>
                </div>
              </div>

              <button
                onClick={handleClaimCelebration}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 cursor-pointer"
              >
                <span>Comemorar</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4">
              {dailyQuests.map((quest) => {
                const percent = Math.min(100, Math.round((quest.current / quest.target) * 100));
                return (
                  <div
                    key={quest.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 card-gamified ${
                      quest.completed
                        ? 'bg-gradient-to-b from-teal-50/70 to-emerald-50/50 dark:from-teal-950/30 dark:to-emerald-950/20 border-teal-300 dark:border-teal-800/80 shadow-2xs'
                        : 'bg-slate-50/70 dark:bg-[#142038]/60 border-slate-200/80 dark:border-[#243452]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{quest.icon}</span>
                        {quest.completed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                            <Check className="w-3 h-3 stroke-[3]" /> Concluída
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            +{quest.rewardXp} XP
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {quest.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {quest.description}
                      </p>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>Progresso</span>
                        <span className="tabular-nums">
                          {quest.current} / {quest.target}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            quest.completed
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                              : 'bg-gradient-to-r from-amber-400 to-orange-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Continuar de onde parou ── */}
          {continueReading ? (
            <div className="bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-white dark:to-[#0F172A] rounded-3xl border border-teal-300/80 dark:border-teal-800/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card-gamified">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider text-[10px] font-extrabold">
                    Continuar de onde parou
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
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
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>Retomar Leitura</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}

          {/* ── Biblioteca Médica por Especialidade (Grid Responsivo Amplo) ── */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/25">
                  <Compass className="w-4 h-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Biblioteca por Especialidade Médica
                </h2>
              </div>
              <button
                onClick={() => onSelectView('compendiums')}
                className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver acervo completo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {disciplines.map((disc) => {
                const count = compendiums.filter((c) => c.disciplineId === disc.id).length;
                return (
                  <button
                    key={disc.id}
                    onClick={() => onSelectView('compendiums')}
                    className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-[#243452] hover:border-teal-500 dark:hover:border-teal-400/80 text-left transition-all cursor-pointer shadow-2xs group card-gamified flex flex-col justify-between min-h-[105px]"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#142038] text-slate-700 dark:text-slate-300 group-hover:bg-teal-500/15 group-hover:text-teal-600 dark:group-hover:text-teal-300 flex items-center justify-center transition-colors">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 leading-tight">
                        {disc.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {count} {count === 1 ? 'material' : 'materiais'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Materiais Novos e Estudados Recentemente (2 Colunas Amplas) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Materiais Atualizados Recentemente */}
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200/90 dark:border-[#243452] p-5 sm:p-6 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    Materiais Atualizados
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400">Curadoria Nexus</span>
              </div>

              <div className="space-y-2.5">
                {updatedMaterials.map((comp) => {
                  const disc = disciplines.find((d) => d.id === comp.disciplineId);
                  return (
                    <div
                      key={comp.id}
                      onClick={() => onOpenCompendium(comp.id)}
                      className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#142038] border border-slate-100 dark:border-slate-800/80 transition-all cursor-pointer group flex items-center justify-between gap-3 card-gamified"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-bold text-teal-700 dark:text-teal-400 uppercase">
                            {disc?.name}
                          </span>
                          <span>•</span>
                          <span>{comp.lastUpdated}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 truncate">
                          {comp.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {comp.subtitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-slate-400 group-hover:text-teal-600 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{comp.estimatedReadTimeMinutes} min</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Materiais Estudados Recentemente */}
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200/90 dark:border-[#243452] p-5 sm:p-6 shadow-xs space-y-3.5">
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
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Explorar biblioteca de compêndios →
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentlyStudied.map((comp) => {
                    const prog = readingProgress[comp.id];
                    return (
                      <div
                        key={comp.id}
                        onClick={() => onOpenCompendium(comp.id)}
                        className="p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#142038] border border-slate-100 dark:border-slate-800/80 transition-all cursor-pointer group flex items-center justify-between gap-3 card-gamified"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 truncate">
                            {comp.title}
                          </h4>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all"
                              style={{ width: `${prog?.percent || 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-teal-600 dark:text-teal-400 block">
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

        {/* ═══ COLUNA LATERAL DE GAMIFICAÇÃO & DESEMPENHO (4 Colunas) ═══ */}
        <div className="xl:col-span-4 space-y-6">
          {/* ── Painel de Conquistas & Medalhas (Gamification Showcase) ── */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200/90 dark:border-[#243452] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/25">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    Medalhas & Conquistas
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {unlockedAchievementsCount} de {achievements.length} desbloqueadas
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowAchievementsModal(true)}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Ver todas
              </button>
            </div>

            {/* Badges Grid (Preview de 4 medalhas em destaque) */}
            <div className="grid grid-cols-2 gap-3">
              {achievements.slice(0, 4).map((ach) => (
                <div
                  key={ach.id}
                  onClick={() => setShowAchievementsModal(true)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer card-gamified ${
                    ach.unlocked
                      ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-400/40 dark:border-amber-500/30'
                      : 'bg-slate-50/60 dark:bg-[#142038]/50 border-slate-200/60 dark:border-[#243452]/70 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{ach.icon}</span>
                    {ach.unlocked ? (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[9px] font-black">
                        ✓
                      </span>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {ach.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {ach.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Termômetro de Desempenho & Acurácia Clínica ── */}
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200/90 dark:border-[#243452] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/25">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  Desempenho Clínico
                </h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {totalAnswered > 0 ? `${accuracy}% de acerto` : 'Sem dados'}
              </span>
            </div>

            {/* Circular / Stat progress indicator */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#142038] border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Questões Feitas
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {totalAnswered}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {totalCorrect} corretas
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#142038] border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sequência Ativa
                </span>
                <div className="text-2xl font-black text-amber-500 flex items-center gap-1">
                  {stats.streakDays}
                  <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  {stats.streakDays > 0 ? 'Ritmo diário' : 'Comece hoje'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onSelectView('questions')}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#142038] dark:hover:bg-[#1A2845] text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Abrir Banco de Questões</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Circuito Flashcards SRS Hoje ── */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-white dark:to-[#0F172A] rounded-3xl border border-indigo-200/80 dark:border-indigo-900/60 p-5 sm:p-6 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/25">
                  <Brain className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  Circuito Flashcards SRS
                </h3>
              </div>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                {dueCards.length} hoje
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {dueCards.length > 0
                ? 'Você possui cards com revisão pendente hoje pelo algoritmo de repetição espaçada.'
                : 'Excelente! Todos os flashcards do seu circuito de repetição espaçada foram revisados.'}
            </p>

            <button
              onClick={onStartSRS}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                dueCards.length > 0
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 dark:bg-[#142038] text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{dueCards.length > 0 ? 'Iniciar Sessão de Revisão' : 'Praticar Baralho Geral'}</span>
            </button>
          </div>

          {/* ── Radar de Lacunas Clínicas (Caderno de Erros) ── */}
          {recentMistakes.length > 0 && (
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200/90 dark:border-[#243452] p-5 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center border border-rose-500/25">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    Radar de Lacunas
                  </h3>
                </div>

                <button
                  onClick={() => onSelectView('errors')}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Ver caderno ({errorLogs.length})
                </button>
              </div>

              <div className="space-y-2">
                {recentMistakes.map((ans, idx) => {
                  const q = questions.find((item) => item.id === ans.questionId);
                  const th = themes.find((t) => t.id === q?.themeId);
                  const comp = compendiums.find((c) => c.id === q?.compendiumRefId);

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-1.5"
                    >
                      <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                        {th?.name || 'Clínica Médica'}
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                        {q?.questionStem || 'Questão com erro'}
                      </p>
                      {comp && (
                        <button
                          onClick={() => onOpenCompendium(comp.id, q?.compendiumSectionId)}
                          className="text-[11px] font-bold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Revisar fisiopatologia</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Modal de Conquistas & Gamificação ── */}
      {showAchievementsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-[#243452] w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-xl">
                  🏆
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Quadro de Conquistas Nexus
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Complete desafios clínicos e desbloqueie medalhas exclusivas de residência
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAchievementsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                    ach.unlocked
                      ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-400/40 dark:border-amber-500/40 shadow-xs'
                      : 'bg-slate-50/80 dark:bg-[#142038]/60 border-slate-200/80 dark:border-[#243452] opacity-75'
                  }`}
                >
                  <div className="text-3xl shrink-0 mt-0.5">{ach.icon}</div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {ach.title}
                      </h4>
                      {ach.unlocked ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                          Desbloqueada
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Bloqueada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {ach.description}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      <span>Recompensa: +{ach.rewardXp} XP</span>
                      {!ach.unlocked && (
                        <span>
                          {ach.progress}/{ach.maxProgress}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowAchievementsModal(false);
                  handleClaimCelebration();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Celebrar Conquistas ✨
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
