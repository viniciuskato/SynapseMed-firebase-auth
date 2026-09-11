-- Reconciliação de um grupo duplicado de flashcards SRS
-- (mesmo user_id + question_origin_id, violando o índice único que a
-- migration 20260911120000_flashcard_srs_unique_creation.sql passa a
-- impor para criações novas — mas não limpa duplicatas já existentes).
--
-- Prompt 11-B3 (2026-09-11). NÃO contém IDs reais — são parâmetros psql
-- (:'keep_id' etc.) que devem ser passados na invocação, nunca editados
-- neste arquivo. Um arquivo separado, git-ignorado, com os IDs reais do
-- grupo remoto confirmado pode chamar este script via `\i`.
--
-- Uso (dry-run, padrão — NÃO commita nada, sempre faz ROLLBACK):
--   psql "$DB_URL" \
--     -v keep_id="'8090042a-...'" \
--     -v remove_id="'de9cae09-...'" \
--     -v expected_user_id="'06948458-...'" \
--     -v expected_question_origin_id="'ef5c8134-...'" \
--     -v dry_run=true \
--     -f scripts/reconcile-flashcard-duplicate.sql
--
-- Uso real (aplica de verdade, exige dry_run=false explícito):
--   ... -v dry_run=false -f scripts/reconcile-flashcard-duplicate.sql
--
-- Pré-condições verificadas (o script ABORTA — RAISE EXCEPTION, ROLLBACK
-- automático da transação inteira — se qualquer uma falhar):
--   1. keep_id e remove_id existem em flashcards.
--   2. Ambos pertencem ao MESMO user_id, igual a :expected_user_id.
--   3. Ambos têm o MESMO question_origin_id, igual a
--      :expected_question_origin_id (nunca um padrão de busca solto —
--      só esse par exato).
--   4. keep_id.created_at <= remove_id.created_at (a diretoria recomenda
--      manter o mais antigo; o script recusa inverter essa ordem sem
--      confirmação humana explícita nos parâmetros — quem chama decide
--      qual id é "keep", o script só valida que bate com created_at).
--   5. Conteúdo (front || back || mechanism_highlight) IDÊNTICO entre as
--      duas linhas. Se divergir, o script NÃO apaga nada — grava as duas
--      versões completas em flashcard_reconciliation_review (criada sob
--      demanda, nunca apagada por este script) e aborta com instrução
--      para decisão humana. Preservar os dois textos vem antes de
--      qualquer remoção.
--
-- O que faz quando as pré-condições passam e o conteúdo é equivalente:
--   - Migra flashcard_reviews de remove_id para keep_id, mas só os
--     eventos que NÃO são duplicata exata (mesmo reviewed_at + rating)
--     de um evento já existente em keep_id — evita duplicar histórico.
--   - Reaponta bookmarks/notes de remove_id para keep_id; se keep_id já
--     tiver o mesmo bookmark/nota (índice único), descarta o duplicado
--     de remove_id em vez de violar a constraint.
--   - Revalida o estado SRS final de keep_id: se remove_id tinha MAIS
--     repetições (srs progrediu mais), adota o estado SRS de remove_id
--     (não o descarta silenciosamente); caso contrário mantém o de
--     keep_id. Nunca faz média nem inventa um estado novo.
--   - Apaga a linha remove_id (flashcard_reviews dela já foi migrada,
--     cascade cuida do resto).
--   - Valida ao final: exatamente 1 linha para (user_id,
--     question_origin_id); contagem de flashcard_reviews de keep_id =
--     soma pré-existente + migrados (nunca menor, nunca maior por
--     duplicação); nenhuma linha órfã em bookmarks/notes apontando pro
--     id removido.
--   - dry_run=true (padrão): executa tudo dentro da transação, imprime
--     o resultado via RAISE NOTICE, depois força ROLLBACK — nenhuma
--     escrita persiste. dry_run=false: COMMIT ao final, só se todas as
--     validações passarem; qualquer falha de validação pós-escrita
--     também força ROLLBACK (nunca deixa o banco num estado
--     intermediário).

\set ON_ERROR_STOP on

-- psql NÃO interpola :variavel dentro de corpo $$...$$ (é tratado como
-- string literal para fins de varredura) — por isso os parâmetros são
-- passados via GUC de sessão (set_config, interpolado aqui FORA do
-- bloco DO) e lidos dentro do bloco com current_setting().
select set_config('recon.keep_id', :'keep_id', false);
select set_config('recon.remove_id', :'remove_id', false);
select set_config('recon.expected_user_id', :'expected_user_id', false);
select set_config('recon.expected_question_origin_id', :'expected_question_origin_id', false);
select set_config('recon.dry_run', :'dry_run', false);

-- Checagem de conteúdo e preservação ANTES de abrir a transação principal
-- e de propósito FORA dela: se o conteúdo divergir, a linha gravada em
-- flashcard_reconciliation_review precisa sobreviver mesmo que o resto
-- do procedimento aborte/rollback logo depois — um RAISE EXCEPTION
-- dentro do mesmo bloco/transação que fez o INSERT desfaria o INSERT
-- também, o que anularia a garantia de "preservar antes de apagar".
create table if not exists public.flashcard_reconciliation_review (
  id uuid primary key default gen_random_uuid(),
  detected_at timestamptz not null default now(),
  user_id uuid not null,
  question_origin_id uuid not null,
  keep_id uuid not null,
  remove_id uuid not null,
  keep_front text not null,
  keep_back text not null,
  remove_front text not null,
  remove_back text not null,
  resolved boolean not null default false
);

select set_config(
  'recon.content_matches',
  (
    select (
      md5(coalesce(k.front,'') || '|' || coalesce(k.back,'') || '|' || coalesce(k.mechanism_highlight,''))
      = md5(coalesce(r.front,'') || '|' || coalesce(r.back,'') || '|' || coalesce(r.mechanism_highlight,''))
    )::text
    from flashcards k, flashcards r
    where k.id = current_setting('recon.keep_id')::uuid
      and r.id = current_setting('recon.remove_id')::uuid
  ),
  false
);

-- INSERT ... SELECT com WHERE: só grava linha quando o conteúdo diverge
-- (quando content_matches='true' a condição é falsa, 0 linhas inseridas,
-- sem efeito). Roda como statement autocommit próprio, sobrevive mesmo
-- que a transação principal abaixo aborte.
insert into public.flashcard_reconciliation_review
  (user_id, question_origin_id, keep_id, remove_id, keep_front, keep_back, remove_front, remove_back)
select
  current_setting('recon.expected_user_id')::uuid,
  current_setting('recon.expected_question_origin_id')::uuid,
  k.id, r.id, k.front, k.back, r.front, r.back
from flashcards k, flashcards r
where k.id = current_setting('recon.keep_id')::uuid
  and r.id = current_setting('recon.remove_id')::uuid
  and current_setting('recon.content_matches') = 'false';

select current_setting('recon.content_matches') as content_matches \gset

\if :content_matches
begin;

do $$
declare
  v_keep_id uuid := current_setting('recon.keep_id')::uuid;
  v_remove_id uuid := current_setting('recon.remove_id')::uuid;
  v_expected_user_id uuid := current_setting('recon.expected_user_id')::uuid;
  v_expected_question_origin_id uuid := current_setting('recon.expected_question_origin_id')::uuid;
  v_dry_run boolean := current_setting('recon.dry_run')::boolean;

  v_keep record;
  v_remove record;
  v_migrated_reviews int := 0;
  v_dup_skipped_reviews int := 0;
  v_reviews_before int;
  v_reviews_after int;
  v_final_group_count int;
  v_adopt_remove_srs boolean := false;
begin
  raise notice 'Iniciando reconciliação: keep=% remove=% dry_run=%', v_keep_id, v_remove_id, v_dry_run;

  -- Pré-condição 1: ambas as linhas existem, lock explícito.
  select * into v_keep from flashcards where id = v_keep_id for update;
  if not found then
    raise exception 'keep_id % não existe em flashcards', v_keep_id;
  end if;

  select * into v_remove from flashcards where id = v_remove_id for update;
  if not found then
    raise exception 'remove_id % não existe em flashcards', v_remove_id;
  end if;

  -- Pré-condição 2 e 3: mesmo usuário e mesma questão de origem, batendo
  -- exatamente com o que foi passado como parâmetro (nunca um padrão
  -- solto — só esse par exato).
  if v_keep.user_id is distinct from v_expected_user_id
     or v_remove.user_id is distinct from v_expected_user_id then
    raise exception 'user_id não bate com o esperado (keep=%, remove=%, esperado=%)',
      v_keep.user_id, v_remove.user_id, v_expected_user_id;
  end if;

  if v_keep.question_origin_id is distinct from v_expected_question_origin_id
     or v_remove.question_origin_id is distinct from v_expected_question_origin_id then
    raise exception 'question_origin_id não bate com o esperado (keep=%, remove=%, esperado=%)',
      v_keep.question_origin_id, v_remove.question_origin_id, v_expected_question_origin_id;
  end if;

  -- Pré-condição 4: keep é de fato o mais antigo (ou igual).
  if v_keep.created_at > v_remove.created_at then
    raise exception 'keep_id (created_at=%) é mais NOVO que remove_id (created_at=%) — recomendação padrão da diretoria é manter o mais antigo; inverter isso exige revisão humana explícita, não automação',
      v_keep.created_at, v_remove.created_at;
  end if;

  -- Pré-condição 5 (conteúdo equivalente) já foi verificada e, se
  -- divergente, preservada em flashcard_reconciliation_review e o script
  -- nem chega a abrir esta transação (ver bloco \if fora do DO acima).
  -- Reconfirma aqui só como defesa em profundidade contra corrida entre
  -- a checagem e este ponto (ex.: outra sessão editou o conteúdo nesse
  -- meio-tempo) — se acontecer, aborta sem apagar nada; a preservação
  -- para esse caso raro fica pendente de nova execução do script.
  if md5(coalesce(v_keep.front,'') || '|' || coalesce(v_keep.back,'') || '|' || coalesce(v_keep.mechanism_highlight,''))
     is distinct from
     md5(coalesce(v_remove.front,'') || '|' || coalesce(v_remove.back,'') || '|' || coalesce(v_remove.mechanism_highlight,'')) then
    raise exception 'Conteúdo divergiu entre a pré-checagem e a transação (corrida rara) — nada foi apagado, execute o script de novo';
  end if;

  select count(*) into v_reviews_before from flashcard_reviews where flashcard_id = v_keep_id;

  -- Migra reviews de remove_id que NÃO são duplicata exata (mesmo
  -- reviewed_at + rating) de um evento já presente em keep_id.
  with candidatos as (
    select r.id, r.reviewed_at, r.rating
    from flashcard_reviews r
    where r.flashcard_id = v_remove_id
      and not exists (
        select 1 from flashcard_reviews k
        where k.flashcard_id = v_keep_id
          and k.reviewed_at = r.reviewed_at
          and k.rating = r.rating
      )
  ), movidos as (
    update flashcard_reviews
    set flashcard_id = v_keep_id
    where id in (select id from candidatos)
    returning id
  )
  select count(*) into v_migrated_reviews from movidos;

  select count(*) into v_dup_skipped_reviews
  from flashcard_reviews r
  where r.flashcard_id = v_remove_id; -- sobras = duplicatas exatas, apagadas pelo cascade do delete abaixo

  -- Reaponta bookmarks, descartando duplicata se keep_id já tiver o
  -- mesmo bookmark (índice único bookmarks_user_flashcard_uq).
  delete from bookmarks b
  where b.flashcard_id = v_remove_id
    and exists (
      select 1 from bookmarks k
      where k.flashcard_id = v_keep_id and k.user_id = b.user_id
    );
  update bookmarks set flashcard_id = v_keep_id where flashcard_id = v_remove_id;

  -- Reaponta notes da mesma forma (índice único equivalente para notes,
  -- se existir; se não houver conflito, o UPDATE simplesmente move).
  delete from notes n
  where n.flashcard_id = v_remove_id
    and exists (
      select 1 from notes k
      where k.flashcard_id = v_keep_id and k.user_id = n.user_id
    );
  update notes set flashcard_id = v_keep_id where flashcard_id = v_remove_id;

  -- Estado SRS final: adota o de remove_id só se ele tiver progredido
  -- mais (mais repetições) que o de keep_id; nunca faz média.
  select exists (
    select 1
    from flashcard_srs_state ks, flashcard_srs_state rs
    where ks.flashcard_id = v_keep_id
      and rs.flashcard_id = v_remove_id
      and rs.repetition_count > ks.repetition_count
  ) into v_adopt_remove_srs;

  if v_adopt_remove_srs then
    declare
      v_keep_reps_before int;
      v_remove_reps int;
    begin
      select repetition_count into v_keep_reps_before from flashcard_srs_state where flashcard_id = v_keep_id;
      select repetition_count into v_remove_reps from flashcard_srs_state where flashcard_id = v_remove_id;
      update flashcard_srs_state ks
      set interval_days = rs.interval_days,
          repetition_count = rs.repetition_count,
          ease_factor = rs.ease_factor,
          next_due_date = rs.next_due_date,
          last_reviewed_date = rs.last_reviewed_date,
          state = rs.state,
          updated_at = now()
      from flashcard_srs_state rs
      where ks.flashcard_id = v_keep_id and rs.flashcard_id = v_remove_id;
      raise notice 'Estado SRS de remove_id adotado (progrediu mais: % repetições vs % do keep_id antes da atualização)',
        v_remove_reps, v_keep_reps_before;
    end;
  end if;

  -- Apaga a linha excedente (cascade cuida de flashcard_srs_state e do
  -- que sobrou em flashcard_reviews — só duplicatas exatas a esta
  -- altura, já que o resto foi migrado acima).
  delete from flashcards where id = v_remove_id;

  -- Validações pós-escrita.
  select count(*) into v_final_group_count
  from flashcards
  where user_id = v_expected_user_id and question_origin_id = v_expected_question_origin_id;

  if v_final_group_count <> 1 then
    raise exception 'Pós-condição falhou: esperava exatamente 1 flashcard restante para o grupo, encontrei %', v_final_group_count;
  end if;

  select count(*) into v_reviews_after from flashcard_reviews where flashcard_id = v_keep_id;
  if v_reviews_after <> v_reviews_before + v_migrated_reviews then
    raise exception 'Pós-condição falhou: contagem de reviews pós-migração (%) != pré (%) + migrados (%)',
      v_reviews_after, v_reviews_before, v_migrated_reviews;
  end if;

  if exists (select 1 from bookmarks where flashcard_id = v_remove_id)
     or exists (select 1 from notes where flashcard_id = v_remove_id)
     or exists (select 1 from flashcard_reviews where flashcard_id = v_remove_id) then
    raise exception 'Pós-condição falhou: sobrou referência órfã a remove_id % depois do delete', v_remove_id;
  end if;

  raise notice 'OK: grupo reconciliado. reviews_migrados=% reviews_pre=% reviews_pos=% srs_adotado_de_remove=%',
    v_migrated_reviews, v_reviews_before, v_reviews_after, v_adopt_remove_srs;

  if v_dry_run then
    raise notice 'DRY-RUN: todas as validações passaram; a transação será revertida de propósito a seguir (nenhuma escrita persistida)';
  end if;
end $$;

-- dry_run=true (padrão): reverte tudo, nenhuma escrita persiste.
-- dry_run=false: só chega aqui se NENHUMA exceção foi lançada acima
-- (qualquer falha de pré/pós-condição já abortou a transação antes
-- deste ponto, via RAISE EXCEPTION dentro do bloco DO).
\if :dry_run
rollback;
\else
commit;
\endif
\else
\echo 'Conteudo DIVERGENTE: nada foi apagado. Os dois textos completos ficaram preservados em public.flashcard_reconciliation_review (linha nao resolvida) para decisao humana.'
\endif
