import React, { useState } from 'react';
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
} from 'lucide-react';
import { Question, QuestionOption, QuestionAnswerRecord, Discipline, Theme } from '../../types';
import { StorageService } from '../../services/storage';
import { bookmarksRepository } from '../../repositories/BookmarksRepository';
import { flashcardsRepository } from '../../repositories/FlashcardsRepository';

interface QuestionCardProps {
  question: Question;
  discipline?: Discipline;
  theme?: Theme;
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onAnswerRecorded?: (record: QuestionAnswerRecord) => void;
  isExamMode?: boolean;
  selectedOptionInExam?: 'A' | 'B' | 'C' | 'D' | 'E';
  onSelectOptionInExam?: (opt: 'A' | 'B' | 'C' | 'D' | 'E') => void;
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
}) => {
  // Local state for study mode
  const initialAnswer = StorageService.getAnswers()[question.id];
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | 'C' | 'D' | 'E' | null>(
    initialAnswer?.selectedOption || selectedOptionInExam || null
  );
  const [isSubmitted, setIsSubmitted] = useState<boolean>(!!initialAnswer && !isExamMode);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(
    bookmarksRepository.getBookmarks().questions.includes(question.id)
  );
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [errorReason, setErrorReason] = useState<QuestionAnswerRecord['errorReason']>(
    initialAnswer?.errorReason || 'lacuna_teorica'
  );
  const [userNote, setUserNote] = useState<string>(initialAnswer?.userNotes || '');
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const [showErrorTagger, setShowErrorTagger] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveNote = () => {
    const existing = StorageService.getAnswers()[question.id];
    if (existing) {
      existing.userNotes = userNote;
      StorageService.recordAnswer(existing);
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

  const handleConfirmAnswer = () => {
    if (!selectedOption) return;
    const correctOpt = question.options.find((o) => o.isCorrect)?.letter;
    const isCorrect = selectedOption === correctOpt;

    const record: QuestionAnswerRecord = {
      questionId: question.id,
      selectedOption,
      isCorrect,
      timestamp: new Date().toISOString(),
      timeSpentSeconds: 45,
      errorReason: isCorrect ? undefined : errorReason,
    };

    StorageService.recordAnswer(record);
    setIsSubmitted(true);

    if (onAnswerRecorded) onAnswerRecorded(record);

    if (!isCorrect) {
      setShowErrorTagger(true);
      showToast('Resposta incorreta. O elo de revisão foi ativado!');
    } else {
      showToast('Resposta correta! Excelente raciocínio clínico.');
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

  const handleToggleBookmark = () => {
    const bookmarked = bookmarksRepository.toggleBookmark('questions', question.id);
    setIsBookmarked(bookmarked);
    showToast(bookmarked ? 'Questão adicionada aos seus favoritos' : 'Removida dos favoritos');
  };

  const handleAddFlashcard = () => {
    flashcardsRepository.createFlashcardFromQuestion(question);
    showToast('Flashcard adicionado à sua rotina de Revisão Espaçada (SRS)!');
  };

  const handleUpdateErrorReason = (reason: QuestionAnswerRecord['errorReason']) => {
    setErrorReason(reason);
    const existing = StorageService.getAnswers()[question.id];
    if (existing) {
      existing.errorReason = reason;
      StorageService.recordAnswer(existing);
      showToast('Motivo do erro atualizado no seu Caderno de Erros.');
    }
  };

  const isCorrect = isSubmitted && question.options.find((o) => o.letter === selectedOption)?.isCorrect;
  const isIncorrect = isSubmitted && !isCorrect;

  return (
    <div
      id={`question-${question.id}`}
      className={`bg-white rounded-3xl border transition-all p-6 sm:p-8 shadow-xs relative ${
        isSubmitted
          ? isCorrect
            ? 'border-emerald-300 ring-1 ring-emerald-100'
            : 'border-rose-300 ring-1 ring-rose-100'
          : 'border-slate-200'
      }`}
    >
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-20 bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/60">
            {discipline?.name || 'Medicina'}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {theme?.name || 'Tema'}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/60">
            {question.institution} ({question.year})
          </span>
          <span className="text-[11px] font-medium text-slate-500 uppercase">
            {question.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleBookmark}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              isBookmarked
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
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
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 font-serif-reading text-slate-800 text-sm sm:text-base leading-relaxed">
            {question.clinicalVignette}
          </div>
        )}
        <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
          {question.questionStem}
        </p>
      </div>

      {/* Options List */}
      <div className="space-y-3 mb-6">
        {question.options.map((opt) => {
          const isSelected = selectedOption === opt.letter;
          const isEliminated = eliminatedOptions.includes(opt.letter);

          let optBg = 'bg-white border-slate-200 hover:border-slate-300';
          let letterBg = 'bg-slate-100 text-slate-700';

          if (isExamMode) {
            if (isSelected) {
              optBg = 'bg-teal-50 border-teal-600 ring-2 ring-teal-600/30';
              letterBg = 'bg-teal-700 text-white';
            }
          } else if (isSubmitted) {
            if (opt.isCorrect) {
              optBg = 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-300';
              letterBg = 'bg-emerald-600 text-white';
            } else if (isSelected && !opt.isCorrect) {
              optBg = 'bg-rose-50/90 border-rose-400 ring-1 ring-rose-300';
              letterBg = 'bg-rose-600 text-white';
            }
          } else {
            if (isSelected) {
              optBg = 'bg-teal-50 border-teal-600 ring-2 ring-teal-600/30';
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
                  <span className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed pt-0.5">
                    {opt.text}
                  </span>
                </div>

                {/* Strike-through descartar button */}
                {!isSubmitted && !isExamMode && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleEliminate(e, opt.letter)}
                    className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 text-[10px] font-semibold transition-colors shrink-0"
                    title={isEliminated ? 'Restaurar alternativa' : 'Riscar alternativa'}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Individual Alternative Explanation (When Answered in Study Mode) */}
              {isSubmitted && !isExamMode && (
                <div
                  className={`mt-2 pt-2 border-t text-xs leading-relaxed ${
                    opt.isCorrect
                      ? 'border-emerald-200 text-emerald-900 bg-emerald-100/40 p-2.5 rounded-xl'
                      : 'border-slate-200/80 text-slate-600 bg-slate-50 p-2.5 rounded-xl'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {opt.isCorrect ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span>{opt.isCorrect ? 'Por que está correta:' : 'Por que está incorreta (distrator):'}</span>
                  </div>
                  <p>{opt.explanation}</p>
                  {opt.mechanismReference && (
                    <p className="mt-1 text-[11px] font-mono text-slate-500 italic">
                      Mecanismo: {opt.mechanismReference}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action / Submit Area (Study Mode) */}
      {!isExamMode && !isSubmitted && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            {selectedOption
              ? `Alternativa (${selectedOption}) selecionada.`
              : 'Selecione uma alternativa para responder.'}
          </p>
          <button
            onClick={handleConfirmAnswer}
            disabled={!selectedOption}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              selectedOption
                ? 'bg-teal-700 hover:bg-teal-800 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
                  {question.generalCommentary}
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
                  {question.generalCommentary}
                </p>
                <div className="p-2.5 rounded-xl bg-rose-100/60 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-900 dark:text-rose-200">
                  <strong>Ponto-chave negligenciado:</strong> {question.highYieldSummary}
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
            <p className="leading-relaxed font-medium text-teal-950/90 dark:text-teal-200/90">{question.highYieldSummary}</p>
          </div>

          {/* Próximos Passos Claros (Fisiopatologia, Caderno de Erros, Flashcard) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* 1. Revisar Fisiopatologia */}
            <button
              onClick={() =>
                onOpenCompendium(question.compendiumRefId, question.compendiumSectionId)
              }
              className="p-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Revisar Fisiopatologia</span>
            </button>

            {/* 2. Adicionar / Mapear no Caderno de Erros */}
            <button
              onClick={() => {
                const existing = StorageService.getAnswers()[question.id];
                if (existing) {
                  existing.errorReason = errorReason;
                  StorageService.recordAnswer(existing);
                  showToast('Questão catalogada no Caderno de Erros!');
                }
              }}
              className="p-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Tag className="w-4 h-4 text-rose-200" />
              <span>{isIncorrect ? 'Catalogar no Caderno de Erros' : 'Salvar no Caderno'}</span>
            </button>

            {/* 3. Gerar Flashcard */}
            <button
              onClick={handleAddFlashcard}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-teal-400" />
              <span>Gerar Flashcard SRS</span>
            </button>
          </div>

          {/* Anotação Pessoal Vinculada ao Erro */}
          {isIncorrect && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                  Mapear Motivo do Erro:
                </span>
                <span className="text-[10px] text-slate-400">Classificação pedagógica</span>
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
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Personal notes textarea */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Anotação Pessoal Vinculada ao Erro:
                  </label>
                  {isNoteSaved && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Salvo!
                    </span>
                  )}
                </div>
                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="Registre o que você aprendeu com este erro, a pegadinha da banca ou uma correlação rápida..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
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
