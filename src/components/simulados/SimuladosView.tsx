import React, { useState } from 'react';
import {
  Timer,
  Plus,
  Play,
  CheckCircle2,
  Award,
  Calendar,
  Clock,
  Sparkles,
  RotateCcw,
  Zap,
  Target,
} from 'lucide-react';
import { SimuladoSessionData, Discipline, Theme, SimuladoConfig } from '../../types';
import { StorageService } from '../../services/storage';

interface SimuladosViewProps {
  disciplines: Discipline[];
  themes: Theme[];
  onOpenCreateModal: () => void;
  onStartCustomSimulado: (config: SimuladoConfig) => void;
  onUpdate: () => void;
}

export const SimuladosView: React.FC<SimuladosViewProps> = ({
  disciplines,
  themes,
  onOpenCreateModal,
  onStartCustomSimulado,
  onUpdate,
}) => {
  const history = StorageService.getSimuladoHistory();

  const handleQuickPreset = (type: 'express' | 'enare' | 'mistakes') => {
    let config: SimuladoConfig;

    if (type === 'express') {
      config = {
        id: `sim-quick-${Date.now()}`,
        name: 'Simulado Express Misto',
        disciplineIds: disciplines.map((d) => d.id),
        themeIds: [],
        difficulties: ['facil', 'medio', 'dificil'],
        cycles: ['clinico', 'internato_residencia'],
        onlyMistakes: false,
        questionCount: 5,
        timeLimitMinutes: 10,
        isExamMode: true,
      };
    } else if (type === 'enare') {
      config = {
        id: `sim-enare-${Date.now()}`,
        name: 'Simulado Padrão ENARE / USP',
        disciplineIds: disciplines.slice(0, 3).map((d) => d.id),
        themeIds: [],
        difficulties: ['medio', 'dificil'],
        cycles: ['internato_residencia'],
        onlyMistakes: false,
        questionCount: 8,
        timeLimitMinutes: 16,
        isExamMode: true,
      };
    } else {
      config = {
        id: `sim-errors-${Date.now()}`,
        name: 'Simulado de Correção de Erros',
        disciplineIds: disciplines.map((d) => d.id),
        themeIds: [],
        difficulties: ['facil', 'medio', 'dificil'],
        cycles: ['basico', 'clinico', 'internato_residencia'],
        onlyMistakes: true,
        questionCount: 5,
        timeLimitMinutes: 10,
        isExamMode: false,
      };
    }

    onStartCustomSimulado(config);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <Timer className="w-3.5 h-3.5" />
            <span>Simulador de Provas & Cronometria Real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Simulados Customizados e Treino de Prova
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Configure parâmetros precisos de tempo, banca examinadora, disciplinas e nível de dificuldade para simular a pressão e o tempo de resolução das principais provas de Residência Médica.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-6 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Simulado Personalizado</span>
        </button>
      </div>

      {/* Quick Presets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Preset 1 */}
        <div
          onClick={() => handleQuickPreset('express')}
          className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-teal-50 text-teal-700">
                <Zap className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold text-slate-400">10 minutos</span>
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors text-sm">
              Simulado Express Misto
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              5 questões rápidas de múltiplas especialidades para treinar no intervalo do plantão.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-700">
            <span>Iniciar Agora</span>
            <Play className="w-3.5 h-3.5 fill-teal-700" />
          </div>
        </div>

        {/* Preset 2 */}
        <div
          onClick={() => handleQuickPreset('enare')}
          className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <Target className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold text-slate-400">16 minutos</span>
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors text-sm">
              Padrão R1 / ENARE / USP
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Questões de média e alta complexidade das principais bancas de residência do país.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
            <span>Iniciar Agora</span>
            <Play className="w-3.5 h-3.5 fill-blue-700" />
          </div>
        </div>

        {/* Preset 3 */}
        <div
          onClick={() => handleQuickPreset('mistakes')}
          className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <RotateCcw className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold text-slate-400">Modo Estudo</span>
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-rose-700 transition-colors text-sm">
              Simulado de Erros Recentes
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Foque exclusivamente nos tópicos em que você errou anteriormente para fechar lacunas.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-700">
            <span>Iniciar Agora</span>
            <Play className="w-3.5 h-3.5 fill-rose-700" />
          </div>
        </div>
      </div>

      {/* History of Completed Exams */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">Histórico de Simulados Realizados</h2>
          </div>
          <span className="text-xs text-slate-400">{history.length} provas arquivadas</span>
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs space-y-1">
            <Timer className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">Nenhum simulado finalizado ainda.</p>
            <p>Selecione um preset acima ou configure seu simulado para ver seu histórico de pontuação.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((session) => {
              const totalQ = session.questionIds.length;
              const answeredQ = Object.keys(session.answers).length;
              const score = session.score || 0;
              const minutes = Math.floor(session.totalTimeSeconds / 60);
              const seconds = session.totalTimeSeconds % 60;

              return (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {session.config.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-600">
                        {session.config.isExamMode ? 'Modo Prova' : 'Modo Estudo'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(session.startedAt).toLocaleDateString('pt-BR')}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{minutes}m {seconds}s gastos</span>
                      </span>
                      <span>{totalQ} questões</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Aproveitamento
                      </span>
                      <span
                        className={`text-base font-extrabold ${
                          score >= 70
                            ? 'text-emerald-600'
                            : score >= 50
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {score}%
                      </span>
                    </div>

                    <button
                      onClick={() => onStartCustomSimulado(session.config)}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Refazer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
