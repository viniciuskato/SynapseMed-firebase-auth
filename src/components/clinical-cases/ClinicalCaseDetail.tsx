import React, { useState } from 'react';
import {
  ArrowLeft,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Sparkles,
  Layers,
  Award,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ClinicalCase, Discipline, Theme } from '../../types';
import { StorageService } from '../../services/storage';

interface ClinicalCaseDetailProps {
  clinicalCase: ClinicalCase;
  disciplines: Discipline[];
  themes: Theme[];
  onBack: () => void;
  onOpenCompendium: (compendiumId: string) => void;
}

export const ClinicalCaseDetail: React.FC<ClinicalCaseDetailProps> = ({
  clinicalCase,
  disciplines,
  themes,
  onBack,
  onOpenCompendium,
}) => {
  const discipline = disciplines.find((d) => d.id === clinicalCase.disciplineId);
  const theme = themes.find((t) => t.id === clinicalCase.themeId);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [stepConfirmed, setStepConfirmed] = useState<Record<string, boolean>>({});
  const [totalScore, setTotalScore] = useState(0);

  const currentStep = clinicalCase.steps[currentStepIdx];
  const isLastStep = currentStepIdx === clinicalCase.steps.length - 1;
  const isCaseCompleted = stepConfirmed[clinicalCase.steps[clinicalCase.steps.length - 1]?.id];

  const handleSelectOption = (stepId: string, optionId: string) => {
    if (stepConfirmed[stepId]) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [stepId]: optionId,
    }));
  };

  const handleConfirmStep = (stepId: string) => {
    const selectedOptId = selectedAnswers[stepId];
    if (!selectedOptId) return;

    const opt = currentStep.question.options.find((o) => o.id === selectedOptId);
    if (opt) {
      setTotalScore((prev) => prev + opt.score);
    }

    setStepConfirmed((prev) => ({
      ...prev,
      [stepId]: true,
    }));

    if (isLastStep) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    }
  };

  const handleNextStep = () => {
    if (currentStepIdx < clinicalCase.steps.length - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Session Bar */}
      <div className="sticky top-[61px] z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3 -mx-4 lg:-mx-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
              title="Voltar aos Casos"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {discipline?.name || 'Clínica Médica'}
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                {clinicalCase.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Progresso</span>
              <span className="text-xs font-bold text-purple-900">
                Etapa {currentStepIdx + 1} de {clinicalCase.steps.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Patient Summary Card */}
        <div className="bg-gradient-to-br from-purple-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-xs text-purple-200 mb-3">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 font-semibold">
              Paciente: {clinicalCase.patientAge} anos, {clinicalCase.patientGender === 'M' ? 'Masculino' : 'Feminino'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 font-semibold">
              Dificuldade: {clinicalCase.difficulty}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/10 font-semibold">
              ~{clinicalCase.estimatedMinutes} min
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {clinicalCase.title}
          </h1>

          <div className="mt-4 p-3.5 rounded-2xl bg-white/10 border border-white/15 text-xs sm:text-sm text-purple-100 font-serif-reading italic">
            Queixa Principal: {clinicalCase.chiefComplaint}
          </div>
        </div>

        {/* Step Progression Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {clinicalCase.steps.map((step, idx) => {
            const isCompleted = stepConfirmed[step.id];
            const isCurrent = currentStepIdx === idx;

            return (
              <button
                key={step.id}
                onClick={() => isCompleted && setCurrentStepIdx(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 ${
                  isCurrent
                    ? 'bg-purple-700 text-white shadow-sm'
                    : isCompleted
                    ? 'bg-purple-50 text-purple-900 border border-purple-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{idx + 1}. {step.stageTitle.split(':')[0]}</span>
                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
            );
          })}
        </div>

        {/* Active Step Content */}
        {currentStep && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Stethoscope className="w-5 h-5 text-purple-600" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {currentStep.stageTitle}
              </h3>
            </div>

            {/* Clinical Data Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-serif-reading text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line">
              {currentStep.clinicalData}
            </div>

            {/* Vitals & Labs (if available) */}
            {currentStep.vitalsAndLabs && (
              <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-950 block mb-2">
                  Dados Vitais e Achados da Ausculta:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(currentStep.vitalsAndLabs).map(([k, v]) => (
                    <div key={k} className="p-2 bg-white rounded-xl border border-purple-100">
                      <span className="text-[10px] text-slate-500 block">{k}</span>
                      <span className="font-bold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Decision Question */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="font-bold text-sm sm:text-base text-slate-900">
                {currentStep.question.prompt}
              </h4>

              <div className="space-y-3">
                {currentStep.question.options.map((opt) => {
                  const isSelected = selectedAnswers[currentStep.id] === opt.id;
                  const isConfirmed = stepConfirmed[currentStep.id];

                  let optClass = 'bg-white border-slate-200 hover:border-purple-300';
                  if (isSelected && !isConfirmed) {
                    optClass = 'bg-purple-50 border-purple-600 ring-2 ring-purple-600/20';
                  } else if (isConfirmed) {
                    if (opt.isBestChoice) {
                      optClass = 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-300';
                    } else if (isSelected && !opt.isBestChoice) {
                      optClass = 'bg-rose-50 border-rose-400 ring-1 ring-rose-200';
                    }
                  }

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectOption(currentStep.id, opt.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${optClass}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs sm:text-sm text-slate-800 font-medium">
                          {opt.text}
                        </span>
                        {isConfirmed && opt.isBestChoice && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                        {isConfirmed && isSelected && !opt.isBestChoice && (
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                      </div>

                      {/* Clinical Feedback when confirmed */}
                      {isConfirmed && isSelected && (
                        <div
                          className={`mt-3 pt-3 border-t text-xs leading-relaxed ${
                            opt.isBestChoice
                              ? 'border-emerald-200 text-emerald-950 font-medium'
                              : 'border-rose-200 text-rose-950'
                          }`}
                        >
                          <span className="font-bold block mb-0.5">Raciocínio Clínico:</span>
                          {opt.clinicalFeedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Confirm Step Button or Next Step */}
              <div className="flex items-center justify-between pt-4">
                {!stepConfirmed[currentStep.id] ? (
                  <button
                    onClick={() => handleConfirmStep(currentStep.id)}
                    disabled={!selectedAnswers[currentStep.id]}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      selectedAnswers[currentStep.id]
                        ? 'bg-purple-700 hover:bg-purple-800 text-white'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Confirmar Decisão Clínica
                  </button>
                ) : !isLastStep ? (
                  <button
                    onClick={handleNextStep}
                    className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <span>Avançar para Próxima Etapa</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Caso Clínico Concluído com Sucesso!
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Final Discussion & Connected Compendium (When all steps finished) */}
        {isCaseCompleted && (
          <div className="bg-white rounded-3xl border border-purple-200 p-6 sm:p-8 shadow-md space-y-6 animate-in fade-in">
            <div className="flex items-center gap-2 text-purple-900 font-bold text-base">
              <Award className="w-5 h-5 text-purple-600" />
              <span>Discussão Clínica Geral & Desfecho</span>
            </div>

            <div className="prose text-slate-700 font-serif-reading text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              {clinicalCase.finalDiscussion}
            </div>

            {/* Takeaways */}
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
              <span className="text-xs font-bold text-purple-950 uppercase tracking-wider block mb-2">
                Conclusões para a Prática Médica:
              </span>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                {clinicalCase.clinicalTakeaways.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Connect to Compendium Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Aprofunde os mecanismos fisiopatológicos deste caso no compêndio oficial.
              </p>
              <button
                onClick={() => onOpenCompendium(clinicalCase.compendiumRefId)}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Ler Compêndio Completo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
