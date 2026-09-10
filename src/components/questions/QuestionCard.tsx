import { sourceVerificationLabel } from '../../utils/bibliographicSources';
import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  Layers,
  Sparkles,
  Bookmark,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Clock,
  EyeOff,
  Stethoscope,
  ThumbsUp,
  ThumbsDown,
  Link2,
} from 'lucide-react';
import { Question, QuestionAnswerRecord, QuestionReviewResult, Discipline, Theme, QuestionReactionValue } from '../../types';
import { bookmarksRepository } from '../../repositories/BookmarksRepository';
import { flashcardsRepository } from '../../repositories/FlashcardsRepository';
import { answersRepository } from '../../repositories/AnswersRepository';
import { questionsRepository } from '../../repositories/QuestionsRepository';
import { questionReactionsRepository } from '../../repositories/QuestionReactionsRepository';
import { GamificationService, CELEBRATION_STREAK_LENGTH } from '../../services/gamification';
import { ContextualFeedbackPopover } from '../feedback/ContextualFeedbackPopover';

interface QuestionCardProps {
  question: Question;
  discipline?: Discipline;
  theme?: Theme;
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onAnswerRecorded?: (record: QuestionAnswerRecord) => void;
  isExamMode?: boolean;
  selectedOptionInExam?: 'A' | 'B' | 'C' | 'D' | 'E';
  onSelectOptionInExam?: (opt: 'A' | 'B' | 'C' | 'D' | 'E') => void;
  /**
   * Resposta/favorito/reação já resolvidos em lote pelo componente pai (ex.:
   * <QuestionsView>, que busca os três de uma vez para TODOS os cartões
   * visíveis). Quando presente, evita que este cartão dispare sua própria
   * consulta individual — com filtros como "Todas"/"Erros" renderizando até
   * as 393 questões de uma vez (sem paginação), 3 requisições por cartão
   * viravam centenas de requisições concorrentes pela mesma informação
   * (Prompt 10-A). Contextos que não passam esta prop (prova/simulado,
   * questão única) continuam buscando por conta própria, como antes.
   */
  hydrated?: {
    answer: QuestionAnswerRecord | null;
    bookmarked: boolean;
    reaction: QuestionReactionValue | null;
  };
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  discipline,
  theme,
  onOpenCompendium,
  onAnswerRecorded,
  isExamMode = false,
  selectedOptionInExam,
  onSelectOptionInExam,
  hydrated,
}) => {
  // Local state for study mode
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | 'E' | null>(
    selectedOptionInExam || null
  );
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [errorReason, setErrorReason] = useState<QuestionAnswerRecord['errorReason']>('lacuna_teorica');
  // Modo de resposta (recall livre vs. múltipla escolha): escolhido antes de
  // ver as alternativas, em modo de estudo, e travado até a questão ser
  // respondida ou trocada (ver useEffect abaixo, que reseta por question.id).
  const [answerMode, setAnswerMode] = useState<QuestionAnswerRecord['answerMode']>(undefined);
  const [alternativesRevealed, setAlternativesRevealed] = useState<boolean>(false);
  const [answerStrategy, setAnswerStrategy] = useState<QuestionAnswerRecord['answerStrategy']>(undefined);
  const [userNote, setUserNote] = useState<string>('');
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const [showErrorTagger, setShowErrorTagger] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Gabarito (quem está correta, explicação por alternativa) obtido via RPC —
  // question.options[].isCorrect/.explanation vêm sempre vazios para o
  // estudante, pois question_option_keys/question_answer_keys não têm
  // policy de SELECT direto (ver rls_policies.sql).
  const [reviewResult, setReviewResult] = useState<QuestionReviewResult | null>(null);
  const [myReaction, setMyReaction] = useState<QuestionReactionValue | null>(null);
  // Rascunho da recordação ativa (Prompt 10-A) — o que o estudante escreveu
  // ANTES de revelar as alternativas, no modo "recall livre". Existe só
  // durante a sessão (nunca enviado ao servidor, nunca à IA, nunca vira
  // gabarito): não há necessidade de sobreviver a reload/dispositivo — é um
  // rascunho descartável, não um dado de aprendizado que precise persistir
  // (ver instrução do prompt: não criar migration para isso).
  const [openRecallDraft, setOpenRecallDraft] = useState<string>('');
  // Distingue "reidratado de uma tentativa já existente no servidor" de
  // "respondida agora, nesta sessão" — usado só para não confundir os dois
  // casos (ex.: nunca disparar confete/toast/XP pela hidratação) e para
  // testes automatizados conseguirem afirmar qual dos dois aconteceu.
  const [answerOrigin, setAnswerOrigin] = useState<'hydrated' | 'session' | null>(null);

  // Chave estável derivada de `hydrated` para a dependência do useEffect
  // abaixo. `hydrated` é um objeto NOVO a cada render do pai (`<QuestionsView>`
  // recria o literal `{ answer, bookmarked, reaction }` toda vez) — depender
  // do objeto em si reexecutaria a hidratação (inclusive a chamada de rede
  // de `getQuestionReview`) a cada tecla digitada na busca/filtro do pai.
  // Os valores primitivos abaixo só mudam quando o CONTEÚDO realmente muda.
  const hydratedKey = hydrated
    ? `${hydrated.answer?.selectedOption ?? ''}|${hydrated.answer?.isCorrect ?? ''}|${
        hydrated.answer?.timestamp ?? ''
      }|${hydrated.bookmarked}|${hydrated.reaction ?? ''}`
    : null;

  // Carrega a resposta/favorito/reação já registrados para esta questão.
  // Quando o pai já buscou tudo em lote (`hydrated`, ver <QuestionsView>),
  // usa esses valores direto — evita uma consulta individual por cartão
  // (Prompt 10-A). Sem `hydrated` (prova/simulado, questão única via busca),
  // busca por conta própria, como antes.
  useEffect(() => {
    let cancelled = false;

    const applyInitialState = (
      initialAnswer: QuestionAnswerRecord | null,
      bookmarked: boolean,
      reaction: QuestionReactionValue | null
    ) => {
      if (cancelled) return;
      if (!isExamMode) {
        setSelectedOption(initialAnswer?.selectedOption || selectedOptionInExam || null);
        setIsSubmitted(!!initialAnswer);
        setAnswerOrigin(initialAnswer ? 'hydrated' : null);
      }
      setIsBookmarked(bookmarked);
      setErrorReason(initialAnswer?.errorReason || 'lacuna_teorica');
      setUserNote(initialAnswer?.userNotes || '');
      setAnswerMode(initialAnswer?.answerMode);
      setAlternativesRevealed(isExamMode || !!initialAnswer);
      setAnswerStrategy(initialAnswer?.answerStrategy);
      setMyReaction(reaction);
    };

    const loadReviewIfAnswered = async (initialAnswer: QuestionAnswerRecord | null) => {
      if (isExamMode || !initialAnswer) return;
      try {
        const review = await questionsRepository.getQuestionReview(question.id);
        if (!cancelled) setReviewResult(review);
      } catch {
        // Justificativa/gabarito não puderam ser recarregados agora (rede
        // instável, etc.) — isSubmitted/selectedOption já foram restaurados
        // acima independentemente disso; o estudante ainda vê que já
        // respondeu, só a explicação detalhada fica indisponível até uma
        // nova tentativa de carregamento (reload da questão).
      }
    };

    setOpenRecallDraft('');
    setReviewResult(null);

    if (hydrated) {
      applyInitialState(hydrated.answer, hydrated.bookmarked, hydrated.reaction);
      loadReviewIfAnswered(hydrated.answer);
      return () => {
        cancelled = true;
      };
    }

    // Sem hidratação em lote: cada consulta é isolada (Promise.allSettled,
    // não Promise.all) para que uma falha isolada (ex.: reação) não apague o
    // resultado das outras — antes, qualquer rejeição zerava TODO o estado
    // reidratado desta questão, incluindo isSubmitted/resposta/justificativa.
    (async () => {
      const [answersResult, bookmarksResult, reactionResult] = await Promise.allSettled([
        answersRepository.getAnswers(),
        bookmarksRepository.getBookmarks(),
        questionReactionsRepository.getMyReaction(question.id),
      ]);
      if (cancelled) return;

      const answers = answersResult.status === 'fulfilled' ? answersResult.value : {};
      const bookmarks =
        bookmarksResult.status === 'fulfilled'
          ? bookmarksResult.value
          : { questions: [], compendiums: [], flashcards: [] };
      const reaction = reactionResult.status === 'fulfilled' ? reactionResult.value : null;

      const initialAnswer = answers[question.id] ?? null;
      applyInitialState(initialAnswer, bookmarks.questions.includes(question.id), reaction);
      await loadReviewIfAnswered(initialAnswer);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, hydratedKey]);

  // Achado real do Prompt 07-F (reproduzido com Playwright, dois
  // BrowserContext da mesma conta): `myReaction` só é atualizado localmente
  // quando ESTE componente é quem chama setReaction/removeReaction — uma
  // aba/dispositivo que ficou aberto sem recarregar nunca fica sabendo que
  // OUTRO dispositivo mudou a reação nesse meio tempo. Antes desta correção,
  // clicar no mesmo botão de novo decidia "remover" com base nesse estado
  // LOCAL desatualizado (ex.: A marca up, B troca para down no servidor, A
  // clica em "up" de novo achando que ainda está "up" localmente => A
  // decide REMOVER em vez de reafirmar "up", apagando a reação em vez de
  // convergir para o clique real do usuário). Corrigido buscando o valor
  // atual do SERVIDOR (nunca o estado React possivelmente obsoleto)
  // imediatamente antes de decidir set vs. remove — o clique do usuário
  // sempre expressa a intenção correta em relação ao estado mais recente
  // conhecido, nunca em relação a uma leitura antiga.
  const handleToggleReaction = async (reaction: QuestionReactionValue) => {
    const current = await questionReactionsRepository.getMyReaction(question.id);
    if (current === reaction) {
      setMyReaction(null);
      await questionReactionsRepository.removeReaction(question.id);
    } else {
      setMyReaction(reaction);
      await questionReactionsRepository.setReaction(question.id, reaction);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveNote = async () => {
    const existing = (await answersRepository.getAnswers())[question.id];
    if (existing) {
      existing.userNotes = userNote;
      await answersRepository.recordAnswer(existing);
      setIsNoteSaved(true);
      showToast('Anotação pessoal vinculada ao erro salva com sucesso!');
      setTimeout(() => setIsNoteSaved(false), 2000);
    }
  };

  const handleSelectOption = (letter: 'A' | 'B' | 'C' | 'D' | 'E') => {
    if (isExamMode) {
      if (onSelectOptionInExam) onSelectOptionInExam(letter);
      setSelectedOption(letter);
      return;
    }

    if (isSubmitted) return; // already answered in study mode
    setSelectedOption(letter);
  };

  const handleConfirmAnswer = async () => {
    if (!selectedOption) return;

    // isCorrect é calculado pelo servidor (RPC submit_question_attempt); o
    // valor aqui é só um placeholder ignorado pela API.
    const record: QuestionAnswerRecord = {
      questionId: question.id,
      selectedOption,
      isCorrect: false,
      timestamp: new Date().toISOString(),
      timeSpentSeconds: 45,
      answerMode,
    };

    const review = await answersRepository.recordAnswer(record);
    const isCorrect = review.isCorrect;
    record.isCorrect = isCorrect;
    record.errorReason = isCorrect ? undefined : errorReason;
    setReviewResult(review);
    setIsSubmitted(true);
    setAnswerOrigin('session');

    if (onAnswerRecorded) onAnswerRecorded(record);

    if (!isCorrect) {
      setShowErrorTagger(true);
      showToast('Resposta incorreta. O elo de revisão foi ativado!');
    } else {
      showToast('Resposta correta! Excelente raciocínio clínico.');
      await checkStreakCelebration();
    }
  };

  // Confete automático só em marcos reais: ao completar uma sequência de
  // CELEBRATION_STREAK_LENGTH respostas corretas seguidas dentro da mesma
  // disciplina. Calculado em memória a partir de `answers`, sem persistir
  // nada novo no banco.
  const checkStreakCelebration = async () => {
    const [allAnswers, allQuestions] = await Promise.all([
      answersRepository.getAnswers(),
      questionsRepository.getQuestions(),
    ]);
    const disciplineByQuestionId = new Map(allQuestions.map((q) => [q.id, q.disciplineId]));

    const sameDisciplineAnswers = Object.values(allAnswers)
      .filter((a) => disciplineByQuestionId.get(a.questionId) === question.disciplineId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let streak = 0;
    for (let i = sameDisciplineAnswers.length - 1; i >= 0; i--) {
      if (!sameDisciplineAnswers[i].isCorrect) break;
      streak++;
    }

    if (streak > 0 && streak % CELEBRATION_STREAK_LENGTH === 0) {
      GamificationService.triggerCelebration();
    }
  };

  const handleToggleEliminate = (e: React.MouseEvent, letter: string) => {
    e.stopPropagation();
    if (eliminatedOptions.includes(letter)) {
      setEliminatedOptions(eliminatedOptions.filter((l) => l !== letter));
    } else {
      setEliminatedOptions([...eliminatedOptions, letter]);
    }
  };

  const handleToggleBookmark = async () => {
    const bookmarked = await bookmarksRepository.toggleBookmark('questions', question.id);
    setIsBookmarked(bookmarked);
    showToast(bookmarked ? 'Questão adicionada aos seus favoritos' : 'Removida dos favoritos');
  };

  const handleAddFlashcard = async () => {
    await flashcardsRepository.createFlashcardFromQuestion(question);
    showToast('Flashcard adicionado à sua rotina de Revisão Espaçada (SRS)!');
  };

  const handleUpdateErrorReason = async (reason: QuestionAnswerRecord['errorReason']) => {
    setErrorReason(reason);
    const existing = (await answersRepository.getAnswers())[question.id];
    if (existing) {
      existing.errorReason = reason;
      await answersRepository.recordAnswer(existing);
      showToast('Motivo do erro atualizado no seu Caderno de Erros.');
    }
  };

  const handleUpdateAnswerStrategy = async (strategy: QuestionAnswerRecord['answerStrategy']) => {
    setAnswerStrategy(strategy);
    const existing = (await answersRepository.getAnswers())[question.id];
    if (existing) {
      existing.answerStrategy = strategy;
      await answersRepository.recordAnswer(existing);
      showToast('Estratégia de resposta registrada.');
    }
  };

  // Alternativas só ficam totalmente visíveis em modo de prova, depois de
  // responder, quando o modo escolhido é "ver alternativas", ou quando o
  // aluno já revelou as alternativas no modo de recall livre.
  const showOptionsFully =
    isExamMode ||
    isSubmitted ||
    answerMode === 'multiple_choice' ||
    (answerMode === 'open_recall' && alternativesRevealed);

  const isCorrect = isSubmitted && !!reviewResult?.isCorrect;
  const isIncorrect = isSubmitted && !!reviewResult && !isCorrect;
  const reviewByLetter: Map<string, QuestionReviewResult['options'][number]> = new Map();
  for (const o of reviewResult?.options ?? []) {
    reviewByLetter.set(o.letter, o);
  }

  return (
    <div
      id={`question-${question.id}`}
      data-answer-origin={answerOrigin ?? 'unanswered'}
      className={`bg-white dark:bg-[#0F172A] rounded-3xl border transition-all p-6 sm:p-8 elev-xs relative ${
        isSubmitted
          ? isCorrect
            ? 'border-emerald-300 dark:border-emerald-700/80 ring-1 ring-emerald-100 dark:ring-emerald-950/40'
            : 'border-rose-300 dark:border-rose-700/80 ring-1 ring-rose-100 dark:ring-rose-950/40'
          : 'border-slate-200 dark:border-[#243452]'
      }`}
    >
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-20 bg-slate-900 dark:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-semibold elev-lg flex items-center gap-1.5 animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
            {discipline?.name || 'Medicina'}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#142038] text-slate-700 dark:text-slate-300">
            {theme?.name || 'Tema'}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            {question.institution} ({question.year})
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase">
            {question.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ContextualFeedbackPopover questionId={question.id} />
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              isBookmarked
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                : 'bg-white dark:bg-[#142038] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#243452] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Favoritar questão"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Clinical Vignette & Stem */}
      <div className="space-y-4 mb-6">
        {question.clinicalVignette && (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#142038]/80 border border-slate-200/80 dark:border-[#243452] font-serif-reading text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed">
            {question.clinicalVignette}
          </div>
        )}
        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug">
          {question.questionStem}
        </p>
      </div>

      {/* Escolha do modo de resposta (recall livre vs. múltipla escolha) —
          só em modo de estudo, antes de responder, e travada após escolhida. */}
      {!isExamMode && !isSubmitted && !answerMode && (
        <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-[#142038] border border-slate-200 dark:border-[#243452] flex flex-col sm:flex-row items-center gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium flex-1">
            Antes de ver as alternativas: prefere responder com suas próprias palavras primeiro, ou já reconhecer a resposta entre as opções?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAnswerMode('open_recall');
                setAlternativesRevealed(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-colors cursor-pointer elev-xs"
            >
              Responder antes de ver as alternativas
            </button>
            <button
              type="button"
              onClick={() => {
                setAnswerMode('multiple_choice');
                setAlternativesRevealed(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Ver alternativas
            </button>
          </div>
        </div>
      )}

      {/* Recall ativo: campo de texto livre ANTES de revelar as alternativas
          (Prompt 10-A). O estudante escreve sua resposta com as próprias
          palavras (recordação ativa); pode revelar as alternativas sem
          preencher nada — o texto é só um apoio à memória, nunca é
          classificado automaticamente nem vira gabarito, e a seleção +
          confirmação de uma alternativa continua sendo o único mecanismo
          oficial de correção. Nunca enviado ao servidor nem a nenhuma IA —
          existe só neste componente, durante esta sessão. */}
      {!isExamMode && !isSubmitted && answerMode === 'open_recall' && !alternativesRevealed && (
        <div className="mb-6 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center gap-4 text-center">
          <div className="w-full text-left space-y-1.5">
            <label
              htmlFor={`open-recall-draft-${question.id}`}
              className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Escreva sua resposta antes de ver as alternativas (opcional)
            </label>
            <textarea
              id={`open-recall-draft-${question.id}`}
              value={openRecallDraft}
              onChange={(e) => setOpenRecallDraft(e.target.value)}
              placeholder="Ex.: eu responderia que é... porque..."
              rows={3}
              inputMode="text"
              aria-describedby={`open-recall-draft-help-${question.id}`}
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 dark:border-[#243452] bg-white dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
            <p id={`open-recall-draft-help-${question.id}`} className="text-[11px] text-slate-400 dark:text-slate-500">
              Este texto não é enviado a ninguém, não é analisado automaticamente e não substitui marcar uma alternativa — é só para você comparar depois de ver as opções. Pode continuar sem escrever nada.
            </p>
          </div>

          <div className="space-y-2 select-none blur-sm pointer-events-none opacity-60 w-full" aria-hidden="true">
            {question.options.map((opt) => (
              <div
                key={opt.letter}
                className="rounded-xl border border-slate-200 dark:border-[#243452] p-3 text-xs text-slate-500 dark:text-slate-400 text-left"
              >
                {opt.letter}) {opt.text}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAlternativesRevealed(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-colors cursor-pointer elev-xs"
          >
            Revelar alternativas para marcar minha resposta
          </button>
        </div>
      )}

      {/* Comparação: mostra o que foi escrito antes de revelar (recordação
          ativa), lado a lado com as alternativas agora visíveis. Some quando
          a questão é trocada (reset no useEffect) — não fica sobrando de uma
          questão anterior. */}
      {!isExamMode && answerMode === 'open_recall' && alternativesRevealed && openRecallDraft.trim() && (
        <div className="mb-4 p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 text-xs">
          <span className="font-bold flex items-center gap-1.5 text-teal-900 dark:text-teal-300 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            O que você escreveu antes de ver as alternativas:
          </span>
          <p className="text-teal-950/90 dark:text-teal-200/90 leading-relaxed whitespace-pre-wrap">{openRecallDraft}</p>
        </div>
      )}

      {/* Options List */}
      {showOptionsFully && (
      <div className="space-y-3 mb-6">
        {question.options.map((opt) => {
          const isSelected = selectedOption === opt.letter;
          const isEliminated = eliminatedOptions.includes(opt.letter);
          const reviewOpt = reviewByLetter.get(opt.letter);

          let optBg = 'bg-white dark:bg-[#142038] border-slate-200 dark:border-[#243452] hover:border-slate-300 dark:hover:border-slate-600';
          let letterBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';

          if (isExamMode) {
            if (isSelected) {
              optBg = 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 ring-2 ring-teal-600/30';
              letterBg = 'bg-teal-700 text-white';
            }
          } else if (isSubmitted && reviewOpt) {
            if (reviewOpt.isCorrect) {
              optBg = 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-300 dark:ring-emerald-800';
              letterBg = 'bg-emerald-600 text-white';
            } else if (isSelected && !reviewOpt.isCorrect) {
              optBg = 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 ring-1 ring-rose-300 dark:ring-rose-800';
              letterBg = 'bg-rose-600 text-white';
            }
          } else {
            if (isSelected) {
              optBg = 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 ring-2 ring-teal-600/30';
              letterBg = 'bg-teal-700 text-white';
            }
          }

          return (
            <div
              key={opt.letter}
              onClick={() => handleSelectOption(opt.letter)}
              className={`rounded-2xl border p-3.5 sm:p-4 transition-all cursor-pointer relative flex flex-col gap-2 ${optBg} ${
                isEliminated ? 'opacity-40 line-through' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span
                    className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${letterBg}`}
                  >
                    {opt.letter}
                  </span>
                  <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed pt-0.5">
                    {opt.text}
                  </span>
                </div>

                {/* Strike-through descartar button */}
                {!isSubmitted && !isExamMode && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleEliminate(e, opt.letter)}
                    className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-semibold transition-colors shrink-0 cursor-pointer"
                    title={isEliminated ? 'Restaurar alternativa' : 'Riscar alternativa'}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Individual Alternative Explanation (When Answered in Study Mode) */}
              {isSubmitted && !isExamMode && reviewOpt && (
                <div
                  className={`mt-2 pt-2 border-t text-xs leading-relaxed ${
                    reviewOpt.isCorrect
                      ? 'border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 bg-emerald-100/40 dark:bg-emerald-950/40 p-2.5 rounded-xl'
                      : 'border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#0B1220]/60 p-2.5 rounded-xl'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {reviewOpt.isCorrect ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span>{reviewOpt.isCorrect ? 'Por que está correta:' : 'Por que está incorreta (distrator):'}</span>
                  </div>
                  <p>{reviewOpt.explanation}</p>
                  {opt.mechanismReference && (
                    <p className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 italic">
                      Mecanismo: {opt.mechanismReference}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Action / Submit Area (Study Mode) */}
      {!isExamMode && !isSubmitted && showOptionsFully && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {selectedOption
              ? `Alternativa (${selectedOption}) selecionada.`
              : 'Selecione uma alternativa para responder.'}
          </p>
          <button
            onClick={handleConfirmAnswer}
            disabled={!selectedOption}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all elev-xs ${
              selectedOption
                ? 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            Confirmar Resposta
          </button>
        </div>
      )}

      {/* --- THE INTEGRATED ACTION BANNER (O DIFERENCIAL CONECTADO) --- */}
      {isSubmitted && !isExamMode && (
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          {/* Status summary */}
          {isCorrect ? (
            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold block text-emerald-900 dark:text-emerald-300 uppercase tracking-wider text-[11px]">
                  Confirmação Clínica · Resposta Correta
                </span>
                <p className="text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-200/90">
                  {reviewResult?.generalCommentary}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <span className="text-xs font-bold block text-rose-900 dark:text-rose-300 uppercase tracking-wider text-[11px]">
                  Mecanismo Negligenciado ou Distrator Identificado
                </span>
                <p className="text-xs leading-relaxed text-rose-900/90 dark:text-rose-200/90">
                  {reviewResult?.generalCommentary}
                </p>
                <div className="p-2.5 rounded-xl bg-rose-100/60 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-900 dark:text-rose-200">
                  <strong>Ponto-chave negligenciado:</strong> {reviewResult?.highYieldSummary}
                </div>
              </div>
            </div>
          )}

          {/* High-Yield Summary Pearl */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-950 dark:text-teal-200">
            <span className="font-bold block mb-1 flex items-center gap-1.5 text-teal-900 dark:text-teal-300">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Pérola High-Yield (Resumo Prático):
            </span>
            <p className="leading-relaxed font-medium text-teal-950/90 dark:text-teal-200/90">{reviewResult?.highYieldSummary}</p>
          </div>

          {/* Fontes vinculadas a esta questão (question_references -> sources).
              Só aparece quando existe vínculo estruturado real — questões sem
              essa recuperação/carga não mostram nada aqui (não é bibliografia
              geral do compêndio, é citação específica desta questão). */}
          {reviewResult?.references && reviewResult.references.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#243452] text-xs">
              <span className="font-bold flex items-center gap-1.5 text-slate-600 dark:text-slate-300 mb-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Bibliografia da questão:
              </span>
              <p className="mb-2">Referências gerais da questão; não há vínculo individual com cada alternativa.</p>
              <ul className="space-y-1">
                {reviewResult.references.map((ref) => (
                  <li key={ref.sourceId} className="text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        {ref.citationText}
                      </a>
                    ) : (
                      <span>{ref.citationText}</span>
                    )}
                    <span className="block text-[11px]">{sourceVerificationLabel(ref.verificacao)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reação rápida à explicação */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-slate-400">Esta explicação te ajudou?</span>
            <button
              type="button"
              onClick={() => handleToggleReaction('up')}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                myReaction === 'up'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-white dark:bg-[#142038] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-[#243452] hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Explicação útil"
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${myReaction === 'up' ? 'fill-emerald-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => handleToggleReaction('down')}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                myReaction === 'down'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                  : 'bg-white dark:bg-[#142038] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-[#243452] hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Explicação confusa"
            >
              <ThumbsDown className={`w-3.5 h-3.5 ${myReaction === 'down' ? 'fill-rose-500' : ''}`} />
            </button>
          </div>

          {/* Estratégia de Resposta (toda resposta, certa ou errada) —
              taxonomia separada de errorReason, que só se aplica a erro. */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#142038] border border-slate-200 dark:border-[#243452] rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Como você chegou a essa escolha?
              </span>
              <span className="text-[10px] text-slate-400">Autoavaliação metacognitiva</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'recognition', label: 'Reconheci a alternativa certa' },
                { id: 'elimination', label: 'Usei exclusão' },
                { id: 'false_confidence', label: 'Achei que sabia — confiança equivocada' },
                { id: 'guess', label: 'Chutei' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleUpdateAnswerStrategy(item.id as any)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                    answerStrategy === item.id
                      ? 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800'
                      : 'bg-white dark:bg-[#0B1220] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#243452] hover:bg-slate-100 dark:hover:bg-[#1A2845]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Próximos Passos Claros (Fisiopatologia, Caderno de Erros, Flashcard) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* 1. Revisar Fisiopatologia */}
            <button
              onClick={() =>
                onOpenCompendium(question.compendiumRefId, question.compendiumSectionId)
              }
              className="p-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-2 elev-xs transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Revisar Fisiopatologia</span>
            </button>

            {/* 2. Adicionar / Mapear no Caderno de Erros */}
            <button
              onClick={async () => {
                const existing = (await answersRepository.getAnswers())[question.id];
                if (existing) {
                  existing.errorReason = errorReason;
                  await answersRepository.recordAnswer(existing);
                  showToast('Questão catalogada no Caderno de Erros!');
                }
              }}
              className="p-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center justify-center gap-2 elev-xs transition-colors cursor-pointer"
            >
              <Tag className="w-4 h-4 text-rose-200" />
              <span>{isIncorrect ? 'Catalogar no Caderno de Erros' : 'Salvar no Caderno'}</span>
            </button>

            {/* 3. Gerar Flashcard */}
            <button
              onClick={handleAddFlashcard}
              className="p-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 elev-xs transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-teal-200 dark:text-teal-400" />
              <span>Gerar Flashcard SRS</span>
            </button>
          </div>

          {/* Anotação Pessoal Vinculada ao Erro */}
          {isIncorrect && (
            <div className="p-3.5 bg-slate-50 dark:bg-[#142038] border border-slate-200 dark:border-[#243452] rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                  Mapear Motivo do Erro:
                </span>
                <span className="text-[10px] text-slate-400">Por que errei (categoria separada da estratégia acima)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'lacuna_teorica', label: 'Lacuna Teórica' },
                  { id: 'pegadinha', label: 'Pegadinha / Distrator' },
                  { id: 'falta_atencao', label: 'Falta de Atenção' },
                  { id: 'raciocinio_clinico', label: 'Raciocínio Clínico' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleUpdateErrorReason(item.id as any)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      errorReason === item.id
                        ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
                        : 'bg-white dark:bg-[#0B1220] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#243452] hover:bg-slate-100 dark:hover:bg-[#1A2845]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Personal notes textarea */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#243452] space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Anotação Pessoal Vinculada ao Erro:
                  </label>
                  {isNoteSaved && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Salvo!
                    </span>
                  )}
                </div>
                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="Registre o que você aprendeu com este erro, a pegadinha da banca ou uma correlação rápida..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-[#243452] bg-white dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-teal-600 hover:bg-slate-700 dark:hover:bg-teal-500 text-white text-[11px] font-semibold transition-colors cursor-pointer elev-xs"
                  >
                    Salvar Anotação Pessoal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
