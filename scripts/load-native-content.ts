/**
 * Carga do conteúdo nativo do NexusMed — formato de autoria em YAML definido
 * em 2026-09-11 (ver memória `project_nexusmed_workflow_autoria_conteudo_
 * nativo` e os arquivos de exemplo em
 * `Estudos/Base de Estudos/Biblioteca/Medicina/<especialidade>/_nexusmed-nativo/`).
 *
 * Grava direto nas tabelas nativas do app (materials/material_sections/
 * material_references/questions/question_options/question_option_keys/
 * question_answer_keys), replicando exatamente os mesmos shapes de insert de
 * `SupabaseMaterialsRepository.saveCompendium` e
 * `SupabaseQuestionsRepository.saveQuestion` — mas rodando em Node, fora do
 * browser, então sem depender de sessão de usuário autenticado.
 *
 * Isto é um pipeline DIFERENTE de `load-compendios.ts` (que consome
 * `_extracted-supabase/*.json`, no schema `PilotCompendium` com
 * `content_html`, vindo da extração dos 33 compêndios legados em HTML). Este
 * script aqui é para conteúdo NOVO, autoral, sem HTML nenhum na origem.
 *
 * Uso:
 *   npx tsx scripts/load-native-content.ts <slug>              # dry-run
 *   npx tsx scripts/load-native-content.ts <slug> --execute    # grava (só local)
 *
 * Busca `<slug>.compendium.yaml` e `<slug>.questions.yaml` (opcional)
 * recursivamente em `Estudos/Base de Estudos/Biblioteca/Medicina/`.
 *
 * Idempotência: os ids de material/seção/questão são derivados
 * deterministicamente do slug legível usado no YAML (sha256 truncado,
 * formatado como uuid v4-like) — rodar de novo com o mesmo slug faz UPDATE
 * nas mesmas linhas (upsert), nunca duplica.
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });

const EXECUTE = process.argv.includes('--execute');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');
const slugArg = process.argv.slice(2).find((a) => !a.startsWith('--'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ONEDRIVE = 'C:\\Users\\vinic\\OneDrive';
const MEDICINA_DIR = path.join(ONEDRIVE, 'Estudos', 'Base de Estudos', 'Biblioteca', 'Medicina');

function log(...args: unknown[]) {
  console.log(...args);
}

/** UUID v4-like determinístico, derivado do texto de entrada (sha256 truncado). */
function deterministicUuid(input: string): string {
  const hash = crypto.createHash('sha256').update(input).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function findFileRecursive(dir: string, filename: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return full;
    }
  }
  return null;
}

function slugifyCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

async function ensureDiscipline(name: string, cycle: string): Promise<string> {
  const { data: existing, error: selErr } = await admin.from('disciplines').select('id').ilike('name', name).maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id as string;
  if (!EXECUTE) return `[dry-run-fake-id:discipline:${name}]`;
  const { data: created, error: insErr } = await admin
    .from('disciplines')
    .insert({ name, code: slugifyCode(name), cycle })
    .select('id')
    .single();
  if (insErr) throw insErr;
  log(`  discipline "${name}" criada (id=${created.id}).`);
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
  log(`  theme "${name}" criado (id=${created.id}).`);
  return created.id as string;
}

// ----------------------------------------------------------------------------
// Tipos do formato de autoria (YAML)
// ----------------------------------------------------------------------------

interface YamlSection {
  id: string;
  title: string;
  mechanismTag?: string;
  content: string;
  keyTakeaways?: string[];
  clinicalPearl?: string;
  warningAlert?: string;
}

interface YamlCompendium {
  id: string;
  title: string;
  subtitle?: string;
  disciplineName: string;
  themeName: string;
  author?: string;
  estimatedReadTimeMinutes?: number;
  tags?: string[];
  sections: YamlSection[];
  references?: string[];
}

interface YamlOption {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  isCorrect: boolean;
  explanation: string;
}

interface YamlQuestion {
  id: string;
  compendiumSection: string;
  difficulty: string;
  tags?: string[];
  // Sobrescreve institution/year do arquivo quando presente — usado por
  // questões de prova real dentro de um arquivo cujo padrão é autoral (ou
  // vice-versa). Ver YamlQuestionsFile.institution/year.
  institution?: string;
  year?: number;
  clinicalVignette: string;
  questionStem: string;
  options: YamlOption[];
  generalCommentary?: string;
  highYieldSummary?: string;
}

interface YamlQuestionsFile {
  disciplineName: string;
  themeName: string;
  cycle: string;
  institution?: string;
  year?: number;
  questions: YamlQuestion[];
}

// ----------------------------------------------------------------------------

async function main() {
  if (!slugArg) {
    throw new Error('Uso: npx tsx scripts/load-native-content.ts <slug> [--execute] [--allow-remote]');
  }
  log(`=== Carga de conteúdo nativo "${slugArg}" (${EXECUTE ? 'EXECUTE — grava de verdade' : 'DRY-RUN — não grava nada'}) ===`);
  log(`Supabase alvo: ${SUPABASE_URL}`);
  if (!SUPABASE_URL.includes('127.0.0.1') && !SUPABASE_URL.includes('localhost') && !ALLOW_REMOTE) {
    throw new Error(
      `SUPABASE_URL (${SUPABASE_URL}) não é local — por padrão este script só conecta no local, nem em dry-run. Rode: VITE_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<chave local> npx tsx scripts/load-native-content.ts ${slugArg}. Para remoto de propósito, passe --allow-remote explicitamente.`
    );
  }

  const compendiumPath = findFileRecursive(MEDICINA_DIR, `${slugArg}.compendium.yaml`);
  if (!compendiumPath) throw new Error(`Não encontrei ${slugArg}.compendium.yaml em ${MEDICINA_DIR}`);
  const compendium = yaml.load(fs.readFileSync(compendiumPath, 'utf8')) as YamlCompendium;
  log(`Compêndio: "${compendium.title}" (${compendium.sections.length} seções, ${compendium.references?.length ?? 0} referências)`);
  log(`  arquivo: ${compendiumPath}`);

  const questionsPath = findFileRecursive(MEDICINA_DIR, `${slugArg}.questions.yaml`);
  const questionsFile = questionsPath ? (yaml.load(fs.readFileSync(questionsPath, 'utf8')) as YamlQuestionsFile) : null;
  if (questionsFile) {
    log(`Questões: ${questionsFile.questions.length} encontradas`);
    log(`  arquivo: ${questionsPath}`);
  } else {
    log('Nenhum arquivo de questões encontrado — carregando só o compêndio.');
  }

  const disciplineId = await ensureDiscipline(compendium.disciplineName, 'clinico');
  const themeId = await ensureTheme(disciplineId, compendium.themeName);

  const materialId = deterministicUuid(`material:${compendium.id}`);
  const sectionIdBySlug = new Map<string, string>();
  for (const s of compendium.sections) {
    sectionIdBySlug.set(s.id, deterministicUuid(`section:${compendium.id}:${s.id}`));
  }

  const materialRow = {
    id: materialId,
    discipline_id: disciplineId,
    theme_id: themeId,
    title: compendium.title,
    subtitle: compendium.subtitle || null,
    mode: null,
    study_lens: null,
    estimated_read_time_minutes: compendium.estimatedReadTimeMinutes ?? null,
    author: compendium.author || null,
    tags: compendium.tags ?? [],
  };
  log(`\n--- materials (id=${materialId}) ---`);
  log(`  title: "${materialRow.title}"`);
  if (EXECUTE) {
    const { error } = await admin.from('materials').upsert(materialRow);
    if (error) throw error;
    const { error: delSecErr } = await admin.from('material_sections').delete().eq('material_id', materialId);
    if (delSecErr) throw delSecErr;
    const { error: delRefErr } = await admin.from('material_references').delete().eq('material_id', materialId);
    if (delRefErr) throw delRefErr;
  }

  if (compendium.sections.length > 0) {
    const sectionRows = compendium.sections.map((s, i) => ({
      id: sectionIdBySlug.get(s.id),
      material_id: materialId,
      sort_order: i,
      title: s.title,
      mechanism_tag: s.mechanismTag ?? null,
      content: s.content,
      key_takeaways: s.keyTakeaways ?? [],
      clinical_pearl: s.clinicalPearl ?? null,
      warning_alert: s.warningAlert ?? null,
    }));
    log(`\n--- material_sections (${sectionRows.length}) ---`);
    sectionRows.forEach((r) => log(`  [${r.sort_order}] ${r.title} (id=${r.id})`));
    if (EXECUTE) {
      const { error } = await admin.from('material_sections').insert(sectionRows);
      if (error) throw error;
    }
  }

  if (compendium.references && compendium.references.length > 0) {
    const refRows = compendium.references.map((text, i) => ({
      material_id: materialId,
      citation_text: text,
      sort_order: i,
    }));
    log(`\n--- material_references (${refRows.length}) ---`);
    if (EXECUTE) {
      const { error } = await admin.from('material_references').insert(refRows);
      if (error) throw error;
    }
  }

  if (questionsFile) {
    const qDisciplineId = await ensureDiscipline(questionsFile.disciplineName, 'clinico');
    const qThemeId = await ensureTheme(qDisciplineId, questionsFile.themeName);

    for (const q of questionsFile.questions) {
      const questionId = deterministicUuid(`question:${q.id}`);
      const sectionId = sectionIdBySlug.get(q.compendiumSection) ?? null;
      if (!sectionId) {
        log(`[AVISO] questão "${q.id}" referencia seção "${q.compendiumSection}" que não existe no compêndio — material_section_id ficará null.`);
      }

      const questionRow = {
        id: questionId,
        discipline_id: qDisciplineId,
        theme_id: qThemeId,
        material_id: materialId,
        material_section_id: sectionId,
        cycle: questionsFile.cycle,
        difficulty: q.difficulty,
        institution: q.institution ?? questionsFile.institution ?? null,
        year: q.year ?? questionsFile.year ?? null,
        clinical_vignette: q.clinicalVignette,
        question_stem: q.questionStem,
        tags: q.tags ?? [],
      };
      log(`\n--- questions: ${q.id} (id=${questionId}, seção=${q.compendiumSection}) ---`);
      if (EXECUTE) {
        const { error: qErr } = await admin.from('questions').upsert(questionRow);
        if (qErr) throw qErr;

        const { error: akErr } = await admin.from('question_answer_keys').upsert({
          question_id: questionId,
          general_commentary: q.generalCommentary || '',
          high_yield_summary: q.highYieldSummary || '',
        });
        if (akErr) throw akErr;

        const { error: delErr } = await admin.from('question_options').delete().eq('question_id', questionId);
        if (delErr) throw delErr;

        const optionRows = q.options.map((o, i) => ({
          question_id: questionId,
          letter: o.letter,
          option_text: o.text,
          sort_order: i,
        }));
        const { data: insertedOptions, error: insErr } = await admin.from('question_options').insert(optionRows).select('*');
        if (insErr) throw insErr;

        const optionKeyRows = (insertedOptions ?? []).map((row: { id: string; letter: string }) => {
          const original = q.options.find((o) => o.letter === row.letter);
          return {
            option_id: row.id,
            is_correct: original?.isCorrect ?? false,
            explanation: original?.explanation ?? '',
          };
        });
        if (optionKeyRows.length > 0) {
          const { error: okErr } = await admin.from('question_option_keys').upsert(optionKeyRows);
          if (okErr) throw okErr;
        }
      }
    }
  }

  log(`\n=== ${EXECUTE ? 'Carga concluída' : 'Dry-run concluído — nada foi gravado'} ===`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
