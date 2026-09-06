# Roteiro de Migração Firebase → Supabase

> Este documento acompanha o roteiro; a Etapa 1 foi executada e validada localmente.

## Etapa 1 (esta etapa) — Fundação local Supabase

Entregue:

- Modelo PostgreSQL completo (`supabase/migrations/20260903120000_initial_schema.sql`).
- RLS, funções e triggers de segurança/integridade editorial (`supabase/migrations/20260903120100_rls_policies.sql`).
- Políticas de Storage (`supabase/migrations/20260903120200_storage_policies.sql`).
- Seed local mínimo, não sensível (`supabase/seed.sql`).
- Suíte de testes pgTAP (`supabase/tests/database/rls_policies.test.sql`) — **executada em 2026-09-05: 80/80 asserções passando**.
- Documentação de esquema (`supabase-schema.md`).

Explicitamente fora do escopo desta etapa (não foi feito):

- Nenhuma conexão do frontend React ao Supabase.
- Nenhuma instalação de `@supabase/supabase-js`.
- Nenhum projeto Supabase remoto criado.
- Nenhuma migração executada contra um banco real (local ou remoto).
- Nenhum dado real do Firebase/Firestore/localStorage/OneDrive migrado.
- Firebase Authentication, Firestore, Firebase Hosting e o app React atual continuam intocados e funcionais.

## Testes: planejado vs. executado

| Categoria | Quantidade | Executado? |
|---|---|---|
| Casos pgTAP (`rls_policies.test.sql`) | 80 asserções (`select plan(80)`) | **Sim** — executado em 2026-09-05 contra Supabase CLI 2.116.0 + Docker local; todos passaram. |
| Verificação estática de `config.toml` | 1 (schema `app` fora de `[api].schemas`) | **Sim**, nesta etapa, por leitura direta do arquivo (não requer banco). |
| Integração HTTP (`/rest/v1/rpc/is_admin_active` deve ser rota inexistente) | 1 | **Parcial** — PostgREST local respondeu 404 para os helpers `app.*`, como esperado; as RPCs públicas também não apareceram no catálogo HTTP, embora existam no schema SQL e tenham `EXECUTE` para `authenticated`. Investigar a política de exposição/grants antes da conexão do frontend. |
| Integração concorrente (`publish_question` sob corrida com edição simultânea de alternativa) | 1 (documentado na seção "Concorrência na publicação" de `supabase-schema.md`) | **Não** — pgTAP roda em uma única sessão/transação e não consegue abrir duas conexões concorrentes; precisa de um script de duas sessões psql (ou pgbench) contra um Postgres real. Não é uma asserção `pgTAP`. |

O resultado de execução do pgTAP foi obtido de fato contra a stack local: 80/80 asserções passaram em 2026-09-05, inclusive em duas execuções consecutivas sem reset. Durante essa validação, quatro fixtures com identificadores fixos foram tornados idempotentes (emails de usuários, código de disciplina, id de fonte e nome de objeto no Storage).

### Correção de auditoria (esta revisão)

Uma auditoria independente encontrou 4 problemas de implementação que foram corrigidos nesta revisão, sem execução remota:

1. Fixtures de teste faziam `UPDATE question_option_keys` sem que a linha existisse (nenhum `INSERT` prévio) — corrigido com a Estratégia A: trigger `AFTER INSERT` em `question_options` que cria a key automaticamente.
2. `publish_question` não validava `option_key_count = option_count`, nem que `general_commentary`/`high_yield_summary` fossem não vazios — corrigido.
3. Fixtures chamavam `publish_question()` sem autenticar `v_admin` primeiro (função exigia `app.is_admin_active(auth.uid())` com `auth.uid()` nulo) — corrigido, fixtures agora autenticam `v_admin` antes de qualquer chamada real à RPC.
4. Ausência de proteção contra corrida entre `publish_question` e edição concorrente de alternativas — corrigido com `SELECT ... FOR UPDATE` em ordem determinística (ver `supabase-schema.md`).
5. `'casos_pratica'` removido do `CHECK` de `materials.study_lens` (módulo de Casos Clínicos não deve ter nenhum resquício funcional; os valores válidos de lente de estudo agora são apenas fisiopatologia/diagnostico/conduta/farmacologia/alto_rendimento). **Atualização**: a divergência com `src/` mencionada nesta linha em revisão anterior foi corrigida em rodada posterior — `src/types/index.ts` (união `StudyLens`) e `src/components/compendium/CompendiumView.tsx` (entrada `id: 'casos_pratica'` em `STUDY_LENSES`) não usam mais `'casos_pratica'`; frontend e schema Supabase estão alinhados nesse ponto.

## Pré-requisitos para rodar a suíte pgTAP

1. Instalar Docker Desktop (ou daemon Docker equivalente).
2. Instalar o Supabase CLI (`npm install -g supabase` ou via `scoop`/`brew`, conforme plataforma).
3. `supabase init` (para regenerar `config.toml` no formato oficial da versão instalada — o atual foi escrito à mão e deve ser conferido).
4. `supabase start` (sobe Postgres local + Auth + Storage + PostgREST).
5. `supabase db reset` (aplica migrações + `seed.sql`).
6. `supabase test db` (roda `rls_policies.test.sql`).

## Etapas futuras (não iniciadas, apenas indicadas)

1. **Primeiro administrador**: operação administrativa direta (fora do frontend) para promover um perfil a `role='admin', status='active'` — nunca por variável de ambiente manipulável no navegador nem por código público. A definir com o usuário quando a etapa de conexão real começar.
2. **Sincronização de `profiles.email`**: avaliar trigger em `auth.users` (`AFTER UPDATE OF email`) reaproveitando a mesma técnica de `current_user = 'postgres'` já usada para `role`/`status`.
3. **Conexão do frontend**: instalar `@supabase/supabase-js`, criar client paralelo ao Firebase (sem remover Firebase), variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.
4. **Inventário e migração controlada de dados reais**: Base de Estudos, Biblioteca/Medicina, Questões (OneDrive) — etapa própria, com leitura explicitamente autorizada, fora do escopo desta etapa.
5. **Migração de dados de usuários**: localStorage → Supabase, com plano de dupla-escrita ou corte único a definir.
6. **Desligamento gradual do Firebase**: só depois de validação completa em produção.

## Variáveis de ambiente futuras (documentadas, sem valores reais)

- `VITE_SUPABASE_URL` — pode ser usada no cliente.
- `VITE_SUPABASE_ANON_KEY` — pode ser usada no cliente **desde que a RLS esteja correta** (é a premissa de todo este desenho).
- `SUPABASE_SERVICE_ROLE_KEY` — **nunca** com prefixo `VITE_`; nunca no bundle, no Git, em logs ou no frontend. Não existe nenhuma referência a `service_role` em código cliente nesta etapa (verificado por busca em `src/`).

Nenhum `.env` real foi criado.
