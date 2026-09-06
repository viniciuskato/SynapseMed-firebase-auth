/**
 * Carga genérica das 393 questões de `Questões/_banco/banco-questoes.json`
 * (campo `.questoes[]`) para as tabelas questions/question_options/
 * question_option_keys/question_answer_keys (schema v2). Generaliza a lógica
 * de carga de QUESTÕES já usada em `load-pilot-cardiologia.ts` (que só
 * cobria as 40 questões hardcoded de Cardiologia/Insuficiência Cardíaca)
 * para o banco inteiro.
 *
 * Por padrão roda em modo --dry-run (não grava nada, só imprime o que
 * faria). Passar --execute para gravar de verdade, e mesmo assim SÓ contra
 * o Supabase LOCAL (mesma proteção de env de load-compendios.ts —
 * sobrescrever VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nas envs do
 * comando, nunca usar as do .env.local do repo, que por padrão apontam pro
 * projeto remoto).
 *
 * Uso:
 *   npx tsx scripts/load-questoes.ts                # dry-run, só relatório
 *   npx tsx scripts/load-questoes.ts --execute       # grava de verdade (local)
 *
 * ANTES desta carga foi checado (fora deste script) se
 * `Questões/_banco/correcoes.json` já está integralmente refletido em
 * banco-questoes.json: os 393 `questaoId` referenciados em correcoes.json
 * existem no banco, correcoes.atualizadoEm=2026-08-31 é anterior a
 * banco.atualizadoEm=2026-09-01, e a versaoEditorial das questões já reflete
 * as correções (ex.: endocardite-26 e sodio-agua-05, ambas nas correções,
 * estão em versaoEditorial=2/estadoEditorial=aprovada no banco). Não há
 * correção pendente de aplicar — este script não lê correcoes.json.
 *
 * DECISÕES DE CARGA (mapeamento banco-questoes.json -> schema Supabase):
 *
 *  1. `clinical_vignette` <- '' (banco-questoes.json não separa vinheta
 *     clínica de enunciado, mesma decisão do piloto — só existe "pergunta").
 *  2. `discipline`/`theme`: `classificacao.disciplina` e `classificacao.tema`
 *     via ensureDiscipline()/ensureTheme() (idênticas às de
 *     load-pilot-cardiologia.ts), casando por nome com o que já existe no
 *     banco (inclusive disciplinas criadas pela carga de compêndios).
 *  3. `difficulty` <- classificacao.complexidade via
 *     difficultyFromComplexidade() (Fundamental->facil, Aplicação->medio,
 *     Integração->dificil), idêntica à do piloto.
 *  4. `cycle` <- CYCLE_BY_DISCIPLINE de load-compendios.ts, casado pelo nome
 *     da disciplina. Disciplinas de banco-questoes.json sem entrada nesse
 *     mapa são reportadas como GAP no relatório (não é feito palpite).
 *  5. `explicacao` <- copiada para question_answer_keys.general_commentary
 *     E high_yield_summary (mesmo texto nos dois campos), mesma decisão do
 *     piloto — banco original não tem campo de resumo separado.
 *  6. `explicacaoPorAlternativa[].comentario` (casado por `indice`) <-
 *     question_option_keys.explanation por alternativa — diferença real
 *     frente ao piloto, que copiava a mesma `explicacao` para todas as
 *     alternativas por falta desse campo nas 40 questões de Cardiologia.
 *     Aqui, quando explicacaoPorAlternativa existe e cobre o índice, usa o
 *     comentário específico; senão cai de volta pra `explicacao` (mesmo
 *     comportamento do piloto) e isso é contado/reportado.
 *  7. `material_id`/`material_section_id` <- null (banco-questoes.json não
 *     tem vínculo com compêndio) e `institution`/`year` <- null.
 *  8. `competencia` <- classificacao.competencia; `editorial_state` <-
 *     estadoEditorial (colunas já existentes no schema v2, mesmos nomes
 *     usados em load-pilot-cardiologia.ts).
 *  9. Idempotência: como não há coluna de id externo em `questions`, a
 *     chave de "já existe" é a combinação exata
 *     (discipline_id, theme_id, question_stem) — se já houver uma linha com
 *     essa combinação, a questão inteira é pulada e reportada como "já
 *     existente" (mesmo padrão de load-compendios.ts com materials.title).
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
const BANCO_DIR = path.join(ONEDRIVE, 'Questões', '_banco');

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
// Tipos da fonte de dado (banco-questoes.json)
// ----------------------------------------------------------------------------

interface ExplicacaoPorAlternativa {
  indice: number;
  correta: boolean;
  comentario: string;
}

interface BancoQuestao {
  id: string;
  tema: string;
  categoria: string;
  tags: string[];
  pergunta: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
  referencias: string[];
  criadoEm: string;
  fonte: string;
  classificacao: {
    disciplina: string;
    disciplinasRelacionadas: string[];
    tema: string;
    subtema: string;
    competencia: string;
    complexidade: string;
    contexto: string;
  };
  versaoEditorial: number;
  estadoEditorial: string;
  auditoriaEditorial: unknown;
  proveniencia: unknown;
  evidencia: unknown;
  qualidadeDoItem: unknown;
  explicacaoPorAlternativa?: ExplicacaoPorAlternativa[];
}

// ----------------------------------------------------------------------------
// cycle por disciplina — reaproveitado de load-compendios.ts. Disciplinas de
// banco-questoes.json ausentes deste mapa são reportadas como gap, não
// adivinhadas (ver decisão #4 no cabeçalho).
// ----------------------------------------------------------------------------

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
  'Radiologia': 'clinico',
  'Fisiologia e fisiopatologia': 'basico',
  'Farmacologia': 'basico',
  'Neurocirurgia': 'clinico',
  'Gastroenterologia': 'clinico',
};

function difficultyFromComplexidade(complexidade: string): 'facil' | 'medio' | 'dificil' {
  if (complexidade === 'Fundamental') return 'facil';
  if (complexidade === 'Aplicação') return 'medio';
  return 'dificil'; // 'Integração'
}

// ----------------------------------------------------------------------------
// Helpers de disciplina/tema (upsert por nome, sem duplicar) — idênticos aos
// de load-pilot-cardiologia.ts / load-compendios.ts, com o padrão dry-run de
// load-compendios.ts (fake id, sem gravar).
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

async function ensureDiscipline(name: string, cycle: 'basico' | 'clinico' | 'internato_residencia'): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from('disciplines')
    .select('id, name, code')
    .ilike('name', name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    log.push(`  discipline "${name}" já existe (id=${existing.id}, code=${existing.code}) — reaproveitada, não duplicada.`);
    return existing.id as string;
  }
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
  if (!EXECUTE && disciplineId.startsWith('[dry-run-fake-id')) return `[dry-run-fake-id:theme:${disciplineId}:${name}]`;
  const { data: existing, error: selErr } = await admin
    .from('themes')
    .select('id')
    .eq('discipline_id', disciplineId)
    .eq('name', name)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    log.push(`  theme "${name}" já existe (id=${existing.id}) — reaproveitado, não duplicado.`);
    return existing.id as string;
  }
  if (!EXECUTE) return `[dry-run-fake-id:theme:${disciplineId}:${name}]`;
  const { data: created, error: insErr } = await admin
    .from('themes')
    .insert({ discipline_id: disciplineId, name })
    .select('id')
    .single();
  if (insErr) throw insErr;
  log.push(`  theme "${name}" criado (id=${created.id}).`);
  return created.id as string;
}

// ----------------------------------------------------------------------------
// Carga das questões
// ----------------------------------------------------------------------------

const counts = {
  questoesEncontradas: 0,
  questoesPuladasJaExistentes: 0,
  questoesCarregadas: 0,
  questionOptionsCarregadas: 0,
  alternativasSemExplicacaoEspecifica: 0,
};

const disciplinasSemCycle: Set<string> = new Set();

async function main() {
  log.push(`=== Carga de questões (${EXECUTE ? 'EXECUTE — grava de verdade' : 'DRY-RUN — não grava nada'}) ===`);
  log.push(`Supabase alvo: ${SUPABASE_URL}`);
  // Trava vale para QUALQUER modo, inclusive --dry-run (leituras já são
  // conexão real contra o banco indicado) — mesma proteção documentada em
  // load-compendios.ts. .env.local deste repo aponta por padrão pro projeto
  // REMOTO; nunca confiar nele aqui.
  if (!SUPABASE_URL.includes('127.0.0.1') && !SUPABASE_URL.includes('localhost') && !ALLOW_REMOTE) {
    throw new Error(
      `SUPABASE_URL (${SUPABASE_URL}) não é local — por padrão este script só conecta no local, nem em dry-run (que já faz leituras reais). Rode contra local assim: VITE_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<chave local> npx tsx scripts/load-questoes.ts. Para rodar contra remoto de propósito, passe --allow-remote explicitamente. Abortando antes de qualquer chamada de rede.`
    );
  }

  const banco: { questoes: BancoQuestao[] } = JSON.parse(
    fs.readFileSync(path.join(BANCO_DIR, 'banco-questoes.json'), 'utf8')
  );
  counts.questoesEncontradas = banco.questoes.length;
  log.push(`Questões encontradas em banco-questoes.json: ${banco.questoes.length}`);

  const disciplineIdByName = new Map<string, string>();
  const themeIdByKey = new Map<string, string>(); // key = `${disciplineId}::${tema}`
  const letters = ['A', 'B', 'C', 'D', 'E'] as const;

  for (const q of banco.questoes) {
    const disciplinaNome = q.classificacao.disciplina;
    const temaNome = q.classificacao.tema;

    let cycle = CYCLE_BY_DISCIPLINE[disciplinaNome];
    if (!cycle) {
      disciplinasSemCycle.add(disciplinaNome);
      cycle = 'clinico'; // fallback só pra permitir o dry-run seguir e reportar todos os gaps de uma vez; revisar antes de --execute
    }

    let disciplineId = disciplineIdByName.get(disciplinaNome);
    if (!disciplineId) {
      disciplineId = await ensureDiscipline(disciplinaNome, cycle);
      disciplineIdByName.set(disciplinaNome, disciplineId);
    }

    const themeKey = `${disciplineId}::${temaNome}`;
    let themeId = themeIdByKey.get(themeKey);
    if (!themeId) {
      themeId = await ensureTheme(disciplineId, temaNome);
      themeIdByKey.set(themeKey, themeId);
    }

    // idempotência: mesma combinação exata (discipline_id, theme_id, question_stem)
    let already = false;
    if (!disciplineId.startsWith('[dry-run-fake-id') && !themeId.startsWith('[dry-run-fake-id')) {
      const { data: existingQuestion, error: selErr } = await admin
        .from('questions')
        .select('id')
        .eq('discipline_id', disciplineId)
        .eq('theme_id', themeId)
        .eq('question_stem', q.pergunta)
        .maybeSingle();
      if (selErr) throw selErr;
      already = existingQuestion !== null;
    }

    if (already) {
      counts.questoesPuladasJaExistentes++;
      log.push(`[PULADA] "${q.id}" — já existe questão com mesma (discipline_id, theme_id, question_stem).`);
      continue;
    }

    const difficulty = difficultyFromComplexidade(q.classificacao.complexidade);

    let questionId: string;
    if (EXECUTE) {
      const { data: question, error: qErr } = await admin
        .from('questions')
        .insert({
          discipline_id: disciplineId,
          theme_id: themeId,
          material_id: null,
          material_section_id: null,
          cycle,
          difficulty,
          institution: null,
          year: null,
          clinical_vignette: '',
          question_stem: q.pergunta,
          tags: q.tags,
          status: 'draft',
          source: q.fonte,
          competencia: q.classificacao.competencia,
          editorial_state: q.estadoEditorial,
        })
        .select('id')
        .single();
      if (qErr) throw qErr;
      questionId = question.id as string;
    } else {
      questionId = `[dry-run-fake-id:question:${q.id}]`;
    }
    counts.questoesCarregadas++;

    const explicacaoPorIndice = new Map<number, string>();
    for (const e of q.explicacaoPorAlternativa ?? []) explicacaoPorIndice.set(e.indice, e.comentario);

    for (let i = 0; i < q.alternativas.length; i++) {
      counts.questionOptionsCarregadas++;
      const explicacaoAlternativa = explicacaoPorIndice.get(i);
      if (explicacaoAlternativa === undefined) counts.alternativasSemExplicacaoEspecifica++;

      if (EXECUTE) {
        const { data: option, error: optErr } = await admin
          .from('question_options')
          .insert({
            question_id: questionId,
            letter: letters[i],
            option_text: q.alternativas[i],
            sort_order: i,
          })
          .select('id')
          .single();
        if (optErr) throw optErr;

        const { error: keyErr } = await admin
          .from('question_option_keys')
          .update({
            is_correct: i === q.correta,
            explanation: explicacaoAlternativa ?? q.explicacao,
          })
          .eq('option_id', option.id);
        if (keyErr) throw keyErr;
      }
    }

    if (EXECUTE) {
      const { error: ansErr } = await admin.from('question_answer_keys').insert({
        question_id: questionId,
        general_commentary: q.explicacao,
        high_yield_summary: q.explicacao,
      });
      if (ansErr) throw ansErr;
    }
  }

  log.push('\n=== Disciplinas/temas ===');
  log.push(`Disciplinas distintas em banco-questoes.json: ${new Set(banco.questoes.map((q) => q.classificacao.disciplina)).size}`);
  log.push(`Temas distintos em banco-questoes.json: ${new Set(banco.questoes.map((q) => q.classificacao.tema)).size}`);

  log.push('\n=== Resumo ===');
  log.push(`Questões encontradas: ${counts.questoesEncontradas}`);
  log.push(`Puladas (já existentes): ${counts.questoesPuladasJaExistentes}`);
  log.push(`Carregadas${EXECUTE ? '' : ' (simulado)'}: ${counts.questoesCarregadas}`);
  log.push(`Question options: ${counts.questionOptionsCarregadas}`);
  log.push(
    `Alternativas sem explicação específica em explicacaoPorAlternativa (fallback pra "explicacao" geral): ${counts.alternativasSemExplicacaoEspecifica}`
  );
  log.push(`\nDisciplinas sem entrada em CYCLE_BY_DISCIPLINE (gap — revisar antes de --execute): ${disciplinasSemCycle.size}`);
  [...disciplinasSemCycle].forEach((d) => log.push(`  - ${d}`));

  const reportPath = path.join(__dirname, '..', `load-questoes.${EXECUTE ? 'execute' : 'dry-run'}.report.txt`);
  fs.writeFileSync(reportPath, log.lines.join('\n'));
  log.push(`\nRelatório salvo em: ${reportPath}`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
