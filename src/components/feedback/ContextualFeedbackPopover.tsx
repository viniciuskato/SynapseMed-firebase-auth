import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect, useCallback } from 'react';
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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedTag(null);
    setFreeText('');
    setSubmitted(false);
  }, []);

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

  // Diálogo modal: foco inicial no primeiro controle, Tab/Shift+Tab presos
  // dentro do diálogo, Escape fecha, e o foco volta ao gatilho ao fechar
  // (clique fora, X, Escape ou envio) — vale tanto no leitor de compêndio
  // quanto no cartão de questão, os dois usos deste componente.
  useEffect(() => {
    if (!isOpen) return;

    const appRoot = document.getElementById('root');
    const wasInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = (): HTMLElement[] => {
      if (!dialogRef.current) return [];
      return Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    };

    const focusFirst = () => {
      const items = getFocusable();
      (items[0] ?? dialogRef.current)?.focus();
    };
    // Aguarda o próximo frame para garantir que o diálogo já está no DOM.
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first: HTMLElement = items[0];
        const last: HTMLElement = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (appRoot) appRoot.inert = wasInert;
      document.body.style.overflow = oldOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen, submitted, handleClose]);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 py-3.5 px-2.5 -my-3.5 -mx-2.5 transition-colors cursor-pointer"
      >
        <AlertCircle className="w-3 h-3" />
        <span>Algo errado aqui?</span>
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/20" onClick={handleClose} aria-hidden="true" />
          {/* Modal centralizado na viewport, fora de qualquer containing block
              criado por backdrop-filter nos pais. */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={submitted ? 'Relato enviado' : 'Relatar problema com este conteúdo'}
            tabIndex={-1}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[min(20rem,calc(100vw-2rem))] sm:w-72 bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-[#243452] elev-lg p-4 text-xs animate-in fade-in max-h-[calc(100dvh-2rem)] overflow-y-auto focus:outline-hidden"
          >
            {submitted ? (
              <div className="text-center py-2 space-y-2">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="text-slate-600 dark:text-slate-300 font-medium">Obrigado! Relato registrado.</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-11 px-3 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
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
                    aria-label="Fechar"
                    className="w-11 h-11 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
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
                      className={`min-h-11 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
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
                  aria-label="Detalhes do problema (opcional)"
                  rows={2}
                  maxLength={500}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-[#243452] bg-slate-50 dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-[11px] resize-none focus:outline-hidden focus:ring-1 focus:ring-teal-500 mb-2.5"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedTag || isSubmitting}
                    className="min-h-11 px-3 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isSubmitting ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>, document.body
      )}
    </div>
  );
};
