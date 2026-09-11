// O status descreve a revisão editorial da fonte, não valida cada afirmação.
export function sourceVerificationLabel(status?: string): string {
  const labels: Record<string, string> = {
    verificada: 'Fonte verificada',
    nao_verificavel_externamente: 'Fonte não verificável externamente',
    vaga_pendente: 'Verificação pendente',
    verificada_por_busca_resumo: 'Verificada por busca ou resumo',
    verificada_texto_integral_e_inspecao_visual: 'Texto integral e inspeção visual verificados',
    verificada_texto_integral: 'Texto integral verificado',
  };
  return labels[status ?? ''] ?? 'Verificação não informada';
}

export function sourceUrl(ids?: Record<string, string> | null, referenceUrl?: string | null): string | undefined {
  const candidate = referenceUrl || ids?.url || (ids?.doi ? `https://doi.org/${ids.doi}`
    : ids?.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${ids.pmid}/`
    : ids?.pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${ids.pmcid}/` : undefined);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

// Tipos de link que uma citação pode receber. Nenhum deles afirma acesso
// aberto/texto integral por conta própria — isso só é dito quando existe
// evidência real (verificacao vinda do banco, nunca inferida aqui).
export type CitationLinkKind = 'url_curada' | 'doi' | 'pmid' | 'sugestao_busca';

export interface CitationLink {
  url: string;
  kind: CitationLinkKind;
  // Rótulo honesto do botão — nunca declara "íntegra"/"acesso aberto" para
  // links heurísticos (Prompt 11-B, gate 10).
  label: string;
}

/**
 * Resolve, quando possível, um link clicável para a citação — SEM inventar
 * metadados. Prioridade: (1) URL curada explícita, já registrada para essa
 * fonte; (2) URL embutida no próprio texto da citação; (3) DOI embutido;
 * (4) PMID embutido; (5) como último recurso, uma sugestão de busca no
 * Google Scholar, sempre rotulada como sugestão — nunca como fonte
 * confirmada. Retorna `undefined` quando não há nada seguro para linkar
 * (nesse caso a UI não deve renderizar um botão/link ativo).
 */
export function resolveCitationLink(citationText: string, existingUrl?: string | null): CitationLink | undefined {
  // 1. URL curada explícita — estado editorial real, preservado como está.
  if (existingUrl) {
    try {
      const parsed = new URL(existingUrl);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return { url: existingUrl, kind: 'url_curada', label: 'Abrir fonte' };
      }
    } catch {
      // URL inválida - cai para as heurísticas abaixo.
    }
  }

  // 2. URL embutida no texto de citação.
  const urlMatch = citationText.match(/https?:\/\/[^\s)\]]+/i);
  if (urlMatch) {
    return { url: urlMatch[0], kind: 'url_curada', label: 'Abrir fonte' };
  }

  // 3. DOI embutido — real identificador, link clicável. A classe de
  // caracteres do regex inclui "." (válido dentro de um DOI real), então um
  // DOI no fim de frase ("...10.xxxx/yyyy." seguido de espaço) capturava
  // também o ponto final da frase, gerando um link malformado
  // (.../yyyy.). Remove pontuação de fechamento de frase (. , ; ) ] no
  // final do match — nunca legítima como último caractere de um DOI real.
  const doiMatch = citationText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (doiMatch) {
    const doi = doiMatch[0].replace(/[.,;)\]]+$/, '');
    return { url: `https://doi.org/${doi}`, kind: 'doi', label: 'Abrir DOI' };
  }

  // 4. PMID embutido — real identificador, link clicável.
  const pmidMatch = citationText.match(/PMID:?\s*(\d+)/i);
  if (pmidMatch) {
    return { url: `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`, kind: 'pmid', label: 'Abrir no PubMed' };
  }

  // 5. Nenhum identificador real encontrado: sugestão de busca no Google
  // Scholar, explicitamente rotulada como sugestão — nunca apresentada como
  // acesso confirmado, texto integral ou fonte verificada.
  const cleanTitle = citationText
    .replace(/^\[?\d+\]?\s*/, '')
    .replace(/^(autor|autores|ref|fonte):\s*/i, '')
    .trim();
  if (!cleanTitle) return undefined;

  return {
    url: `https://scholar.google.com/scholar?q=${encodeURIComponent(cleanTitle)}`,
    kind: 'sugestao_busca',
    label: 'Pesquisar referência (Google Scholar)',
  };
}

export interface CitationDisplay {
  // Texto original da citação, preservado integralmente — nunca reescrito,
  // nunca decomposto em autor/título/ano por heurística (Prompt 11-B, gate
  // 10: o banco não guarda esses campos estruturados, então qualquer
  // "parsing" de autor/editora/volume/página a partir do texto livre seria
  // inventado).
  citationText: string;
  link?: CitationLink;
}

/**
 * Monta a citação pronta para exibição. NÃO formata em ABNT NBR 6023 por
 * heurística de string (isso exigiria campos estruturados — autor, título,
 * veículo, volume, página, ano — que não existem no modelo de dados; ver
 * `QuestionReviewReference`/`bibliographicSources` em `src/types/index.ts`,
 * ambos só têm `citationText` + `url` + `verificacao` livres). Preserva o
 * texto curado como veio e resolve só o link, honestamente rotulado.
 */
export function formatCitationForDisplay(citationText: string, existingUrl?: string | null): CitationDisplay {
  return {
    citationText,
    link: resolveCitationLink(citationText, existingUrl),
  };
}
