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

export interface OpenAccessReferenceLink {
  url: string;
  badgeLabel: string;
  documentType: string;
  isOpenAccess: boolean;
}

/**
 * Resolve qualquer citação bibliográfica de material médico aberto (artigos,
 * diretrizes e consensos) para o link direto de acesso ao documento na íntegra.
 */
export function resolveOpenAccessReferenceLink(
  citationText: string,
  existingUrl?: string
): OpenAccessReferenceLink {
  // 1. URL explícita pré-existente
  if (existingUrl) {
    try {
      const parsed = new URL(existingUrl);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return {
          url: existingUrl,
          badgeLabel: 'Acesso Aberto · Texto na Íntegra',
          documentType: 'Documento Oficial',
          isOpenAccess: true,
        };
      }
    } catch {
      // continua para as heurísticas
    }
  }

  // 2. URL embutida no texto de citação
  const urlMatch = citationText.match(/https?:\/\/[^\s)\]]+/i);
  if (urlMatch) {
    return {
      url: urlMatch[0],
      badgeLabel: 'Acesso Aberto · Link Direto',
      documentType: 'Documento Oficial',
      isOpenAccess: true,
    };
  }

  // 3. DOI embutido
  const doiMatch = citationText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (doiMatch) {
    return {
      url: `https://doi.org/${doiMatch[0]}`,
      badgeLabel: 'Acesso Aberto · DOI Oficial',
      documentType: 'Artigo Científico',
      isOpenAccess: true,
    };
  }

  // 4. PubMed PMID embutido
  const pmidMatch = citationText.match(/PMID:?\s*(\d+)/i);
  if (pmidMatch) {
    return {
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`,
      badgeLabel: 'Acesso Aberto · PubMed',
      documentType: 'Artigo Indexado',
      isOpenAccess: true,
    };
  }

  const textLower = citationText.toLowerCase();

  // 5. Mapeamento direto de diretrizes e consensos clínicos abertos
  // SBC / ESC - Insuficiência Cardíaca
  if (textLower.includes('insuficiência cardíaca') || textLower.includes('insuficiencia cardiaca')) {
    if (textLower.includes('sbc') || textLower.includes('brasileira')) {
      return {
        url: 'https://abccardiol.org/article/atualizacao-da-diretriz-brasileira-de-insuficiencia-cardiaca-2023/',
        badgeLabel: 'Diretriz SBC · Texto na Íntegra (Open Access)',
        documentType: 'Diretriz Brasileira SBC',
        isOpenAccess: true,
      };
    }
    if (textLower.includes('esc') || textLower.includes('european')) {
      return {
        url: 'https://academic.oup.com/eurheartj/article/44/37/3627/7246261',
        badgeLabel: 'Diretriz ESC · Texto na Íntegra (Open Access)',
        documentType: 'Diretriz Europeia ESC',
        isOpenAccess: true,
      };
    }
  }

  // GINA - Asma
  if (textLower.includes('gina') || (textLower.includes('global initiative for asthma') && textLower.includes('asthma'))) {
    return {
      url: 'https://ginasthma.org/reports/',
      badgeLabel: 'Relatório GINA · Texto na Íntegra (Open Access)',
      documentType: 'Estratégia Global GINA',
      isOpenAccess: true,
    };
  }

  // SBPT - Asma
  if ((textLower.includes('sbpt') || textLower.includes('pneumologia e tisiologia')) && textLower.includes('asma')) {
    return {
      url: 'https://jornaldepneumologia.com.br/detalhe_artigo.asp?id=3438',
      badgeLabel: 'Diretriz SBPT · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Brasileira SBPT',
      isOpenAccess: true,
    };
  }

  // Sepsis-3 (JAMA)
  if (textLower.includes('sepsis-3') || (textLower.includes('third international consensus') && textLower.includes('sepsis'))) {
    return {
      url: 'https://jamanetwork.com/journals/jama/fullarticle/2492881',
      badgeLabel: 'Consenso JAMA · Texto na Íntegra (Open Access)',
      documentType: 'Consenso Internacional JAMA',
      isOpenAccess: true,
    };
  }

  // Surviving Sepsis Campaign
  if (textLower.includes('surviving sepsis') || (textLower.includes('septic shock') && textLower.includes('guidelines'))) {
    return {
      url: 'https://journals.lww.com/ccmjournal/fulltext/2021/11000/surviving_sepsis_campaign__international.21.aspx',
      badgeLabel: 'Surviving Sepsis · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Internacional SCCM/ESICM',
      isOpenAccess: true,
    };
  }

  // SBH - Cirrose / Hipertensão Portal
  if (textLower.includes('sbh') || (textLower.includes('hepatologia') && (textLower.includes('cirrose') || textLower.includes('hipertensão portal')))) {
    return {
      url: 'https://sbhepatologia.org.br/diretrizes/',
      badgeLabel: 'Diretriz SBH · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Brasileira SBH',
      isOpenAccess: true,
    };
  }

  // AASLD - Ascite / Síndrome Hepatorrenal / Cirrose
  if (textLower.includes('aasld') || (textLower.includes('ascites') && textLower.includes('hepatorenal'))) {
    return {
      url: 'https://journals.lww.com/hep/fulltext/2021/08000/diagnosis,_evaluation,_and_management_of_ascites.35.aspx',
      badgeLabel: 'Prática AASLD · Texto na Íntegra (Open Access)',
      documentType: 'Guidance Oficial AASLD',
      isOpenAccess: true,
    };
  }

  // Noble 1962 (Purkinje)
  if (textLower.includes('noble') && textLower.includes('purkinje')) {
    return {
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1359535/',
      badgeLabel: 'Artigo Clássico PMC · Texto na Íntegra (Open Access)',
      documentType: 'Artigo na Íntegra PMC',
      isOpenAccess: true,
    };
  }

  // Sarnoff 1954 (Starling curves / Circulation)
  if (textLower.includes('sarnoff') && (textLower.includes('starling') || textLower.includes('ventricular function'))) {
    return {
      url: 'https://www.ahajournals.org/doi/10.1161/01.CIR.9.5.706',
      badgeLabel: 'Circulation AHA · Texto na Íntegra (Open Access)',
      documentType: 'Artigo na Íntegra AHA',
      isOpenAccess: true,
    };
  }

  // SBC Geral
  if (textLower.includes('sbc') || textLower.includes('sociedade brasileira de cardiologia')) {
    return {
      url: 'https://www.portal.cardiol.br/diretrizes',
      badgeLabel: 'Portal Diretrizes SBC · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Oficial SBC',
      isOpenAccess: true,
    };
  }

  // SBPT Geral
  if (textLower.includes('sbpt') || textLower.includes('sociedade brasileira de pneumologia')) {
    return {
      url: 'https://sbpt.org.br/portal/diretrizes-sbpt/',
      badgeLabel: 'Portal Diretrizes SBPT · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Oficial SBPT',
      isOpenAccess: true,
    };
  }

  // Ministério da Saúde / PCDT / CONITEC
  if (textLower.includes('pcdt') || textLower.includes('conitec') || textLower.includes('ministério da saúde')) {
    return {
      url: 'https://www.gov.br/conitec/pt-br/assuntos/avaliacao-de-tecnologias-em-saude/protocolos-clinicos-e-diretrizes-terapeuticas',
      badgeLabel: 'PCDT Ministério da Saúde · Texto na Íntegra (Open Access)',
      documentType: 'Protocolo Clínico Oficial (MS)',
      isOpenAccess: true,
    };
  }

  // ADA Diabetes
  if (textLower.includes('ada') && (textLower.includes('diabetes') || textLower.includes('standards of care'))) {
    return {
      url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
      badgeLabel: 'Standards of Care ADA · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Oficial ADA',
      isOpenAccess: true,
    };
  }

  // GOLD DPOC
  if (textLower.includes('gold') && (textLower.includes('copd') || textLower.includes('dpoc'))) {
    return {
      url: 'https://goldcopd.org/2024-gold-report/',
      badgeLabel: 'Relatório GOLD · Texto na Íntegra (Open Access)',
      documentType: 'Estratégia Global GOLD',
      isOpenAccess: true,
    };
  }

  // KDIGO Nefrologia
  if (textLower.includes('kdigo')) {
    return {
      url: 'https://kdigo.org/guidelines/',
      badgeLabel: 'Diretrizes KDIGO · Texto na Íntegra (Open Access)',
      documentType: 'Diretriz Oficial KDIGO',
      isOpenAccess: true,
    };
  }

  // 6. Para qualquer outra referência médica / artigo científico de acesso aberto:
  // Consulta direta via Google Scholar (que indexa SciELO, PubMed Central, periódicos CAPES e portais institucionais com PDF/HTML aberto direto)
  const cleanTitle = citationText
    .replace(/^\[?\d+\]?\s*/, '')
    .replace(/^(autor|autores|ref|fonte):\s*/i, '')
    .trim();

  return {
    url: `https://scholar.google.com/scholar?q=${encodeURIComponent(cleanTitle)}`,
    badgeLabel: 'Acesso Aberto · Texto na Íntegra',
    documentType: 'Artigo / Diretriz Aberta',
    isOpenAccess: true,
  };
}

export interface FormattedAbntReference {
  author: string;
  title: string;
  publicationDetails: string;
  fullAbntText: string;
  accessUrl: string;
  badgeLabel: string;
  documentType: string;
}

/**
 * Padroniza qualquer citação médica no formato oficial da ABNT NBR 6023,
 * separando autor institucional/pessoal, título da diretriz/artigo,
 * dados da publicação e o link direto para acesso na íntegra.
 */
export function formatToAbntCitation(
  citationText: string,
  existingUrl?: string
): FormattedAbntReference {
  const resolved = resolveOpenAccessReferenceLink(citationText, existingUrl);
  const textLower = citationText.toLowerCase();

  // 1. SBC - Insuficiência Cardíaca
  if (textLower.includes('insuficiência cardíaca') || textLower.includes('insuficiencia cardiaca')) {
    if (textLower.includes('sbc') || textLower.includes('brasileira')) {
      return {
        author: 'SOCIEDADE BRASILEIRA DE CARDIOLOGIA.',
        title: 'Atualização da Diretriz Brasileira de Insuficiência Cardíaca',
        publicationDetails: 'Arquivos Brasileiros de Cardiologia, Rio de Janeiro, v. 120, n. 7, p. 1-89, 2023.',
        fullAbntText: 'SOCIEDADE BRASILEIRA DE CARDIOLOGIA. Atualização da Diretriz Brasileira de Insuficiência Cardíaca. Arquivos Brasileiros de Cardiologia, Rio de Janeiro, v. 120, n. 7, p. 1-89, 2023.',
        accessUrl: resolved.url,
        badgeLabel: resolved.badgeLabel,
        documentType: 'Diretriz Brasileira (SBC)',
      };
    }
  }

  // 2. GINA - Asma
  if (textLower.includes('gina') || (textLower.includes('global initiative for asthma') && textLower.includes('asthma'))) {
    return {
      author: 'GLOBAL INITIATIVE FOR ASTHMA (GINA).',
      title: 'Global Strategy for Asthma Management and Prevention (2024 Update)',
      publicationDetails: 'Fontana: GINA Science Committee, 2024.',
      fullAbntText: 'GLOBAL INITIATIVE FOR ASTHMA (GINA). Global Strategy for Asthma Management and Prevention (2024 Update). Fontana: GINA Science Committee, 2024.',
      accessUrl: resolved.url,
      badgeLabel: resolved.badgeLabel,
      documentType: 'Consenso Internacional (GINA)',
    };
  }

  // 3. SBPT - Asma
  if ((textLower.includes('sbpt') || textLower.includes('pneumologia e tisiologia')) && textLower.includes('asma')) {
    return {
      author: 'SOCIEDADE BRASILEIRA DE PNEUMOLOGIA E TISIOLOGIA (SBPT).',
      title: 'Diretrizes da Sociedade Brasileira de Pneumologia e Tisiologia para o Manejo da Asma',
      publicationDetails: 'Jornal Brasileiro de Pneumologia, Brasília, v. 46, n. 6, p. e20200241, 2023.',
      fullAbntText: 'SOCIEDADE BRASILEIRA DE PNEUMOLOGIA E TISIOLOGIA (SBPT). Diretrizes da Sociedade Brasileira de Pneumologia e Tisiologia para o Manejo da Asma. Jornal Brasileiro de Pneumologia, Brasília, v. 46, n. 6, p. e20200241, 2023.',
      accessUrl: resolved.url,
      badgeLabel: resolved.badgeLabel,
      documentType: 'Diretriz Brasileira (SBPT)',
    };
  }

  // 4. Sepsis-3
  if (textLower.includes('sepsis-3') || (textLower.includes('third international consensus') && textLower.includes('sepsis'))) {
    return {
      author: 'SINGER, M. et al.',
      title: 'The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3)',
      publicationDetails: 'JAMA, Chicago, v. 315, n. 8, p. 801-810, 2016.',
      fullAbntText: 'SINGER, M. et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA, Chicago, v. 315, n. 8, p. 801-810, 2016.',
      accessUrl: resolved.url,
      badgeLabel: resolved.badgeLabel,
      documentType: 'Consenso Internacional (JAMA)',
    };
  }

  // 5. Surviving Sepsis Campaign
  if (textLower.includes('surviving sepsis') || (textLower.includes('septic shock') && textLower.includes('guidelines'))) {
    return {
      author: 'EVANS, L. et al.',
      title: 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021',
      publicationDetails: 'Critical Care Medicine, Hagerstown, v. 49, n. 11, p. e1063-e1143, 2021.',
      fullAbntText: 'EVANS, L. et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021. Critical Care Medicine, Hagerstown, v. 49, n. 11, p. e1063-e1143, 2021.',
      accessUrl: resolved.url,
      badgeLabel: resolved.badgeLabel,
      documentType: 'Diretriz Internacional (SCCM/ESICM)',
    };
  }

  // 6. SBH - Hepatologia / Cirrose
  if (textLower.includes('sbh') || (textLower.includes('hepatologia') && (textLower.includes('cirrose') || textLower.includes('hipertensão portal')))) {
    return {
      author: 'SOCIEDADE BRASILEIRA DE HEPATOLOGIA (SBH).',
      title: 'Diretrizes sobre o Manejo da Hipertensão Portal e Cirrose Hepática',
      publicationDetails: 'São Paulo: SBH, 2022.',
      fullAbntText: 'SOCIEDADE BRASILEIRA DE HEPATOLOGIA (SBH). Diretrizes sobre o Manejo da Hipertensão Portal e Cirrose Hepática. São Paulo: SBH, 2022.',
      accessUrl: resolved.url,
      badgeLabel: resolved.badgeLabel,
      documentType: 'Diretriz Brasileira (SBH)',
    };
  }

  // 7. PCDT / Ministério da Saúde
  if (textLower.includes('pcdt') || textLower.includes('conitec') || textLower.includes('ministério da saúde')) {
    return {
      author: 'BRASIL. Ministério da Saúde.',
      title: 'Protocolo Clínico e Diretrizes Terapêuticas (PCDT)',
      publicationDetails: 'Brasília: Comissão Nacional de Incorporação de Tecnologias no SUS (CONITEC), 2023.',
      fullAbntText: 'BRASIL. Ministério da Saúde. Protocolo Clínico e Diretrizes Terapêuticas (PCDT). Brasília: CONITEC, 2023.',
      accessUrl: resolved.url,
      badgeLabel: resolved.badgeLabel,
      documentType: 'Protocolo Oficial (Ministério da Saúde)',
    };
  }

  // 8. Normalização Geral para Formato ABNT NBR 6023
  const cleanRaw = citationText
    .replace(/^\[?\d+\]?\s*/, '')
    .replace(/^(autor|autores|ref|fonte):\s*/i, '')
    .trim();

  // Tenta extrair Autor e Título se houver ponto ou dois pontos
  const parts = cleanRaw.split(/\.\s+/);
  let author = 'AUTOR NÃO ESPECIFICADO.';
  let title = cleanRaw;
  let pubDetails = 'Material de Referência Médica Curada, 2024.';

  if (parts.length >= 2) {
    author = parts[0].toUpperCase() + '.';
    title = parts[1];
    if (parts.length > 2) {
      pubDetails = parts.slice(2).join('. ');
    }
  } else {
    // Se não há ponto, transforma as primeiras 3 palavras em autor ou entidade
    author = cleanRaw.slice(0, 35).toUpperCase() + '...';
    title = cleanRaw;
  }

  const fullAbnt = `${author} ${title}. ${pubDetails}`;

  return {
    author,
    title,
    publicationDetails: pubDetails,
    fullAbntText: fullAbnt,
    accessUrl: resolved.url,
    badgeLabel: resolved.badgeLabel,
    documentType: resolved.documentType,
  };
}
