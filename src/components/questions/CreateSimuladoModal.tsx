import React, { useState } from 'react';
import {
  Timer,
  X,
  Sparkles,
  Check,
  Layers,
  HelpCircle,
  Clock,
  BookOpen,
  Filter,
} from 'lucide-react';
import { Discipline, Theme, DifficultyLevel, MedicalCycle, SimuladoConfig } from '../../types';

interface CreateSimuladoModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplines: Discipline[];
  themes: Theme[];
  totalAvailableQuestions: number;
  mistakesCount: number;
  onStartSimulado: (config: SimuladoConfig) => void;
}

export const CreateSimuladoModal: React.FC<CreateSimuladoModalProps> = ({
  isOpen,
  onClose,
  disciplines,
  themes,
  totalAvailableQuestions,
  mistakesCount,
  onStartSimulado,
}) => {
  const [name, setName] = useState('Simulado Personalizado');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<DifficultyLevel[]>([
    'facil',
    'medio',
    'dificil',
  ]);
  const [selectedCycles, setSelectedCycles] = useState<MedicalCycle[]>([
    'basico',
    'clinico',
    'internato_residencia',
  ]);
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [isExamMode, setIsExamMode] = useState(true);

  if (!isOpen) return null;

  const toggleDiscipline = (id: string) => {
    if (selectedDisciplines.includes(id)) {
      setSelectedDisciplines(selectedDisciplines.filter((d) => d !== id));
    } else {
      setSelectedDisciplines([...selectedDisciplines, id]);
    }
  };

  const handleStart = () => {
    const config: SimuladoConfig = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Simulado Personalizado',
      disciplineIds: selectedDisciplines,
      themeIds: [],
      difficulties: selectedDifficulties,
      cycles: selectedCycles,
      onlyMistakes,
      questionCount,
      timeLimitMinutes,
      isExamMode,
    };
    onStartSimulado(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Criador de Simulados & Listas</h3>
              <p className="text-xs text-slate-300">
                Monte provas cronometradas ou listas de revisão focadas nas suas lacunas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Title */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Nome da Sessão de Estudo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              placeholder="Ex: Simulado Cardiologia & Pneumo Ciclo Clínico"
            />
          </div>

          {/* Quick Filter: Caderno de Erros */}
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-rose-950 block">Treinar Apenas Erros Anteriores</span>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Você possui <strong>{mistakesCount} questões erradas</strong> registradas no seu Caderno de Erros.
              </p>
            </div>
            <button
              onClick={() => setOnlyMistakes(!onlyMistakes)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${
                onlyMistakes
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-800 border border-rose-300'
              }`}
            >
              {onlyMistakes ? 'Filtro de Erros Ativo' : 'Ativar Filtro de Erros'}
            </button>
          </div>

          {/* Disciplines Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700">Disciplinas Médicas</label>
              <button
                onClick={() =>
                  setSelectedDisciplines(
                    selectedDisciplines.length === disciplines.length
                      ? []
                      : disciplines.map((d) => d.id)
                  )
                }
                className="text-teal-700 hover:underline font-semibold"
              >
                {selectedDisciplines.length === disciplines.length
                  ? 'Desmarcar todas'
                  : 'Selecionar todas'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {disciplines.map((disc) => {
                const isSelected = selectedDisciplines.includes(disc.id);
                return (
                  <button
                    key={disc.id}
                    onClick={() => toggleDiscipline(disc.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-teal-50 border-teal-600 text-teal-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{disc.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Count & Time Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Quantidade de Questões: <strong className="text-teal-700">{questionCount}</strong>
              </label>
              <input
                type="range"
                min={2}
                max={Math.max(5, totalAvailableQuestions)}
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Tempo Limite: <strong className="text-teal-700">{timeLimitMinutes} minutos</strong>
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
          </div>

          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsExamMode(true)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isExamMode
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-bold block mb-0.5">Modo Prova Real</span>
              <p className={`text-[11px] ${isExamMode ? 'text-slate-300' : 'text-slate-500'}`}>
                Gabarito e explicações revelados apenas após envio final.
              </p>
            </button>

            <button
              onClick={() => setIsExamMode(false)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                !isExamMode
                  ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="font-bold block mb-0.5">Modo Estudo Guiado</span>
              <p className={`text-[11px] ${!isExamMode ? 'text-teal-100' : 'text-slate-500'}`}>
                Feedback e comentário de cada alternativa imediatamente ao responder.
              </p>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-semibold text-xs"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <Timer className="w-4 h-4" />
            <span>Iniciar Simulado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
