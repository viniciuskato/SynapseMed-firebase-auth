// Verificação automatizada pequena (Prompt 11-A, item 5): prova que
// `resolveConfig` (src/lib/supabaseClient.ts) NUNCA aceita uma chave secreta
// do Supabase (`sb_secret_...`, privilégios de service_role) como
// anonKey/publishable key, não importa em qual variável VITE_SUPABASE_* ela
// apareça por engano — e que a configuração legítima (chave pública
// sb_publishable_, JWT anon legado, URL completa, domínio sem protocolo,
// referência de projeto) continua funcionando.
//
// Cada cenário roda em um processo `tsx` FILHO isolado
// (scripts/_check-secret-key-leak-child.ts), porque src/lib/supabaseClient.ts
// resolve a configuração e chama createClient() como efeito de módulo, uma
// única vez, no primeiro import — não dá para reimportar com um env.
// diferente no mesmo processo Node.
//
// Uso: npx tsx scripts/check-no-secret-key-leak.ts
// Saída: exit code 0 e "OK" por cenário se nenhum vazamento for encontrado;
// exit code 1 e mensagem descrevendo o cenário que falhou, caso contrário.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const childScript = path.join(__dirname, '_check-secret-key-leak-child.ts');

const REAL_PROJECT_URL = 'https://jfvhwwvixwvgjfqzlkkb.supabase.co';
const FAKE_SECRET = 'sb_secret_TESTONLY_11A_deveNuncaVirarAnonKey';
const FAKE_PUBLISHABLE = 'sb_publishable_TESTONLY_11A_ok';
const FAKE_LEGACY_ANON_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test-signature-not-real';

interface ChildResult {
  isConfigured: boolean;
  effectiveKey: string;
  effectiveUrl: string;
}

// Resolve o binário local do tsx diretamente (node_modules/.bin/tsx[.cmd]) e
// invoca via `process.execPath`, em vez de `npx.cmd` — em Node 22+/24 no
// Windows, `execFileSync('npx.cmd', ...)` falha com `spawnSync EINVAL`
// (quirk de resolução de `.cmd` sem `shell: true`; achado ao rodar este
// script no Prompt 11-B). Chamar o `.js` do tsx via `process.execPath`
// evita depender de resolução de shell/PATH por completo, e funciona igual
// em qualquer SO.
function resolveTsxEntry(): string {
  return require.resolve('tsx/cli', { paths: [path.join(__dirname, '..')] });
}

function runChild(env: Record<string, string | undefined>): ChildResult {
  const tsxCli = resolveTsxEntry();
  const raw = execFileSync(process.execPath, [tsxCli, childScript], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  });
  const lastLine = raw.trim().split('\n').filter(Boolean).pop() ?? '{}';
  return JSON.parse(lastLine) as ChildResult;
}

interface Scenario {
  name: string;
  env: Record<string, string | undefined>;
  assert: (r: ChildResult) => string | null; // retorna mensagem de erro, ou null se OK
}

const scenarios: Scenario[] = [
  {
    name: 'secret key colada em VITE_SUPABASE_URL',
    env: { VITE_SUPABASE_URL: FAKE_SECRET, VITE_SUPABASE_ANON_KEY: '' },
    assert: (r) => {
      if (r.effectiveKey === FAKE_SECRET || r.effectiveKey.startsWith('sb_secret_')) {
        return `chave efetiva contém a secret: ${r.effectiveKey}`;
      }
      if (r.isConfigured) return 'isConfigured deveria ser false (nenhuma anonKey válida sobrou)';
      return null;
    },
  },
  {
    name: 'secret key colada em VITE_SUPABASE_ANON_KEY (URL normal)',
    env: { VITE_SUPABASE_URL: REAL_PROJECT_URL, VITE_SUPABASE_ANON_KEY: FAKE_SECRET },
    assert: (r) => {
      if (r.effectiveKey === FAKE_SECRET || r.effectiveKey.startsWith('sb_secret_')) {
        return `chave efetiva contém a secret: ${r.effectiveKey}`;
      }
      if (r.isConfigured) return 'isConfigured deveria ser false (a única chave fornecida era a secret)';
      return null;
    },
  },
  {
    name: 'secret key em AMBAS as variáveis',
    env: { VITE_SUPABASE_URL: FAKE_SECRET, VITE_SUPABASE_ANON_KEY: FAKE_SECRET },
    assert: (r) => {
      if (r.effectiveKey === FAKE_SECRET || r.effectiveKey.startsWith('sb_secret_')) {
        return `chave efetiva contém a secret: ${r.effectiveKey}`;
      }
      if (r.isConfigured) return 'isConfigured deveria ser false';
      return null;
    },
  },
  // Regressão: configurações legítimas continuam aceitas normalmente.
  {
    name: 'regressão: chave pública sb_publishable_ colada na URL',
    env: { VITE_SUPABASE_URL: FAKE_PUBLISHABLE, VITE_SUPABASE_ANON_KEY: '' },
    assert: (r) => {
      if (r.effectiveKey !== FAKE_PUBLISHABLE) return `esperava a publishable como chave, veio: ${r.effectiveKey}`;
      if (!r.isConfigured) return 'isConfigured deveria ser true (chave pública válida)';
      return null;
    },
  },
  {
    name: 'regressão: JWT anon legado colado na URL',
    env: { VITE_SUPABASE_URL: FAKE_LEGACY_ANON_JWT, VITE_SUPABASE_ANON_KEY: '' },
    assert: (r) => {
      if (r.effectiveKey !== FAKE_LEGACY_ANON_JWT) return `esperava o JWT como chave, veio: ${r.effectiveKey}`;
      if (!r.isConfigured) return 'isConfigured deveria ser true (JWT anon legado válido)';
      return null;
    },
  },
  {
    name: 'regressão: URL completa + publishable key nos campos corretos',
    env: { VITE_SUPABASE_URL: REAL_PROJECT_URL, VITE_SUPABASE_ANON_KEY: FAKE_PUBLISHABLE },
    assert: (r) => {
      if (r.effectiveUrl.replace(/\/$/, '') !== REAL_PROJECT_URL) return `URL inesperada: ${r.effectiveUrl}`;
      if (r.effectiveKey !== FAKE_PUBLISHABLE) return `chave inesperada: ${r.effectiveKey}`;
      if (!r.isConfigured) return 'isConfigured deveria ser true';
      return null;
    },
  },
  {
    name: 'regressão: domínio sem protocolo',
    env: { VITE_SUPABASE_URL: 'jfvhwwvixwvgjfqzlkkb.supabase.co', VITE_SUPABASE_ANON_KEY: FAKE_PUBLISHABLE },
    assert: (r) => {
      if (r.effectiveUrl.replace(/\/$/, '') !== REAL_PROJECT_URL) return `URL inesperada: ${r.effectiveUrl}`;
      if (!r.isConfigured) return 'isConfigured deveria ser true';
      return null;
    },
  },
  {
    name: 'regressão: apenas referência do projeto',
    env: { VITE_SUPABASE_URL: 'jfvhwwvixwvgjfqzlkkb', VITE_SUPABASE_ANON_KEY: FAKE_PUBLISHABLE },
    assert: (r) => {
      if (r.effectiveUrl.replace(/\/$/, '') !== REAL_PROJECT_URL) return `URL inesperada: ${r.effectiveUrl}`;
      if (!r.isConfigured) return 'isConfigured deveria ser true';
      return null;
    },
  },
];

let failures = 0;
for (const scenario of scenarios) {
  try {
    const result = runChild(scenario.env);
    const error = scenario.assert(result);
    if (error) {
      failures++;
      // eslint-disable-next-line no-console
      console.error(`[FALHOU] ${scenario.name}: ${error}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[OK] ${scenario.name}`);
    }
  } catch (err) {
    failures++;
    // eslint-disable-next-line no-console
    console.error(`[ERRO] ${scenario.name}: processo filho falhou —`, err);
  }
}

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n${failures}/${scenarios.length} cenário(s) falharam.`);
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log(`\nTodos os ${scenarios.length} cenários passaram — sb_secret_ nunca vira anonKey.`);
}
