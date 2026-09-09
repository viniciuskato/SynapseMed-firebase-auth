# Sincronização confiável entre dispositivos (Prompt 07-A / 07-B)

> Executado em `C:\Users\vinic\dev\NexusMed\firebase-auth`, branch
> `work/sincronizacao-confiavel-07`. Este documento é o retorno completo da
> Etapa 1 (diagnóstico), Etapa 2 (modelo) e Etapa 3 (UX) do Prompt 07-A, e
> registra o que foi de fato implementado nas Etapas 4-6 (categorias 1 e 2)
> versus o que fica como plano para as demais categorias.
>
> **Atualização 07-B**: a revisão da diretoria sobre o código do 07-A
> encontrou quatro bloqueios reais que a Etapa 6 original não tinha
> exercitado em navegador (não havia automação disponível naquela sessão).
> Os quatro foram reproduzidos e corrigidos nesta entrega — ver seção
> "Correções do Prompt 07-B" abaixo, que também substitui qualquer afirmação
> de isolamento/recuperação feita mais abaixo neste documento que ainda não
> era verdadeira antes desta correção.

## Etapa 1 — Diagnóstico por categoria

Todas as categorias abaixo seguem o mesmo esqueleto
"`Resilient<X>Repository`": grava sempre no `localStorage` primeiro
(`Local<X>Repository`/`StorageService`), depois tenta espelhar no Supabase
(`Supabase<X>Repository`) dentro de um `try { await ... } catch {}` — nenhum
retorno de erro, nenhum log visível, nenhuma fila. Isso é o achado do Prompt
06 (R2), confirmado nesta sessão arquivo por arquivo. **O que muda de
categoria para categoria não é o padrão de falha (é sempre o mesmo), e sim o
custo de reenviar a operação sem cuidado** — é isso que define a prioridade
abaixo.

| # | Categoria | Leitura começa em | Escrita ocorre em | Local | Supabase | Quem prevalece após login/reload/troca de dispositivo | Repetir a operação duplica? |
|---|---|---|---|---|---|---|---|
| 1 | Tentativas de questão | `AnswersRepository.getAnswers` | `AnswersRepository.recordAnswer` | `localStorage` (`synapse_<uid>_answers_v1`, 1 registro por questão — sobrescreve) | `question_attempts` (histórico completo, 1 linha por tentativa) + `error_notebook` (auto) via RPC `submit_question_attempt` | Supabase quando configurado e a leitura funciona; local só como fallback | **Sim, antes desta entrega.** Reenviar a mesma resposta inseria uma nova linha em `question_attempts` (sem chave de idempotência) e, se incorreta, uma nova linha em `error_notebook` a cada vez — infla o histórico e o XP calculado a partir dele (`GamificationService`, ver AGENTS.md armadilha #5) |
| 2 | Flashcards / SRS | `FlashcardsRepository.getFlashcards`/`getDueFlashcards` | `saveFlashcard`, `createFlashcardFromQuestion`, `deleteFlashcard`, `updateFlashcardSRS`, `reviewFlashcard` | `localStorage` isolado por UID | `flashcards` (upsert por id) + `flashcard_srs_state` (upsert por `flashcard_id`) + `flashcard_reviews` (insert, histórico) | Supabase quando tem ≥1 card; senão local | `saveFlashcard`/`deleteFlashcard`/`updateFlashcardSRS` já eram upsert/delete por id (idempotentes por natureza). **`reviewFlashcard` não era**: o SM-2 era calculado no navegador a partir do estado local e gravado em duas escritas separadas (`flashcard_srs_state` + `flashcard_reviews`) sem chave de idempotência — reenviar duplicava a linha de histórico e, em caso de duas revisões offline em dispositivos diferentes, a que sincronizasse por último "vencia" com um cálculo baseado em estado desatualizado |
| 3 | Caderno de erros | `ErrorNotebookRepository.getErrorLogs` | `updateErrorLog` (só `resolved`/`user_notes`, grant restrito) | `localStorage` | `error_notebook` (criado automaticamente por `submit_question_attempt`, nunca por escrita direta do cliente) | Supabase | `updateErrorLog` é upsert por id — idempotente. O registro em si não é escrito pelo cliente (efeito colateral de categoria 1) |
| 4 | Notas | `NotesRepository.getNotes` | `saveNote` | `localStorage` (`Record<targetId, texto>`) | `notes` (upsert por `(user_id, target)`, a definir — ver Etapa 4 pendente) | Supabase | Idempotente por natureza (upsert por alvo) — risco baixo |
| 5 | Favoritos | `BookmarksRepository.getBookmarks` | `toggleBookmark` | `localStorage` (listas por tipo) | `bookmarks` (`unique (user_id, question_id\|material_id\|flashcard_id)`) | Supabase | **Não é idempotente por design**: é um *toggle* (liga/desliga), não um "set". Reenviar a mesma operação depois de uma falha inverte o estado errado (favoritou → tenta de novo pensando que falhou → desfavorita). Precisa virar `setBookmark(id, true/false)` explícito antes de entrar numa fila de retry — não é só "adicionar client_op_id" |
| 6 | Progresso de leitura | `ReadingProgressRepository.getReadingProgress` | `toggleSectionRead` | `localStorage` (`{ readSectionIds[], percent }` por compêndio) | `reading_progress` (`unique (user_id, material_id)`) | Supabase | **Mesmo problema do favorito**: `toggleSectionRead` também alterna (marca/desmarca seção lida), não define um valor. Mesma correção necessária antes de automatizar retry |
| 7 | Simulados/listas | `SimuladosRepository.getSimulados`/`getSimuladoHistory` | `saveSimuladoSession` | `localStorage` (lista por UID) | `simulations`/`simulation_questions`/`simulation_answers` | Supabase | Upsert por `session.id` (gerado no cliente) — idempotente por natureza, mas a sessão tem sub-escritas (perguntas, respostas) que não foram auditadas quanto a atomicidade nesta rodada |
| 8 | Reações 👍/👎 | `QuestionReactionsRepository.getMyReaction` | `setReaction`/`removeReaction` | `localStorage` (`Record<questionId, 'up'\|'down'>`) | `question_reactions` (toggle único por usuário/questão, ver migration `feedback_contextual`) | Supabase | `setReaction`/`removeReaction` parecem ser "set" explícito (não toggle cego) — mais fácil de tornar idempotente que bookmarks/reading_progress, mas não auditado a fundo nesta rodada |
| 9 | Feedback contextual | `FeedbackRepository.getFeedbacks` | `saveFeedback` | `localStorage` (lista) | `feedback` | Supabase | Depende de o id ser gerado no cliente (upsert) ou sempre um INSERT novo — não auditado a fundo; se for sempre INSERT, precisa de `client_op_id`+`unique` como categoria 1 |
| 10 | Preferências locais (tema, plano) | `StorageService.getTheme`/`getUserPlan` | `setTheme`/`setUserPlan` | `localStorage` apenas | **Não sincronizado hoje** (`profiles` não tem campo de tema/plano de UI) | Só local, por design atual | Não se aplica — não há escrita remota para essa preferência |

**Comportamento de logout/troca de conta** (comum a todas): `StorageService.setActiveUser(null)` no logout não apaga nada — os dados ficam no `localStorage` sob a chave do UID anterior. Login de outra conta no mesmo navegador troca `currentUserId` e todas as leituras/escritas passam a usar as chaves do novo UID — **nenhuma operação pendente do usuário anterior é enviada sob a sessão nova**, porque `getUserKey`/a fila nova (`syncQueue`) são sempre indexadas pelo UID que criou a operação, não pelo UID ativo no momento do envio (ver Etapa 2).

**Confirmação sobre XP**: não existe uma tabela de XP — `GamificationService.computeRealStats()` deriva o XP a partir da contagem/qualidade real de `question_attempts` (ver AGENTS.md armadilha #5). Isso significa que **qualquer duplicação em `question_attempts` infla XP diretamente**, sem precisar de uma tabela própria de XP para o risco ser real.

## Etapa 2 — Modelo de sincronização

### Fonte de verdade por categoria

- **Tentativas de questão (categoria 1)**: evento imutável, **nunca sobrescrito**. Fonte de verdade é o servidor (`question_attempts`); o cliente nunca decide "qual resposta vale", só registra uma tentativa nova a cada resposta (mesmo comportamento de antes — só a duplicação por retry que muda).
- **Flashcards/SRS (categoria 2)**: o *card em si* (front/back/tags) é um estado editável — upsert por id, "última gravação vence" é aceitável aqui porque é o próprio dono editando o próprio card, sem edição concorrente esperada. **O estado do SRS não pode usar essa regra**: é derivado de uma sequência de eventos (revisões), então a fonte de verdade é "estado atual + histórico no servidor", recalculado a cada revisão a partir do que existe no servidor no momento em que a revisão chega — nunca a partir do que o cliente lembra de ter visto por último.
- **Notas e favoritos**: estados editáveis, mas favoritos/progresso de leitura são *toggles*, não valores — tratados como pendência de redesenho (Etapa 1, linhas 5-6), não implementados nesta entrega.
- **Feedback/reações**: fora do escopo implementado; documentado como precisando de idempotência própria antes de entrar na fila.

### Infraestrutura compartilhada: `src/services/syncQueue.ts`

Fila persistente por usuário (`localStorage`, chave `synapse_<uid>_sync_queue_v1`), com:

- **Identificador idempotente por operação**: `client_op_id` (uuid gerado no cliente), enviado ao servidor em toda RPC de escrita sensível. O servidor usa esse id para decidir "já apliquei isso" e devolver o resultado já calculado, em vez de reaplicar.
- **Estados**: `pending` → `syncing` → `synced` | `failed`. Nunca existe "não sei" — todo item tem um estado explícito, consultável pela UI (`useSyncQueueStatus`).
- **Retentativa com backoff exponencial** (15s, 30s, 60s... até 10min, no máximo 8 tentativas) — só para erros classificados como `network` ou `unknown`.
- **Classificação de erro** (`classifySyncError`): `network`, `auth`, `permission`, `validation`, `schema`, `unknown`. Só `network`/`unknown` entram em retry automático; `auth` marca "precisa logar de novo" e só é retentado quando o usuário loga de novo (reconciliação dispara no login); `permission`/`validation`/`schema` marcam falha **permanente** (sem retry infinito) — são erros que reenviar não resolve.
- **Reconciliação automática** em: login/troca de usuário (`StorageService.setActiveUser` → `onActiveUserChanged`), evento `online`, aba voltando a ficar visível (`visibilitychange`), e um heartbeat a cada 60s enquanto houver usuários com fila conhecida.
- **Isolamento por usuário** (corrigido no 07-B — ver seção dedicada abaixo): a fila é uma chave de `localStorage` por UID, o que já impedia um item da fila de A ser confundido com um item da fila de B. Isso sozinho não era suficiente: o cliente Supabase é um único objeto global autenticado com UMA sessão por vez, e a versão original do 07-A **não conferia** se o dono da fila era também o usuário autenticado no momento do envio — `flushAllKnown()` (disparada por `online`/`visibilitychange`/heartbeat) varria TODOS os UIDs conhecidos no navegador, então a fila de A podia acabar sendo enviada autenticada como B se B tivesse acabado de logar no mesmo navegador. `runFlush` agora confere a sessão ativa do Supabase antes de cada operação, e `flushAllKnown` só toca a fila do usuário atualmente ativo.
- **Preservação de dados existentes**: a fila é aditiva — não apaga nem reescreve os dados que os repositórios locais já gravavam antes desta entrega (`synapse_<uid>_answers_v1`, `synapse_<uid>_flashcards_v1` etc. continuam intocados).

### RPCs novas/alteradas (migration `20260909120000_sync_reliability.sql`)

- `submit_question_attempt` ganhou `p_client_op_id uuid default null` + índice único `(user_id, client_op_id)`. Reenviar a mesma operação devolve o resultado da tentativa original sem inserir de novo nem duplicar `error_notebook`.
- `submit_flashcard_review(p_flashcard_id, p_rating, p_client_op_id)` é **nova**: centraliza em uma única transação o que antes eram duas escritas separadas feitas pelo cliente. O SM-2 (portado de `src/services/srsAlgorithm.ts`) roda dentro da função, com `select ... for update` na linha de `flashcard_srs_state` — isso serializa duas revisões concorrentes do mesmo card (ex.: reconciliação simultânea em duas abas) para que a segunda sempre parta do estado real deixado pela primeira, nunca de um cálculo feito no navegador com dado desatualizado. Índice único `(flashcard_id, client_op_id)` garante idempotência do histórico.

## Etapa 3 — Experiência do usuário

`src/components/common/SyncStatusIndicator.tsx`, no cabeçalho (`Header.tsx`), com 4 estados possíveis (nunca mais que isso, nunca "salvo" quando só o local recebeu o dado):

1. **Nada pendente** → indicador some (não polui a interface o tempo todo com "tudo certo").
2. **Aguardando sincronização** (`pending`, sem erro) → ícone de nuvem cortada + texto discreto.
3. **Sincronizando** (`syncing`) → ícone girando.
4. **Falha que exige ação** (`failed`) → ícone de alerta; se a causa for `auth`, o texto orienta a logar de novo; caso contrário, oferece "Tentar novamente" (`retryAllFailed`). Nunca expõe mensagem técnica, stack trace ou identificador de registro — só a categoria do problema.

Estudo offline continua funcionando exatamente como antes (grava local, UI otimista imediata) — a fila só muda o que acontece depois disso, nunca bloqueia a interação.

## Etapa 4 — Implementação progressiva

**Implementado nesta entrega**: categorias 1 (tentativas de questão/XP) e 2
(flashcards/SRS), roteadas por `AnswersRepository.ts` e
`FlashcardsRepository.ts` através de `syncQueue`/`syncHandlers`
(`src/services/syncHandlers.ts` registra os handlers reais de envio, chamado
uma vez em `App.tsx`).

**Não implementado** (mapeado, não resolvido): categorias 3-9 da tabela da
Etapa 1 continuam no padrão antigo (`catch {}` silencioso). Antes de migrá-las
para a fila:

- **Caderno de erros, notas, simulados**: só precisam do mesmo tratamento já
  aplicado (client_op_id onde for INSERT puro; já são idempotentes onde já é
  upsert por id) — trabalho mecânico, próximo item de prioridade natural.
- **Favoritos e progresso de leitura**: precisam de uma mudança de contrato
  primeiro (`toggle` → `set` explícito) antes de entrarem numa fila com
  retry automático, senão uma retentativa depois de falha pode inverter o
  estado errado. **Não implementado propositalmente** — colocar isso na fila
  sem essa correção introduziria um bug novo.
- **Reações e feedback**: precisam de auditoria própria de idempotência
  (confirmar se são upsert ou insert puro) antes de entrar na fila.

## Etapa 5 — Recuperação de dados locais antigos

`src/services/legacyRecovery.ts`, chamado a cada login
(`StorageService.setActiveUser`). Fluxo:

1. Lê o que já existe no servidor para a questão em questão (`question_id`,
   alternativa selecionada, horário, modo/estratégia — não só a presença de
   `question_id`, ver correção 07-B abaixo) e para os flashcards
   (`flashcards.id`) — a "simulação" pedida pelo prompt: só decide o que
   enfileirar depois de comparar com o servidor, nunca envia às cegas.
2. Enfileira (nunca insere diretamente) só o que é claramente local e ainda
   não existe remotamente — a fila (`syncQueue`) garante que isso não duplica
   mesmo que o item já tenha sido parcialmente recuperado antes.
3. Mantém um "ledger" local (`synapse_<uid>_sync_legacy_recovered_v1`) para
   não reexaminar o mesmo item a cada login — mas só marca um item como
   "já verificado" depois de uma consulta bem-sucedida ao servidor (ou de
   confirmar que a operação enfileirada foi de fato sincronizada); se a
   consulta falhar (rede indisponível no momento do login), tenta de novo no
   próximo login, sem crescer sem limite.
4. **Nunca apaga `localStorage`** — mesmo depois de recuperado com sucesso,
   os dados locais originais continuam onde estavam (a fila só lê, nunca
   remove a fonte).

**Limitação confirmada e documentada, não contornada**: flashcards
personalizados criados pelo `LocalStorageFlashcardsRepository` **antes** desta
entrega usam um id não-uuid (`fc-from-q-<timestamp>-<random>`), incompatível
com a coluna `uuid` de `flashcards.id`. A recuperação automática só cobre
cards com id em formato uuid (os criados pelo `SupabaseFlashcardsRepository`,
que já usa `crypto.randomUUID()`). Cards antigos com id não-uuid **não são
apagados** (continuam no `localStorage`, visíveis localmente), mas não têm
caminho automático de recuperação nesta entrega — recriar sob um novo id
duplicaria o card visualmente; a correção adequada exigiria uma decisão de
produto (gerar novo id preservando o conteúdo, ou aceitar a perda de
sincronização desses cards específicos) fora do escopo desta etapa.

**Associação de dados anônimos a uma conta**: não implementada e não deveria
ser automática — o app já tem um usuário "demo" local (`local-demo-user`) e
qualquer heurística de "isso era do usuário anônimo, deve ser deste login"
seria uma suposição de produto, não uma correção técnica. Fora de escopo por
decisão consciente, não por esquecimento.

## Correções do Prompt 07-B

A revisão da diretoria sobre o código do 07-A (sem ainda ter testado em
navegador real) encontrou quatro bloqueios. Todos foram reproduzidos com
Playwright/Chromium contra o Supabase LOCAL antes de corrigir, e novamente
depois da correção, para confirmar o antes/depois — ver Etapa 6 atualizada.

### Bloqueio 1 — `enqueueAndTry` podia retornar cedo

**Causa confirmada**: `enqueue()` chama `void flush(userId)` (dispara e não
espera); `enqueueAndTry()` chamava `await flush(userId)` logo em seguida. A
versão original de `flush` tinha uma guarda simples (`if
(flushingUsers.has(userId)) return;`) — se o primeiro flush (disparado por
`enqueue`) já tivesse marcado o usuário como "flushing", o segundo `flush`
(chamado por `enqueueAndTry`) retornava IMEDIATAMENTE sem esperar nada, e
`enqueueAndTry` podia ler a operação ainda `pending`/`syncing` e devolver
`null` antes da conclusão real.

**Correção**: `flush(userId)` agora deduplica por usuário devolvendo a MESMA
`Promise` para todo chamador concorrente (um `Map<userId, Promise<void>>`
preenchido de forma síncrona antes de qualquer `await`, para que duas
chamadas no mesmo tick observem a mesma entrada). `enqueueAndTry` passou a
fazer um laço que chama `flush` e relê o estado da SUA operação especificamente
(por `client_op_id`) até ela chegar a um estado terminal (`synced`/`failed`)
ou até um timeout de 20s — nunca conclui só porque "um flush terminou", só
quando a própria operação terminou. Comportamento definido para os quatro
casos pedidos: sucesso → devolve o resultado real do servidor; falha
permanente (validação/permissão/schema) → devolve `null` sem insistir; falha
retentável sem rede/sessão → sai cedo do laço (offline) e devolve `null`;
timeout → devolve `null`. Em todos os casos de `null`, o chamador (
`AnswersRepository`/`FlashcardsRepository`) já usa o resultado local otimista
— nada trava a UI.

Também corrigido, no mesmo arquivo: uma operação encontrada em estado
`syncing` no INÍCIO de um flush (resíduo de reload/fechamento de aba durante
um envio anterior, já que esse estado só deveria existir durante o próprio
`await handler(...)`) é reclassificada para `pending` antes de processar —
nunca fica presa indefinidamente (cenário de teste "reload em syncing").
Reenviar é seguro porque as RPCs são idempotentes por `client_op_id`.

### Bloqueio 2 — fila de um usuário podia ser processada sob outra sessão

**Causa confirmada**: a fila já era isolada por `localStorage` (uma chave por
UID), mas isso não bastava — o cliente Supabase (`supabase-js`) é um único
objeto global com UMA sessão ativa por vez. `flushAllKnown()` (chamada pelos
eventos `online`, `visibilitychange` e por um heartbeat a cada 60s) varria
`knownUserIds` (todos os UIDs já vistos no navegador) chamando `flush` para
CADA um, sem checar se o usuário da fila era o mesmo autenticado no Supabase
no momento. Se A respondesse uma questão offline e depois B fizesse login no
mesmo navegador, um desses eventos periódicos podia enviar a operação de A
autenticada como B (RLS grava sob `auth.uid()`, que seria o de B).

**Correção**: `runFlush(userId)` agora chama `getActiveSupabaseUserId()`
(`supabase.auth.getSession()`) antes de CADA operação da fila — se o usuário
autenticado agora não for `userId`, para de processar aquela fila
imediatamente, sem tocar/apagar/reatribuir nenhuma operação (ela continua lá,
pendente, para quando o dono voltar a ser o usuário ativo). `flushAllKnown()`
foi reescrita para consultar a sessão ativa UMA vez e só disparar `flush`
para esse usuário (e só se ele tiver fila conhecida) — nunca mais varre todos
os UIDs conhecidos. Comportamento confirmado por teste real (Cenário 4 da
Etapa 6): B logando e disparando `online`/`visibilitychange` NÃO envia a
operação pendente de A; a fila de A permanece intacta; ao A logar de novo,
sua fila volta a ser processada.

**Limitação documentada, não contornada**: uma operação já em voo (dentro do
`await handler(...)`) no momento em que o usuário faz logout NÃO é cancelada
— o token de autenticação já foi anexado à requisição HTTP no momento do
envio pelo `supabase-js`, então essa requisição específica completa como
quem estava autenticado quando foi enviada. O que a correção garante é que
NENHUMA operação SEGUINTE da fila seja enviada depois que a sessão mudar. Em
outras palavras: o corte de isolamento é "por operação enviada", não
"instantâneo no meio de uma operação já em trânsito" — condizente com como
HTTP/JWT funcionam, não uma limitação evitável no cliente.

### Bloqueio 3 — recuperação legada considerava qualquer `question_attempts` remoto como prova de sincronização

**Causa confirmada**: `legacyRecovery.ts` fazia `select question_id from
question_attempts` e tratava a MERA PRESENÇA de qualquer linha remota para
aquele `question_id` como "já sincronizado", marcando o ledger e nunca
enfileirando. Como o sistema permite múltiplas tentativas legítimas por
questão (histórico real, não sobrescrita), uma tentativa remota antiga não
prova que a resposta local mais recente (que pode ter alternativa,
horário, modo ou estratégia diferentes) já foi enviada — o código descartava
silenciosamente uma tentativa local potencialmente distinta.

**Correção**: a reconciliação agora busca as tentativas remotas da questão
(`question_id, answered_at, answer_mode, answer_strategy,
question_options(letter)`) e compara com a resposta local por
alternativa selecionada + horário (tolerância de 5 minutos, cobrindo latência
de rede/retry) + modo/estratégia quando disponíveis nos dois lados
(`isSameAttempt`). Três desfechos possíveis, nunca uma decisão às cegas:

1. **Nenhuma tentativa remota** → claramente não sincronizada → enfileira.
2. **Uma tentativa remota bate com a local** → já sincronizada → marca
   recuperada, não duplica.
3. **Tentativas remotas existem mas nenhuma bate** → **AMBÍGUO** — pode ser
   uma tentativa local distinta e legítima, ou uma comparação inconclusiva.
   A correção NÃO decide por engano: preserva a resposta local, registra a
   pendência (`console.warn` com os dados da comparação — sem UI dedicada
   nesta entrega, ver limitação abaixo) e **não marca o ledger como
   concluído** — reexaminada no próximo login.

**Operação estável antes do envio**: quando o caso 1 decide enfileirar, o
`client_op_id` retornado por `enqueue()` é salvo IMEDIATAMENTE no ledger
(`ledger.pendingAnswerOps[questionId]`), antes de examinar a próxima questão
pendente — não só ao final do laço. Um login seguinte que encontre essa
entrada NUNCA gera outro `client_op_id`: só consulta o estado real da
operação na fila (`getOps`) — se `synced`, confirma no ledger; se
`pending`/`syncing`/`failed`, não mexe (a fila já cuida do resto). Isso
elimina o risco de, numa interrupção entre "decidiu enfileirar" e "servidor
confirmou", uma sessão seguinte reavaliar do zero e gerar uma SEGUNDA
operação (duplicando a tentativa no servidor).

**Limitação documentada, não contornada**: o caso "ambíguo" só é reportado
via `console.warn` nesta entrega — não há um painel de UI para o estudante
revisar pendências ambíguas de recuperação legada. Isso é aceitável porque
esse caso só pode ocorrer para dados gravados ANTES desta funcionalidade
existir (usuários que já usavam o app antes do Prompt 07-A), é raro na
prática (exige múltiplas tentativas para a mesma questão com timestamps
locais imprecisos) e o comportamento seguro (preservar local, não duplicar,
não descartar) já está garantido — só a experiência de "avisar o usuário" é
que fica pendente para uma iteração de produto futura.

### Bloqueio 4 — fallback de UUID inválido

**Causa confirmada**: `uuid()` usava `crypto.randomUUID()` quando disponível,
mas o fallback gerava `op-<timestamp>-<random>` — uma string que não é um
UUID. As RPCs (`submit_question_attempt`, `submit_flashcard_review`) recebem
`p_client_op_id` como `uuid`; esse formato seria rejeitado pelo driver antes
mesmo de chegar à validação do servidor (a operação falharia sempre, todo o
tempo, nesse ambiente).

**Correção**: fallback via `crypto.getRandomValues` gerando um UUID v4 válido
(RFC 4122 — bits de versão/variante ajustados manualmente a partir de 16
bytes aleatórios). Se NENHUMA fonte criptográfica estiver disponível (nem
`randomUUID` nem `getRandomValues` — ambiente extremamente incomum), `uuid()`
lança, e `enqueue()` captura isso: a operação NÃO é persistida na fila (nunca
chega a existir um `client_op_id` inválido), o erro é logado de forma
compreensível (`console.error`), e o dado local (já gravado pelo repositório
ANTES de chamar `enqueue`) permanece intacto. `enqueueAndTry` detecta esse
caso (`op.id` vazio) e devolve `null` imediatamente, sem tentar esperar por
uma operação que nunca vai existir.

## Etapa 6 — Testes

### O que foi executado e passou

- `npx tsc --noEmit` — sem erros.
- `npm run build` — build de produção concluído (mesmo aviso pré-existente
  de chunk >500kB, não relacionado a esta entrega).
- `supabase test db` (pgTAP) contra Supabase LOCAL, com `supabase db reset`
  antes: **106/106 asserções passando** (83 já existentes +
  `supabase/tests/database/sync_reliability.test.sql`, 23 novas), em duas
  execuções (confirmando que os asserts não dependem de estado deixado por
  execução anterior — cada teste cria sua própria fixture com sufixo
  aleatório). As 23 novas cobrem, direto na RPC (não só na leitura da fila do
  cliente):
  1. `submit_question_attempt` com `client_op_id` novo é aceito e grava 1 linha.
  2. Reenvio do mesmo `client_op_id` não duplica a tentativa nem `error_notebook`.
  3. Reenvio devolve o resultado da tentativa **original**, não recalcula a partir de argumentos novos passados por engano.
  4. Uma tentativa real nova (`client_op_id` diferente) É aceita — idempotência não trava respostas repetidas legítimas.
  5. Isolamento entre usuários: o mesmo `client_op_id` reusado por outro usuário não colide (chave é `(user_id, client_op_id)`, não global) nem funde as duas tentativas numa só.
  6. `submit_flashcard_review`: primeira revisão aplica o SM-2 e grava 1 linha de histórico.
  7. Reenvio do mesmo `client_op_id` de revisão (mesmo com rating diferente por engano) não reaplica o SM-2 nem duplica o histórico.
  8. Segunda revisão real avança `repetition_count`/histórico corretamente (ordem preservada).
  9. Rating fora de 1-4 é rejeitado.
  10. Usuário B não consegue revisar flashcard do usuário A (ownership).

### Prompt 07-B — testes reais de navegador (Playwright/Chromium contra Supabase LOCAL)

Ambiente: Playwright instalado fora do repositório (área temporária, sem
alterar `package.json`), Chromium, app servido por `vite` dev
(`.env.development.local`, git-ignorado, aponta para `http://127.0.0.1:54321`
— NUNCA o `.env.local` do projeto, que aponta para o Supabase remoto por
padrão, ver AGENTS.md armadilha #4). Dois usuários de teste reais
(`sync07b.a@test.local`/`sync07b.b@test.local`, senha própria, `status=active`
promovido via `psql -U postgres` direto, nunca via client — ver armadilha #9)
e dois `BrowserContext` independentes por cenário. **15/15 asserções
passaram**, cobrindo:

1. **Resposta online**: `enqueueAndTry` aguarda a RPC de verdade
   (interceptação de rede confirma `submit_question_attempt` respondendo
   2xx antes da UI avançar); exatamente 1 `question_attempts` nova no banco;
   UI mostra a explicação por alternativa (só existe no payload real da RPC,
   não no otimista local).
2. **Resposta offline**: chamadas ao Supabase local bloqueadas via
   interceptação de rede (não `context.setOffline(true)` puro, que também
   impede o próprio reload da página via `chrome-error://` — não é o que se
   quer exercitar); resposta fica pendente sem travar a UI; reload ainda
   "offline" preserva a pendência (não some, não fica presa); ao restaurar a
   rede e disparar `online`, a fila retoma sozinha e converge para
   `synced`; exatamente 1 tentativa nova no banco (sem duplicar).
4. **Troca de usuário**: A enfileira uma operação e permanece pendente; B
   loga no mesmo navegador; disparar `online`/`visibilitychange` NÃO envia a
   operação de A sob a sessão de B (confirmado consultando o banco: zero
   linhas daquela operação sob o UID de B); a fila de A permanece
   preservada; ao A logar de novo, sua operação volta a ser processada
   (`attempts` avança) em vez de ficar intocada para sempre.
6. **`enqueueAndTry` concorrente**: duas chamadas simultâneas (mesma
   sessão) terminam em estado terminal (`synced`/`failed`) cada uma — nenhuma
   fica presa em `pending`/`syncing` por causa de um flush concorrente que
   nunca a tocou, confirmando que o bloqueio 1 não reaparece sob concorrência
   real do navegador.
9. **UUID**: com `crypto.randomUUID` disponível, `client_op_id` é um UUID
   válido; com `randomUUID` removido em runtime (mas `getRandomValues`
   presente), o fallback ainda gera um UUID v4 válido; com as duas fontes
   removidas, a operação não é persistida na fila (`op.id === ''`,
   `state === 'failed'`) — nunca um id incompatível chega perto de uma RPC.

**Cenários pedidos e NÃO cobertos por automação de navegador nesta entrega**
(limitação confirmada, não contornada — priorização de tempo, não
dificuldade técnica): 3 (reenvio pós-aplicação-no-servidor-mas-antes-da-
resposta-chegar-ao-cliente — coberto indiretamente pelos testes pgTAP de
idempotência de `client_op_id`, mas não reproduzido como uma falha de rede
real via Playwright), 5 (duas abas/dispositivos revisando o mesmo flashcard
simultaneamente — a serialização por `select ... for update` está coberta
pelo pgTAP existente, não por dois `BrowserContext` reais revisando ao mesmo
tempo), 7 como reload explícito com uma operação real presa em `syncing` no
momento do reload (a limpeza de `syncing` órfão no início de `runFlush` está
implementada e coberta indiretamente pelo cenário 2, mas não com uma prova
determinística de "estava em `syncing`, reload, não passou de "pending" pra
sempre" isolada), 8 (erros de sessão expirada, RLS/permissão, schema
ausente e número máximo de tentativas — cobertos pela lógica de
`classifySyncError` e pelos testes pgTAP de ownership/validação, não
reproduzidos individualmente via navegador), e 10 (os sete sub-casos pedidos
de recuperação legada — a lógica está implementada e documentada acima com
testes de leitura de código, mas não há teste de navegador ponta a ponta
criando dado legado pré-existente e validando os três desfechos via UI).
**Não declarar esses sub-cenários como testados em navegador** — ficam como
pendência explícita para uma sessão futura com mais tempo dedicado à
automação (a infraestrutura de teste — usuários, Playwright, DB local — já
está pronta e documentada acima, é trabalho de extensão, não de descoberta).

## Resumo do que está pronto para revisão de merge

- Migration `20260909120000_sync_reliability.sql` aplicada e testada só em
  Supabase LOCAL — **não aplicada no remoto** (fora do escopo desta sessão:
  só pode escrever/rodar contra o Supabase local). Nenhuma alteração de
  schema foi necessária no 07-B — os quatro bloqueios eram todos client-side.
- Código cliente (`syncQueue.ts`, `syncHandlers.ts`, `legacyRecovery.ts`,
  `SyncStatusIndicator.tsx`, `AnswersRepository.ts`,
  `FlashcardsRepository.ts`) compila (`tsc --noEmit`) e builda (`npm run
  build`) limpo, e **foi exercitado em navegador real (Playwright/Chromium)
  no 07-B** para os cenários listados acima — não mais só por leitura de
  código.
- Categorias 3-9 permanecem no padrão antigo, com o plano de correção
  documentado acima (Etapa 4) — favoritos e progresso de leitura precisam de
  uma mudança de contrato antes de qualquer fila automática de retry.
