# Sincronização confiável entre dispositivos (Prompt 07-A)

> Executado em `C:\Users\vinic\dev\NexusMed\firebase-auth`, branch
> `work/sincronizacao-confiavel-07`. Este documento é o retorno completo da
> Etapa 1 (diagnóstico), Etapa 2 (modelo) e Etapa 3 (UX) do Prompt 07-A, e
> registra o que foi de fato implementado nas Etapas 4-6 (categorias 1 e 2)
> versus o que fica como plano para as demais categorias.

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
- **Isolamento por usuário**: a fila é uma chave de `localStorage` por UID; o handler de uma operação só roda quando ela pertence ao UID atualmente ativo em `flush(userId)` — nunca é possível a fila de um usuário ser enviada sob a sessão de outro, mesmo compartilhando o mesmo navegador.
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

1. Lê o que já existe no servidor (`question_attempts.question_id`,
   `flashcards.id`) — a "simulação" pedida pelo prompt: só decide o que
   enfileirar depois de comparar com o servidor, nunca envia às cegas.
2. Enfileira (nunca insere diretamente) só o que é local e ainda não existe
   remotamente — a fila (`syncQueue`) garante que isso não duplica mesmo que
   o item já tenha sido parcialmente recuperado antes.
3. Mantém um "ledger" local (`synapse_<uid>_sync_legacy_recovered_v1`) para
   não reexaminar o mesmo item a cada login — mas só marca um item como
   "já verificado" depois de uma consulta bem-sucedida ao servidor; se a
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

### O que NÃO foi executado (limitação confirmada, não contornada)

- **Os 15 cenários de dois dispositivos/navegadores pedidos na Etapa 6 do
  prompt** (A escreve, B vê; rede cai durante escrita; reload com pendência;
  reconexão; reenvio repetido; edições concorrentes reais; sessão expirada;
  logout com pendência; login de outra conta no mesmo navegador; RLS;
  schema incompatível; fechar o navegador durante sync) **não foram
  reproduzidos com dois contextos de navegador reais nesta sessão** — esta
  execução não tinha uma ferramenta de automação de navegador (Playwright ou
  equivalente) disponível. O que os testes pgTAP cobrem é a garantia do lado
  do servidor que torna esses cenários seguros de tentar (idempotência,
  isolamento por usuário, atomicidade) — não é o mesmo que observar o
  indicador de status realmente mudar de estado na tela em dois navegadores
  ao vivo. **Não declarar os 15 cenários como testados** — ficam como
  pendência explícita para uma sessão com acesso a automação de navegador.
- Testes de nível de queue em Node/`tsx` (no padrão dos scripts existentes
  `scripts/recover-question-references.ts`) não foram escritos porque
  `syncQueue.ts` depende de APIs de navegador (`localStorage`, `window`,
  `document`, `navigator`) — rodar em Node exigiria simular essas APIs, o
  que testaria o simulador, não o comportamento real do navegador. A
  cobertura de correção fica deliberadamente concentrada na RPC (onde o
  contrato de idempotência/atomicidade é realmente garantido) mais
  `tsc`/`build` (garantindo que o código cliente compila e tipa
  corretamente contra essas RPCs).

## Resumo do que está pronto para revisão de merge

- Migration `20260909120000_sync_reliability.sql` aplicada e testada só em
  Supabase LOCAL — **não aplicada no remoto** (fora do escopo desta sessão:
  só pode escrever/rodar contra o Supabase local).
- Código cliente (`syncQueue.ts`, `syncHandlers.ts`, `legacyRecovery.ts`,
  `SyncStatusIndicator.tsx`, mudanças em `AnswersRepository.ts` e
  `FlashcardsRepository.ts`) compila e builda limpo, mas **não foi exercitado
  em navegador real nesta sessão** (sem ambiente de automação disponível) —
  só por leitura de código e pelos testes de servidor acima.
- Categorias 3-9 permanecem no padrão antigo, com o plano de correção
  documentado acima (Etapa 4) — favoritos e progresso de leitura precisam de
  uma mudança de contrato antes de qualquer fila automática de retry.
