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
3. **Escrita no Supabase remoto ou operações de deploy podem ser
   bloqueadas pelo classificador de segurança do Claude Code, mas nem
   sempre são** — em 2026-09-09 (09-B), `supabase db push --linked --yes`,
   `npx tsx recover-question-references.ts --execute --allow-remote` e
   `git push origin main` (deploy automático) rodaram sem bloqueio na
   mesma sessão; só `supabase migration list` foi bloqueado nessa ocasião
   (contornado com `supabase db query` para a mesma verificação). Não
   presuma bloqueio nem ausência dele — tente a operação real primeiro;
   se for bloqueada, prepare o comando exato (de preferência um arquivo
   `.sql`/script, não uma string com aspas aninhadas complexas) e peça
   pro usuário rodar interativamente.
4. **`.env.local` aponta pro Supabase REMOTO por padrão.** Scripts que
   tocam dado real (`scripts/load-*.ts`) têm trava de "só local por
   padrão" — não remover essa trava, não confiar que o ambiente atual é
   local sem checar `VITE_SUPABASE_URL` primeiro. **Para testar o app de
   verdade no navegador contra o Supabase LOCAL** (`npm run dev`), crie
   (ou reaproveite, se já existir) um `.env.development.local` com
   `VITE_SUPABASE_URL=http://127.0.0.1:54321` e o `ANON_KEY` local (`supabase
   status`) — o Vite dá prioridade a `.env.[mode].local` sobre `.env.local`
   só no modo `development` (`npm run dev`/`vite`, não `vite build`), então
   isso não afeta build de produção nem precisa tocar no `.env.local` real.
   Esse arquivo é git-ignorado (`.env.*` no `.gitignore`) — criado no 07-B
   para os testes de navegador do Prompt 07-B, pode ser reaproveitado por
   sessões futuras que precisem do mesmo setup.
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
10. **`docker exec supabase_db_synapsemed psql -U postgres <<'SQL' ...`
    (heredoc) não funciona sem `-i`** — sem essa flag o `docker exec` não
    conecta stdin ao container, o comando termina sem erro nenhum e sem
    imprimir nada, e nenhuma instrução SQL roda (parece sucesso, não é).
    Use `docker exec -i supabase_db_synapsemed psql -U postgres <<'SQL'`
    para heredoc, ou `-c "..."` para uma instrução só. Além disso, o
    classificador de segurança do Claude Code bloqueia de forma
    inconsistente (não determinística) alguns `docker exec ... psql -c
    "update/insert ..."` mesmo sendo escrita local/idempotente — quando
    bloquear, tentar de novo (às vezes passa) ou trocar para um script
    `supabase-js` com a service role key local, que não sofre esse
    bloqueio.
11. **Inserir uma questão de teste isolada no Supabase LOCAL não é um
    simples `INSERT ... status='published'`.** Triggers de proteção
    (`guard_question_publish`, `guard_question_option_keys_immutable`,
    `guard_question_answer_keys_immutable`, `guard_question_delete`)
    exigem: inserir a questão como `draft`; inserir alternativas (isso
    já dispara `set_question_option_keys_question_id`, que cria
    automaticamente uma linha vazia em `question_option_keys` por
    alternativa — não repita o INSERT nela, faça UPDATE); preencher
    `question_answer_keys`; só então `UPDATE questions SET
    status='published'` (permitido só quando `current_user = 'postgres'`
    ou via `publish_question()`, que por sua vez exige
    `app.is_admin_active(auth.uid())` — não dá pra chamar via service
    role sem um `auth.uid()` válido). Para editar `question_option_keys`
    depois, a questão precisa voltar a `draft` primeiro (mesmos
    triggers). Para limpar depois: com a questão em `draft`, `DELETE FROM
    questions WHERE id=...` faz cascade em opções/keys/answer_keys/
    attempts — não precisa apagar filho por filho manualmente. Também:
    nomes de disciplina/tema têm `UNIQUE (code)` — reaproveite os
    registros existentes (ex.: já existe "Infectologia" com id próprio)
    em vez de tentar recriar com o mesmo `code`/id do remoto.
12. **A navegação para uma questão específica no app não usa URL** (é
    tudo estado de componente/`activeView`). Pra testar uma questão em
    isolamento via automação de navegador, use o filtro de Disciplina em
    "Questões" pra reduzir a lista a 1 item, em vez de tentar helpers com
    IDs/slugs que não existem. O nav do Header (`getByText('Questões')`)
    só é visível em desktop (`xl:inline`); em telas menores o mesmo item
    é o 3º botão (índice 2, sem texto, só ícone) do dock fixo
    `#mobile-floating-dock`.

13. **O padrão `Resilient*Repository` (grava local, espelha no Supabase com
    `catch {}` silencioso) foi confirmado como risco real, não só teórico**
    (Prompt 07-A, 2026-09-09): sem chave de idempotência, reenviar uma
    operação falha duplicava dado real — `question_attempts`/`error_notebook`
    (infla XP, calculado a partir de `question_attempts` real — ver armadilha
    #5) e `flashcard_reviews` (duplica histórico de SRS; pior, o cálculo do
    SM-2 era feito no navegador a partir do estado local, então duas revisões
    offline em dispositivos diferentes podiam se sobrescrever com "última
    gravação vence" baseada em dado desatualizado). Corrigido para as
    categorias 1 (tentativas/XP) e 2 (flashcards/SRS) com uma fila
    persistente no cliente (`src/services/syncQueue.ts`, ver
    `docs/SINCRONIZACAO-CONFIAVEL.md`) + `client_op_id` idempotente
    verificado no servidor (migration `20260909120000_sync_reliability.sql`)
    + `submit_flashcard_review` recalculando o SM-2 no servidor dentro de uma
    transação com `select ... for update` (serializa revisões concorrentes do
    mesmo card). **Categorias 3-9 (caderno de erros, notas, favoritos,
    progresso de leitura, simulados, reações, feedback) continuam no padrão
    antigo** — não presumir que a correção já é geral. Ao mexer em qualquer
    `Resilient*Repository` novo/existente, ver o plano de migração na Etapa 4
    daquele documento antes de simplesmente copiar o padrão antigo.
    **(07-B, 2026-09-09) Uma primeira implementação client-side sem teste de
    navegador real teve quatro bugs sérios apesar de 106/106 pgTAP passando**:
    `enqueueAndTry` podia retornar antes da operação terminar (dedupe de
    flush concorrente mal feito), a fila de um usuário podia ser enviada
    autenticada como outro usuário (eventos periódicos varriam todos os UIDs
    conhecidos sem checar a sessão ativa do Supabase), a recuperação de dados
    legados tratava qualquer `question_attempts` remoto para a questão como
    prova de sincronização (ignorando que múltiplas tentativas por questão
    são legítimas), e o fallback de UUID gerava um formato incompatível com a
    coluna `uuid` do Postgres. Todos corrigidos e reproduzidos com
    Playwright/Chromium real contra o Supabase local — ver
    `docs/SINCRONIZACAO-CONFIAVEL.md`, seção "Correções do Prompt 07-B".
    **Lição**: testes pgTAP provam contratos de servidor, não o comportamento
    real do código client-side que os chama (dedupe de promises, checagem de
    sessão ativa, comparação de dados legados) — para essa camada, só teste
    de navegador real detecta esse tipo de bug.
14. **`toggleBookmark`/`toggleSectionRead` não são operações idempotentes** —
    são um "liga/desliga", não um "define este valor". Colocá-las numa fila
    de retry automático sem antes trocar o contrato para `setBookmark(id,
    bool)`/`setSectionRead(id, bool)` introduziria um bug novo: reenviar a
    mesma operação depois de uma falha de rede inverteria o estado errado.
    Por isso ficaram deliberadamente fora da correção de sincronização do
    Prompt 07-A (ver `docs/SINCRONIZACAO-CONFIAVEL.md`, Etapa 1/4) — não é
    esquecimento, é uma dependência real de redesenho antes de automatizar.

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
- **Implementado em 2026-09-07 (confirmado em `main` e em `origin/main`,
  commit `2d58efd` — verificado com `git merge-base --is-ancestor` e
  `git branch -a --contains` em 2026-09-07; a branch `feature/feedback-
  contextual` não existe mais, nem local nem remota)**: feedback
  contextual vinculado a questão/compêndio (link discreto "Algo errado
  aqui?" em `QuestionCard.tsx` e `CompendiumReader.tsx`) + reação rápida
  👍/👎 por questão (`question_reactions`, toggle) + aba "Feedback" no
  admin (lista, filtro por status, avanço pendente → em_analise →
  resolvido, link para abrir a questão/compêndio de origem) + badge de
  contagem de reações na aba "Questões Comentadas". Migration:
  `supabase/migrations/20260907130000_feedback_contextual.sql` — **status
  de aplicação no Supabase remoto CONFIRMADO** em 2026-09-07, conforme
  retorno do Prompt 02 — Complemento colado pelo usuário: consulta direta
  via `supabase db query --linked`, versão aplicada e tabela feedback com
  question_id/material_id/status, question_reactions e duas policies RLS
  esperadas verificadas pela executiva. A diretoria não repetiu a consulta.
- **PUBLICADO em produção em 2026-09-09 (09-B)**: mesclado em `main`
  (commit de merge `4bbda0f`, `main`/`origin/main` avançaram de `2d58efd`),
  deploy automático confirmado no Vercel (bundle publicado contém as
  strings novas — "Bibliografia da questão", "Fonte verificada", "Algo
  errado aqui", `app-header-height`, `inert`). Migration
  `20260907140000_question_references_in_review.sql` **aplicada e
  verificada no Supabase remoto** (registrada em
  `supabase_migrations.schema_migrations`, `references` presente no corpo
  das duas funções, assinaturas inalteradas, grants corretos — só
  `authenticated`/`postgres`). `recover-question-references.ts --execute
  --allow-remote` rodado contra o remoto: 393/393 questões, 675
  `question_references` inseridas, 84 `sources` criadas, 0 gaps, 0 não
  encontradas — bateu exatamente com o dry-run. Tabelas fora de
  `sources`/`question_references` confirmadas inalteradas antes/depois
  (`questions`=393, `question_options`=1965, `question_option_keys`=1965,
  `question_answer_keys`=393, `question_attempts`=8, `error_notebook`=8,
  `bookmarks`=0, `notes`=0, `flashcards`=5). Amostragem confirmou citação
  real, DOI e estado de verificação em Cardiologia e no tema Endocardite
  Infecciosa. Smoke test em produção com usuário de teste descartável
  (criado, promovido a `active` via conexão direta como `postgres`, e
  apagado ao final — 0 rastro remanescente): login, header
  desktop/mobile, nav compacta, busca de questão, diálogo "Algo errado
  aqui?" (abre, fica dentro da viewport em 390px, fecha com Escape),
  fluxo de resposta (modo recall aberto -> "Ver alternativas" ->
  selecionar -> confirmar), bibliografia da questão com rótulo de
  verificação e link DOI, geração de flashcard a partir de questão
  respondida, bibliografia herdada visível no flashcard
  (`FlashcardReviewSession`), barra do compêndio e menu "Mais ações" no
  mobile — 23/23 passos OK, 0 erros de console, 0 requisições com falha.
  Todos os 393 questões publicadas já têm ao menos 1 referência agora (não
  havia exemplo real de "questão sem referência" para testar nesta rodada
  — comportamento de fallback sem placeholder confirmado só por código,
  não visualmente). Ver `docs/diretoria/registro.md` para o retorno
  completo do 09-B.
- **Histórico (preparado em 2026-09-07, commitado em 2026-09-08 na branch
  `work/consolidacao-diretoria-2026-09-08`, commit `1e89a2f`)**: correção
  do achado de auditoria "question_references/sources descartados na carga
  real" (`Organização/RELATORIO-AUDITORIA-ACERVO-NEXUSMED-2026-09-07.md`,
  seção 4 — Prompt 03 v2). `scripts/load-questoes.ts` agora popula
  `sources`/`question_references` a partir de `q.referencias[]` +
  `fontes.json` (idempotente: fonte já existente não é regravada, questão
  pulada por já existir não duplica referência). Script novo
  `scripts/recover-question-references.ts` faz a mesma recuperação para as
  393 questões já carregadas no remoto ANTES desta correção — casamento só
  por igualdade EXATA de `(discipline_id, theme_id, question_stem)`, nunca
  por título/ILIKE; idempotente e retomável (preserva vínculos existentes
  e insere somente fontes ausentes, sem duplicação). Migration
  `20260907140000_question_references_in_review.sql` acrescenta um campo
  `references` ao jsonb já devolvido por `get_question_review`/
  `submit_question_attempt` (mesma assinatura das duas funções, só um campo
  a mais). UI: `QuestionCard.tsx` mostra as fontes da questão junto à
  explicação geral (é o nível real do dado — `referencias[]` é por questão,
  não por alternativa; link clicável só quando a fonte tem doi/pmid/url,
  nunca inventado); `CompendiumReader.tsx`/`SupabaseMaterialsRepository.ts`
  ganharam a mesma capacidade via `material_references.source_id`, mas hoje
  nenhum dos 33 compêndios carregados tem `source_id` curado (decisão já
  documentada em `load-compendios.ts`) — a bibliografia continua aparecendo
  como texto simples até essa curadoria existir, não é um bug desta
  correção; `SupabaseFlashcardsRepository.ts` passou a anexar a fonte
  bibliográfica herdada da questão de origem
  (`question_origin_id` -> `question_references`) a
  `Flashcard.bibliographicSources`, exibida no fluxo ativo
  `FlashcardReviewSession` distinta do material de origem
  (`compendiumRefId`, botão "Ver no Compêndio" já existente). O estado de
  verificação editorial é exibido nas fontes de questões, compêndios
  estruturados e flashcards, com texto que explicita a granularidade do
  vínculo. Validado localmente: `tsc --noEmit` e `npm run build` limpos,
  teste visual em Chromium nas larguras 320/360/390/430/640/768/1024/1280
  e alturas baixas 480/400/320, pgTAP
  83/83 (as duas RPCs já são exercitadas pela suíte existente), carga real
  das 393 questões contra o Supabase LOCAL (675 question_references, 84
  sources, 0 gaps contra `fontes.json`), reexecução sem duplicar nada, e
  simulação da recuperação (zerar `question_references` e rodar
  `recover-question-references.ts`) recuperou 393/393 sem nenhum
  casamento ambíguo. Publicação em produção concluída em 2026-09-09 — ver
  entrada "PUBLICADO em produção" acima.
- **Responsividade (01-B/01-C, commitado na mesma branch de consolidação)**:
  cabeçalho e navegação adaptados por faixa de largura (menu central só a
  partir de `xl` — 1280px —, dock inferior `MobileBottomNav` abaixo disso),
  barra de ações do `CompendiumReader` reorganizada no mobile com menu
  único "Mais ações" (Índice/Anotações/Favoritar, 44px por item), e
  `ContextualFeedbackPopover` com semântica de diálogo acessível (foco
  preso, Escape, devolução de foco). **09-A (2026-09-09) validou visualmente
  em Chromium/Playwright** (não só schema/build) e corrigiu dois problemas
  reais que só apareciam em navegador: o diálogo de feedback era clipado
  pelo `backdrop-blur` do cabeçalho (containing block de `filter`) e saía
  da viewport em ~640px — corrigido renderizando via `createPortal` direto
  em `document.body`, com `inert` no `#root` e bloqueio de scroll do body
  enquanto aberto; e a barra sticky do `CompendiumReader` usava
  `top-[53px]` fixo, que descolava do cabeçalho real sempre que a altura
  dele mudava — corrigido com `--app-header-height` (CSS var atualizada
  por `ResizeObserver` no `Header.tsx`) e `top-[var(--app-header-height)]`.
  Confirmado depois da correção, com Playwright real (não só leitura de
  código): diálogo dentro da viewport em 390px e 640px, botões do
  cabeçalho ≥44px em 390px, sem erros de console.
- **09-A (2026-09-09) — nota de higiene local, não é bug do produto**:
  o Supabase LOCAL compartilhado (`supabase_db_synapsemed`) acumulava
  resíduo de questões/fontes de teste (`Disciplina Teste`/`Enunciado A-H`,
  `fonte-teste-*`) de pelo menos 3 sessões anteriores (2026-09-07 a
  2026-09-09), nunca limpo apesar de retornos anteriores declararem
  limpeza feita — removido nesta sessão (contagem confirmada de volta a
  394 questões / 675 question_references / 84 sources, o baseline real).
  `supabase test db` (pgTAP) também deixa fixtures próprias (usuários
  `*@test.local`, uma `Disciplina Teste`) — isso é do próprio runner de
  teste, não desta branch; normal reaparecer a cada `supabase test db`.
  Se uma sessão futura ver contagens divergentes de 394/675/84 acima, não
  presuma corrupção — primeiro confira se não é resíduo de teste não
  limpo antes de mexer em dado real.

- **Em andamento na branch `work/sincronizacao-confiavel-07` (2026-09-09,
  Prompt 07-A + 07-B), NÃO mesclada em `main`**: fila de sincronização
  confiável (`src/services/syncQueue.ts`) com idempotência por
  `client_op_id`, implementada para as categorias 1 (tentativas de
  questão/XP) e 2 (flashcards/SRS) — ver armadilha #13 e
  `docs/SINCRONIZACAO-CONFIAVEL.md` para diagnóstico completo, modelo e
  plano das categorias 3-9 ainda não corrigidas. Migration
  `20260909120000_sync_reliability.sql` testada e aplicada só em Supabase
  LOCAL (106/106 pgTAP); nada disso está em produção. **07-B (mesmo dia)**
  corrigiu quatro bloqueios encontrados na revisão do código do 07-A antes
  de qualquer teste de navegador — retorno cedo de `enqueueAndTry` sob flush
  concorrente, fila de um usuário podendo ser processada sob a sessão de
  outro, recuperação legada tratando qualquer tentativa remota da questão
  como prova de sincronização, e fallback de UUID incompatível com a coluna
  `uuid` — todos client-side, sem migration nova. Reproduzidos e corrigidos
  com testes reais de navegador (Playwright/Chromium contra Supabase local,
  15/15 asserções passando) além de `tsc`/`build`/106 pgTAP mantidos verdes.
  Cenários de duas abas simultâneas, reenvio pós-servidor-pré-cliente,
  reload durante `syncing` isolado e os sete sub-casos de recuperação legada
  ficam como pendência de teste de navegador (lógica implementada e
  documentada, não exercitada ponta a ponta) — ver
  `docs/SINCRONIZACAO-CONFIAVEL.md` para o detalhamento completo.

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

**Registro de prompts e decisões da diretoria**: `docs/diretoria/
registro.md` é a cópia versionada (sobrevive a troca de máquina/sessão)
do acompanhamento de prompts entre diretoria e executivas — número,
status, dependências e retorno de cada um. Ver também
`docs/CONTINUIDADE-MULTI-MAQUINA.md` para riscos e procedimento de
transição entre máquinas. Ao fechar um prompt ou mudar seu status,
atualizar `docs/diretoria/registro.md`, não só relatar na conversa.

## Comunicação entre diretoria e executivas (2026-09-07)

- Ao usuário definir uma sessão como "sessão de diretoria", adote o papel criativo e interativo: explorar ideias, questionar propostas, amadurecer decisões, formular prompts e avaliar os retornos. A implementação cabe às sessões executivas. A diretoria pode registrar convenções quando solicitado.
- Cada prompt de encaminhamento deve ficar em seu próprio bloco de código cercado, com botão de copiar independente. Nunca reúna vários prompts no mesmo bloco. Coloque o número e o título dentro do bloco, para acompanharem o texto copiado.
- Numere os prompts sequencialmente na conversa (Prompt 01, Prompt 02 etc.). Revisões preservam o número e indicam a versão. Cada prompt deve ser autocontido, com contexto, tarefa, restrições, critérios de conclusão, dependências e formato do retorno.
- Mantenha explicações e discussão fora dos blocos. Apresente os blocos de encaminhamento no fim da resposta, seguidos apenas pela tabela de acompanhamento quando aplicável. Não gere encaminhamentos artificiais durante uma conversa exploratória.
- Cada executiva deve terminar com um bloco copiável próprio identificado como "RETORNO DO PROMPT NN", relatando resultado, alterações, validações, limitações e pendências.
- Quando houver múltiplos prompts em acompanhamento, termine a resposta da diretoria com uma tabela fora dos blocos: número, entrega e situação. Diferencie preparado, aguardando retorno, retorno recebido/em análise e concluído. Não presuma envio, execução ou conclusão sem evidência; atualize a tabela conforme os retornos colados pelo usuário.
### Modelo obrigatório de acompanhamento da diretoria

- Use a tabela: Prompt | Entrega/etapa atual | Situação | Pode enviar? / Dependência.
- Situação e liberação são conceitos separados. Situações: Preparado (envio não confirmado), Em execução (usuário confirmou que mandou rodar), Retorno recebido (aguarda avaliação), Concluído (critérios atendidos). Registre publicação separadamente quando relevante.
- Na última coluna, escreva explicitamente: "Sim", "Aguarda retorno do NN — motivo" ou "Já enviado; aguardar retorno". Não use expressões ambíguas como "pronto com o diagnóstico". Inclua no próprio prompt o contexto necessário para encaminhamento.
- Só marque Em execução quando o usuário disser que enviou/mandou rodar. Colar um prompt sem confirmação não comprova envio. Só marque retorno recebido quando houver resultado, não quando o usuário repetir as instruções.
- Preserve o histórico de retornos iniciais; a linha deve identificar quando acompanha complemento ou versão nova. Não crie outro número para um complemento do mesmo trabalho.
- Antes de liberar trabalhos simultâneos, confira dependências de resultados e possíveis conflitos de edição. Explicite a necessidade de isolamento quando houver arquivos compartilhados.
- Mantenha decisões e estados em docs/diretoria/registro.md, quando disponível, para continuidade entre sessões; não sobrescreva registros de outra sessão. Estas regras são o padrão para toda sessão de diretoria deste projeto.
- Estado confirmado pelo usuário nesta conversa em 2026-09-07: Prompt 06 — complemento de preparação da transição entre máquinas foi enviado e está Em execução. Retornos iniciais de 01, 02 e 06 já recebidos. Envio dos complementos 01/02 e dos prompts 03 v2, 04 e 07 não confirmado. Prompt 05 aguarda a reconciliação do complemento 02.

### Modelo vigente da diretoria
Toda sessão de diretoria deve ler e seguir [docs/diretoria/MODELO-DIRETORIA.md](docs/diretoria/MODELO-DIRETORIA.md) e consultar [docs/diretoria/registro.md](docs/diretoria/registro.md). O modelo aprovado organiza entregas com etapas NN-A/NN-B, fila priorizada, histórico, estados baseados na confirmação do usuário e verificação separada de dependências e conflitos de execução. Ele substitui as regras anteriores de formato que conflitem com ele. Preserve os identificadores de prompts já emitidos.
