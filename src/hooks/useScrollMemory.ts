import { useEffect, useRef } from 'react';

// Memória de posição de rolagem entre trocas de seção do app. App.tsx
// desmonta cada view ao trocar de activeView (não há React Router), então
// qualquer scrollY se perde ao navegar para outra seção e voltar — este Map
// vive fora do React (nível de módulo) e sobrevive a esses remounts enquanto
// a página não recarrega. Não persiste em localStorage de propósito: não faz
// sentido restaurar posição de rolagem depois de um F5 dias depois.
const scrollMemory = new Map<string, number>();

// Scroll é sempre do window/document neste app (ver CompendiumReader.tsx,
// que já usa window.scrollTo/window.scrollY para a barra de progresso),
// nunca de containers internos com overflow — por isso um único listener em
// window é suficiente para todas as views.
export function useScrollMemory(key: string, ready: boolean = true): void {
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;

    const savedY = scrollMemory.get(key) ?? 0;
    // rAF duplo: dá tempo do conteúdo (às vezes assíncrono) ocupar a altura
    // final da página antes de tentar rolar até savedY.
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, savedY)));

    const onScroll = () => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        scrollMemory.set(key, window.scrollY);
        rafId.current = null;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      scrollMemory.set(key, window.scrollY);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);
}
