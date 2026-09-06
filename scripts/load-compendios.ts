/**
 * Carga genérica dos compêndios extraídos em
 * `Estudos/Base de Estudos/Biblioteca/Medicina/_extracted-supabase/*.json`
 * para as tabelas materials/material_sections/content_assets/material_references
 * (schema v2). Generaliza `load-pilot-cardiologia.ts` (que só cobria 2
 * compêndios hardcoded) para os 33 compêndios já extraídos e auditados.
 *
 * AINDA NÃO EXECUTADO — script de rascunho para revisão. Por padrão roda em
 * modo --dry-run (não grava nada, só imprime o que faria). Passar --execute
 * para gravar de verdade, e mesmo assim SÓ contra o Supabase LOCAL (mesma
 * proteção de env do piloto — sobrescrever VITE_SUPABASE_URL/
 * SUPABASE_SERVICE_ROLE_KEY nas envs do comando, nunca usar as do .env.local
 * do repo, que por padrão apontam pro projeto remoto).
 *
 * Uso:
 *   npx tsx scripts/load-compendios.ts                # dry-run, só relatório
 *   npx tsx scripts/load-compendios.ts --execute       # grava de verdade (local)
 *
 * DECISÕES DE CARGA DOCUMENTADAS (revisar antes de rodar com --execute):
 *
 *  1. **Disciplina vem da pasta real do arquivo, não de discipline_hint do
 *     JSON.** Achado ao preparar este script: discipline_hint é preenchido
 *     livremente pelo modelo na extração e diverge da pasta real em vários
 *     casos (ex. choque-circulatorio.json tem discipline_hint="Medicina" mas
 *     mora em `Medicina de Emergência/`; tumores-do-sistema-nervoso-central.json
 *     tem "Neurologia e Neurocirurgia" mas a pasta é `Neurologia/`;
 *     anatomia-cardiaca.json tem "Cardiology" em inglês). Usar isso direto
 *     fragmentaria a tabela disciplines com entradas erradas/duplicadas.
 *     Decisão do usuário (2026-09-06): derivar a disciplina do primeiro
 *     segmento do caminho relativo dentro de `Biblioteca/Medicina/`. Ver
 *     `SPECIALTY_TO_DISCIPLINE` abaixo para o de-para de nome de pasta ->
 *     nome de disciplina gravado no banco (idêntico na maioria, só ajusta
 *     acentuação/forma quando preciso) e `CYCLE_BY_DISCIPLINE` para o cycle
 *     de cada uma — este último é um PALPITE razoável (clínico para
 *     especialidades clínicas, básico para Imunologia), não confirmado
 *     item a item com o usuário; revisar antes de --execute.
 *  2. **theme_hint do JSON é usado como veio** (diferente da disciplina, o
 *     tema é mais granular e specific o suficiente pra não causar a mesma
 *     fragmentação grave — mas também não foi auditado item a item; theme é
 *     só um agrupamento dentro da disciplina já correta, então um nome
 *     imperfeito aqui é bem menos grave que uma disciplina errada).
 *  3. **material_references NÃO cria linha em `sources`** — diferente do
 *     piloto (que tinha uma tabela hardcoded de ~13 fontes curadas item a
 *     item). Para 33 compêndios isso não é viável manualmente, e o schema
 *     documenta que `source_id` em material_references é opcional
 *     ("citation_text continua sendo a fonte de verdade textual" — migration
 *     20260904140000, comentário da seção 3). Este script grava só
 *     `citation_text` = raw_citation_text integral, `source_id` = null.
 *     Se no futuro quiser popular `sources` também, é um script à parte.
 *  4. **Imagens com caminho local** (external_url que não começa com
 *     http(s)://, ex. `_imagens/foo.jpg`) são gravadas como vieram no JSON —
 *     o schema aceita porque a checagem é só "exatamente um de storage_path/
 *     external_url preenchido", não valida se é uma URL real. Ficam
 *     listadas no relatório final ("imagens pendentes de upload") porque
 *     precisam virar URL real do Supabase Storage antes de qualquer
 *     material com essas imagens ser publicado — decisão de quando/como
 *     fazer esse upload é trabalho futuro, não deste script.
 *  5. **Idempotência**: um compêndio é pulado inteiro se já existir um
 *     `materials` com o mesmo `title` (case-insensitive) — cobre os 2 já
 *     carregados pelo piloto (Cardiac Anatomy / Ciclo Cardíaco) sem
 *     precisar de lista de exclusão hardcoded, e permite rodar de novo com
 *     segurança se algo falhar no meio.
 *  6. **dependencies[] resolvidas só por título exato (normalizado)** contra
 *     materials já existentes no banco + os carregados nesta mesma rodada —
 *     mesma filosofia do piloto (decisão #10 de load-pilot-cardiologia.ts):
 *     não inventar correspondência, reportar como "sem correspondência" o
 *     que não bater. Dado que dependencies[] nos 33 JSONs é texto livre
 *     variado (ex. "M4 — Imunidade Inata", "SRAA e Anti-hipertensivos"),
 *     espera-se que a MAIORIA fique sem correspondência nesta rodada — isso
 *     é esperado, não um bug do script.
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });

const EXECUTE = process.argv.includes('--execute');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ONEDRIVE = 'C:\\Users\\vinic\\OneDrive';
const MEDICINA_DIR = path.join(ONEDRIVE, 'Estudos', 'Base de Estudos', 'Biblioteca', 'Medicina');
const EXTRACTED_DIR = path.join(MEDICINA_DIR, '_extracted-supabase');

// ----------------------------------------------------------------------------
// Relatório
// ----------------------------------------------------------------------------

const log = {
  lines: [] as string[],
  push(s: string) {
    this.lines.push(s);
    console.log(s);
  },
};

// ----------------------------------------------------------------------------
// HTML -> markdown leve (idêntico ao usado em load-pilot-cardiologia.ts, para
// manter compatibilidade com SafeMarkdown.tsx)
// ----------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function convertInlinePreservingNewlines(text: string): string {
  let t = text;
  t = t.replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, '**$2**');
  t = t.replace(/<(em|i)>([\s\S]*?)<\/\1>/g, '*$2*');
  t = t.replace(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');
  t = t.replace(/<a[^>]*href="#[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1');
  t = t.replace(/<\/?span[^>]*>/g, '');
  t = t.replace(/<[^>]+>/g, '');
  t = decodeEntities(t);
  return t;
}

function flattenToSingleLine(html: string): string {
  const t = convertInlinePreservingNewlines(html);
  return t.replace(/\s+/g, ' ').trim();
}

function convertTables(html: string): string {
  return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_m, inner: string) => {
    const rows: string[][] = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRe.exec(inner))) {
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(trMatch[1]))) {
        cells.push(flattenToSingleLine(cellMatch[1]));
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return '';
    const [header, ...body] = rows;
    const lines = [
      '| ' + header.join(' | ') + ' |',
      '| ' + header.map(() => '---').join(' | ') + ' |',
      ...body.map((r) => '| ' + r.join(' | ') + ' |'),
    ];
    return '\n\n' + lines.join('\n') + '\n\n';
  });
}

function htmlToMarkdown(rawHtml: string): string {
  let html = rawHtml;
  html = convertTables(html);
  html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_m, c: string) => '\n- ' + flattenToSingleLine(c));
  html = html.replace(/<\/?(ul|ol)[^>]*>/g, '\n');
  html = html.replace(/<br\s*\/?>/g, '\n');
  html = html.replace(/<\/(p|div)>/g, '\n\n');
  html = html.replace(/<(p|div)[^>]*>/g, '');
  html = convertInlinePreservingNewlines(html);
  html = html
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return html;
}

// ----------------------------------------------------------------------------
// Tipos das fontes de dado (idênticos ao schema PilotCompendium)
// ----------------------------------------------------------------------------

interface PilotGlossaryTerm {
  term: string;
  translation_or_definition: string;
}

interface PilotImage {
  external_url: string;
  alt_text: string | null;
  caption: string | null;
  license_or_rights: string | null;
  source_note: string | null;
}

interface PilotSection {
  title: string;
  level: number;
  content_html: string;
  key_takeaways: string[] | null;
  glossary_terms?: PilotGlossaryTerm[] | null;
  images?: PilotImage[] | null;
}

interface PilotReference {
  raw_citation_text: string;
}

interface PilotCompendium {
  title: string;
  subtitle: string | null;
  discipline_hint: string;
  theme_hint: string;
  estimated_read_time_minutes: number | null;
  tags: string[];
  dependencies: string[];
  sections: PilotSection[];
  references: PilotReference[];
  _unmapped?: string[];
}

// ----------------------------------------------------------------------------
// Disciplina real por pasta (ver decisão #1 no cabeçalho) + cycle assumido
// (ver decisão #1 — REVISAR antes de --execute)
// ----------------------------------------------------------------------------

const SPECIALTY_TO_DISCIPLINE: Record<string, string> = {
  'Cardiologia': 'Cardiologia',
  'Hematologia': 'Hematologia',
  'Imunologia': 'Imunologia',
  'Infectologia': 'Infectologia',
  'Medicina de Emergência': 'Medicina de Emergência',
  'Medicina de Família e Comunidade': 'Medicina de Família e Comunidade',
  'Medicina Geral': 'Medicina Geral',
  'Nefrologia': 'Nefrologia',
  'Neurologia': 'Neurologia',
  'Pneumologia': 'Pneumologia',
};

// PALPITE não confirmado item a item com o usuário — revisar antes de --execute.
const CYCLE_BY_DISCIPLINE: Record<string, 'basico' | 'clinico' | 'internato_residencia'> = {
  'Cardiologia': 'clinico',
  'Hematologia': 'clinico',
  'Imunologia': 'basico',
  'Infectologia': 'clinico',
  'Medicina de Emergência': 'clinico',
  'Medicina de Família e Comunidade': 'clinico',
  'Medicina Geral': 'basico',
  'Nefrologia': 'clinico',
  'Neurologia': 'clinico',
  'Pneumologia': 'clinico',
};

/** Acha a pasta de especialidade real (1º segmento sob Biblioteca/Medicina/) do .html de origem de um slug. */
function findRealSpecialty(slug: string): string {
  const found = findHtmlRecursive(MEDICINA_DIR, slug + '.html');
  if (!found) throw new Error(`Não encontrei o .html de origem para o slug "${slug}" em ${MEDICINA_DIR}`);
  const rel = path.relative(MEDICINA_DIR, found);
  const specialty = rel.split(path.sep)[0];
  return specialty;
}

function findHtmlRecursive(dir: string, filename: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_archive' || entry.name === '_extracted-supabase' || entry.name === '_tools') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findHtmlRecursive(full, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return full;
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Helpers de disciplina/tema (upsert por nome, sem duplicar) — idênticos ao
// piloto
// ----------------------------------------------------------------------------

function slugifyCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function normalizeTitle(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function ensureDiscipline(name: string, cycle: 'basico' | 'clinico' | 'internato_residencia'): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from('disciplines')
    .select('id, name, code')
    .ilike('name', name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id as string;
  if (!EXECUTE) return `[dry-run-fake-id:discipline:${name}]`;
  const code = slugifyCode(name);
  const { data: created, error: insErr } = await admin
    .from('disciplines')
    .insert({ name, code, cycle })
    .select('id')
    .single();
  if (insErr) throw insErr;
  log.push(`  discipline "${name}" criada (id=${created.id}, code=${code}, cycle=${cycle}).`);
  return created.id as string;
}

async function ensureTheme(disciplineId: string, name: string): Promise<string> {
  if (!EXECUTE && disciplineId.startsWith('[dry-run-fake-id')) return `[dry-run-fake-id:theme:${name}]`;
  const { data: existing, error: selErr } = await admin
    .from('themes')
    .select('id')
    .eq('discipline_id', disciplineId)
    .eq('name', name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id as string;
  if (!EXECUTE) return `[dry-run-fake-id:theme:${name}]`;
  const { data: created, error: insErr } = await admin
    .from('themes')
    .insert({ discipline_id: disciplineId, name })
    .select('id')
    .single();
  if (insErr) throw insErr;
  log.push(`  theme "${name}" criado (id=${created.id}).`);
  return created.id as string;
}

function inferMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

// ----------------------------------------------------------------------------
// Carga
// ----------------------------------------------------------------------------

const counts = {
  compendiosEncontrados: 0,
  compendiosPulados: 0,
  compendiosCarregados: 0,
  sectionsCarregadas: 0,
  contentAssetsCarregados: 0,
  materialReferencesCarregadas: 0,
  dependenciasResolvidas: 0,
  dependenciasSemCorrespondencia: [] as string[],
};

const imagensPendentesUpload: string[] = [];

async function main() {
  log.push(`=== Carga de compêndios (${EXECUTE ? 'EXECUTE — grava de verdade' : 'DRY-RUN — não grava nada'}) ===`);
  log.push(`Supabase alvo: ${SUPABASE_URL}`);
  // Trava vale para QUALQUER modo, inclusive --dry-run: mesmo as leituras
  // (select em materials/disciplines/themes, feitas antes de qualquer insert)
  // são uma conexão real contra o banco indicado. .env.local deste repo tem,
  // por padrão, as credenciais do projeto REMOTO — rodar sem sobrescrever
  // VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nas envs do comando conecta
  // no remoto por engano (já aconteceu uma vez ao preparar este script).
  if (!SUPABASE_URL.includes('127.0.0.1') && !SUPABASE_URL.includes('localhost') && !ALLOW_REMOTE) {
    throw new Error(
      `SUPABASE_URL (${SUPABASE_URL}) não é local — por padrão este script só conecta no local, nem em dry-run (que já faz leituras reais). Rode contra local assim: VITE_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<chave local> npx tsx scripts/load-compendios.ts. Para rodar contra remoto de propósito, passe --allow-remote explicitamente. Abortando antes de qualquer chamada de rede.`
    );
  }

  const files = fs.readdirSync(EXTRACTED_DIR).filter((f) => f.endsWith('.json'));
  counts.compendiosEncontrados = files.length;
  log.push(`Compêndios encontrados em _extracted-supabase/: ${files.length}`);

  // materiais já existentes no banco (pro check de idempotência e resolução de dependências)
  const { data: existingMaterials, error: emErr } = await admin.from('materials').select('id, title');
  if (emErr) throw emErr;
  const materialIdByNormalizedTitle = new Map<string, string>();
  for (const m of existingMaterials ?? []) {
    materialIdByNormalizedTitle.set(normalizeTitle(m.title as string), m.id as string);
  }
  log.push(`Materials já existentes no banco: ${materialIdByNormalizedTitle.size}`);

  const compendiaLoadedThisRun: { title: string; dependencies: string[] }[] = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(EXTRACTED_DIR, file), 'utf8');
    const arr: PilotCompendium[] = JSON.parse(raw);
    const c = arr[0];

    const normTitle = normalizeTitle(c.title);
    if (materialIdByNormalizedTitle.has(normTitle)) {
      log.push(`[PULADO] "${c.title}" (${slug}) já existe em materials — não recarregado.`);
      counts.compendiosPulados++;
      continue;
    }

    const specialty = findRealSpecialty(slug);
    const disciplineName = SPECIALTY_TO_DISCIPLINE[specialty];
    if (!disciplineName) {
      log.push(`[ERRO] Pasta de especialidade "${specialty}" (slug=${slug}) sem entrada em SPECIALTY_TO_DISCIPLINE — pulando.`);
      continue;
    }
    const cycle = CYCLE_BY_DISCIPLINE[disciplineName] ?? 'clinico';

    log.push(`\n--- ${slug} ---`);
    log.push(`  title: "${c.title}" | pasta real: ${specialty} -> discipline: ${disciplineName} (cycle=${cycle}) | theme_hint: "${c.theme_hint}"`);

    const disciplineId = await ensureDiscipline(disciplineName, cycle);
    const themeId = await ensureTheme(disciplineId, c.theme_hint);

    let materialId: string;
    if (EXECUTE) {
      const { data: material, error: matErr } = await admin
        .from('materials')
        .insert({
          discipline_id: disciplineId,
          theme_id: themeId,
          title: c.title,
          subtitle: c.subtitle,
          status: 'draft',
          estimated_read_time_minutes: c.estimated_read_time_minutes,
          tags: c.tags,
        })
        .select('id')
        .single();
      if (matErr) throw matErr;
      materialId = material.id as string;
    } else {
      materialId = `[dry-run-fake-id:material:${c.title}]`;
    }
    materialIdByNormalizedTitle.set(normTitle, materialId);
    compendiaLoadedThisRun.push({ title: c.title, dependencies: c.dependencies });

    for (let i = 0; i < c.sections.length; i++) {
      const s = c.sections[i];
      const content = htmlToMarkdown(s.content_html);
      const mergedTakeaways: string[] = [];
      if (s.key_takeaways) mergedTakeaways.push(...s.key_takeaways);
      if (s.glossary_terms) {
        for (const g of s.glossary_terms) mergedTakeaways.push(`Termo: ${g.term} — ${g.translation_or_definition}`);
      }

      let sectionId: string | null = null;
      if (EXECUTE) {
        const { data: section, error: secErr } = await admin
          .from('material_sections')
          .insert({ material_id: materialId, sort_order: i, title: s.title, content, key_takeaways: mergedTakeaways })
          .select('id')
          .single();
        if (secErr) throw secErr;
        sectionId = section.id as string;
      }
      counts.sectionsCarregadas++;

      for (const img of s.images ?? []) {
        if (!/^https?:\/\//i.test(img.external_url)) {
          imagensPendentesUpload.push(`${slug} / "${s.title}": ${img.external_url}`);
        }
        if (EXECUTE) {
          const { error: assetErr } = await admin.from('content_assets').insert({
            material_section_id: sectionId,
            is_primary: false,
            storage_path: null,
            external_url: img.external_url,
            mime_type: inferMimeType(img.external_url),
            alt_text: img.alt_text,
            caption: img.caption,
            rights_status: img.license_or_rights,
            notes: img.source_note,
          });
          if (assetErr) throw assetErr;
        }
        counts.contentAssetsCarregados++;
      }
    }

    for (let i = 0; i < c.references.length; i++) {
      if (EXECUTE) {
        const { error: refErr } = await admin.from('material_references').insert({
          material_id: materialId,
          citation_text: c.references[i].raw_citation_text,
          source_id: null,
          sort_order: i,
        });
        if (refErr) throw refErr;
      }
      counts.materialReferencesCarregadas++;
    }

    log.push(`  ${c.sections.length} seções, ${c.references.length} referências.`);
    counts.compendiosCarregados++;
  }

  // dependencies — resolve por título normalizado contra tudo que existe/foi carregado
  for (const c of compendiaLoadedThisRun) {
    const fromId = materialIdByNormalizedTitle.get(normalizeTitle(c.title))!;
    for (const dep of c.dependencies) {
      const targetId = materialIdByNormalizedTitle.get(normalizeTitle(dep));
      if (targetId) {
        if (EXECUTE) {
          const { error } = await admin.from('material_dependencies').insert({ material_id: fromId, depends_on_material_id: targetId });
          if (error) throw error;
        }
        counts.dependenciasResolvidas++;
      } else {
        counts.dependenciasSemCorrespondencia.push(`${c.title} -> "${dep}"`);
      }
    }
  }

  log.push('\n=== Resumo ===');
  log.push(`Compêndios encontrados: ${counts.compendiosEncontrados}`);
  log.push(`Pulados (já existiam): ${counts.compendiosPulados}`);
  log.push(`Carregados${EXECUTE ? '' : ' (simulado)'}: ${counts.compendiosCarregados}`);
  log.push(`Sections: ${counts.sectionsCarregadas}`);
  log.push(`Content assets: ${counts.contentAssetsCarregados}`);
  log.push(`Material references: ${counts.materialReferencesCarregadas}`);
  log.push(`Dependencies resolvidas: ${counts.dependenciasResolvidas}`);
  log.push(`Dependencies sem correspondência: ${counts.dependenciasSemCorrespondencia.length}`);
  counts.dependenciasSemCorrespondencia.forEach((d) => log.push(`  - ${d}`));
  log.push(`\nImagens locais pendentes de upload pro Supabase Storage: ${imagensPendentesUpload.length}`);
  imagensPendentesUpload.forEach((i) => log.push(`  - ${i}`));

  const reportPath = path.join(__dirname, '..', `load-compendios.${EXECUTE ? 'execute' : 'dry-run'}.report.txt`);
  fs.writeFileSync(reportPath, log.lines.join('\n'));
  log.push(`\nRelatório salvo em: ${reportPath}`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
