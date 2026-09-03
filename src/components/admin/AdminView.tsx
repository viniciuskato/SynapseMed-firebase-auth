import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  BookOpen,
  HelpCircle,
  Stethoscope,
  Layers,
  Save,
  Trash2,
  Edit3,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  Compendium,
  Question,
  ClinicalCase,
  Discipline,
  Theme,
  CompendiumSection,
  QuestionOption,
} from '../../types';
import { StorageService } from '../../services/storage';

interface AdminViewProps {
  disciplines: Discipline[];
  themes: Theme[];
  compendiums: Compendium[];
  questions: Question[];
  clinicalCases: ClinicalCase[];
  onRefreshData: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  disciplines,
  themes,
  compendiums,
  questions,
  clinicalCases,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'compendiums' | 'questions' | 'cases' | 'metrics'>('questions');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Question Form State
  const [qDisciplineId, setQDisciplineId] = useState(disciplines[0]?.id || 'cardio');
  const [qThemeId, setQThemeId] = useState(themes[0]?.id || 'cardio-ic');
  const [qStem, setQStem] = useState('');
  const [qVignette, setQVignette] = useState('');
  const [qInstitution, setQInstitution] = useState('ENARE / USP');
  const [qYear, setQYear] = useState(2025);
  const [qDifficulty, setQDifficulty] = useState<'facil' | 'medio' | 'dificil'>('medio');
  const [qHighYield, setQHighYield] = useState('');
  const [qGeneralComm, setQGeneralComm] = useState('');
  const [qCorrectLetter, setQCorrectLetter] = useState<'A' | 'B' | 'C' | 'D'>('A');

  const [optA, setOptA] = useState({ text: '', explanation: '' });
  const [optB, setOptB] = useState({ text: '', explanation: '' });
  const [optC, setOptC] = useState({ text: '', explanation: '' });
  const [optD, setOptD] = useState({ text: '', explanation: '' });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qStem.trim() || !optA.text.trim() || !optB.text.trim()) {
      showToast('Preencha o enunciado e pelo menos as alternativas A e B.');
      return;
    }

    const options: QuestionOption[] = [
      { letter: 'A', text: optA.text, isCorrect: qCorrectLetter === 'A', explanation: optA.explanation },
      { letter: 'B', text: optB.text, isCorrect: qCorrectLetter === 'B', explanation: optB.explanation },
      { letter: 'C', text: optC.text, isCorrect: qCorrectLetter === 'C', explanation: optC.explanation },
      { letter: 'D', text: optD.text, isCorrect: qCorrectLetter === 'D', explanation: optD.explanation },
    ];

    const newQuestion: Question = {
      id: `q-admin-${Date.now()}`,
      disciplineId: qDisciplineId,
      themeId: qThemeId,
      compendiumRefId: 'comp-cardio-1',
      compendiumSectionId: 'sec-cardio-1',
      institution: qInstitution,
      year: qYear,
      difficulty: qDifficulty,
      cycle: 'clinico',
      clinicalVignette: qVignette.trim(),
      questionStem: qStem.trim(),
      options,
      generalCommentary: qGeneralComm.trim() || 'Comentário da equipe pedagógica SynapseMed.',
      highYieldSummary: qHighYield.trim() || 'Pérola clínica para revisão imediata.',
      tags: ['Admin', 'Nova Questão'],
    };

    StorageService.saveQuestion(newQuestion);
    onRefreshData();
    showToast('Nova questão médica cadastrada com sucesso!');

    // Reset fields
    setQStem('');
    setQVignette('');
    setOptA({ text: '', explanation: '' });
    setOptB({ text: '', explanation: '' });
    setOptC({ text: '', explanation: '' });
    setOptD({ text: '', explanation: '' });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-800 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">Painel Administrativo & Curadoria Médica</h1>
            <p className="text-xs text-slate-300">
              Gerenciamento de conteúdo, indexação de mecanismos e criação de questões e casos clínicos.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'questions'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Cadastrar Questão ({questions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('compendiums')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'compendiums'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Compêndios ({compendiums.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'cases'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Casos Clínicos ({clinicalCases.length})</span>
        </button>
      </div>

      {/* Tab 1: Create Question Form */}
      {activeTab === 'questions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />
              <span>Nova Questão com Justificativa por Alternativa</span>
            </h3>

            <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs">
              {/* Discipline & Theme */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Disciplina</label>
                  <select
                    value={qDisciplineId}
                    onChange={(e) => {
                      setQDisciplineId(e.target.value);
                      const firstTheme = themes.find((t) => t.disciplineId === e.target.value);
                      if (firstTheme) setQThemeId(firstTheme.id);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                  >
                    {disciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tema</label>
                  <select
                    value={qThemeId}
                    onChange={(e) => setQThemeId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                  >
                    {themes
                      .filter((t) => t.disciplineId === qDisciplineId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Institution, Year, Difficulty */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Banca / Instituição</label>
                  <input
                    type="text"
                    value={qInstitution}
                    onChange={(e) => setQInstitution(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                    placeholder="Ex: USP / ENARE"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ano</label>
                  <input
                    type="number"
                    value={qYear}
                    onChange={(e) => setQYear(parseInt(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Dificuldade</label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                  >
                    <option value="facil">Fácil</option>
                    <option value="medio">Média</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>
              </div>

              {/* Vignette */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Enunciado Clínico (Caso / Vignette)
                </label>
                <textarea
                  rows={3}
                  value={qVignette}
                  onChange={(e) => setQVignette(e.target.value)}
                  placeholder="Ex: Paciente masculino de 62 anos comparece à UBS com dispneia aos médios esforços..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              {/* Stem */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Pergunta Central (Stem) *</label>
                <input
                  type="text"
                  required
                  value={qStem}
                  onChange={(e) => setQStem(e.target.value)}
                  placeholder="Ex: Qual é a conduta farmacológica inicial mais indicada para reduzir a mortalidade?"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              {/* Alternatives with commentary */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Alternativas e Comentários Pedagógicos:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Gabarito Correto:</span>
                    <select
                      value={qCorrectLetter}
                      onChange={(e) => setQCorrectLetter(e.target.value as any)}
                      className="p-1 rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-900 font-bold"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </div>

                {[
                  { letter: 'A', state: optA, setter: setOptA },
                  { letter: 'B', state: optB, setter: setOptB },
                  { letter: 'C', state: optC, setter: setOptC },
                  { letter: 'D', state: optD, setter: setOptD },
                ].map(({ letter, state, setter }) => (
                  <div
                    key={letter}
                    className={`p-3.5 rounded-2xl border ${
                      qCorrectLetter === letter
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 font-bold">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                          qCorrectLetter === letter
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {letter}
                      </span>
                      <span>Texto da Alternativa {letter} {qCorrectLetter === letter ? '(Correta)' : '(Distrator)'}</span>
                    </div>
                    <input
                      type="text"
                      value={state.text}
                      onChange={(e) => setter({ ...state, text: e.target.value })}
                      placeholder={`Ex: Alternativa ${letter}...`}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white mb-2"
                    />
                    <textarea
                      rows={2}
                      value={state.explanation}
                      onChange={(e) => setter({ ...state, explanation: e.target.value })}
                      placeholder={`Justificativa individual da alternativa ${letter} (por que está certa ou errada)...`}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white text-slate-600"
                    />
                  </div>
                ))}
              </div>

              {/* High yield pearl */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Pérola High-Yield (Fixação Rápida)
                </label>
                <input
                  type="text"
                  value={qHighYield}
                  onChange={(e) => setQHighYield(e.target.value)}
                  placeholder="Ex: No paciente com ICFEr, o quarteto fantástico reduz mortalidade em até 60%."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Publicar Questão no Banco</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick List (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">
                Questões Cadastradas ({questions.length})
              </h4>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-teal-800">{q.institution} ({q.year})</span>
                      <span className="uppercase">{q.difficulty}</span>
                    </div>
                    <p className="font-semibold text-slate-800 line-clamp-2">{q.questionStem}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Compendiums Overview */}
      {activeTab === 'compendiums' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {compendiums.map((comp) => (
            <div key={comp.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800">
                  {comp.disciplineId}
                </span>
                <span className="text-xs text-slate-400">{comp.sections.length} seções</span>
              </div>
              <h3 className="font-bold text-base text-slate-900">{comp.title}</h3>
              <p className="text-xs text-slate-600 line-clamp-2">{comp.subtitle}</p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Autor: {comp.author}</span>
                <span className="text-emerald-700 font-semibold">Ativo na Biblioteca</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Clinical Cases Overview */}
      {activeTab === 'cases' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clinicalCases.map((c) => (
            <div key={c.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800">
                  {c.patientAge}a, {c.patientGender}
                </span>
                <span className="text-xs text-slate-400">{c.steps.length} etapas</span>
              </div>
              <h3 className="font-bold text-base text-slate-900">{c.title}</h3>
              <p className="text-xs text-slate-600 line-clamp-2">{c.summary}</p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Queixa: {c.chiefComplaint}</span>
                <span className="text-purple-700 font-semibold">Interativo</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
