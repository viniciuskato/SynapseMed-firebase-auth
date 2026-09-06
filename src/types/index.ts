export type UserPlan = 'free' | 'premium';

export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  plan: UserPlan;
  status?: 'active' | 'pending' | 'blocked';
  createdAt?: any;
  lastLoginAt?: any;
}

export interface MigrationSummary {
  hasLegacyData: boolean;
  answersCount: number;
  flashcardsCount: number;
  simuladosCount: number;
  bookmarksCount: number;
  notesCount: number;
  readingProgressCount: number;
}

export type ThemeMode = 'light' | 'dark';

export type MedicalCycle = 'basico' | 'clinico' | 'internato_residencia';

export type DifficultyLevel = 'facil' | 'medio' | 'dificil';

export interface Discipline {
  id: string;
  name: string;
  code: string;
  icon: string;
  description: string;
  cycle: MedicalCycle;
  color: string;
  themesCount?: number;
}

export interface Theme {
  id: string;
  disciplineId: string;
  name: string;
  description: string;
  highYield: boolean;
  order: number;
}

export interface CompendiumSection {
  id: string;
  title: string;
  mechanismTag?: string; // e.g. "Fisiopatologia", "Farmacodinâmica", "Critérios Diagnósticos", "Conduta", "Pérolas Clínicas"
  content: string; // Markdown / structured medical text
  keyTakeaways: string[];
  clinicalPearl?: string;
  warningAlert?: string;
  diagramSvgKey?: string;
}

export type StudyLens =
  | 'fisiopatologia'
  | 'diagnostico'
  | 'conduta'
  | 'farmacologia'
  | 'alto_rendimento';

export type EditorialStatus = 'completo' | 'em_atualizacao' | 'em_revisao';

export interface Compendium {
  id: string;
  disciplineId: string;
  themeId: string;
  title: string;
  subtitle: string;
  estimatedReadTimeMinutes: number;
  lastUpdated: string;
  author: string;
  mode?: 'atlas' | 'mecanismos';
  studyLens?: StudyLens;
  editorialStatus?: EditorialStatus;
  tags?: string[];
  dependencies?: { title: string; linkId?: string }[];
  sections: CompendiumSection[];
  references: string[];
  isPremiumOnly?: boolean;
}

export interface QuestionOption {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  isCorrect: boolean;
  explanation: string;
  mechanismReference?: string;
}

export interface Question {
  id: string;
  disciplineId: string;
  themeId: string;
  compendiumRefId: string; // Linking directly to compendium!
  compendiumSectionId?: string; // Exact section anchor
  cycle: MedicalCycle;
  difficulty: DifficultyLevel;
  institution: string; // USP, UNIFESP, UFRJ, ENARE, Revalida, etc.
  year: number;
  clinicalVignette: string;
  questionStem: string;
  options: QuestionOption[];
  generalCommentary: string;
  highYieldSummary: string;
  tags: string[];
  flashcardTemplate?: {
    front: string;
    back: string;
    mechanismNote: string;
  };
  isPremiumOnly?: boolean;
}

export interface FlashcardSRS {
  intervalDays: number;
  repetitionCount: number;
  easeFactor: number; // SM-2 standard default 2.5
  nextDueDate: string; // ISO date string
  lastReviewedDate?: string;
  state: 'new' | 'learning' | 'review' | 'mastered';
  reviewHistory: Array<{
    date: string;
    rating: 1 | 2 | 3 | 4; // 1: Errei, 2: Dificil, 3: Bom, 4: Facil
  }>;
}

export interface Flashcard {
  id: string;
  disciplineId: string;
  themeId: string;
  compendiumRefId?: string;
  questionOriginId?: string;
  derivedFromQuestionId?: string;
  front: string;
  back: string;
  mechanismHighlight: string;
  tags: string[];
  difficulty: DifficultyLevel;
  srs: FlashcardSRS;
  isCustom?: boolean;
}

export type AppView =
  | 'dashboard'
  | 'compendiums'
  | 'compendium_reader'
  | 'questions'
  | 'simulado_active'
  | 'flashcards'
  | 'flashcard_reviewer'
  | 'caderno_erros'
  | 'admin';

export interface QuestionAnswerRecord {
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D' | 'E';
  isCorrect: boolean;
  timestamp: string;
  timeSpentSeconds: number;
  errorReason?: 'lacuna_teorica' | 'pegadinha' | 'falta_atencao' | 'tempo_esgotado' | 'raciocinio_clinico';
  userNotes?: string;
}

// Gabarito de uma questão (quem está correta, explicação por alternativa),
// obtido via RPC (submit_question_attempt ou get_question_review) — nunca
// por SELECT direto em question_option_keys/question_answer_keys, que não
// têm policy de leitura para estudante (ver rls_policies.sql).
export interface QuestionReviewOption {
  optionId: string;
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  isCorrect: boolean;
  explanation: string;
}

export interface QuestionReviewResult {
  isCorrect: boolean;
  correctOptionId: string;
  generalCommentary: string;
  highYieldSummary: string;
  options: QuestionReviewOption[];
}

export interface SimuladoConfig {
  id: string;
  name: string;
  disciplineIds: string[];
  themeIds: string[];
  difficulties: DifficultyLevel[];
  cycles: MedicalCycle[];
  onlyMistakes: boolean;
  questionCount: number;
  timeLimitMinutes: number;
  isExamMode: boolean; // exam mode hides feedback until end
}

export interface SimuladoSessionData {
  id: string;
  config: SimuladoConfig;
  questionIds: string[];
  answers: Record<string, { selectedOption: 'A' | 'B' | 'C' | 'D' | 'E'; timeSpent: number }>;
  startedAt: string;
  completedAt?: string;
  score?: number;
  totalTimeSeconds: number;
}

export interface ErrorLogItem {
  id: string;
  questionId: string;
  timestamp: string;
  selectedOption: string;
  correctOption: string;
  errorReason: 'lacuna_teorica' | 'pegadinha' | 'falta_atencao' | 'tempo_esgotado' | 'raciocinio_clinico';
  userNotes: string;
  resolved: boolean;
}

export interface UserStats {
  totalAnswered: number;
  totalCorrect: number;
  streakDays: number;
  lastActiveDate: string;
  cardsReviewedToday: number;
  compendiumsReadCount: number;
}

export type FeedbackType = 'sugestao' | 'problema' | 'elogio';

export interface UserFeedback {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  createdAt: string;
  userId?: string | null;
  userEmail?: string | null;
}
