import React from 'react';
import { Stethoscope, Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC<{ message?: string }> = ({
  message = 'Carregando base de estudos médicos...',
}) => {
  return (
    <div
      id="loading-screen"
      className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 transition-colors"
    >
      <div className="flex flex-col items-center max-w-sm text-center">
        {/* Logo / Brand Icon */}
        <div className="w-16 h-16 rounded-2xl bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-700/20 mb-6">
          <Stethoscope className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold font-serif-reading tracking-tight mb-2 text-slate-900 dark:text-white">
          SynapseMed
        </h1>
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-6">
          Base de Estudos e Compêndios Médicos
        </p>

        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
};
