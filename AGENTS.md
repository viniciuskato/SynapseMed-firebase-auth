# AGENTS.md — contexto operacional para agentes de IA

Este arquivo é lido por qualquer agente de IA (Claude Code, Codex, ou
outro) que trabalhe neste repositório. Diferente do `README.md` (guia de
setup para humanos), este documento existe para que um agente que nunca
viu este projeto antes não repita erros já resolvidos, nem precise
redescobrir decisões já tomadas. Ver seção "Manter este arquivo
atualizado" no final — é obrigatória, não opcional.

## O que é o projeto

Plataforma de estudos médicos (NexusMed/SynapseMed — o nome de marca é
"NexusMed", o repositório e o projeto continuam se chamando SynapseMed)
para residência médica: compêndios teóricos, banco de questões
comentadas, flashcards com SRS, simulados, caderno de erros. Produção
real, em uso por um grupo fechado de amigos do dono do projeto (não é
protótipo).

- **URL de produção**: `https://synapse-med-firebase-auth.vercel.app`
- **Deploy**: automático a cada push em `main` (Vercel + GitHub).
- **Backend**: Supabase (Postgres + Auth + Storage), projeto `synapsemed`,
  ref `jfvhwwvixwvgjfqzlkkb`, região `sa-east-1`.
- **Frontend**: React 19 + Vite 6 + Tailwind v4 + TypeScript.

## Arquitetura em uma tela

- `src/repositories/*Repository.ts` — interface + wrapper "Resilient"
  (tenta Supabase, cai pra localStorage em erro/config ausente).
- `src/repositories/Supabase*Repository.ts` — implementação real contra
  o Supabase, é o que efetivamente importa em produção.
- `src/services/gamification.ts` — XP/nível/ofensiva calculados a partir
  de dados REAIS sincronizados (ver "Armadilhas" abaixo — isso já foi um
  bug de placeholder fixo).
- `supabase/migrations/*.sql` — schema, RLS, RPCs. `RLS` é a linha de
  defesa real (não o frontend) — qualquer tabela nova precisa de policy
  explícita ou fica inacessível/exposta por padrão do Postgres.
- `materials.status`/`questions.status` — conteúdo carregado nasce
  `draft`; só `published` aparece pra estudante (`role='student'`). Isso
  é deliberado, não um bug — publicar é uma ação manual na Área
  Editorial (admin) depois de carregar.
- `profiles.status` — cadastro novo nasce `pending`; só `active` acessa
  o app. Aprovação manual na aba "Usuários" da Área Editorial.

## Armadilhas já descobertas (não redescobrir)

1. **Tailwind v4 descarta CSS custom com nome igual a uma utilidade
   dele**, mesmo fora de `@layer`, mesmo com `!important` de propósito
   — o build simplesmente não inclui a regra, sem erro, sem aviso.
   Confirmado empiricamente (não é suposição). Se precisar sobrescrever
   `shadow-md`, `text-sm` etc., use um nome de classe que o Tailwind não
   reconheça (ex.: o projeto usa `.elev-xs/sm/md/lg/xl/2xl` em vez de
   sobrescrever `.shadow-*` — ver `src/index.css`).
2. **PowerShell do usuário bloqueia scripts `.ps1`** (política de
   execução) — `npx <algo>` falha com erro de segurança. Use
   `npx.cmd <algo>`, ou o caminho completo do binário (ex.:
   `C:\Users\vinic\bin\supabase.exe`, `C:\Users\vinic\bin\vercel.exe` se
   existir) quando estiver orientando o usuário a rodar algo ele mesmo.
3. **Escrita no Supabase remoto ou operações de deploy (`vercel
   rollback`, `vercel promote`) são bloqueadas pelo classificador de
   segurança do Claude Code** quando rodadas via uma sessão de agente —
   precisam ser rodadas pelo usuário mesmo, interativamente. Prepare o
   comando exato (de preferência um arquivo `.sql`/script, não uma
   string com aspas aninhadas complexas) e peça pra ele rodar.
4. **`.env.local` aponta pro Supabase REMOTO por padrão.** Scripts que
   tocam dado real (`scripts/load-*.ts`) têm trava de "só local por
   padrão" — não remover essa trava, não confiar que o ambiente atual é
   local sem checar `VITE_SUPABASE_URL` primeiro.
5. **`StorageService.getStats()` tinha `streakDays` fixo** (`totalAnswered
   > 0 ? 4 : 1`), nunca uma sequência real, e lia de uma cópia local do
   StorageService desconectada dos dados sincronizados. Foi substituído
   por `GamificationService.computeRealStats()`, que usa os dados reais
   dos repositórios. Não reintroduzir números fixos/mockados em métricas
   visíveis ao usuário sem deixar isso óbvio no código.
6. **Um redesenho feito via Google AI Studio Build** (ambiente que clona
   o repo e edita com preview ao vivo, exportado manualmente pro GitHub)
   introduziu, junto com melhorias visuais legítimas: um botão de login
   de demonstração sempre visível que logava qualquer visitante como
   admin sem autenticação real (corrigido — só aparece quando
   `!isConfigured`), `package-lock.json` apagado sem necessidade, e um
   padrão de `catch {}` vazio engolindo erros de escrita no Supabase nos
   repositórios de conteúdo administrado. Qualquer código vindo de fora
   desta sessão de trabalho normal (AI Studio, outra ferramenta) precisa
   de revisão linha a linha antes de ir pra produção — já aconteceu de
   um commit assim ir ao ar automaticamente (push em `main` = deploy) e
   precisar de rollback de emergência.
7. **`error_reason` (por que errou) e `answer_strategy` (como chegou na
   resposta) são conceitos DIFERENTES**, não redundantes — o primeiro só
   se aplica a resposta errada, o segundo se aplica a toda resposta. Não
   fundir as duas taxonomias numa só. (Já implementado — ver
   `question_attempts.answer_mode`/`answer_strategy` e
   `submit_question_attempt`.)
8. **Merge em `main` != schema aplicado no remoto.** `main` fazer merge/
   deploy no Vercel não aplica migrations no Supabase remoto — são dois
   passos independentes. Já aconteceu de um merge ir ao ar com o
   frontend chamando uma RPC com assinatura nova enquanto o banco remoto
   ainda tinha só a versão antiga (quebrou o registro de respostas em
   produção por alguns minutos). Ao mesclar qualquer branch que inclua
   migration nova, aplicar no remoto (`supabase db push --linked --yes`,
   rodado pelo usuário — ver armadilha #3) faz parte do merge, não é um
   passo opcional posterior. Sempre conferir depois com uma query direta
   (ex.: `select pronargs from pg_proc where proname = '...'`) — não
   confiar só na mensagem de sucesso do CLI.
9. **`service_role` (usado por `SUPABASE_SERVICE_ROLE_KEY` via REST/
   supabase-js) NÃO é o mesmo que o usuário Postgres `postgres`.** O
   trigger `protect_profile_fields` só libera alterar `role`/`status`
   em `public.profiles` quando `current_user = 'postgres'` — chamar
   `.update({role, status})` com a service role key pelo REST local
   ainda cai nessa checagem e falha. Pra promover um usuário de teste a
   admin/ativo direto no banco LOCAL (bootstrapping de script de teste,
   sem passar por `admin_set_profile_status`), rode via `docker exec
   supabase_db_synapsemed psql -U postgres -c "update ..."` (conecta
   como `postgres` de verdade), não via cliente Supabase JS mesmo com a
   service role key.

## Convenções de trabalho

- **Commits vão direto pra `main`** hoje (sem PR obrigatório) porque é
  um projetinho de uma pessoa só com IA — mas cada push é um deploy real
  em produção. Rodar `tsc --noEmit` + `npm run build` antes de commitar,
  sempre.
- **Modelo "sessão diretoria / sessão executiva"**: mudanças maiores são
  planejadas por uma sessão que escreve um prompt autocontido (não
  assume contexto de conversa nenhuma), e uma sessão executiva separada
  implementa, verifica com as próprias ferramentas (build, testes
  pgTAP, teste contra Supabase local) e reporta objetivamente — sem
  mesclar em `main` sozinha, sem inventar escopo novo.
- **Testar contra Supabase LOCAL** (`supabase start`, `supabase db
  reset`, `supabase test db`) antes de considerar qualquer mudança de
  schema/RPC pronta. Nunca validar mudança de escrita direto no remoto.
- **Ponto de restauração**: tag git `v0-beta-amigos` marca um estado
  conhecido-bom. Rollback de emergência do site: `vercel rollback`
  (instantâneo, não mexe no código). Reverter código: `git revert`.

## Estado atual (mantenha esta seção precisa — é a mais importante)

- Migração Firebase → Supabase: **concluída**, Firebase removido do
  código.
- Conteúdo: 33 compêndios + 393 questões carregados e publicados no
  Supabase remoto.
- Painel admin (Área Editorial): abas Compêndios, Questões, Flashcards,
  Usuários (aprovação de cadastro) — todas com controle de
  publicar/despublicar onde se aplica.
- PWA instalável (manifest + ícones), logo próprio (monograma N + pulso
  cardíaco, `src/components/common/Logo.tsx`), site fora de buscadores
  por decisão do usuário (`robots.txt` + `noindex`).
- Sistema de sombra/elevação próprio (`.elev-*`) funcionando em claro e
  escuro — ver armadilha #1 antes de mexer nisso.
- Gamificação usa dados reais (não placeholder) desde a correção da
  armadilha #5.
- **Concluído em 2026-09-07** (mesclado em `main`, migration aplicada no
  remoto e verificada): modo de resposta aberta (recall antes de ver
  alternativas) + captura de estratégia de resposta em toda resposta +
  XP ponderado por dificuldade/modo/primeira-tentativa.
- **Implementado em 2026-09-07, na branch `feature/feedback-contextual`
  (AINDA NÃO mesclado em `main`, migration AINDA NÃO aplicada no
  remoto)**: feedback contextual vinculado a questão/compêndio (link
  discreto "Algo errado aqui?" em `QuestionCard.tsx` e
  `CompendiumReader.tsx`) + reação rápida 👍/👎 por questão
  (`question_reactions`, toggle) + aba "Feedback" no admin (lista,
  filtro por status, avanço pendente → em_analise → resolvido, link
  para abrir a questão/compêndio de origem) + badge de contagem de
  reações na aba "Questões Comentadas". Migration:
  `supabase/migrations/20260907130000_feedback_contextual.sql`. Quando
  essa branch for mesclada em `main`, aplicar a migration no remoto
  (`supabase db push --linked --yes`, rodado pelo usuário — ver
  armadilha #3) faz parte do merge, não é opcional (ver armadilha #8).
  Se você está lendo isto e o merge/push já aconteceu, atualize este
  parágrafo e remova a ressalva de "ainda não".

## Manter este arquivo atualizado

Isto não é um documento estático. **Toda sessão de trabalho neste
repositório — qualquer IA, incluindo você agora — deve atualizar este
arquivo ao final de qualquer mudança que:**

- resolva ou descubra uma armadilha nova (adicione à lista acima);
- mude o estado atual do projeto de forma relevante (edite a seção
  "Estado atual" para refletir a realidade, não deixe ficar
  desatualizada);
- estabeleça ou mude uma convenção de trabalho.

Isso vale mesmo que ninguém peça explicitamente — é parte do trabalho,
não um extra. O objetivo é que a PRÓXIMA sessão (sua ou de outra
ferramenta) não precise redescobrir o que você já descobriu agora.
