#!/usr/bin/env node
// `npm run test` — testes existentes do projeto são os pgTAP em
// supabase/tests/database/*.test.sql, executados via `supabase test db`
// contra o Supabase LOCAL (nunca o remoto — ver AGENTS.md).
//
// Exigir Docker/Supabase local rodando como pré-condição *obrigatória* de
// `npm run verify` quebraria o barramento em qualquer máquina sem o stack
// local de pé (ex.: uma CI sem Docker, ou uma sessão que só quer validar
// TypeScript/lint/build). Por isso: se o Supabase local não estiver
// disponível, este script avisa claramente e sai com sucesso (skip), em
// vez de fingir que os testes passaram ou travar o gate inteiro por causa
// de infraestrutura ausente. Quando o stack local ESTÁ de pé, os testes
// rodam de verdade e uma falha real derruba `npm run verify`.
import { spawnSync } from 'node:child_process';

function run(command, args) {
  return spawnSync(command, args, { shell: true, encoding: 'utf8' });
}

const status = run('supabase', ['status']);

const supabaseCliMissing = status.error != null;
const localStackDown =
  status.status !== 0 ||
  /DB_URL/.test(status.stdout ?? '') === false;

if (supabaseCliMissing) {
  console.warn(
    'test: CLI da Supabase não encontrada no PATH — pulando pgTAP (supabase/tests/database). ' +
      'Instale a CLI e rode `supabase start` para executar os testes de verdade.',
  );
  process.exit(0);
}

if (localStackDown) {
  console.warn(
    'test: Supabase LOCAL não está rodando (`supabase status` não retornou DB_URL) — ' +
      'pulando pgTAP (supabase/tests/database). Rode `supabase start` e tente de novo ' +
      'para executar os testes de verdade contra o schema local.',
  );
  process.exit(0);
}

console.log('test: Supabase local detectado — rodando `supabase test db` (pgTAP)...');
const result = run('supabase', ['test', 'db']);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
