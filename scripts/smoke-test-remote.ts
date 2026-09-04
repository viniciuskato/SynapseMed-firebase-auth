/**
 * Fase 3 — teste de fumaça das implementações Supabase de MaterialsRepository
 * e QuestionsRepository contra o projeto Supabase REMOTO (produção real,
 * ainda sem conteúdo). Objetivo: confirmar que os repositórios funcionam
 * de verdade contra o remoto antes de migrar conteúdo, sem deixar nenhum
 * rastro de dado de teste no banco ao final.
 *
 * Diferenças em relação a scripts/validate-supabase-repos.ts (que roda
 * contra o Supabase LOCAL):
 *  - Escopo mínimo: 1 discipline, 1 theme, 1 material, 1 question (não o
 *    conjunto completo de casos de RLS/update).
 *  - Não existe container Docker local para promover o usuário de teste a
 *    admin via `docker exec psql`. Em vez disso, o script roda em DUAS
 *    execuções separadas (não usa prompt interativo, pois roda melhor em
 *    processos não-TTY):
 *      `npx tsx scripts/smoke-test-remote.ts setup` — cria o usuário de
 *        teste, imprime o e-mail e o SQL de promoção, salva o estado em
 *        .smoke-test-remote-state.json (git-ignorado) e para.
 *      (humano roda o SQL impresso no SQL Editor do dashboard remoto)
 *      `npx tsx scripts/smoke-test-remote.ts run` — lê o estado salvo,
 *        autentica, exercita CRUD, limpa os dados e o usuário de teste, e
 *        apaga o arquivo de estado.
 *  - O usuário de teste é sempre excluído ao final do `run` (sucesso ou
 *    falha) via try/finally. Se `run` nunca for chamado, o usuário fica
 *    órfão — rode `setup` de novo só depois de confirmar limpeza manual.
 *
 * Roda fora do app Vite: `npx tsx scripts/smoke-test-remote.ts <setup|run>`.
 * Requer um .env.local apontando para o projeto remoto (VITE_SUPABASE_URL,
 * VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) — nunca committar.
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });

// Importado DEPOIS de popular process.env, pois supabaseClient.ts lê o
// ambiente no momento do import (top-level).
const { supabase } = await import('../src/lib/supabaseClient.js');
const { SupabaseMaterialsRepository } = await import('../src/repositories/SupabaseMaterialsRepository.js');
const { SupabaseQuestionsRepository } = await import('../src/repositories/SupabaseQuestionsRepository.js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em .env.local. Abortando sem tocar em nada.');
  process.exit(1);
}
if (SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost')) {
  console.error('VITE_SUPABASE_URL aponta para localhost — este script é só para o projeto REMOTO. Abortando.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const materialsRepo = new SupabaseMaterialsRepository();
const questionsRepo = new SupabaseQuestionsRepository();

type StepResult = { name: string; ok: boolean; detail?: string };
const results: StepResult[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name}${detail ? ' — ' + detail : ''}`);
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const parts = [anyErr.message, anyErr.details, anyErr.hint, anyErr.code]
      .filter((v) => v !== undefined && v !== null && v !== '')
      .map(String);
    if (parts.length > 0) return parts.join(' | ');
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const value = await fn();
    record(name, true);
    return value;
  } catch (err) {
    record(name, false, stringifyError(err));
    return undefined;
  }
}

const STATE_FILE = path.resolve(__dirname, '..', '.smoke-test-remote-state.json');
const TEST_PASSWORD = 'SmokeTesteRemoto!2026';

type State = {
  testEmail: string;
  testUserId: string;
  createdIds: {
    disciplineId: string;
    themeId: string;
    materialId: string;
    sectionId: string;
    questionId: string;
  };
};

let testUserId: string | null = null;
let TEST_EMAIL = '';
let createdIds = {
  disciplineId: '',
  themeId: '',
  materialId: '',
  sectionId: '',
  questionId: '',
};

async function cleanupData() {
  console.log('\n--- Limpeza de dados de teste (best-effort, via service_role) ---');
  await admin.from('questions').delete().eq('id', createdIds.questionId);
  await admin.from('materials').delete().eq('id', createdIds.materialId);
  await admin.from('themes').delete().eq('id', createdIds.themeId);
  await admin.from('disciplines').delete().eq('id', createdIds.disciplineId);
}

async function cleanupUser() {
  if (testUserId) {
    console.log('--- Excluindo usuário de teste (best-effort, via service_role) ---');
    await admin.auth.admin.deleteUser(testUserId);
  }
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

async function runSetup() {
  console.log('=== Teste de fumaça — Supabase REMOTO (jfvhwwvixwvgjfqzlkkb) — SETUP ===\n');

  if (fs.existsSync(STATE_FILE)) {
    console.error(
      `Arquivo de estado ${STATE_FILE} já existe — provavelmente há um setup anterior pendente.\n` +
        'Confirme se o usuário de teste dele já foi limpo antes de rodar setup de novo (rode "run" ou apague manualmente).',
    );
    process.exit(1);
  }

  TEST_EMAIL = `smoke-remote-${Date.now()}@synapsemed.local`;
  createdIds = {
    disciplineId: crypto.randomUUID(),
    themeId: crypto.randomUUID(),
    materialId: crypto.randomUUID(),
    sectionId: crypto.randomUUID(),
    questionId: crypto.randomUUID(),
  };

  await step('1. Criar usuário de teste via GoTrue admin API', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    testUserId = data.user.id;
  });

  if (!testUserId) {
    console.log('\nAbortando: não foi possível criar o usuário de teste.');
    printSummary();
    process.exit(1);
  }

  const state: State = { testEmail: TEST_EMAIL, testUserId, createdIds };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log(`\n>>> Usuário de teste criado: ${TEST_EMAIL}`);
  console.log('>>> Rode agora no SQL Editor do dashboard REMOTO (projeto jfvhwwvixwvgjfqzlkkb):');
  console.log(`>>>   update public.profiles set role = 'admin', status = 'active' where email = '${TEST_EMAIL}';`);
  console.log('\n>>> Depois de rodar o SQL, execute: npx tsx scripts/smoke-test-remote.ts run');
  printSummary();
}

async function main() {
  console.log('=== Teste de fumaça — Supabase REMOTO (jfvhwwvixwvgjfqzlkkb) — RUN ===\n');

  if (!fs.existsSync(STATE_FILE)) {
    console.error(`Arquivo de estado ${STATE_FILE} não encontrado. Rode "setup" primeiro.`);
    process.exit(1);
  }
  const state: State = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  TEST_EMAIL = state.testEmail;
  testUserId = state.testUserId;
  createdIds = state.createdIds;
  console.log(`Retomando com usuário de teste: ${TEST_EMAIL}\n`);

  await step('2. Autenticar como admin via signInWithPassword (cliente anon)', async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (error) throw error;
  });

  const discipline = {
    id: createdIds.disciplineId,
    name: 'Cardiologia (Smoke Test Remoto)',
    code: `SMOKE-REMOTE-${Date.now()}`,
    icon: 'heart',
    description: 'Disciplina criada pelo teste de fumaça remoto.',
    cycle: 'clinico' as const,
    color: '#ff0000',
  };
  await step('3. Criar discipline via SupabaseMaterialsRepository.saveDisciplines', async () => {
    await materialsRepo.saveDisciplines([discipline]);
  });
  await step('4. Ler discipline de volta e conferir round-trip', async () => {
    const all = await materialsRepo.getDisciplines();
    const found = all.find((d) => d.id === discipline.id);
    if (!found) throw new Error('discipline não encontrada após save');
    if (found.name !== discipline.name || found.code !== discipline.code) {
      throw new Error('campos não batem com o que foi salvo');
    }
  });

  const theme = {
    id: createdIds.themeId,
    disciplineId: discipline.id,
    name: 'Insuficiência Cardíaca (Smoke Test Remoto)',
    description: 'Tema criado pelo teste de fumaça remoto.',
    highYield: true,
    order: 0,
  };
  await step('5. Criar theme via SupabaseMaterialsRepository.saveThemes', async () => {
    await materialsRepo.saveThemes([theme]);
  });
  await step('6. Ler theme de volta e conferir round-trip', async () => {
    const all = await materialsRepo.getThemes();
    const found = all.find((t) => t.id === theme.id);
    if (!found) throw new Error('theme não encontrado após save');
    if (found.highYield !== true || found.disciplineId !== discipline.id) {
      throw new Error('campos não batem com o que foi salvo');
    }
  });

  const compendium = {
    id: createdIds.materialId,
    disciplineId: discipline.id,
    themeId: theme.id,
    title: 'Atlas de Insuficiência Cardíaca (Smoke Test Remoto)',
    subtitle: 'Subtítulo de teste',
    estimatedReadTimeMinutes: 12,
    lastUpdated: new Date().toISOString(),
    author: 'Script de Smoke Test',
    mode: 'atlas' as const,
    studyLens: 'fisiopatologia' as const,
    tags: ['smoke-test-remoto'],
    sections: [
      {
        id: createdIds.sectionId,
        title: 'Fisiopatologia',
        mechanismTag: 'Fisiopatologia',
        content: 'Conteúdo de teste da seção.',
        keyTakeaways: ['Ponto-chave 1'],
        clinicalPearl: 'Pérola clínica de teste.',
        warningAlert: 'Alerta de teste.',
      },
    ],
    references: ['Referência de teste 1'],
  };
  await step('7. Criar material (compendium) via saveCompendium', async () => {
    await materialsRepo.saveCompendium(compendium);
  });
  await step('8. Ler compendium de volta e conferir round-trip (material + seção + referência)', async () => {
    const all = await materialsRepo.getCompendiums();
    const found = all.find((c) => c.id === compendium.id);
    if (!found) throw new Error('compendium não encontrado após save');
    if (found.sections.length !== 1 || found.sections[0].title !== 'Fisiopatologia') {
      throw new Error('seção não bateu no round-trip');
    }
    if (found.references.length !== 1) {
      throw new Error('referências não bateram no round-trip');
    }
  });

  const question = {
    id: createdIds.questionId,
    disciplineId: discipline.id,
    themeId: theme.id,
    compendiumRefId: compendium.id,
    compendiumSectionId: undefined,
    cycle: 'clinico' as const,
    difficulty: 'medio' as const,
    institution: 'USP (Smoke Test Remoto)',
    year: 2026,
    clinicalVignette: 'Vinheta clínica de teste.',
    questionStem: 'Enunciado de teste?',
    options: [
      { letter: 'A' as const, text: 'Alternativa A', isCorrect: false, explanation: 'Explicação A' },
      { letter: 'B' as const, text: 'Alternativa B', isCorrect: true, explanation: 'Explicação B' },
      { letter: 'C' as const, text: 'Alternativa C', isCorrect: false, explanation: 'Explicação C' },
    ],
    generalCommentary: 'Comentário geral de teste.',
    highYieldSummary: 'Resumo de alto rendimento de teste.',
    tags: ['smoke-test-remoto'],
  };
  await step('9. Criar question via SupabaseQuestionsRepository.saveQuestion', async () => {
    await questionsRepo.saveQuestion(question);
  });
  await step('10. Ler question de volta e conferir round-trip (opções + gabarito)', async () => {
    const all = await questionsRepo.getQuestions();
    const found = all.find((q) => q.id === question.id);
    if (!found) throw new Error('question não encontrada após save');
    if (found.options.length !== 3) throw new Error(`esperava 3 opções, achou ${found.options.length}`);
    const correct = found.options.filter((o) => o.isCorrect);
    if (correct.length !== 1 || correct[0].letter !== 'B') {
      throw new Error('alternativa correta não bateu no round-trip');
    }
  });

  await step('11. Excluir question via deleteQuestion e confirmar ausência', async () => {
    await questionsRepo.deleteQuestion(question.id);
    const all = await questionsRepo.getQuestions();
    if (all.some((q) => q.id === question.id)) throw new Error('question ainda presente após delete');
  });
  await step('12. Excluir material via deleteCompendium e confirmar ausência', async () => {
    await materialsRepo.deleteCompendium(compendium.id);
    const all = await materialsRepo.getCompendiums();
    if (all.some((c) => c.id === compendium.id)) throw new Error('compendium ainda presente após delete');
  });
  await step('13. Excluir theme e confirmar ausência', async () => {
    await admin.from('themes').delete().eq('id', theme.id);
    const all = await materialsRepo.getThemes();
    if (all.some((t) => t.id === theme.id)) throw new Error('theme ainda presente após delete');
  });
  await step('14. Excluir discipline e confirmar ausência', async () => {
    await admin.from('disciplines').delete().eq('id', discipline.id);
    const all = await materialsRepo.getDisciplines();
    if (all.some((d) => d.id === discipline.id)) throw new Error('discipline ainda presente após delete');
  });

  await step('15. signOut', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  });
}

function printSummary() {
  console.log('\n=== Resumo ===');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`${passed}/${results.length} passos OK`);
  if (failed.length > 0) {
    console.log('Falharam:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
  process.exitCode = failed.length > 0 ? 1 : 0;
}

async function run() {
  const mode = process.argv[2];
  if (mode === 'setup') {
    await runSetup();
    return;
  }
  if (mode !== 'run') {
    console.error('Uso: npx tsx scripts/smoke-test-remote.ts <setup|run>');
    process.exit(1);
  }

  try {
    await main();
  } catch (err) {
    console.error('Erro fatal no teste de fumaça:', err);
    process.exitCode = 1;
  } finally {
    // Garantia: mesmo em caso de erro no meio, tenta apagar tudo.
    await cleanupData().catch((e) => console.error('Falha na limpeza de dados:', stringifyError(e)));
    await cleanupUser().catch((e) => console.error('Falha na exclusão do usuário de teste:', stringifyError(e)));
    printSummary();
  }
}

run();
