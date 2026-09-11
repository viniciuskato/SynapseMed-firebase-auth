import { createClient } from '@supabase/supabase-js';

// Cliente Supabase (backend ativo em produção).
//
// Lê as credenciais do ambiente Vite. Em desenvolvimento local, aponte
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (em .env.local, não versionado)
// para a instância local do Supabase CLI (`supabase status` mostra os valores).

// Sob Vite (app real), as variáveis vêm de import.meta.env. Sob execução
// direta via tsx/node (ex.: scripts/validate-supabase-repos.ts, fora do
// bundle Vite), import.meta.env não existe — cai para process.env, que o
// script de validação popula a partir do mesmo .env.local via dotenv.
const env: Record<string, string | undefined> = (import.meta as unknown as { env?: Record<string, string> }).env ?? (
  typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {}
);

interface ResolvedConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

// `sb_secret_...` é a chave de SERVIÇO do Supabase (privilégios de
// service_role) — nunca pode ser aceita como anonKey/publishable key nem
// virar configuração válida no frontend, seja qual for a variável VITE_ onde
// aparecer por engano (Prompt 11-A/11-B, gate 9). O commit 274c846 (Google
// AI Studio) tinha reintroduzido um caminho que fazia exatamente isso: se
// VITE_SUPABASE_URL viesse com uma chave `sb_secret_` colada por engano, o
// código promovia esse valor para `anonKey` sempre que `VITE_SUPABASE_ANON_KEY`
// estivesse vazia ou também fosse uma secret — nenhum caminho impedia
// `sb_secret_` de chegar até `createClient`. fb989a4 (Google AI Studio,
// integração da nova arquitetura) não tocou este arquivo e manteve o mesmo
// código vulnerável.
function isSecretKey(value: string | undefined): boolean {
  return !!value && value.startsWith('sb_secret_');
}

function resolveConfig(): ResolvedConfig {
  let rawUrl = env.VITE_SUPABASE_URL?.trim();
  let rawKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  // Caso o usuário tenha colado a chave pública/publishable (ou, por engano,
  // a secret) no campo de URL.
  if (rawUrl && (rawUrl.startsWith('sb_publishable_') || rawUrl.startsWith('sb_secret_') || rawUrl.startsWith('eyJ'))) {
    const keyFromUrl = rawUrl;
    rawUrl = 'https://jfvhwwvixwvgjfqzlkkb.supabase.co';
    // NUNCA promove uma chave secreta para o lugar da anonKey, nem daqui nem
    // do valor bruto de VITE_SUPABASE_ANON_KEY — ver guarda final abaixo,
    // que cobre os dois casos de forma incondicional.
    if (!isSecretKey(keyFromUrl) && (!rawKey || isSecretKey(rawKey))) {
      rawKey = keyFromUrl;
    }
  }

  // Caso o usuário tenha informado apenas a referência do projeto
  if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    if (rawUrl.includes('.supabase.co')) {
      rawUrl = `https://${rawUrl}`;
    } else if (/^[a-z0-9_-]{10,40}$/i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}.supabase.co`;
    }
  }

  // Validação de formato de URL HTTP/HTTPS
  let isValid = false;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      isValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      isValid = false;
    }
  }

  // Guarda final, incondicional: `sb_secret_...` nunca é uma anonKey válida,
  // não importa de onde veio (VITE_SUPABASE_ANON_KEY diretamente, ou
  // promovida do campo de URL acima). Nunca loga o valor da chave.
  if (isSecretKey(rawKey)) {
    // eslint-disable-next-line no-console
    console.warn(
      '[supabaseClient] Uma variável VITE_SUPABASE_* contém uma chave secreta ' +
        '(sb_secret_...), não uma chave pública/anônima. Por segurança essa ' +
        'configuração foi rejeitada; operando em modo local resiliente.'
    );
    rawKey = undefined;
  }

  const isConfigured = Boolean(isValid && rawKey);
  return {
    url: isValid ? rawUrl! : 'https://placeholder.supabase.co',
    anonKey: rawKey || 'placeholder-anon-key',
    isConfigured,
  };
}

const resolved = resolveConfig();

export const isSupabaseConfigured = resolved.isConfigured;

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas ou inválidas. ' +
      'Operando em modo local resiliente com dados simulados.'
  );
}

function initSupabase() {
  try {
    return createClient(resolved.url, resolved.anonKey);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[supabaseClient] Falha ao inicializar createClient, usando fallback seguro:', err);
    return createClient('https://placeholder.supabase.co', 'placeholder-anon-key');
  }
}

export const supabase = initSupabase();
