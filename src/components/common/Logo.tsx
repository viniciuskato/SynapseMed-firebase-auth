import React from 'react';

interface LogoProps {
  className?: string;
}

/**
 * Marca do NexusMed: monograma "N" com uma linha de pulso/batimento cardíaco
 * como acento, unindo "Nexus" (conexão) e "Med" (medicina). Mesma arte usada
 * nos ícones do PWA/favicon (public/icon-*.png), gerados a partir do mesmo
 * desenho para manter a marca consistente dentro e fora do app.
 */
export const Logo: React.FC<LogoProps> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 512 512" className={className} role="img" aria-label="NexusMed">
    <defs>
      <linearGradient id="nexusmed-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0d9488" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="110" fill="url(#nexusmed-logo-gradient)" />
    <polyline
      points="146,320 146,150 366,320 366,150"
      fill="none"
      stroke="#ffffff"
      strokeWidth="38"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="120,388 176,388 196,356 222,414 246,388 392,388"
      fill="none"
      stroke="#ffffff"
      strokeWidth="16"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.92"
    />
  </svg>
);
