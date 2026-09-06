import { createClient } from '@supabase/supabase-js';

// Fase 3 — cliente Supabase (não conectado à produção ainda).
//
// Lê as credenciais do ambiente Vite. Em desenvolvimento local, aponte
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (em .env.local, não versionado)
// para a instância local do Supabase CLI (`supabase status` mostra os valores).
//
// Este cliente ainda não é usado pelos singletons `materialsRepository`/
// `questionsRepository` consumidos pelo app (App.tsx/AdminCMSView.tsx) — a
// troca fica para uma etapa futura, condicionada à migração de autenticação
// (Fase 5), já que as policies de escrita exigem um admin autenticado via
// Supabase Auth, e o app hoje autentica via Firebase.

// Sob Vite (app real), as variáveis vêm de import.meta.env. Sob execução
// direta via tsx/node (ex.: scripts/validate-supabase-repos.ts, fora do
// bundle Vite), import.meta.env não existe — cai para process.env, que o
// script de validação popula a partir do mesmo .env.local via dotenv.
const env: Record<string, string | undefined> = (import.meta as unknown as { env?: Record<string, string> }).env ?? (
  typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {}
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. ' +
      'O cliente Supabase não funcionará até que .env.local seja preenchido.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
