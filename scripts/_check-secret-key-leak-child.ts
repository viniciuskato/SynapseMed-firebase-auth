// Processo-filho usado por scripts/check-no-secret-key-leak.ts. Roda em um
// processo `tsx` isolado (não é possível reimportar src/lib/supabaseClient.ts
// com env diferentes no MESMO processo — os efeitos de módulo, inclusive
// createClient(), rodam só uma vez, no primeiro import). Este arquivo lê o
// cenário de VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY já presente no
// process.env (setado pelo pai antes de spawnar este processo), importa o
// módulo real do app (nenhuma reimplementação da lógica) e imprime em stdout,
// como uma única linha JSON, o que o app efetivamente resolveu — para o pai
// comparar contra o valor secreto usado no cenário.
import { isSupabaseConfigured, supabase } from '../src/lib/supabaseClient';

// eslint-disable-next-line no-console
console.log(
  JSON.stringify({
    isConfigured: isSupabaseConfigured,
    effectiveKey: (supabase as unknown as { supabaseKey: string }).supabaseKey,
    effectiveUrl: (supabase as unknown as { supabaseUrl: string }).supabaseUrl,
  })
);
