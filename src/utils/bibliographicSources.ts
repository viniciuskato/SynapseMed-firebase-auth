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
