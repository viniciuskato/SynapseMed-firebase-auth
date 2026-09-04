import React, { useState } from 'react';
import {
  Database,
  Plus,
  BookOpen,
  HelpCircle,
  Layers,
  Stethoscope,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
  RotateCcw,
  Edit3,
  Search,
  Clock,
  Compass,
  Activity,
  Lightbulb,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Discipline, Theme, Question, Compendium, Flashcard, CompendiumSection } from '../../types';
import { StorageService } from '../../services/storage';
import { flashcardsRepository } from '../../repositories/FlashcardsRepository';
import { materialsRepository } from '../../repositories/MaterialsRepository';
import { questionsRepository } from '../../repositories/QuestionsRepository';

interface AdminCMSViewProps {
  disciplines: Discipline[];
  themes: Theme[];
  questions: Question[];
  compendiums: Compendium[];
  flashcards: Flashcard[];
  onRefreshData: () => void;
}

export const AdminCMSView: React.FC<AdminCMSViewProps> = ({
  disciplines,
  themes,
  questions,
  compendiums,
  flashcards,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'compendiums' | 'questions' | 'flashcards' | 'database'>('compendiums');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Compendium State ───────────────────────────────────────────
  const [isCompendiumFormOpen, setIsCompendiumFormOpen] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compSearch, setCompSearch] = useState('');

  // Compendium Form Fields
  const [compTitle, setCompTitle] = useState('');
  const [compSubtitle, setCompSubtitle] = useState('');
  const [compDisciplineId, setCompDisciplineId] = useState(disciplines[0]?.id || 'cardio');
  const [compThemeId, setCompThemeId] = useState(themes[0]?.id || 'cardio-ic');
  const [compMode, setCompMode] = useState<'atlas' | 'mecanismos'>('mecanismos');
  const [compAuthor, setCompAuthor] = useState('Dr. Roberto Albuquerque / Comitê Editorial');
  const [compEstimatedTime, setCompEstimatedTime] = useState(15);
  const [compTagsStr, setCompTagsStr] = useState('Fisiopatologia, Clínica Médica, Alta Relevância');
  const [compDependenciesStr, setCompDependenciesStr] = useState('Anatomia Básica, Semiologia');
  const [compReferencesStr, setCompReferencesStr] = useState('Diretrizes Brasileiras / Sociedades Médicas de Especialidade');

  const [compSections, setCompSections] = useState<CompendiumSection[]>([
    {
      id: 'sec-1',
      title: '1. Fisiopatologia e Mecanismos Moleculares',
      mechanismTag: 'Fisiopatologia',
      content: 'Descreva detalhadamente a cascata fisiopatológica, receptores envolvidos, alterações hemodinâmicas ou histopatológicas.',
      keyTakeaways: ['Mecanismo primário de ativação', 'Correlação clínica fundamental'],
      clinicalPearl: 'Atenção aos sinais precoces de descompensação no exame físico.',
      warningAlert: 'Evitar terapias contraindicadas na presença de instabilidade hemodinâmica.',
    },
  ]);

  // ── Question Form State ─────────────────────────────────────────
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [newQDiscipline, setNewQDiscipline] = useState(disciplines[0]?.id || '');
  const [newQTheme, setNewQTheme] = useState(themes[0]?.id || '');
  const [newQInstitution, setNewQInstitution] = useState('USP-SP / ENARE');
  const [newQYear, setNewQYear] = useState(2025);
  const [newQDifficulty, setNewQDifficulty] = useState<'facil' | 'medio' | 'dificil'>('medio');
  const [newQStem, setNewQStem] = useState('');
  const [newQVignette, setNewQVignette] = useState('');
  const [newQHighYield, setNewQHighYield] = useState('');
  const [optA, setOptA] = useState({ text: '', isCorrect: true, exp: '' });
  const [optB, setOptB] = useState({ text: '', isCorrect: false, exp: '' });
  const [optC, setOptC] = useState({ text: '', isCorrect: false, exp: '' });
  const [optD, setOptD] = useState({ text: '', isCorrect: false, exp: '' });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Compendium Form Handlers ────────────────────────────────────
  const handleOpenNewCompendium = () => {
    setEditingCompId(null);
    setCompTitle('');
    setCompSubtitle('');
    setCompDisciplineId(disciplines[0]?.id || 'cardio');
    setCompThemeId(themes[0]?.id || 'cardio-ic');
    setCompMode('mecanismos');
    setCompAuthor('Equipe Editorial SynapseMed');
    setCompEstimatedTime(15);
    setCompTagsStr('Fisiopatologia, Alta Relevância');
    setCompDependenciesStr('Bases Fisiológicas');
    setCompReferencesStr('Diretriz Oficial de Especialidade (2024)');
    setCompSections([
      {
        id: `sec-${Date.now()}-1`,
        title: '1. Fisiopatologia e Mecanismos Moleculares',
        mechanismTag: 'Fisiopatologia',
        content: 'Descreva a cascata fisiopatológica, receptores envolvidos e desdobramentos hemodinâmicos.',
        keyTakeaways: ['Ponto de ancoragem fisiopatológico principal'],
        clinicalPearl: 'Pérola de aplicação imediata no pronto-atendimento.',
        warningAlert: 'Erro clássico de diagnóstico diferencial.',
      },
    ]);
    setIsCompendiumFormOpen(true);
  };

  const handleEditCompendium = (comp: Compendium) => {
    setEditingCompId(comp.id);
    setCompTitle(comp.title);
    setCompSubtitle(comp.subtitle);
    setCompDisciplineId(comp.disciplineId);
    setCompThemeId(comp.themeId);
    setCompMode(comp.mode || 'mecanismos');
    setCompAuthor(comp.author);
    setCompEstimatedTime(comp.estimatedReadTimeMinutes);
    setCompTagsStr(comp.tags?.join(', ') || '');
    setCompDependenciesStr(comp.dependencies?.map((d) => d.title).join(', ') || '');
    setCompReferencesStr(comp.references.join('\n'));
    setCompSections(
      comp.sections.map((s, idx) => ({
        ...s,
        id: s.id || `sec-${Date.now()}-${idx}`,
      }))
    );
    setIsCompendiumFormOpen(true);
  };

  const handleAddSection = () => {
    const nextIdx = compSections.length + 1;
    setCompSections([
      ...compSections,
      {
        id: `sec-${Date.now()}-${nextIdx}`,
        title: `${nextIdx}. Nova Seção Teórica`,
        mechanismTag: 'Mecanismo Clínico',
        content: 'Insira aqui a explicação médica detalhada ou tabela de conduta...',
        keyTakeaways: ['Conceito de alta retenção'],
        clinicalPearl: '',
        warningAlert: '',
      },
    ]);
  };

  const handleRemoveSection = (idxToRemove: number) => {
    if (compSections.length <= 1) {
      showToast('O compêndio deve possuir ao menos uma seção.');
      return;
    }
    setCompSections(compSections.filter((_, idx) => idx !== idxToRemove));
  };

  const handleUpdateSection = (idx: number, field: keyof CompendiumSection, value: any) => {
    const updated = [...compSections];
    updated[idx] = { ...updated[idx], [field]: value };
    setCompSections(updated);
  };

  const handleAddTakeaway = (secIdx: number) => {
    const updated = [...compSections];
    updated[secIdx].keyTakeaways.push('Novo ponto-chave essencial');
    setCompSections(updated);
  };

  const handleUpdateTakeaway = (secIdx: number, takeIdx: number, val: string) => {
    const updated = [...compSections];
    updated[secIdx].keyTakeaways[takeIdx] = val;
    setCompSections(updated);
  };

  const handleRemoveTakeaway = (secIdx: number, takeIdx: number) => {
    const updated = [...compSections];
    updated[secIdx].keyTakeaways = updated[secIdx].keyTakeaways.filter((_, i) => i !== takeIdx);
    setCompSections(updated);
  };

  const handleSaveCompendium = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compTitle.trim()) {
      showToast('Por favor, informe o título do compêndio.');
      return;
    }

    const tags = compTagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const dependencies = compDependenciesStr
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((title) => ({ title }));

    const references = compReferencesStr
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean);

    const compId = editingCompId || `comp-${Date.now()}`;

    const newComp: Compendium = {
      id: compId,
      disciplineId: compDisciplineId,
      themeId: compThemeId || 'geral',
      title: compTitle.trim(),
      subtitle: compSubtitle.trim(),
      estimatedReadTimeMinutes: Number(compEstimatedTime) || 15,
      lastUpdated: new Date().toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      author: compAuthor.trim() || 'Equipe Editorial',
      mode: compMode,
      tags: tags.length > 0 ? tags : ['Geral', 'Medicina'],
      dependencies: dependencies.length > 0 ? dependencies : undefined,
      sections: compSections,
      references: references.length > 0 ? references : ['Diretrizes Médicas de Referência'],
    };

    materialsRepository.saveCompendium(newComp);
    setIsCompendiumFormOpen(false);
    setEditingCompId(null);
    onRefreshData();
    showToast(editingCompId ? 'Compêndio atualizado com sucesso!' : 'Novo compêndio incluído e indexado com sucesso!');
  };

  const handleDeleteCompendium = (id: string, title: string) => {
    if (window.confirm(`Tem certeza de que deseja excluir o compêndio "${title}"? Esta ação não pode ser desfeita.`)) {
      materialsRepository.deleteCompendium(id);
      onRefreshData();
      showToast('Compêndio excluído.');
    }
  };

  // ── Question Form Handlers ──────────────────────────────────────
  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQStem.trim()) return;

    const matchedComp = compendiums.find((c) => c.disciplineId === newQDiscipline);

    const question: Question = {
      id: `q-custom-${Date.now()}`,
      disciplineId: newQDiscipline,
      themeId: newQTheme || themes.find((t) => t.disciplineId === newQDiscipline)?.id || 'cardio-fa',
      compendiumRefId: matchedComp?.id || 'comp-cardio-fa',
      cycle: 'internato_residencia',
      difficulty: newQDifficulty,
      institution: newQInstitution,
      year: Number(newQYear),
      clinicalVignette: newQVignette.trim(),
      questionStem: newQStem.trim(),
      options: [
        { letter: 'A', text: optA.text, isCorrect: optA.isCorrect, explanation: optA.exp },
        { letter: 'B', text: optB.text, isCorrect: optB.isCorrect, explanation: optB.exp },
        { letter: 'C', text: optC.text, isCorrect: optC.isCorrect, explanation: optC.exp },
        { letter: 'D', text: optD.text, isCorrect: optD.isCorrect, explanation: optD.exp },
      ],
      generalCommentary: 'Comentário cadastrado via Painel Administrativo.',
      highYieldSummary: newQHighYield.trim() || 'Conceito chave adicionado pelo autor.',
      tags: ['Admin', 'CMS', 'Custom'],
    };

    questionsRepository.saveCustomQuestion(question);
    setIsCreatingQuestion(false);
    onRefreshData();
    showToast('Questão cadastrada com sucesso e indexada no banco!');
  };

  const handleDeleteQuestion = (id: string) => {
    if (window.confirm('Excluir esta questão permanentemente?')) {
      questionsRepository.deleteQuestion(id);
      onRefreshData();
      showToast('Questão removida.');
    }
  };

  const handleResetData = () => {
    if (window.confirm('Tem certeza de que deseja restaurar a base de dados original? Suas respostas e compêndios customizados serão reiniciados.')) {
      StorageService.resetToDefaults();
      onRefreshData();
      showToast('Base de dados restaurada para os padrões!');
    }
  };

  // Filtered compendiums
  const filteredCompendiums = compendiums.filter((c) => {
    if (!compSearch.trim()) return true;
    const q = compSearch.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1919] text-[#e2ddd6] px-4 py-3 rounded-xl shadow-2xl border border-[#333131] text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <Sparkles className="w-4 h-4 text-[#d4924a] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Page Banner / Header ───────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a1919] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-[#2a1810] text-amber-900 dark:text-[#d4924a] text-xs font-bold border border-amber-200 dark:border-[#d4924a]/40 font-mono-code">
            <Database className="w-3.5 h-3.5" />
            <span>Painel Curatorial & CMS Editorial</span>
          </div>
          <h1 className="font-serif-reading text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-[#e2ddd6]">
            Gestão de Conteúdo Médico
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm">
            Crie e gerencie compêndios de área, mecanismos fisiopatológicos, questões comentadas e flashcards com repetição espaçada.
          </p>
        </div>

        <button
          onClick={handleResetData}
          className="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-50 hover:dark:bg-rose-950/40 text-stone-700 dark:text-stone-300 hover:text-rose-700 dark:hover:text-rose-300 border border-stone-200 dark:border-stone-700 text-xs font-semibold transition-colors flex items-center gap-2 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar Base Padrão</span>
        </button>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3 text-xs font-bold overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('compendiums')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'compendiums'
              ? 'bg-amber-900 text-white dark:bg-[#d4924a] dark:text-[#111010] shadow-xs font-bold'
              : 'bg-stone-100 dark:bg-[#1a1919] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Compêndios & Mecanismos ({compendiums.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'questions'
              ? 'bg-amber-900 text-white dark:bg-[#d4924a] dark:text-[#111010] shadow-xs font-bold'
              : 'bg-stone-100 dark:bg-[#1a1919] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Questões Comentadas ({questions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('flashcards')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'flashcards'
              ? 'bg-amber-900 text-white dark:bg-[#d4924a] dark:text-[#111010] shadow-xs font-bold'
              : 'bg-stone-100 dark:bg-[#1a1919] text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Flashcards SRS ({flashcards.length})</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── TAB: COMPENDIUMS & MECANISMOS ─────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'compendiums' && (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#1a1919] p-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={compSearch}
                onChange={(e) => setCompSearch(e.target.value)}
                placeholder="Buscar por título, subtítulo ou tag..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              onClick={handleOpenNewCompendium}
              className="px-4 py-2 rounded-lg bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Compêndio / Mecanismo</span>
            </button>
          </div>

          {/* ── Compendium Creation/Edit Modal/Drawer Form ─────────── */}
          {isCompendiumFormOpen && (
            <form
              onSubmit={handleSaveCompendium}
              className="bg-white dark:bg-[#1a1919] rounded-2xl border-2 border-amber-500/50 dark:border-[#d4924a]/60 p-6 sm:p-8 shadow-md space-y-6 text-xs animate-in fade-in"
            >
              {/* Form Title */}
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#d4924a]" />
                  <h3 className="font-serif-reading text-lg font-bold text-stone-900 dark:text-[#e2ddd6]">
                    {editingCompId ? 'Editar Compêndio' : 'Incluir Novo Compêndio ou Mecanismo'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCompendiumFormOpen(false);
                    setEditingCompId(null);
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#222121]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* General Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Título Principal do Compêndio *
                  </label>
                  <input
                    type="text"
                    required
                    value={compTitle}
                    onChange={(e) => setCompTitle(e.target.value)}
                    placeholder="Ex: Fibrilação Atrial: Manejo Agudo, Controle de Ritmo e Anticoagulação"
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] font-semibold text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Modalidade / Categoria
                  </label>
                  <select
                    value={compMode}
                    onChange={(e) => setCompMode(e.target.value as 'atlas' | 'mecanismos')}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] font-semibold text-xs"
                  >
                    <option value="mecanismos">Mecanismo Fisiopatológico (Fisio/Farmaco)</option>
                    <option value="atlas">Compêndio de Área (Atlas / Panorama)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Subtítulo / Descrição Sintética *
                </label>
                <input
                  type="text"
                  required
                  value={compSubtitle}
                  onChange={(e) => setCompSubtitle(e.target.value)}
                  placeholder="Ex: Abordagem fisiopatológica do remodelamento atrial, escores CHA2DS2-VASc e condutas baseadas em diretrizes."
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Disciplina
                  </label>
                  <select
                    value={compDisciplineId}
                    onChange={(e) => setCompDisciplineId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                  >
                    {disciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Tema Vinculado
                  </label>
                  <select
                    value={compThemeId}
                    onChange={(e) => setCompThemeId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                  >
                    {themes
                      .filter((t) => !compDisciplineId || t.disciplineId === compDisciplineId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    <option value="custom-geral">Geral / Teoria Integrada</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Autor / Curador
                  </label>
                  <input
                    type="text"
                    value={compAuthor}
                    onChange={(e) => setCompAuthor(e.target.value)}
                    placeholder="Ex: Dr. Roberto Albuquerque"
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Tempo Est. (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={compEstimatedTime}
                    onChange={(e) => setCompEstimatedTime(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Tags Clínicas (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={compTagsStr}
                    onChange={(e) => setCompTagsStr(e.target.value)}
                    placeholder="Ex: Cardiologia, Eletrofisiologia, Anticoagulação, Emergência"
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Nós de Conexão / Pré-requisitos (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    value={compDependenciesStr}
                    onChange={(e) => setCompDependenciesStr(e.target.value)}
                    placeholder="Ex: Potencial de Ação Cardíaco, Anatomia dos Átrios"
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                  />
                </div>
              </div>

              {/* ── SECTIONS BUILDER ───────────────────────────────────── */}
              <div className="space-y-4 pt-4 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-stone-900 dark:text-[#e2ddd6] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#d4924a]" />
                      <span>Seções Teóricas Estruturadas ({compSections.length})</span>
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Adicione módulos explicativos, tabelas markdown, pontos-chave e alertas clínicos.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#d4924a]" />
                    <span>Adicionar Seção</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {compSections.map((sec, secIdx) => (
                    <div
                      key={sec.id || secIdx}
                      className="p-4 sm:p-5 rounded-xl bg-stone-50 dark:bg-[#222121] border border-stone-200 dark:border-stone-800 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-700/60 pb-2">
                        <span className="font-mono-code text-[11px] font-bold text-amber-900 dark:text-[#d4924a]">
                          Seção {secIdx + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(secIdx)}
                            className="text-stone-400 hover:text-rose-600 transition-colors p-1"
                            title="Remover Seção"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                            Título da Seção
                          </label>
                          <input
                            type="text"
                            required
                            value={sec.title}
                            onChange={(e) => handleUpdateSection(secIdx, 'title', e.target.value)}
                            placeholder="Ex: 1. Fisiopatologia e Remodelamento Eletroanatômico"
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                            Tag de Mecanismo / Âncora
                          </label>
                          <input
                            type="text"
                            value={sec.mechanismTag || ''}
                            onChange={(e) => handleUpdateSection(secIdx, 'mechanismTag', e.target.value)}
                            placeholder="Ex: Fisiopatologia, Farmacodinâmica, Conduta"
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                          Conteúdo Teórico (Markdown / Texto / Tabelas)
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={sec.content}
                          onChange={(e) => handleUpdateSection(secIdx, 'content', e.target.value)}
                          placeholder="Digite os conceitos. Para tabelas, utilize o formato | Coluna 1 | Coluna 2 |"
                          className="w-full p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] font-mono-code text-xs leading-relaxed"
                        />
                      </div>

                      {/* Key Takeaways Builder */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-stone-700 dark:text-stone-300 block">
                            Pontos-Chave & Mecanismos Essenciais
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAddTakeaway(secIdx)}
                            className="text-[11px] text-[#d4924a] hover:underline font-semibold"
                          >
                            + Ponto-chave
                          </button>
                        </div>
                        {sec.keyTakeaways.map((takeaway, tIdx) => (
                          <div key={tIdx} className="flex items-center gap-2">
                            <span className="text-[#d4924a] font-bold">•</span>
                            <input
                              type="text"
                              value={takeaway}
                              onChange={(e) => handleUpdateTakeaway(secIdx, tIdx, e.target.value)}
                              placeholder="Conceito chave para fixação"
                              className="flex-1 p-1.5 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] text-xs"
                            />
                            {sec.keyTakeaways.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTakeaway(secIdx, tIdx)}
                                className="text-stone-400 hover:text-rose-500 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1 mb-1">
                            <Lightbulb className="w-3.5 h-3.5 text-[#d4924a]" />
                            <span>Pérola Clínica & Aplicação (Opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={sec.clinicalPearl || ''}
                            onChange={(e) => handleUpdateSection(secIdx, 'clinicalPearl', e.target.value)}
                            placeholder="Dica rápida de conduta ou diagnóstico"
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Alerta de Armadilha / Erro Comum (Opcional)</span>
                          </label>
                          <input
                            type="text"
                            value={sec.warningAlert || ''}
                            onChange={(e) => handleUpdateSection(secIdx, 'warningAlert', e.target.value)}
                            placeholder="Contraindicação ou pegadinha clássica"
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6] text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* References */}
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Referências Bibliográficas & Diretrizes Oficiais (uma por linha)
                </label>
                <textarea
                  rows={2}
                  value={compReferencesStr}
                  onChange={(e) => setCompReferencesStr(e.target.value)}
                  placeholder="Ex: Diretriz de Fibrilação Atrial da Sociedade Brasileira de Cardiologia (2024)"
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6] text-xs"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCompendiumFormOpen(false);
                    setEditingCompId(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] font-bold shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingCompId ? 'Atualizar Compêndio' : 'Publicar Compêndio'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ── Compendiums List Grid ────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCompendiums.map((c) => {
              const isAtlas = c.mode !== 'mecanismos';
              const disc = disciplines.find((d) => d.id === c.disciplineId);

              return (
                <div
                  key={c.id}
                  className={`bg-white dark:bg-[#1a1919] rounded-xl border border-stone-200 dark:border-stone-800 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-amber-400 dark:hover:border-[#d4924a] transition-all ${
                    isAtlas ? 'border-l-4 border-l-[#5b8dd9]' : 'border-l-4 border-l-[#c0604a]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isAtlas ? 'badge-atlas' : 'badge-mec'
                          }`}
                        >
                          {isAtlas ? 'Compêndio de Área' : 'Mecanismo Fisiopatológico'}
                        </span>
                        <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                          {disc?.name || c.disciplineId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-stone-400 font-mono-code">
                        <Clock className="w-3 h-3" />
                        <span>{c.estimatedReadTimeMinutes} min</span>
                      </div>
                    </div>

                    <h4 className="font-serif-reading text-base font-bold text-stone-900 dark:text-[#e2ddd6] leading-snug">
                      {c.title}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                      {c.subtitle}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 pt-1">
                      <span>{c.sections.length} {c.sections.length === 1 ? 'seção' : 'seções'} estruturadas</span>
                      <span>·</span>
                      <span>Autor: {c.author}</span>
                    </div>

                    {c.tags && c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] px-2 py-0.5 rounded bg-stone-100 dark:bg-[#222121] text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 font-mono-code">ID: {c.id}</span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditCompendium(c)}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs flex items-center gap-1 transition-colors"
                        title="Editar compêndio"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#d4924a]" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCompendium(c.id, c.title)}
                        className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-rose-50 hover:dark:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition-colors"
                        title="Excluir compêndio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── TAB: QUESTIONS MANAGEMENT ─────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-[#1a1919] p-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs">
            <div>
              <h3 className="font-serif-reading text-base font-bold text-stone-900 dark:text-[#e2ddd6]">
                Banco de Questões Cadastradas
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {questions.length} questões com explicações por alternativa vinculadas aos compêndios
              </p>
            </div>

            <button
              onClick={() => setIsCreatingQuestion(!isCreatingQuestion)}
              className="px-4 py-2 bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingQuestion ? 'Fechar Formulário' : 'Nova Questão'}</span>
            </button>
          </div>

          {/* Creation Form */}
          {isCreatingQuestion && (
            <form
              onSubmit={handleSaveQuestion}
              className="bg-white dark:bg-[#1a1919] rounded-2xl border-2 border-amber-500/50 dark:border-[#d4924a]/60 p-6 shadow-sm space-y-4 text-xs animate-in fade-in"
            >
              <h4 className="font-serif-reading font-bold text-sm text-stone-900 dark:text-[#e2ddd6] pb-2 border-b border-stone-200 dark:border-stone-800">
                Cadastrar Questão com Explicação por Alternativa
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Disciplina</label>
                  <select
                    value={newQDiscipline}
                    onChange={(e) => setNewQDiscipline(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6]"
                  >
                    {disciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Instituição / Banca</label>
                  <input
                    type="text"
                    required
                    value={newQInstitution}
                    onChange={(e) => setNewQInstitution(e.target.value)}
                    placeholder="Ex: USP, ENARE, UNICAMP"
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">Ano</label>
                  <input
                    type="number"
                    required
                    value={newQYear}
                    onChange={(e) => setNewQYear(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Enunciado Clínico (Caso / Vinheta)
                </label>
                <textarea
                  rows={2}
                  value={newQVignette}
                  onChange={(e) => setNewQVignette(e.target.value)}
                  placeholder="Ex: Paciente de 68 anos dá entrada no pronto-socorro com palpitações taquicárdicas..."
                  className="w-full p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6]"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Comando da Questão (Pergunta)
                </label>
                <input
                  type="text"
                  required
                  value={newQStem}
                  onChange={(e) => setNewQStem(e.target.value)}
                  placeholder="Ex: Qual é a conduta farmacológica imediata mais indicada?"
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6]"
                />
              </div>

              {/* Alternatives */}
              <div className="space-y-3 pt-2">
                <span className="font-bold text-stone-800 dark:text-stone-200 block">
                  Alternativas e Explicações Individuais:
                </span>

                {[
                  { letter: 'A', state: optA, set: setOptA },
                  { letter: 'B', state: optB, set: setOptB },
                  { letter: 'C', state: optC, set: setOptC },
                  { letter: 'D', state: optD, set: setOptD },
                ].map((item) => (
                  <div
                    key={item.letter}
                    className="p-3 bg-stone-50 dark:bg-[#222121] rounded-xl border border-stone-200 dark:border-stone-700 space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-stone-700 dark:text-stone-300 font-mono-code">
                        {item.letter})
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Texto da alternativa ${item.letter}`}
                        value={item.state.text}
                        onChange={(e) => item.set({ ...item.state, text: e.target.value })}
                        className="flex-1 p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6]"
                      />
                      <label className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                        <input
                          type="radio"
                          name="correctOpt"
                          checked={item.state.isCorrect}
                          onChange={() => {
                            setOptA({ ...optA, isCorrect: item.letter === 'A' });
                            setOptB({ ...optB, isCorrect: item.letter === 'B' });
                            setOptC({ ...optC, isCorrect: item.letter === 'C' });
                            setOptD({ ...optD, isCorrect: item.letter === 'D' });
                          }}
                        />
                        <span>Gabarito</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder={`Explicação comentada da alternativa ${item.letter}`}
                      value={item.state.exp}
                      onChange={(e) => item.set({ ...item.state, exp: e.target.value })}
                      className="w-full p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1919] text-stone-900 dark:text-[#e2ddd6]"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Pérola High-Yield (Resumo para fixação rápida)
                </label>
                <input
                  type="text"
                  value={newQHighYield}
                  onChange={(e) => setNewQHighYield(e.target.value)}
                  placeholder="Ex: Em pacientes instáveis, a conduta é cardioversão elétrica imediata sincronizada."
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#222121] text-stone-900 dark:text-[#e2ddd6]"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingQuestion(false)}
                  className="px-4 py-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-amber-900 hover:bg-amber-800 text-white dark:bg-[#d4924a] dark:text-[#111010] dark:hover:bg-[#e5a45f] font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Publicar Questão</span>
                </button>
              </div>
            </form>
          )}

          {/* List of existing questions */}
          <div className="bg-white dark:bg-[#1a1919] rounded-xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden shadow-xs">
            {questions.map((q) => (
              <div key={q.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 dark:text-[#e2ddd6]">
                      {q.institution} ({q.year})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-semibold">
                      {q.difficulty}
                    </span>
                  </div>
                  <p className="text-stone-600 dark:text-stone-400 font-medium line-clamp-1">{q.questionStem}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-stone-400 text-[11px]">{q.options.length} alternativas</span>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 transition-colors"
                    title="Excluir questão"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── TAB: FLASHCARDS SRS ───────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'flashcards' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1a1919] p-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-serif-reading text-base font-bold text-stone-900 dark:text-[#e2ddd6]">
                Flashcards SRS no Sistema
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Cartões indexados para repetição espaçada SM-2 vinculados à base conceitual
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a1919] rounded-xl border border-stone-200 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden shadow-xs">
            {flashcards.map((fc) => (
              <div key={fc.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-stone-900 dark:text-[#e2ddd6]">{fc.front}</span>
                  <p className="text-stone-500 dark:text-stone-400 line-clamp-1">{fc.back}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-[#2a1810] text-amber-900 dark:text-[#d4924a] font-bold border border-amber-200 dark:border-[#d4924a]/40">
                    Repetições: {fc.srs.repetitionCount}
                  </span>
                  <button
                    onClick={() => {
                      flashcardsRepository.deleteFlashcard(fc.id);
                      onRefreshData();
                      showToast('Flashcard removido.');
                    }}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 transition-colors"
                    title="Excluir flashcard"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
