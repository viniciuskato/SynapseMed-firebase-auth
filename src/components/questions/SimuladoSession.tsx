import React, { useState, useEffect } from 'react';
import {
  Timer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Layers,
  Sparkles,
  BarChart3,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Question, SimuladoConfig, Discipline, Theme, SimuladoSessionData } from '../../types';
import { answersRepository } from '../../repositories/AnswersRepository';
import { simuladosRepository } from '../../repositories/SimuladosRepository';
import { QuestionCard } from './QuestionCard';

interface SimuladoSessionProps {
  config: SimuladoConfig;
  questions: Question[];
  disciplines: Discipline[];
  themes: Theme[];
  onFinishSession: () => void;
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
}

export const SimuladoSession: React.FC<SimuladoSessionProps> = ({
  config,
  questions,
  disciplines,
  themes,
  onFinishSession,
  onOpenCompendium,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D' | 'E'>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(config.timeLimitMinutes * 60);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionResults, setSessionResults] = useState<{
    correctCount: number;
    totalCount: number;
    scorePercent: number;
    timeSpentSeconds: number;
  } | null>(null);

  // Countdown timer
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished]);

  const handleSelectAnswer = (letter: 'A' | 'B' | 'C' | 'D' | 'E') => {
    if (isFinished) return;
    const currentQ = questions[currentIdx];
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: letter,
    }));
  };

  const handleFinishExam = () => {
    if (isFinished) return;

    let correct = 0;
    const sessionAnswersRecord: SimuladoSessionData['answers'] = {};

    questions.forEach((q) => {
      const selected = answers[q.id];
      const isCor = selected === q.options.find((o) => o.isCorrect)?.letter;
      if (isCor) correct += 1;

      if (selected) {
        sessionAnswersRecord[q.id] = {
          selectedOption: selected,
          timeSpent: Math.round((config.timeLimitMinutes * 60 - secondsRemaining) / questions.length),
        };
        // Record in global answers storage
        answersRepository.recordAnswer({
          questionId: q.id,
          selectedOption: selected,
          isCorrect: isCor,
          timestamp: new Date().toISOString(),
          timeSpentSeconds: 45,
          errorReason: isCor ? undefined : 'lacuna_teorica',
        });
      }
    });

    const totalTimeSpent = config.timeLimitMinutes * 60 - secondsRemaining;
    const scorePct = Math.round((correct / Math.max(1, questions.length)) * 100);

    const sessionData: SimuladoSessionData = {
      id: config.id,
      config,
      questionIds: questions.map((q) => q.id),
      answers: sessionAnswersRecord,
      startedAt: new Date(Date.now() - totalTimeSpent * 1000).toISOString(),
      completedAt: new Date().toISOString(),
      score: scorePct,
      totalTimeSeconds: totalTimeSpent,
    };

    simuladosRepository.saveSimuladoSession(sessionData);

    setSessionResults({
      correctCount: correct,
      totalCount: questions.length,
      scorePercent: scorePct,
      timeSpentSeconds: totalTimeSpent,
    });
    setIsFinished(true);

    if (scorePct >= 70) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Session Bar */}
      <div className="sticky top-[61px] z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3 -mx-4 lg:-mx-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onFinishSession}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              title="Encerrar / Sair"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">{config.name}</h2>
              <p className="text-[11px] text-slate-500">
                Questão {currentIdx + 1} de {questions.length} • {answeredCount} respondidas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Countdown timer */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs ${
                secondsRemaining < 120
                  ? 'bg-rose-100 text-rose-800 animate-pulse'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <Timer className="w-4 h-4 text-teal-700" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            {!isFinished && (
              <button
                onClick={handleFinishExam}
                className="px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Finalizar Prova
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        {/* Left / Navigation Palette (3 cols) */}
        <div className="lg:col-span-4 order-2 lg:order-1 space-y-4">
          {/* Questions Grid */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Matriz de Questões
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isSelected = answers[q.id] !== undefined;
                const isCurrent = currentIdx === idx;
                const isCor =
                  isFinished &&
                  answers[q.id] === q.options.find((o) => o.isCorrect)?.letter;
                const isWrong = isFinished && isSelected && !isCor;

                let btnClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                if (isFinished) {
                  if (isCor) btnClass = 'bg-emerald-600 text-white font-bold';
                  else if (isWrong) btnClass = 'bg-rose-600 text-white font-bold';
                  else btnClass = 'bg-slate-200 text-slate-400';
                } else {
                  if (isCurrent) btnClass = 'bg-teal-800 text-white font-bold ring-2 ring-teal-400';
                  else if (isSelected) btnClass = 'bg-teal-100 text-teal-900 font-bold border border-teal-300';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Respondida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Pendente
              </span>
            </div>
          </div>

          {/* If finished: Final Score Card */}
          {isFinished && sessionResults && (
            <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                  Resultado do Simulado
                </span>
                <span className="text-xs text-slate-300">
                  {Math.floor(sessionResults.timeSpentSeconds / 60)} min gastos
                </span>
              </div>

              <div className="text-center py-2">
                <span className="text-4xl font-extrabold text-white">
                  {sessionResults.scorePercent}%
                </span>
                <p className="text-xs text-slate-300 mt-1">
                  Você acertou {sessionResults.correctCount} de {sessionResults.totalCount} questões
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                <p className="text-slate-300">
                  Todas as questões erradas foram enviadas para o seu <strong>Caderno de Erros</strong> e ganharam flashcards recomendados para revisão espaçada.
                </p>
                <button
                  onClick={onFinishSession}
                  className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-colors"
                >
                  Voltar ao Painel Geral
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right / Question Detail (8 cols) */}
        <div className="lg:col-span-8 order-1 lg:order-2 space-y-6">
          {currentQ ? (
            <QuestionCard
              question={currentQ}
              discipline={disciplines.find((d) => d.id === currentQ.disciplineId)}
              theme={themes.find((t) => t.id === currentQ.themeId)}
              onOpenCompendium={onOpenCompendium}
              isExamMode={!isFinished && config.isExamMode}
              selectedOptionInExam={answers[currentQ.id]}
              onSelectOptionInExam={handleSelectAnswer}
            />
          ) : (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
              Nenhuma questão selecionada.
            </div>
          )}

          {/* Navigation Prev / Next Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors ${
                currentIdx === 0
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Questão Anterior</span>
            </button>

            <button
              onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIdx === questions.length - 1}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-colors ${
                currentIdx === questions.length - 1
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800'
              }`}
            >
              <span>Próxima Questão</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
