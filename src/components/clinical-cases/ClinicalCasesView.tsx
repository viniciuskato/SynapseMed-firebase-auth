import React, { useState, useMemo } from 'react';
import {
  Stethoscope,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  User,
  Filter,
  Layers,
  Award,
} from 'lucide-react';
import { ClinicalCase, Discipline, Theme } from '../../types';

interface ClinicalCasesViewProps {
  cases: ClinicalCase[];
  disciplines: Discipline[];
  themes: Theme[];
  onOpenCase: (caseId: string) => void;
  onOpenCompendium: (compendiumId: string) => void;
}

export const ClinicalCasesView: React.FC<ClinicalCasesViewProps> = ({
  cases,
  disciplines,
  themes,
  onOpenCase,
  onOpenCompendium,
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (selectedDiscipline !== 'all' && c.disciplineId !== selectedDiscipline) {
        return false;
      }
      if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesChief = c.chiefComplaint.toLowerCase().includes(q);
        const matchesSummary = c.summary.toLowerCase().includes(q);
        return matchesTitle || matchesChief || matchesSummary;
      }
      return true;
    });
  }, [cases, selectedDiscipline, selectedDifficulty, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-sm">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-400/30">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Simulador de Casos Clínicos Interativos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Tomada de Decisão Médica Passo a Passo
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Vivencie o fluxo de atendimento da vida real: anamnese direcionada, exame físico, interpretação de exames complementares e definição da conduta baseada em diretrizes clínicas.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Pesquisar caso por queixa, hipótese..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Discipline Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0 text-xs">
          <button
            onClick={() => setSelectedDiscipline('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all ${
              selectedDiscipline === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas as Disciplinas
          </button>
          {disciplines.map((disc) => (
            <button
              key={disc.id}
              onClick={() => setSelectedDiscipline(disc.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold shrink-0 transition-all ${
                selectedDiscipline === disc.id
                  ? 'bg-purple-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {disc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
          <Stethoscope className="w-8 h-8 mx-auto text-slate-300" />
          <p className="font-semibold text-sm">Nenhum caso clínico encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCases.map((c) => {
            const disc = disciplines.find((d) => d.id === c.disciplineId);
            const th = themes.find((t) => t.id === c.themeId);

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200/60">
                        {disc?.name || 'Clínica Médica'}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {th?.name || 'Tema'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{c.estimatedMinutes} min</span>
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-purple-900 transition-colors">
                    {c.title}
                  </h3>

                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 font-serif-reading italic">
                    <strong>Queixa:</strong> "{c.chiefComplaint}"
                  </div>

                  <p className="text-xs text-slate-600 mt-3 line-clamp-2">
                    {c.summary}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.patientAge} anos, {c.patientGender === 'M' ? 'Masc' : 'Fem'}</span>
                    </span>
                    <span className="font-semibold text-purple-700">
                      {c.steps.length} etapas de decisão
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <button
                    onClick={() => onOpenCompendium(c.compendiumRefId)}
                    className="text-xs text-teal-700 hover:underline font-semibold"
                  >
                    Ver Compêndio
                  </button>

                  <button
                    onClick={() => onOpenCase(c.id)}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Iniciar Atendimento</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
