-- ============================================================================
-- SynapseMed — pgTAP da migration 20260911120000_flashcard_srs_unique_creation.sql
-- (Prompt 11-B2): unicidade real de (user_id, question_origin_id) para
-- flashcards criados a partir de questão + RPC
-- `create_flashcard_from_question` (idempotência por id/replay, ownership,
-- flashcard personalizado sem origem não deduplicado).
--
-- Concorrência real entre duas conexões simultâneas (duas abas disputando o
-- mesmo instante) é provada separadamente por script Node com dois clientes
-- Supabase distintos contra o Supabase local (ver
-- docs/diretoria/retornos/11-B2.txt) — pgTAP roda numa sessão só, então os
-- cenários "concorrentes" abaixo são sequenciais: provam a unicidade/
-- idempotência do contrato do servidor, não a corrida em si.
-- ============================================================================

select plan(18);

select tests.clear_auth();

select tests.create_user('fcsrs.a@test.local', 'student', 'active') as v_user_a \gset
select tests.create_user('fcsrs.b@test.local', 'student', 'active') as v_user_b \gset

insert into public.disciplines (name, code, cycle) values ('Disciplina FCSRS Teste', 'FCSRS-' || substr(gen_random_uuid()::text, 1, 8), 'clinico')
returning id as v_discipline_id \gset

insert into public.themes (discipline_id, name) values (:'v_discipline_id', 'Tema FCSRS Teste')
returning id as v_theme_id \gset

insert into public.questions (discipline_id, theme_id, cycle, difficulty, clinical_vignette, question_stem)
values (:'v_discipline_id', :'v_theme_id', 'clinico', 'medio', 'Vinheta FCSRS', 'Enunciado FCSRS')
returning id as v_question_id \gset

-- ----------------------------------------------------------------------------
-- 1. Índice único: schema garante unicidade autoritativa
-- ----------------------------------------------------------------------------

select has_index('public', 'flashcards', 'flashcards_user_question_origin_uq', 'índice único (user_id, question_origin_id) existe');

select is(
  (select indisunique from pg_index where indexrelid = 'public.flashcards_user_question_origin_uq'::regclass),
  true,
  'índice é único'
);

-- ----------------------------------------------------------------------------
-- 2. Criação simples + idempotência por replay (mesmo id reenviado)
-- ----------------------------------------------------------------------------

select tests.authenticate_as(:'v_user_a');

select gen_random_uuid() as v_card_id \gset

select lives_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, %L, 'front', 'back', null, '{}', 'medio', false) $$,
    :'v_card_id', :'v_discipline_id', :'v_theme_id', :'v_question_id'
  ),
  'criação inicial não lança erro'
);

select is(
  (select count(*)::int from public.flashcards where user_id = :'v_user_a' and question_origin_id = :'v_question_id'),
  1,
  'exatamente 1 flashcard criado para (usuário, questão)'
);

select is(
  (select count(*)::int from public.flashcard_srs_state where flashcard_id = :'v_card_id'),
  1,
  'flashcard_srs_state criado junto (1 linha)'
);

-- Replay: mesma chamada, mesmo id -> idempotente, nenhuma linha nova.
select lives_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, %L, 'front', 'back', null, '{}', 'medio', false) $$,
    :'v_card_id', :'v_discipline_id', :'v_theme_id', :'v_question_id'
  ),
  'replay (mesmo id) não lança erro'
);

select is(
  (select count(*)::int from public.flashcards where user_id = :'v_user_a' and question_origin_id = :'v_question_id'),
  1,
  'replay não duplica o flashcard'
);

-- ----------------------------------------------------------------------------
-- 3. "Concorrência" sequencial: segundo id DIFERENTE para o MESMO usuário e
--    MESMA questão deve convergir para o flashcard já existente, não criar
--    um segundo (prova a unicidade do lado do servidor; a corrida real de
--    duas conexões simultâneas é responsabilidade do script Node/Playwright).
-- ----------------------------------------------------------------------------

select gen_random_uuid() as v_card_id_2 \gset

select lives_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, %L, 'front 2', 'back 2', null, '{}', 'medio', false) $$,
    :'v_card_id_2', :'v_discipline_id', :'v_theme_id', :'v_question_id'
  ),
  'segunda tentativa com id diferente não lança erro (converge, não falha)'
);

select is(
  (select count(*)::int from public.flashcards where user_id = :'v_user_a' and question_origin_id = :'v_question_id'),
  1,
  'ainda exatamente 1 flashcard para (usuário, questão) após a segunda tentativa'
);

select is(
  (
    select id from public.create_flashcard_from_question(
      :'v_card_id_2'::uuid, :'v_discipline_id'::uuid, :'v_theme_id'::uuid, null::uuid, :'v_question_id'::uuid,
      'front 2'::text, 'back 2'::text, null::text, '{}'::text[], 'medio'::text, false::boolean
    )
  ),
  :'v_card_id',
  'a chamada com id novo devolve o flashcard CANÔNICO já existente (id original), não um novo'
);

-- ----------------------------------------------------------------------------
-- 4. Isolamento entre usuários: B pode criar seu próprio flashcard para a
--    MESMA questão sem colidir com o de A.
-- ----------------------------------------------------------------------------

select tests.authenticate_as(:'v_user_b');

select gen_random_uuid() as v_card_id_b \gset

select lives_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, %L, 'front b', 'back b', null, '{}', 'medio', false) $$,
    :'v_card_id_b', :'v_discipline_id', :'v_theme_id', :'v_question_id'
  ),
  'usuário B consegue criar flashcard para a mesma questão que A já tem'
);

select is(
  (select count(*)::int from public.flashcards where user_id = :'v_user_b' and question_origin_id = :'v_question_id'),
  1,
  'exatamente 1 flashcard de B para a mesma questão'
);

select isnt(
  :'v_card_id_b'::text, :'v_card_id'::text,
  'flashcard de B tem id diferente do de A'
);

-- Ownership: B não consegue "assumir" o id do flashcard de A via replay.
select throws_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, %L, 'front', 'back', null, '{}', 'medio', false) $$,
    :'v_card_id', :'v_discipline_id', :'v_theme_id', :'v_question_id'
  ),
  '42501',
  'flashcard já existe e pertence a outro usuário',
  'B não consegue reusar o id de um flashcard de A (ownership)'
);

-- ----------------------------------------------------------------------------
-- 5. Flashcard personalizado sem origem (question_origin_id null): NUNCA
--    deduplicado — dois cards distintos do mesmo usuário são permitidos.
-- ----------------------------------------------------------------------------

select tests.authenticate_as(:'v_user_a');

select gen_random_uuid() as v_custom_1 \gset
select gen_random_uuid() as v_custom_2 \gset

select lives_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, null, 'custom front 1', 'custom back 1', null, '{}', 'facil', true) $$,
    :'v_custom_1', :'v_discipline_id', :'v_theme_id'
  ),
  'flashcard personalizado 1 (sem origem) criado sem erro'
);

select lives_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, null, 'custom front 2', 'custom back 2', null, '{}', 'facil', true) $$,
    :'v_custom_2', :'v_discipline_id', :'v_theme_id'
  ),
  'flashcard personalizado 2 (sem origem) criado sem erro'
);

select is(
  (select count(*)::int from public.flashcards where user_id = :'v_user_a' and question_origin_id is null),
  2,
  'dois flashcards personalizados sem origem coexistem (sem dedupe indevido)'
);

select tests.clear_auth();

-- Autenticação obrigatória.
select throws_ok(
  format(
    $$ select public.create_flashcard_from_question(%L, %L, %L, null, null, 'x', 'y', null, '{}', 'facil', true) $$,
    gen_random_uuid(), :'v_discipline_id', :'v_theme_id'
  ),
  '28000',
  'usuário não autenticado',
  'chamada sem sessão autenticada é rejeitada'
);

select * from finish();
