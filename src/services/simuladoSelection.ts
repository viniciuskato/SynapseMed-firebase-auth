import { Question, QuestionAnswerRecord, SimuladoConfig } from '../types';

// ============================================================================
// Seleção de questões do Simulado Personalizado (Prompt 07-E5)
// ============================================================================
//
// Corrige a armadilha #17 do AGENTS.md: `handleStartCustomSimulado` gravava
// `activeSimuladoConfig` mas passava o array CHEIO de questões para
// `<SimuladoSession>`, que usava o prop como estava, sem filtrar por config.
// Esta função centraliza a filtragem + corte por quantidade, para que os
// filtros REALMENTE disponíveis no "Criador de Simulados & Listas"
// (disciplina, tema, dificuldade, ciclo, apenas erros) e a quantidade
// configurada determinem de fato as questões da sessão.
//
// Convenção adotada para os campos de filtro (arrays): lista VAZIA significa
// "sem restrição" (todas as opções passam), não "nenhuma corresponde" — é a
// semântica já usada pelo restante do app (`CreateSimuladoModal` deixa
// `selectedDisciplines` vazio por padrão, e isso deve valer como "qualquer
// disciplina", não travar o simulado com 0 questões elegíveis;
// `disciplineIds`/`themeIds` sempre vazios no preset atual de tema, já que a
// UI de hoje não oferece seleção de tema). `difficulties`/`cycles` também
// seguem a mesma regra, embora hoje sempre cheguem com o conjunto completo
// (a UI não expõe toggle individual de dificuldade/ciclo ainda).
//
// Aleatoriedade determinística: quando há mais questões elegíveis do que
// `questionCount`, a amostra é sorteada com um PRNG semeado pelo PRÓPRIO
// `config.id` (gerado uma vez por sessão, via `crypto.randomUUID()` no
// componente que cria o SimuladoConfig). Isso garante duas propriedades
// exigidas pela diretoria ao mesmo tempo: (1) simulados DIFERENTES (ids
// diferentes) tendem a sortear subconjuntos diferentes; (2) recalcular a
// seleção para a MESMA sessão (mesmo config.id) — por exemplo, um
// re-render do componente pai — sempre devolve exatamente a mesma lista,
// na mesma ordem, sem novo sorteio. Não há necessidade de persistir a
// seleção em localStorage: por ser uma função pura de (catálogo de
// questões, config), o resultado já é estável enquanto o catálogo não
// mudar.

export interface SimuladoSelectionResult {
  /** Questões escolhidas para a sessão, já cortadas por `questionCount`. */
  selected: Question[];
  /** Quantas questões elegíveis existiam antes do corte por quantidade. */
  eligibleCount: number;
  /** `config.questionCount` original, para a UI comparar com `selected.length`. */
  requestedCount: number;
}

/** Hash simples (djb2-like) de string para inteiro de 32 bits, usado como semente do PRNG. */
function hashStringToSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** PRNG determinístico (mulberry32) — mesma semente sempre produz a mesma sequência. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates com PRNG semeado — determinístico para a mesma `seed`. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashStringToSeed(seed));
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Filtra o catálogo pelas restrições REALMENTE configuráveis hoje na UI do
 * Criador de Simulados & Listas: disciplina, tema, dificuldade, ciclo e
 * "apenas erros anteriores". Não inventa filtros que a interface não
 * oferece (ex.: não há filtro de instituição/ano no modal).
 */
export function selectEligibleQuestions(
  allQuestions: Question[],
  config: SimuladoConfig,
  answers: Record<string, QuestionAnswerRecord>
): Question[] {
  return allQuestions.filter((q) => {
    if (config.disciplineIds.length > 0 && !config.disciplineIds.includes(q.disciplineId)) {
      return false;
    }
    if (config.themeIds.length > 0 && !config.themeIds.includes(q.themeId)) {
      return false;
    }
    if (config.difficulties.length > 0 && !config.difficulties.includes(q.difficulty)) {
      return false;
    }
    if (config.cycles.length > 0 && !config.cycles.includes(q.cycle)) {
      return false;
    }
    if (config.onlyMistakes) {
      const answer = answers[q.id];
      if (!answer || answer.isCorrect) return false;
    }
    return true;
  });
}

/**
 * Resolve a lista final de questões de uma sessão de simulado: filtra pelo
 * `config`, sorteia deterministicamente pela semente `config.id` quando há
 * mais elegíveis que `questionCount`, e corta pela quantidade pedida. Nunca
 * lança erro por falta de questões — se houver menos elegíveis que o
 * pedido, devolve todas as elegíveis (a UI decide como avisar o usuário
 * comparando `selected.length` com `requestedCount`).
 */
export function buildSimuladoSelection(
  allQuestions: Question[],
  config: SimuladoConfig,
  answers: Record<string, QuestionAnswerRecord>
): SimuladoSelectionResult {
  const eligible = selectEligibleQuestions(allQuestions, config, answers);
  const ordered = seededShuffle(eligible, config.id);
  const selected = ordered.slice(0, Math.max(0, config.questionCount));
  return {
    selected,
    eligibleCount: eligible.length,
    requestedCount: config.questionCount,
  };
}
