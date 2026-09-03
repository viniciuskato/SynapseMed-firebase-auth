import React from 'react';
import {
  Check,
  Crown,
  Sparkles,
  X,
  GraduationCap,
  ShieldCheck,
  Zap,
  BookOpen,
  HelpCircle,
  Stethoscope,
  Layers,
  BarChart3,
} from 'lucide-react';
import { UserPlan } from '../types';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: UserPlan;
  onSelectPlan: (plan: UserPlan) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  onSelectPlan,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-3 border border-teal-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Planos SynapseMed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Escolha o plano ideal para a sua jornada médica
          </h2>
          <p className="text-slate-300 text-sm mt-2 max-w-2xl">
            Do ciclo básico à residência médica: integre teoria, banco de questões comentadas por alternativa, raciocínio clínico e revisão espaçada.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="p-6 sm:p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
          {/* Free Plan */}
          <div
            className={`rounded-2xl p-6 border transition-all flex flex-col justify-between ${
              currentPlan === 'free'
                ? 'bg-white border-teal-600 ring-2 ring-teal-600 shadow-md'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                  <GraduationCap className="w-6 h-6" />
                </div>
                {currentPlan === 'free' && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
                    Seu Plano Atual
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900">Plano Gratuito</h3>
              <p className="text-xs text-slate-500 mt-1">
                Ideal para conhecer a plataforma e testar o método integrado.
              </p>
              <div className="my-6">
                <span className="text-3xl font-extrabold text-slate-900">R$ 0</span>
                <span className="text-slate-500 text-xs font-medium"> / para sempre</span>
              </div>

              <ul className="space-y-3 text-xs text-slate-600 mb-6">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Acesso a compêndios teóricos essenciais</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Até 20 resoluções de questões por mês</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Explicações comentadas básicas</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <X className="w-4 h-4 text-slate-300 shrink-0" />
                  <span>Sem algoritmo avançado de repetição espaçada (SRS)</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <X className="w-4 h-4 text-slate-300 shrink-0" />
                  <span>Sem criação ilimitada de simulados personalizados</span>
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <X className="w-4 h-4 text-slate-300 shrink-0" />
                  <span>Sem diagnóstico avançado de erros por tema</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onSelectPlan('free');
                onClose();
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                currentPlan === 'free'
                  ? 'bg-slate-100 text-slate-500 cursor-default'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              {currentPlan === 'free' ? 'Plano Ativo' : 'Mudar para Gratuito'}
            </button>
          </div>

          {/* Premium Pro Plan */}
          <div
            className={`rounded-2xl p-6 border relative transition-all flex flex-col justify-between ${
              currentPlan === 'premium'
                ? 'bg-white border-amber-500 ring-2 ring-amber-500 shadow-xl'
                : 'bg-white border-amber-300 hover:border-amber-400 shadow-md'
            }`}
          >
            <div className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold text-[10px] tracking-wider uppercase px-3 py-1 rounded-full shadow-xs">
              Recomendado • Acesso Total
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-sm">
                  <Crown className="w-6 h-6 fill-slate-950" />
                </div>
                {currentPlan === 'premium' && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                    Seu Plano Atual
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900">Premium Pro</h3>
              <p className="text-xs text-slate-500 mt-1">
                A experiência completa e integrada de alto rendimento para aprovação.
              </p>
              <div className="my-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">R$ 59</span>
                  <span className="text-slate-500 text-xs font-medium"> / mês (ou R$ 499/ano)</span>
                </div>
                <p className="text-[11px] text-teal-700 font-semibold mt-0.5">
                  Economize 30% no plano anual com simulados ilimitados
                </p>
              </div>

              <ul className="space-y-3 text-xs text-slate-700 mb-6 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0 font-bold" />
                  <span><strong>Acervo completo e irrestrito</strong> de compêndios e diretrizes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0 font-bold" />
                  <span><strong>Banco ilimitado</strong> de questões com explicação por alternativa</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0 font-bold" />
                  <span><strong>Repetição Espaçada (SRS SM-2)</strong> automática e personalizada</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0 font-bold" />
                  <span><strong>Casos Clínicos Interativos</strong> com raciocínio diagnóstico</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0 font-bold" />
                  <span><strong>Simulados cronometrados</strong> e gerador de cadernos de erros</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-teal-600 shrink-0 font-bold" />
                  <span><strong>Painel analítico e diagnóstico</strong> de temas com maior taxa de erro</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                onSelectPlan('premium');
                onClose();
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 ${
                currentPlan === 'premium'
                  ? 'bg-amber-100 text-amber-900 cursor-default'
                  : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 hover:shadow-amber-500/30'
              }`}
            >
              <Crown className="w-4 h-4 fill-current" />
              <span>{currentPlan === 'premium' ? 'Plano Ativo (Acesso Completo)' : 'Ativar Premium Pro Agora'}</span>
            </button>
          </div>
        </div>

        {/* Institutional Plans Note */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-600">
          <span>Instituições de Ensino, Faculdades e Ligas Acadêmicas? </span>
          <span className="font-semibold text-teal-700">Consulte planos institucionais com painel para professores.</span>
        </div>
      </div>
    </div>
  );
};
