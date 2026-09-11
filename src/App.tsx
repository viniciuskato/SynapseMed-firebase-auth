import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Layers,
  Timer,
  BookMarked,
  Settings,
  Menu,
  X,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  UserPlan,
  Discipline,
  Theme,
  Compendium,
  Question,
  Flashcard,
  UserStats,
  SimuladoConfig,
  ThemeMode,
  MigrationSummary,
  QuestionAnswerRecord,
} from './types';
import { StorageService } from './services/storage';
import { materialsRepository } from './repositories/MaterialsRepository';
import { questionsRepository } from './repositories/QuestionsRepository';
import { flashcardsRepository } from './repositories/FlashcardsRepository';
import { answersRepository } from './repositories/AnswersRepository';
import { registerSyncHandlers } from './services/syncHandlers';
import { isCardDueToday } from './services/srsAlgorithm';
import * as syncQueueDebug from './services/syncQueue';
import { supabase as supabaseDebugClient } from './lib/supabaseClient';
import { notesRepository } from './repositories/NotesRepository';
import { bookmarksRepository } from './repositories/BookmarksRepository';
import { readingProgressRepository } from './repositories/ReadingProgressRepository';
import { errorNotebookRepository } from './repositories/ErrorNotebookRepository';
import { simuladosRepository } from './repositories/SimuladosRepository';
import { feedbackRepository } from './repositories/FeedbackRepository';
import { questionReactionsRepository } from './repositories/QuestionReactionsRepository';
import { buildSimuladoSelection, SimuladoSelectionResult } from './services/simuladoSelection';

registerSyncHandlers();

// ============================================================================
// Ponte de depuração SÓ PARA TESTE (Prompt 07-C2, ampliada no 07-E2), nunca
// no bundle de produção: `import.meta.env.DEV` é `false` em `vite build` e o
// bloco inteiro é eliminado por tree-shaking (confirmado com `npm run build`
// — a string "__syncDebug" não aparece no bundle publicado). Permite a
// testes reais de navegador (Playwright/Chromium) ler o estado real da fila
// (`localStorage`/`syncQueue`), forçar condições de erro determinísticas e
// chamar os repositórios das categorias 3-9 (`notesRepository` etc.,
// ampliado no 07-F2 com `feedbackRepository`/`questionReactionsRepository`
// para testar a RPC `submit_feedback`) do MESMO jeito que os componentes
// React fazem — ainda é o caminho client-side
// real (grava local -> enfileira -> handler -> RPC), só disparado pelo
// console em vez de um clique, para cenários de concorrência entre
// dispositivos que não têm como ser exercitados clicando um botão só (ex.:
// duas edições offline da mesma nota). Nunca usado por código de produção —
// só por scripts de teste externos ao repositório.
// ============================================================================
if (import.meta.env.DEV) {
  (window as unknown as { __syncDebug?: unknown }).__syncDebug = {
    ...syncQueueDebug,
    supabase: supabaseDebugClient,
    notesRepository,
    bookmarksRepository,
    readingProgressRepository,
    errorNotebookRepository,
    simuladosRepository,
    feedbackRepository,
    questionReactionsRepository,
    storage: StorageService,
  };
}
import { GamificationService } from './services/gamification';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/common/LoadingScreen';
import { LoginView } from './components/auth/LoginView';
import { EmailVerificationScreen } from './components/auth/EmailVerificationScreen';
import { MigrateDataModal } from './components/auth/MigrateDataModal';
import { AwaitingApprovalView } from './components/auth/AwaitingApprovalView';
import { FeedbackModal } from './components/feedback/FeedbackModal';

// Header & Navigation
import { Header } from './components/Header';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PlanModal } from './components/PlanModal';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { CompendiumView } from './components/compendium/CompendiumView';
import { CompendiumReader } from './components/compendium/CompendiumReader';
import { QuestionsView } from './components/questions/QuestionsView';
import { SimuladoSession } from './components/questions/SimuladoSession';
import { CreateSimuladoModal } from './components/questions/CreateSimuladoModal';
import { FlashcardsView } from './components/flashcards/FlashcardsView';
import { FlashcardReviewSession } from './components/flashcards/FlashcardReviewSession';
import { CreateFlashcardModal } from './components/flashcards/CreateFlashcardModal';
import { SimuladosView } from './components/simulados/SimuladosView';
import { AdminCMSView } from './components/admin/AdminCMSView';

function AuthenticatedApp() {
  const { user, profile, loading, isEmailVerified } = useAuth();

  // Navigation State
  const [activeView, setActiveView] = useState<string>('dashboard');

  // Deep-link / Context State
  const [selectedCompendiumId, setSelectedCompendiumId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(undefined);
  const [activeSimuladoConfig, setActiveSimuladoConfig] = useState<SimuladoConfig | null>(null);
  // Questões já filtradas/sorteadas/cortadas por config (Prompt 07-E5 — ver
  // src/services/simuladoSelection.ts). Resolvida UMA VEZ em
  // handleStartCustomSimulado, nunca recalculada a cada render, para que a
  // MESMA sessão nunca re-sorteie (ver comentário da função para a garantia
  // de estabilidade). `activeSimuladoSelection` guarda também quantas
  // questões elegíveis existiam, para a UI avisar quando pedir mais do que
  // o banco tem disponível.
  const [activeSimuladoSelection, setActiveSimuladoSelection] = useState<SimuladoSelectionResult | null>(null);
  const [reviewCardsQueue, setReviewCardsQueue] = useState<Flashcard[]>([]);
  const [filterThemeForQuestions, setFilterThemeForQuestions] = useState<string | undefined>(undefined);
  const [filterThemeForFlashcards, setFilterThemeForFlashcards] = useState<string | undefined>(undefined);
  const [focusQuestionId, setFocusQuestionId] = useState<string | undefined>(undefined);
  // "Treinar Apenas Questões Erradas" (Prompt 10-A): antes, esse botão criava
  // um SimuladoConfig (isExamMode: false) e abria <SimuladoSession>, que tem
  // cronômetro incondicional — pressão temporal indevida para o que é, na
  // prática, revisão de estudo comum, não uma prova. Corrigido para abrir a
  // MESMA <QuestionsView> usada no banco de questões (sem cronômetro), só
  // pré-filtrada para status "incorreta". Ver AGENTS.md, armadilha nova
  // registrada nesta sessão.
  const [filterStatusForQuestions, setFilterStatusForQuestions] = useState<
    'all' | 'unanswered' | 'correct' | 'incorrect' | 'bookmarked' | undefined
  >(undefined);

  // Tab interna da visão Início: Visão Geral vs Caderno de Erros integrado
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'errors'>('overview');

  const handleSelectView = (view: string) => {
    if (view === 'errors') {
      setDashboardTab('errors');
      setActiveView('dashboard');
      return;
    }
    if (view === 'dashboard') {
      setDashboardTab('overview');
    }
    setActiveView(view);
  };

  // Contexto de retorno ao revisar materiais na biblioteca
  const [libraryOrigin, setLibraryOrigin] = useState<{
    view: string;
    questionId?: string;
    label?: string;
  } | null>(null);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isCreateSimuladoOpen, setIsCreateSimuladoOpen] = useState(false);
  const [isCreateFlashcardOpen, setIsCreateFlashcardOpen] = useState(false);

  // Migration State
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);

  // Core Data State (carregados do StorageService / Supabase)
  const [theme, setTheme] = useState<ThemeMode>(() => StorageService.getTheme());
  const [plan, setPlan] = useState<UserPlan>(() => StorageService.getUserPlan());
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [compendiums, setCompendiums] = useState<Compendium[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswerRecord>>({});
  const [stats, setStats] = useState<UserStats>(() => StorageService.getStats());
  const [dataLoading, setDataLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [nextDisciplines, nextThemes, nextCompendiums, nextQuestions, nextFlashcards, nextAnswers] =
      await Promise.all([
        materialsRepository.getDisciplines(),
        materialsRepository.getThemes(),
        materialsRepository.getCompendiums(),
        questionsRepository.getQuestions(),
        flashcardsRepository.getFlashcards(),
        answersRepository.getAnswers(),
      ]);
    setDisciplines(nextDisciplines);
    setThemes(nextThemes);
    setCompendiums(nextCompendiums);
    setQuestions(nextQuestions);
    setFlashcards(nextFlashcards);
    setAnswers(nextAnswers);
    setStats(GamificationService.computeRealStats(nextAnswers, nextFlashcards));
    setPlan(StorageService.getUserPlan());
    setTheme(StorageService.getTheme());
  }, []);

  // Quando o usuário autenticado muda, recarrega os dados do namespace dele
  useEffect(() => {
    if (user?.id) {
      setDataLoading(true);
      refreshData().finally(() => setDataLoading(false));
      const legacySummary = StorageService.checkLegacyDataSummary(user.id);
      if (legacySummary.hasLegacyData) {
        setMigrationSummary(legacySummary);
      }
    }
  }, [user?.id, refreshData]);

  // Dark Mode synchronization
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    StorageService.setTheme(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Keyboard shortcut for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Se a tela de loading estiver ativa no AuthContext
  if (loading) {
    return <LoadingScreen message="Autenticando e inicializando ambiente seguro..." />;
  }

  // Se o usuário não estiver logado, exibe a tela de login
  if (!user) {
    return <LoginView />;
  }

  // Bloqueio de acesso enquanto o e-mail não estiver verificado
  const hasVerifiedEmail = Boolean(user.email_confirmed_at) || isEmailVerified;
  if (!hasVerifiedEmail) {
    return <EmailVerificationScreen />;
  }

  // Acesso aguardando aprovação pela moderação (fluxo privado)
  if (profile?.status === 'pending') {
    return <AwaitingApprovalView />;
  }

  // Dados pessoais/de conteúdo (Supabase) ainda carregando
  if (dataLoading) {
    return <LoadingScreen message="Carregando seus dados de estudo..." />;
  }

  const isAdmin = profile?.role === 'admin';

  // Calculate badges
  const unansweredCount = questions.filter((q) => !answers[q.id]).length;
  const errorCount = (Object.values(answers) as QuestionAnswerRecord[]).filter((a) => !a.isCorrect).length;
  const dueCardsCount = flashcards.filter((fc) => isCardDueToday(fc)).length;

  // Plan toggles
  const handleTogglePlan = () => {
    const nextPlan = plan === 'premium' ? 'free' : 'premium';
    StorageService.setUserPlan(nextPlan);
    setPlan(nextPlan);
  };

  const handleSelectPlan = (newPlan: UserPlan) => {
    StorageService.setUserPlan(newPlan);
    setPlan(newPlan);
    setIsPlanModalOpen(false);
  };

  // Navigators
  const handleOpenCompendium = (compendiumId?: string, sectionId?: string, originQuestionId?: string) => {
    if (activeView === 'questions' || activeView === 'errors' || activeView === 'simulado-session') {
      setLibraryOrigin({
        view: activeView,
        questionId: originQuestionId,
        label:
          activeView === 'errors'
            ? 'Retornar ao Caderno de Erros'
            : activeView === 'simulado-session'
            ? 'Retornar ao Simulado'
            : 'Retornar às Questões',
      });
    }

    if (!compendiumId) {
      setActiveView('compendiums');
      return;
    }
    setSelectedCompendiumId(compendiumId);
    setSelectedSectionId(sectionId);
    setActiveView('compendium-reader');
  };

  const handleReturnToQuestions = () => {
    if (libraryOrigin) {
      const targetView = libraryOrigin.view;
      if (libraryOrigin.questionId) {
        setFocusQuestionId(libraryOrigin.questionId);
      }
      setLibraryOrigin(null);
      setActiveView(targetView);
    } else {
      setActiveView('questions');
    }
  };

  const handleOpenQuestionsForTheme = (themeId: string) => {
    setFilterThemeForQuestions(themeId);
    setFocusQuestionId(undefined);
    setActiveView('questions');
  };

  const handleOpenFlashcardsForTheme = (themeId: string) => {
    setFilterThemeForFlashcards(themeId);
    setActiveView('flashcards');
  };

  const handleOpenQuestion = (questionId: string) => {
    setFocusQuestionId(questionId);
    setActiveView('questions');
  };

  const handleTrainMistakesUntimed = () => {
    setFilterThemeForQuestions(undefined);
    setFocusQuestionId(undefined);
    setFilterStatusForQuestions('incorrect');
    setActiveView('questions');
  };

  const handleStartSRS = (cards?: Flashcard[]) => {
    const queue = cards && cards.length > 0 ? cards : flashcards.filter((fc) => isCardDueToday(fc));
    setReviewCardsQueue(queue.length > 0 ? queue : flashcards);
    setActiveView('flashcard-session');
  };

  const handleStartCustomSimulado = (config: SimuladoConfig) => {
    // Corrige a armadilha #17 (AGENTS.md): antes, a config era gravada mas
    // as questões passadas para <SimuladoSession> eram o array cheio do
    // banco, sem nenhum filtro. `buildSimuladoSelection` aplica disciplina/
    // tema/dificuldade/ciclo/apenas-erros e corta por questionCount uma
    // única vez aqui — o resultado fica em estado (não recalculado a cada
    // render), preservando a mesma seleção/ordem enquanto esta sessão
    // permanecer montada.
    const selection = buildSimuladoSelection(questions, config, answers);
    setActiveSimuladoConfig(config);
    setActiveSimuladoSelection(selection);
    setIsCreateSimuladoOpen(false);
    setActiveView('simulado-session');
  };

  // Active Compendium Object
  const activeCompendium = compendiums.find((c) => c.id === selectedCompendiumId) || compendiums[0];

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B1220] text-[#172033] dark:text-[#E5E7EB] font-sans flex flex-col selection:bg-teal-500 selection:text-white antialiased transition-colors max-w-full overflow-x-hidden">
      {/* Top Application Header */}
      <Header
        currentPlan={plan}
        onOpenPlanModal={() => setIsPlanModalOpen(true)}
        onTogglePlanQuick={handleTogglePlan}
        onOpenSearch={() => setIsSearchOpen(true)}
        stats={stats}
        dueCardsCount={dueCardsCount}
        errorLogCount={errorCount}
        activeView={activeView}
        onSelectView={handleSelectView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
      />

      {/* Main Workspace - Full Width with Centered Reading Layout */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        <main
          className={`flex-1 min-w-0 w-full ${
            activeView === 'compendium-reader'
              ? 'p-0'
              : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 xl:pb-12'
          }`}
        >

          {/* View Router */}
          {activeView === 'dashboard' && (
            <DashboardView
              disciplines={disciplines}
              themes={themes}
              questions={questions}
              compendiums={compendiums}
              flashcards={flashcards}
              onSelectView={handleSelectView}
              onOpenCompendium={handleOpenCompendium}
              onOpenQuestion={handleOpenQuestion}
              onStartSRS={handleStartSRS}
              initialTab={dashboardTab}
              onTabChange={setDashboardTab}
              onStartErrorSimulado={handleTrainMistakesUntimed}
              onUpdate={refreshData}
            />
          )}

          {activeView === 'compendiums' && (
            <CompendiumView
              compendiums={compendiums}
              disciplines={disciplines}
              themes={themes}
              onOpenCompendium={handleOpenCompendium}
              onOpenQuestionsForTheme={handleOpenQuestionsForTheme}
              returnToQuestionsContext={libraryOrigin}
              onReturnToQuestions={libraryOrigin ? handleReturnToQuestions : undefined}
            />
          )}

          {activeView === 'compendium-reader' && activeCompendium && (
            <CompendiumReader
              compendium={activeCompendium}
              disciplines={disciplines}
              themes={themes}
              onBack={() => {
                if (libraryOrigin) {
                  handleReturnToQuestions();
                } else {
                  setActiveView('compendiums');
                }
              }}
              onOpenQuestionsForTheme={handleOpenQuestionsForTheme}
              onOpenFlashcardsForTheme={handleOpenFlashcardsForTheme}
              targetSectionId={selectedSectionId}
              returnToQuestionsContext={libraryOrigin}
              onReturnToQuestions={libraryOrigin ? handleReturnToQuestions : undefined}
            />
          )}

          {activeView === 'questions' && (
            <QuestionsView
              questions={questions}
              disciplines={disciplines}
              themes={themes}
              compendiums={compendiums}
              onOpenCompendium={handleOpenCompendium}
              onOpenCreateSimulado={() => setIsCreateSimuladoOpen(true)}
              filterThemeId={filterThemeForQuestions}
              focusQuestionId={focusQuestionId}
              initialStatusFilter={filterStatusForQuestions}
            />
          )}

          {activeView === 'flashcards' && (
            <FlashcardsView
              flashcards={flashcards}
              disciplines={disciplines}
              themes={themes}
              compendiums={compendiums}
              onStartReview={(cards) => handleStartSRS(cards)}
              onOpenCreateModal={() => setIsCreateFlashcardOpen(true)}
              onOpenCompendium={handleOpenCompendium}
              onFlashcardUpdated={refreshData}
              filterThemeId={filterThemeForFlashcards}
            />
          )}

          {activeView === 'flashcard-session' && (
            <FlashcardReviewSession
              cards={reviewCardsQueue}
              disciplines={disciplines}
              themes={themes}
              compendiums={compendiums}
              onFinishSession={() => {
                refreshData();
                setActiveView('flashcards');
              }}
              onOpenCompendium={handleOpenCompendium}
            />
          )}

          {activeView === 'simulados' && (
            <SimuladosView
              disciplines={disciplines}
              themes={themes}
              onOpenCreateModal={() => setIsCreateSimuladoOpen(true)}
              onStartCustomSimulado={handleStartCustomSimulado}
              onUpdate={refreshData}
            />
          )}

          {activeView === 'simulado-session' && activeSimuladoConfig && activeSimuladoSelection && (
            <SimuladoSession
              config={activeSimuladoConfig}
              questions={activeSimuladoSelection.selected}
              eligibleCount={activeSimuladoSelection.eligibleCount}
              requestedCount={activeSimuladoSelection.requestedCount}
              disciplines={disciplines}
              themes={themes}
              compendiums={compendiums}
              onFinishSession={() => {
                refreshData();
                setActiveSimuladoSelection(null);
                setActiveView('simulados');
              }}
              onOpenCompendium={handleOpenCompendium}
            />
          )}

          {activeView === 'errors' && (
            <DashboardView
              disciplines={disciplines}
              themes={themes}
              questions={questions}
              compendiums={compendiums}
              flashcards={flashcards}
              onSelectView={handleSelectView}
              onOpenCompendium={handleOpenCompendium}
              onOpenQuestion={handleOpenQuestion}
              onStartSRS={handleStartSRS}
              initialTab="errors"
              onTabChange={(tab) => {
                if (tab === 'overview') setActiveView('dashboard');
                setDashboardTab(tab);
              }}
              onStartErrorSimulado={handleTrainMistakesUntimed}
              onUpdate={refreshData}
            />
          )}

          {/* Admin CMS - Apenas para papel admin */}
          {activeView === 'admin' && (
            isAdmin ? (
              <AdminCMSView
                disciplines={disciplines}
                themes={themes}
                questions={questions}
                compendiums={compendiums}
                flashcards={flashcards}
                onRefreshData={refreshData}
              />
            ) : (
              <div
                id="admin-access-denied-box"
                className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto my-12 elev-md"
              >
                <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold font-serif-reading text-slate-900 dark:text-white mb-2">
                  Acesso Restrito ao Painel
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                  Seu perfil atual é de <strong>Estudante</strong>. O Painel de Administração e Gestão de Conteúdo é reservado exclusivamente para administradores autorizados do corpo clínico.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors elev-xs"
                >
                  Voltar ao Painel de Estudos
                </button>
              </div>
            )
          )}
        </main>
      </div>

      {/* Mobile Floating Thumb Dock */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={handleSelectView}
        dueCardsCount={dueCardsCount}
        errorLogCount={errorCount}
      />

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        compendiums={compendiums}
        questions={questions}
        flashcards={flashcards}
        onNavigateToCompendium={(cid, sid) => {
          handleOpenCompendium(cid, sid);
          setIsSearchOpen(false);
        }}
        onNavigateToQuestion={(qid) => {
          handleOpenQuestion(qid);
          setIsSearchOpen(false);
        }}
        onNavigateToFlashcards={() => {
          setActiveView('flashcards');
          setIsSearchOpen(false);
        }}
      />

      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        currentPlan={plan}
        onSelectPlan={handleSelectPlan}
      />

      <CreateSimuladoModal
        isOpen={isCreateSimuladoOpen}
        onClose={() => setIsCreateSimuladoOpen(false)}
        disciplines={disciplines}
        themes={themes}
        totalAvailableQuestions={questions.length}
        mistakesCount={errorCount}
        onStartSimulado={handleStartCustomSimulado}
      />

      <CreateFlashcardModal
        isOpen={isCreateFlashcardOpen}
        onClose={() => setIsCreateFlashcardOpen(false)}
        disciplines={disciplines}
        themes={themes}
        onFlashcardCreated={() => {
          refreshData();
        }}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* Modal de Migração de Dados Pessoais */}
      {migrationSummary && user?.id && (
        <MigrateDataModal
          summary={migrationSummary}
          userUid={user.id}
          userName={user.user_metadata?.display_name ?? null}
          onComplete={() => {
            setMigrationSummary(null);
            refreshData();
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
