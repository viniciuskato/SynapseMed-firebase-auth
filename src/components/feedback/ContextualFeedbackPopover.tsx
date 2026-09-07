import React, { useState } from 'react';
import { AlertCircle, X, Send, CheckCircle2 } from 'lucide-react';
import { feedbackRepository } from '../../repositories/FeedbackRepository';
import { useAuth } from '../../contexts/AuthContext';

const TAGS = [
  'Gabarito errado',
  'Explicação confusa',
  'Questão ambígua',
  'Erro de digitação',
  'Imagem não carrega',
  'Outro',
] as const;

interface ContextualFeedbackPopoverProps {
  questionId?: string;
  materialId?: string;
}

// Link discreto "Algo errado aqui?" que abre um popover leve de 1 toque —
// não pode competir visualmente com o fluxo principal (responder/ler),
// por isso fica fora do banner de ação e sem estilo de botão grande.
export const ContextualFeedbackPopover: React.FC<ContextualFeedbackPopoverProps> = ({
  questionId,
  materialId,
}) => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<(typeof TAGS)[number] | null>(null);
  const [freeText, setFreeText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedTag(null);
    setFreeText('');
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!selectedTag) return;
    setIsSubmitting(true);
    try {
      await feedbackRepository.saveFeedback({
        id: crypto.randomUUID(),
        type: 'problema',
        title: selectedTag,
        description: freeText.trim() || selectedTag,
        createdAt: new Date().toISOString(),
        userId: user?.id || null,
        userEmail: user?.email || profile?.email || null,
        questionId: questionId ?? null,
        materialId: materialId ?? null,
        status: 'pendente',
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
      >
        <AlertCircle className="w-3 h-3" />
        <span>Algo errado aqui?</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={handleClose} aria-hidden="true" />
          <div className="absolute z-40 mt-2 right-0 w-72 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-[#243452] elev-lg p-4 text-xs animate-in fade-in">
            {submitted ? (
              <div className="text-center py-2 space-y-2">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="text-slate-600 dark:text-slate-300 font-medium">Obrigado! Relato registrado.</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">O que está errado?</span>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                  {TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(tag)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        selectedTag === tag
                          ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
                          : 'bg-slate-50 dark:bg-[#142038] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#243452] hover:bg-slate-100 dark:hover:bg-[#1A2845]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Detalhes (opcional)"
                  rows={2}
                  maxLength={500}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#243452] bg-slate-50 dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-[11px] resize-none focus:outline-hidden focus:ring-1 focus:ring-teal-500 mb-2.5"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedTag || isSubmitting}
                    className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isSubmitting ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
