import React, { useEffect, useState } from 'react';
import { BookOpen, X, Save, History, RotateCcw } from 'lucide-react';
import { Compendium, CompendiumSection, MaterialSectionVersion } from '../../types';
import { materialsRepository } from '../../repositories/MaterialsRepository';

// Editor dedicado de conteúdo de seção — deliberadamente separado do form
// grande de criação/edição de compêndio (handleSaveCompendium em
// AdminCMSView.tsx), que faz delete-all + insert de seções E referências a
// cada save e perderia source_id/url estruturados de material_references.
// Este componente só faz UPDATE direcionado na seção (ver
// MaterialsRepository.updateSectionContent), registrando cada edição em
// material_section_versions para permitir reverter depois.

interface SectionEditorProps {
  compendium: Compendium;
  onClose: () => void;
  onSaved: () => void;
}

export default function SectionEditor({ compendium, onClose, onSaved }: SectionEditorProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(compendium.sections[0]?.id ?? null);
  const selectedSection = compendium.sections.find((s) => s.id === selectedSectionId) ?? null;

  const [title, setTitle] = useState('');
  const [mechanismTag, setMechanismTag] = useState('');
  const [content, setContent] = useState('');
  const [keyTakeawaysStr, setKeyTakeawaysStr] = useState('');
  const [clinicalPearl, setClinicalPearl] = useState('');
  const [warningAlert, setWarningAlert] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<MaterialSectionVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadSectionIntoForm = (s: CompendiumSection) => {
    setTitle(s.title);
    setMechanismTag(s.mechanismTag || '');
    setContent(s.content);
    setKeyTakeawaysStr(s.keyTakeaways.join('\n'));
    setClinicalPearl(s.clinicalPearl || '');
    setWarningAlert(s.warningAlert || '');
    setShowHistory(false);
  };

  useEffect(() => {
    if (selectedSection) loadSectionIntoForm(selectedSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId]);

  const handleSelectSection = (s: CompendiumSection) => {
    setSelectedSectionId(s.id);
  };

  const handleSave = async () => {
    if (!selectedSection) return;
    setSaving(true);
    try {
      await materialsRepository.updateSectionContent(selectedSection.id, {
        title: title.trim(),
        mechanismTag: mechanismTag.trim() || undefined,
        content,
        keyTakeaways: keyTakeawaysStr
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean),
        clinicalPearl: clinicalPearl.trim() || undefined,
        warningAlert: warningAlert.trim() || undefined,
      });
      showToast('Seção atualizada.');
      onSaved();
      if (showHistory) await handleOpenHistory();
    } catch (err) {
      console.error('[SectionEditor] falha ao salvar seção:', err);
      showToast('Erro ao salvar — veja o console.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!selectedSection) return;
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const v = await materialsRepository.getSectionVersions(selectedSection.id);
      setVersions(v);
    } catch (err) {
      console.error('[SectionEditor] falha ao carregar histórico:', err);
      showToast('Erro ao carregar histórico.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRevert = async (versionId: string) => {
    if (!selectedSection) return;
    if (
      !window.confirm(
        'Reverter esta seção para o estado registrado antes desta versão? A versão atual não é apagada — vira uma nova entrada no histórico.'
      )
    ) {
      return;
    }
    try {
      await materialsRepository.revertSectionToVersion(selectedSection.id, versionId);
      showToast('Seção revertida.');
      onSaved();
      await handleOpenHistory();
    } catch (err) {
      console.error('[SectionEditor] falha ao reverter:', err);
      showToast('Erro ao reverter — veja o console.');
    }
  };

  return (
    <div className="bg-white dark:bg-[#0F172A] rounded-2xl border-2 border-teal-500/50 dark:border-teal-500/60 p-6 sm:p-8 elev-md space-y-6 text-xs animate-in fade-in">
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#243452] pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="font-serif-reading text-lg font-bold text-stone-900 dark:text-slate-100">
            Editar seções — {compendium.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-[#142038] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          {compendium.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                s.id === selectedSectionId
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                  : 'border-stone-200 dark:border-[#243452] hover:bg-stone-100 dark:hover:bg-[#1A2845] text-stone-700 dark:text-slate-300'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-4">
          {!selectedSection ? (
            <p className="text-stone-500 dark:text-slate-400">Este compêndio não tem seções.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-400 font-mono-code">ID: {selectedSection.id}</span>
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-[#243452] hover:bg-stone-100 dark:hover:bg-[#1A2845] text-stone-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1 transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Histórico</span>
                </button>
              </div>

              {showHistory && (
                <div className="rounded-lg border border-stone-200 dark:border-[#243452] p-4 space-y-3 bg-stone-50 dark:bg-[#0B1424]">
                  <h4 className="font-bold text-stone-700 dark:text-slate-300">Histórico de versões</h4>
                  {loadingHistory ? (
                    <p className="text-stone-500 dark:text-slate-400">Carregando…</p>
                  ) : versions.length === 0 ? (
                    <p className="text-stone-500 dark:text-slate-400">Nenhuma edição registrada ainda para esta seção.</p>
                  ) : (
                    <ul className="space-y-2">
                      {versions.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white dark:bg-[#0F172A] border border-stone-200 dark:border-[#243452]"
                        >
                          <div>
                            <div className="font-semibold text-stone-700 dark:text-slate-300">
                              {new Date(v.createdAt).toLocaleString('pt-BR')}
                            </div>
                            <div className="text-stone-500 dark:text-slate-400">
                              Campos alterados: {v.changedFields.join(', ')}
                              {v.reason ? ` · ${v.reason}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevert(v.id)}
                            className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-[#243452] hover:bg-stone-100 dark:hover:bg-[#1A2845] text-stone-700 dark:text-slate-300 font-semibold flex items-center gap-1 transition-colors shrink-0"
                            title="Reverter seção para o estado anterior a esta versão"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>Reverter</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1">Título da seção</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-[#243452] bg-stone-50 dark:bg-[#142038] text-stone-900 dark:text-slate-100 font-semibold text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1">Tag de mecanismo</label>
                <input
                  type="text"
                  value={mechanismTag}
                  onChange={(e) => setMechanismTag(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-[#243452] bg-stone-50 dark:bg-[#142038] text-stone-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1">Conteúdo (markdown)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-[#243452] bg-stone-50 dark:bg-[#142038] text-stone-900 dark:text-slate-100 text-xs font-mono-code"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1">Pontos-chave (um por linha)</label>
                <textarea
                  value={keyTakeawaysStr}
                  onChange={(e) => setKeyTakeawaysStr(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-[#243452] bg-stone-50 dark:bg-[#142038] text-stone-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1">Pérola clínica</label>
                  <textarea
                    value={clinicalPearl}
                    onChange={(e) => setClinicalPearl(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-[#243452] bg-stone-50 dark:bg-[#142038] text-stone-900 dark:text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 dark:text-slate-300 block mb-1">Alerta</label>
                  <textarea
                    value={warningAlert}
                    onChange={(e) => setWarningAlert(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 rounded-lg border border-stone-200 dark:border-[#243452] bg-stone-50 dark:bg-[#142038] text-stone-900 dark:text-slate-100 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Salvando…' : 'Salvar alterações'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-stone-900 dark:bg-teal-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg elev-md z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
