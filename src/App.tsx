import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Stethoscope,
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
  ClinicalCase,
  Flashcard,
  UserStats,
  SimuladoConfig,
  ThemeMode,
  MigrationSummary,
} from './types';
import { StorageService } from './services/storage';
import { isCardDueToday } from './services/srsAlgorithm';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/common/LoadingScreen';
import { LoginView } from './components/auth/LoginView';
import { EmailVerificationScreen } from './components/auth/EmailVerificationScreen';
import { MigrateDataModal } from './components/auth/MigrateDataModal';

// Header & Sidebar
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PlanModal } from './components/PlanModal';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { CompendiumView } from './components/compendium/CompendiumView';
import { CompendiumReader } from './components/compendium/CompendiumReader';
import { QuestionsView } from './components/questions/QuestionsView';
import { SimuladoSession } from './components/questions/SimuladoSession';
import { CreateSimuladoModal } from './components/questions/CreateSimuladoModal';
import { ClinicalCasesView } from './components/clinical-cases/ClinicalCasesView';
import { ClinicalCaseDetail } from './components/clinical-cases/ClinicalCaseDetail';
import { FlashcardsView } from './components/flashcards/FlashcardsView';
import { FlashcardReviewSession } from './components/flashcards/FlashcardReviewSession';
import { CreateFlashcardModal } from './components/flashcards/CreateFlashcardModal';
import { ErrorNotebookView } from './components/errors/ErrorNotebookView';
import { SimuladosView } from './components/simulados/SimuladosView';
import { AdminCMSView } from './components/admin/AdminCMSView';

function AuthenticatedApp() {
  const { user, profile, loading, isEmailVerified } = useAuth();

  // Navigation State
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Deep-link / Context State
  const [selectedCompendiumId, setSelectedCompendiumId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(undefined);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeSimuladoConfig, setActiveSimuladoConfig] = useState<SimuladoConfig | null>(null);
  const [reviewCardsQueue, setReviewCardsQueue] = useState<Flashcard[]>([]);
  const [filterThemeForQuestions, setFilterThemeForQuestions] = useState<string | undefined>(undefined);
  const [filterThemeForFlashcards, setFilterThemeForFlashcards] = useState<string | undefined>(undefined);
  const [focusQuestionId, setFocusQuestionId] = useState<string | undefined>(undefined);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isCreateSimuladoOpen, setIsCreateSimuladoOpen] = useState(false);
  const [isCreateFlashcardOpen, setIsCreateFlashcardOpen] = useState(false);

  // Migration State
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);

  // Core Data State (carregados do StorageService)
  const [theme, setTheme] = useState<ThemeMode>(() => StorageService.getTheme());
  const [plan, setPlan] = useState<UserPlan>(() => StorageService.getUserPlan());
  const [disciplines, setDisciplines] = useState<Discipline[]>(() => StorageService.getDisciplines());
  const [themes, setThemes] = useState<Theme[]>(() => StorageService.getThemes());
  const [compendiums, setCompendiums] = useState<Compendium[]>(() => StorageService.getCompendiums());
  const [questions, setQuestions] = useState<Question[]>(() => StorageService.getQuestions());
  const [clinicalCases, setClinicalCases] = useState<ClinicalCase[]>(() => StorageService.getClinicalCases());
  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => StorageService.getFlashcards());
  const [stats, setStats] = useState<UserStats>(() => StorageService.getStats());

  const refreshData = useCallback(() => {
    setDisciplines(StorageService.getDisciplines());
    setThemes(StorageService.getThemes());
    setCompendiums(StorageService.getCompendiums());
    setQuestions(StorageService.getQuestions());
    setClinicalCases(StorageService.getClinicalCases());
    setFlashcards(StorageService.getFlashcards());
    setStats(StorageService.getStats());
    setPlan(StorageService.getUserPlan());
    setTheme(StorageService.getTheme());
  }, []);

  // Quando o usuário autenticado muda, recarrega os dados do namespace dele
  useEffect(() => {
    if (user?.uid) {
      refreshData();
      const legacySummary = StorageService.checkLegacyDataSummary(user.uid);
      if (legacySummary.hasLegacyData) {
        setMigrationSummary(legacySummary);
      }
    }
  }, [user?.uid, refreshData]);

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
  const hasVerifiedEmail = user.emailVerified || isEmailVerified;
  if (!hasVerifiedEmail) {
    return <EmailVerificationScreen />;
  }

  const isAdmin = profile?.role === 'admin';

  // Calculate badges
  const answers = StorageService.getAnswers();
  const unansweredCount = questions.filter((q) => !answers[q.id]).length;
  const errorCount = Object.values(answers).filter((a) => !a.isCorrect).length;
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
  const handleOpenCompendium = (compendiumId: string, sectionId?: string) => {
    setSelectedCompendiumId(compendiumId);
    setSelectedSectionId(sectionId);
    setActiveView('compendium-reader');
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

  const handleOpenCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveView('clinical-case-detail');
  };

  const handleStartSRS = (cards?: Flashcard[]) => {
    const queue = cards && cards.length > 0 ? cards : flashcards.filter((fc) => isCardDueToday(fc));
    setReviewCardsQueue(queue.length > 0 ? queue : flashcards);
    setActiveView('flashcard-session');
  };

  const handleStartCustomSimulado = (config: SimuladoConfig) => {
    setActiveSimuladoConfig(config);
    setIsCreateSimuladoOpen(false);
    setActiveView('simulado-session');
  };

  // Active Compendium / Case Objects
  const activeCompendium = compendiums.find((c) => c.id === selectedCompendiumId) || compendiums[0];
  const activeClinicalCase = clinicalCases.find((c) => c.id === selectedCaseId) || clinicalCases[0];

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col selection:bg-teal-500 selection:text-white antialiased transition-colors max-w-full overflow-x-hidden">
      {/* Top Application Header */}
      <Header
        currentPlan={plan}
        onOpenPlanModal={() => setIsPlanModalOpen(true)}
        onTogglePlanQuick={handleTogglePlan}
        onOpenSearch={() => setIsSearchOpen(true)}
        stats={stats}
        dueCardsCount={dueCardsCount}
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setMobileMenuOpen(false);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
        {/* Desktop Navigation Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={(v) => {
            setActiveView(v);
            setMobileMenuOpen(false);
          }}
          currentPlan={plan}
          onOpenPlanModal={() => setIsPlanModalOpen(true)}
          errorLogCount={errorCount}
          dueCardsCount={dueCardsCount}
          unansweredQuestionsCount={unansweredCount}
        />

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden bg-slate-900/60 backdrop-blur-xs flex">
            <div className="w-4/5 max-w-xs bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full p-4 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Menu SynapseMed</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1 text-xs">
                  {[
                    { id: 'dashboard', label: 'Painel & Diagnóstico', icon: LayoutDashboard },
                    { id: 'compendiums', label: 'Compêndios Teóricos', icon: BookOpen },
                    { id: 'questions', label: 'Banco de Questões', icon: HelpCircle },
                    { id: 'clinical-cases', label: 'Casos Clínicos', icon: Stethoscope },
                    { id: 'flashcards', label: 'Flashcards SRS', icon: Layers },
                    { id: 'simulados', label: 'Simulados & Listas', icon: Timer },
                    { id: 'errors', label: 'Caderno de Erros', icon: BookMarked },
                    ...(isAdmin ? [{ id: 'admin', label: 'Painel Admin CMS', icon: Settings }] : []),
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveView(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-left transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-700 text-white shadow-xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 max-w-full overflow-x-hidden overflow-y-auto">
          {/* Mobile View Switcher Button */}
          <div className="md:hidden mb-4 flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Menu className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Navegar no Ambiente</span>
            </button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* View Router */}
          {activeView === 'dashboard' && (
            <DashboardView
              disciplines={disciplines}
              themes={themes}
              questions={questions}
              compendiums={compendiums}
              flashcards={flashcards}
              clinicalCases={clinicalCases}
              onSelectView={setActiveView}
              onOpenCompendium={handleOpenCompendium}
              onOpenQuestion={handleOpenQuestion}
              onOpenCase={handleOpenCase}
              onStartSRS={handleStartSRS}
            />
          )}

          {activeView === 'compendiums' && (
            <CompendiumView
              compendiums={compendiums}
              disciplines={disciplines}
              themes={themes}
              onOpenCompendium={handleOpenCompendium}
              onOpenQuestionsForTheme={handleOpenQuestionsForTheme}
            />
          )}

          {activeView === 'compendium-reader' && activeCompendium && (
            <CompendiumReader
              compendium={activeCompendium}
              disciplines={disciplines}
              themes={themes}
              onBack={() => setActiveView('compendiums')}
              onOpenQuestionsForTheme={handleOpenQuestionsForTheme}
              onOpenFlashcardsForTheme={handleOpenFlashcardsForTheme}
              targetSectionId={selectedSectionId}
            />
          )}

          {activeView === 'questions' && (
            <QuestionsView
              questions={questions}
              disciplines={disciplines}
              themes={themes}
              onOpenCompendium={handleOpenCompendium}
              onOpenCreateSimulado={() => setIsCreateSimuladoOpen(true)}
              filterThemeId={filterThemeForQuestions}
              focusQuestionId={focusQuestionId}
            />
          )}

          {activeView === 'clinical-cases' && (
            <ClinicalCasesView
              cases={clinicalCases}
              disciplines={disciplines}
              themes={themes}
              onOpenCase={handleOpenCase}
              onOpenCompendium={handleOpenCompendium}
            />
          )}

          {activeView === 'clinical-case-detail' && activeClinicalCase && (
            <ClinicalCaseDetail
              clinicalCase={activeClinicalCase}
              disciplines={disciplines}
              themes={themes}
              onBack={() => setActiveView('clinical-cases')}
              onOpenCompendium={handleOpenCompendium}
            />
          )}

          {activeView === 'flashcards' && (
            <FlashcardsView
              flashcards={flashcards}
              disciplines={disciplines}
              themes={themes}
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

          {activeView === 'simulado-session' && activeSimuladoConfig && (
            <SimuladoSession
              config={activeSimuladoConfig}
              questions={questions}
              disciplines={disciplines}
              themes={themes}
              onFinishSession={() => {
                refreshData();
                setActiveView('simulados');
              }}
              onOpenCompendium={handleOpenCompendium}
            />
          )}

          {activeView === 'errors' && (
            <ErrorNotebookView
              questions={questions}
              disciplines={disciplines}
              themes={themes}
              onOpenCompendium={handleOpenCompendium}
              onOpenQuestion={handleOpenQuestion}
              onStartErrorSimulado={() => {
                const mistakesConfig: SimuladoConfig = {
                  id: `sim-mistakes-${Date.now()}`,
                  name: 'Simulado de Caderno de Erros',
                  disciplineIds: disciplines.map((d) => d.id),
                  themeIds: [],
                  difficulties: ['facil', 'medio', 'dificil'],
                  cycles: ['basico', 'clinico', 'internato_residencia'],
                  onlyMistakes: true,
                  questionCount: 10,
                  timeLimitMinutes: 20,
                  isExamMode: false,
                };
                handleStartCustomSimulado(mistakesConfig);
              }}
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
                clinicalCases={clinicalCases}
                onRefreshData={refreshData}
              />
            ) : (
              <div
                id="admin-access-denied-box"
                className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto my-12 shadow-md"
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
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  Voltar ao Painel de Estudos
                </button>
              </div>
            )
          )}
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        compendiums={compendiums}
        questions={questions}
        clinicalCases={clinicalCases}
        flashcards={flashcards}
        onNavigateToCompendium={(cid, sid) => {
          handleOpenCompendium(cid, sid);
          setIsSearchOpen(false);
        }}
        onNavigateToQuestion={(qid) => {
          handleOpenQuestion(qid);
          setIsSearchOpen(false);
        }}
        onNavigateToCase={(cid) => {
          handleOpenCase(cid);
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

      {/* Modal de Migração de Dados Pessoais */}
      {migrationSummary && user?.uid && (
        <MigrateDataModal
          summary={migrationSummary}
          userUid={user.uid}
          userName={user.displayName}
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
