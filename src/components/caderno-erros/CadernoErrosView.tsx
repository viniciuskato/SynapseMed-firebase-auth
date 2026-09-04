import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Layers,
  Timer,
  Sparkles,
  Tag,
  CheckCircle2,
  HelpCircle,
  Flame,
} from 'lucide-react';
import { Question, Discipline, Theme, QuestionAnswerRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { answersRepository } from '../../repositories/AnswersRepository';
import { QuestionCard } from '../questions/QuestionCard';

interface CadernoErrosViewProps {
  questions: Question[];
  disciplines: Discipline[];
  themes: Theme[];
  onOpenCompendium: (compendiumId: string, sectionId?: string) => void;
  onOpenCreateSimulado: () => void;
}

export const CadernoErrosView: React.FC<CadernoErrosViewProps> = ({
  questions,
  disciplines,
  themes,
  onOpenCompendium,
  onOpenCreateSimulado,
}) => {
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const answers = answersRepository.getAnswers();
  const mistakeRecords = Object.values(answers).filter((a) => !a.isCorrect);

  const mistakeQuestions = questions.filter((q) => {
    const ans = answers[q.id];
    if (!ans || ans.isCorrect) return false;
    if (selectedReasonFilter !== 'all' && ans.errorReason !== selectedReasonFilter) {
      return false;
    }
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleGenerateAllFlashcards = () => {
    let createdCount = 0;
    mistakeQuestions.forEach((q) => {
      StorageService.createFlashcardFromQuestion(q);
      createdCount++;
    });
    showToast(`${createdCount} flashcards adicionados à sua fila de Revisão Espaçada (SRS)!`);
  };

  const reasonStats = {
    lacuna_teorica: Object.values(answers).filter((a) => !a.isCorrect && a.errorReason === 'lacuna_teorica').length,
    pegadinha: Object.values(answers).filter((a) => !a.isCorrect && a.errorReason === 'pegadinha').length,
    falta_atencao: Object.values(answers).filter((a) => !a.isCorrect && a.errorReason === 'falta_atencao').length,
    raciocinio_clinico: Object.values(answers).filter((a) => !a.isCorrect && a.errorReason === 'raciocinio_clinico').length,
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-800 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-400/30">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Caderno de Erros Estruturado</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Transforme Erros em Pontos de Domínio Clínico
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Diagnostique o tipo exato do seu erro (lacuna teórica vs. distrator/pegadinha vs. raciocínio clínico). Acesse o compêndio imediatamente para revisar a fisiopatologia e adicione o flashcard ao SRS.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
          {mistakeQuestions.length > 0 && (
            <button
              onClick={handleGenerateAllFlashcards}
              className="px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              <span>Gerar SRS para Todos</span>
            </button>
          )}

          <button
            onClick={onOpenCreateSimulado}
            className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <Timer className="w-4 h-4" />
            <span>Simulado Só de Erros</span>
          </button>
        </div>
      </div>

      {/* Error Breakdown Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'all', label: 'Todos os Erros', count: mistakeRecords.length, color: 'bg-slate-900 text-white' },
          { id: 'lacuna_teorica', label: 'Lacuna Teórica', count: reasonStats.lacuna_teorica, color: 'bg-rose-50 text-rose-900 border-rose-200' },
          { id: 'pegadinha', label: 'Pegadinha / Distrator', count: reasonStats.pegadinha, color: 'bg-amber-50 text-amber-900 border-amber-200' },
          { id: 'falta_atencao', label: 'Falta de Atenção', count: reasonStats.falta_atencao, color: 'bg-blue-50 text-blue-900 border-blue-200' },
        ].map((item) => {
          const isSelected = selectedReasonFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedReasonFilter(item.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-[11px] font-bold block mb-1">{item.label}</span>
              <span className="text-lg font-extrabold">{item.count} questões</span>
            </button>
          );
        })}
      </div>

      {/* Mistakes List */}
      {mistakeQuestions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
          <p className="font-bold text-base text-slate-800">
            Nenhuma questão no caderno de erros com este filtro!
          </p>
          <p className="text-xs text-slate-400">
            Seus erros são registrados automaticamente sempre que você responde uma questão incorretamente no Banco de Questões ou Simulados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-xs font-semibold text-slate-500 px-2">
            Mostrando <strong>{mistakeQuestions.length} questões erradas</strong> para treino deliberado:
          </div>

          {mistakeQuestions.map((q) => (
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
