-- ============================================================================
-- SynapseMed — Fundação Supabase — Etapa 1
-- Migration: rls_policies
--
-- Conteúdo: schema "app" (helpers internos, não expostos via API), Row Level
-- Security de todas as tabelas, triggers de proteção de profiles, triggers de
-- integridade editorial (imutabilidade de questões published/archived) e as
-- funções RPC públicas admin_set_profile_status / publish_question /
-- submit_question_attempt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Schema "app": helpers internos de autorização.
-- NÃO listado em supabase/config.toml [api].schemas — logo não existe rota
-- REST/RPC para nada aqui, mesmo com GRANT EXECUTE concedido. O GRANT abaixo
-- só permite que o Postgres avalie a função DENTRO da expressão USING/WITH
-- CHECK de uma policy quando a query é executada pelo role "authenticated".
-- ----------------------------------------------------------------------------

create schema if not exists app;

revoke all on schema app from public;
grant usage on schema app to authenticated;
-- "anon" não recebe USAGE: as policies aplicadas a anon são sempre
-- `using (false)` hardcoded, sem chamar nenhum helper.

create or replace function app.is_admin_active(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_uid and role = 'admin' and status = 'active'
  );
$$;

create or replace function app.current_profile_status(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.profiles where id = p_uid;
$$;

revoke all on function app.is_admin_active(uuid) from public;
grant execute on function app.is_admin_active(uuid) to authenticated;

revoke all on function app.current_profile_status(uuid) from public;
grant execute on function app.current_profile_status(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Ativação de RLS em todas as tabelas expostas pela API
-- ----------------------------------------------------------------------------

alter table public.disciplines enable row level security;
alter table public.themes enable row level security;
alter table public.materials enable row level security;
alter table public.material_sections enable row level security;
alter table public.material_references enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.question_option_keys enable row level security;
alter table public.content_assets enable row level security;
alter table public.profiles enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_srs_state enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notes enable row level security;
alter table public.reading_progress enable row level security;
alter table public.question_attempts enable row level security;
alter table public.error_notebook enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_questions enable row level security;
alter table public.simulation_answers enable row level security;
alter table public.feedback enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------

-- Camada 1: privilégio de coluna — authenticated só escreve display_name/avatar_url.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_select_admin_all
  on public.profiles for select
  to authenticated
  using (app.is_admin_active(auth.uid()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Nenhuma policy de INSERT/DELETE para authenticated: criação é só via trigger
-- handle_new_user (contexto de sistema); delete permanece bloqueado nesta etapa.

-- Camada 2: trigger de defesa em profundidade, baseada em current_user real
-- (não em GUC/flag setável). SECURITY INVOKER (sem SECURITY DEFINER) para que
-- current_user reflita quem de fato emitiu o UPDATE.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at
  then
    raise exception 'id/email/created_at são imutáveis nesta etapa';
  end if;

  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and current_user <> 'postgres'
  then
    raise exception 'role/status só podem ser alterados via admin_set_profile_status()';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Trigger de criação de perfil após signup em auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, role, status)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), ''),
    'student',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Única via administrativa para alterar role/status (não genérica: parâmetros
-- tipados e validados, não aceita SQL arbitrário nem uid livre sem checagem).
create or replace function public.admin_set_profile_status(
  p_user_id uuid,
  p_role text,
  p_status text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.profiles;
begin
  if not app.is_admin_active(auth.uid()) then
    raise exception 'apenas administradores ativos podem alterar role/status';
  end if;

  if p_role not in ('student', 'admin') then
    raise exception 'role inválido: %', p_role;
  end if;
  if p_status not in ('pending', 'active', 'blocked') then
    raise exception 'status inválido: %', p_status;
  end if;

  update public.profiles
  set role = p_role, status = p_status
  where id = p_user_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'perfil não encontrado: %', p_user_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_set_profile_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_profile_status(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- CONTEÚDO EDITORIAL: disciplines, themes, materials, material_sections,
-- material_references, questions, question_options, content_assets
-- ----------------------------------------------------------------------------

-- disciplines / themes: não têm campo "status" próprio (são taxonomia, não
-- conteúdo em si) — leitura liberada a qualquer authenticated active;
-- escrita só admin active.
create policy disciplines_select_active
  on public.disciplines for select
  to authenticated
  using (app.current_profile_status(auth.uid()) = 'active' or app.is_admin_active(auth.uid()));

create policy disciplines_admin_write
  on public.disciplines for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy themes_select_active
  on public.themes for select
  to authenticated
  using (app.current_profile_status(auth.uid()) = 'active' or app.is_admin_active(auth.uid()));

create policy themes_admin_write
  on public.themes for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy materials_select_published
  on public.materials for select
  to authenticated
  using (
    (status = 'published' and app.current_profile_status(auth.uid()) = 'active')
    or app.is_admin_active(auth.uid())
  );

create policy materials_admin_write
  on public.materials for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy material_sections_select_published
  on public.material_sections for select
  to authenticated
  using (
    app.is_admin_active(auth.uid())
    or exists (
      select 1 from public.materials m
      where m.id = material_id and m.status = 'published'
    ) and app.current_profile_status(auth.uid()) = 'active'
  );

create policy material_sections_admin_write
  on public.material_sections for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy material_references_select_published
  on public.material_references for select
  to authenticated
  using (
    app.is_admin_active(auth.uid())
    or exists (
      select 1 from public.materials m
      where m.id = material_id and m.status = 'published'
    ) and app.current_profile_status(auth.uid()) = 'active'
  );

create policy material_references_admin_write
  on public.material_references for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy questions_select_published
  on public.questions for select
  to authenticated
  using (
    (status = 'published' and app.current_profile_status(auth.uid()) = 'active')
    or app.is_admin_active(auth.uid())
  );

create policy questions_admin_write
  on public.questions for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy question_options_select_published
  on public.question_options for select
  to authenticated
  using (
    app.is_admin_active(auth.uid())
    or exists (
      select 1 from public.questions q
      where q.id = question_id and q.status = 'published'
    ) and app.current_profile_status(auth.uid()) = 'active'
  );

create policy question_options_admin_write
  on public.question_options for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

-- question_answer_keys / question_option_keys: SEM policy de select para
-- estudante — só admin. O acesso do estudante ao gabarito é exclusivamente
-- via retorno da RPC submit_question_attempt (SECURITY DEFINER, abaixo).
create policy question_answer_keys_admin_all
  on public.question_answer_keys for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy question_option_keys_admin_all
  on public.question_option_keys for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

create policy content_assets_select_published
  on public.content_assets for select
  to authenticated
  using (
    app.is_admin_active(auth.uid())
    or (
      app.current_profile_status(auth.uid()) = 'active'
      and (
        exists (select 1 from public.materials m where m.id = material_id and m.status = 'published')
        or exists (
          select 1 from public.material_sections ms join public.materials m on m.id = ms.material_id
          where ms.id = material_section_id and m.status = 'published'
        )
        or exists (select 1 from public.questions q where q.id = question_id and q.status = 'published')
      )
    )
  );

create policy content_assets_admin_write
  on public.content_assets for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

-- ----------------------------------------------------------------------------
-- Integridade editorial: draft -> published -> draft/archived
-- ----------------------------------------------------------------------------

-- questions.status default 'draft' já definido em initial_schema.sql.

-- (a) Nenhuma linha pode ser inserida já published; nenhuma transição para
--     published fora de publish_question() (rodando como "postgres").
create or replace function public.guard_question_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then
      raise exception 'não é permitido inserir questão já publicada; crie em draft e use publish_question()';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status = 'published'
       and old.status is distinct from 'published'
       and current_user <> 'postgres'
    then
      raise exception 'transição para published (inclusive a partir de archived) só é permitida via publish_question()';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_guard_question_publish
  before insert or update on public.questions
  for each row execute function public.guard_question_publish();

-- (b) Questão published não pode ser excluída (sem exceção nem para postgres).
create or replace function public.guard_question_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'questão publicada não pode ser excluída; mova para draft ou archived antes';
  end if;
  return old;
end;
$$;

create trigger trg_guard_question_delete
  before delete on public.questions
  for each row execute function public.guard_question_delete();

-- (c) Conteúdo editorial de questions fica congelado enquanto published OU
--     archived. Só a coluna status pode mudar nesse estado, e nunca junto
--     com conteúdo no mesmo UPDATE. updated_at é sempre atualizado aqui.
create or replace function public.guard_question_content_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status in ('published', 'archived') then
    if new.discipline_id is distinct from old.discipline_id
       or new.theme_id is distinct from old.theme_id
       or new.material_id is distinct from old.material_id
       or new.material_section_id is distinct from old.material_section_id
       or new.cycle is distinct from old.cycle
       or new.difficulty is distinct from old.difficulty
       or new.institution is distinct from old.institution
       or new.year is distinct from old.year
       or new.clinical_vignette is distinct from old.clinical_vignette
       or new.question_stem is distinct from old.question_stem
       or new.tags is distinct from old.tags
       or new.provenance is distinct from old.provenance
       or new.source is distinct from old.source
       or new.license is distinct from old.license
    then
      if new.status is distinct from old.status then
        raise exception 'não é permitido alterar status e conteúdo editorial no mesmo UPDATE';
      else
        raise exception 'questão % está congelada; altere status para draft antes de editar conteúdo', old.status;
      end if;
    end if;
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger trg_guard_question_content_immutable
  before update on public.questions
  for each row execute function public.guard_question_content_immutable();

-- (d) question_option_keys.question_id é sempre derivado do option_id
--     informado — nunca aceito diretamente do cliente.
create or replace function public.set_question_option_keys_question_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select question_id into new.question_id from public.question_options where id = new.option_id;
  if new.question_id is null then
    raise exception 'option_id inválido: %', new.option_id;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger trg_set_question_option_keys_question_id
  before insert or update on public.question_option_keys
  for each row execute function public.set_question_option_keys_question_id();

-- (d.1) Estratégia A: toda question_option inserida ganha automaticamente uma
-- question_option_keys correspondente (is_correct=false, explanation=''),
-- para que publish_question sempre encontre exatamente 1 key por opção e
-- nunca dependa de um INSERT manual separado (fonte do bug relatado pela
-- auditoria: UPDATEs de fixture/seed que assumiam uma linha inexistente).
-- Função trigger-only (sem RPC pública), option_id vem exclusivamente de
-- NEW.id, question_id continua derivado pela trigger acima (trg_set_...).
-- Roda AFTER INSERT: só executa se a linha em question_options já passou
-- pela trigger de imutabilidade (trg_guard_question_options_immutable), ou
-- seja, criar opção em questão published/archived continua bloqueado antes
-- desta trigger sequer ser alcançada.
create or replace function public.create_question_option_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.question_option_keys (option_id, is_correct, explanation)
  values (new.id, false, '');
  return new;
end;
$$;

create trigger trg_create_question_option_key
  after insert on public.question_options
  for each row execute function public.create_question_option_key();

-- (e) Imutabilidade de question_options / question_option_keys /
--     question_answer_keys enquanto a questão pai (antiga OU nova, no caso de
--     UPDATE) estiver published OU archived. Branching explícito por TG_OP —
--     sem COALESCE de records — validando tanto o vínculo antigo quanto o
--     novo, para impedir mover um registro de uma questão travada para outra.

-- Locking de concorrência (ver seção "Concorrência na publicação" no schema
-- doc): antes de ler o status da(s) questão(ões) pai, cada trigger adquire
-- `FOR UPDATE` na(s) linha(s) correspondente(s) de `questions`. Quando dois
-- ids diferentes estão envolvidos (mover um registro de uma questão para
-- outra em um UPDATE), os dois são bloqueados em uma única instrução
-- `... WHERE id IN (...) ORDER BY id FOR UPDATE`, sempre em ordem crescente
-- de id — mesma ordem usada por publish_question — para que duas transações
-- concorrentes nunca tentem bloquear o mesmo par de linhas em ordens opostas
-- (causa clássica de deadlock).
create or replace function public.guard_question_options_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if tg_op = 'INSERT' then
    perform 1 from public.questions where id = new.question_id for update;
    select status into v_new_status from public.questions where id = new.question_id;
    if v_new_status in ('published', 'archived') then
      raise exception 'questão %: retorne para draft antes de inserir alternativas', v_new_status;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    perform 1 from public.questions where id in (old.question_id, new.question_id) order by id for update;
    select status into v_old_status from public.questions where id = old.question_id;
    select status into v_new_status from public.questions where id = new.question_id;
    if v_old_status in ('published', 'archived') or v_new_status in ('published', 'archived') then
      raise exception 'alternativa vinculada a questão published/archived: retorne para draft antes de editar ou mover';
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    perform 1 from public.questions where id = old.question_id for update;
    select status into v_old_status from public.questions where id = old.question_id;
    if v_old_status in ('published', 'archived') then
      raise exception 'questão %: retorne para draft antes de excluir alternativas', v_old_status;
    end if;
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_guard_question_options_immutable
  before insert or update or delete on public.question_options
  for each row execute function public.guard_question_options_immutable();

create or replace function public.guard_question_option_keys_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_qid uuid;
  v_new_qid uuid;
  v_old_status text;
  v_new_status text;
begin
  if tg_op = 'INSERT' then
    select question_id into v_new_qid from public.question_options where id = new.option_id;
    perform 1 from public.questions where id = v_new_qid for update;
    select status into v_new_status from public.questions where id = v_new_qid;
    if v_new_status in ('published', 'archived') then
      raise exception 'questão %: retorne para draft antes de inserir gabarito', v_new_status;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    select question_id into v_old_qid from public.question_options where id = old.option_id;
    select question_id into v_new_qid from public.question_options where id = new.option_id;
    perform 1 from public.questions where id in (v_old_qid, v_new_qid) order by id for update;
    select status into v_old_status from public.questions where id = v_old_qid;
    select status into v_new_status from public.questions where id = v_new_qid;
    if v_old_status in ('published', 'archived') or v_new_status in ('published', 'archived') then
      raise exception 'gabarito vinculado a questão published/archived: retorne para draft antes de editar ou mover';
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    select question_id into v_old_qid from public.question_options where id = old.option_id;
    perform 1 from public.questions where id = v_old_qid for update;
    select status into v_old_status from public.questions where id = v_old_qid;
    if v_old_status in ('published', 'archived') then
      raise exception 'questão %: retorne para draft antes de excluir gabarito', v_old_status;
    end if;
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_guard_question_option_keys_immutable
  before insert or update or delete on public.question_option_keys
  for each row execute function public.guard_question_option_keys_immutable();

create or replace function public.guard_question_answer_keys_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if tg_op = 'INSERT' then
    perform 1 from public.questions where id = new.question_id for update;
    select status into v_new_status from public.questions where id = new.question_id;
    if v_new_status in ('published', 'archived') then
      raise exception 'questão %: retorne para draft antes de inserir comentários', v_new_status;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    perform 1 from public.questions where id in (old.question_id, new.question_id) order by id for update;
    select status into v_old_status from public.questions where id = old.question_id;
    select status into v_new_status from public.questions where id = new.question_id;
    if v_old_status in ('published', 'archived') or v_new_status in ('published', 'archived') then
      raise exception 'comentários vinculados a questão published/archived: retorne para draft antes de editar ou mover';
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    perform 1 from public.questions where id = old.question_id for update;
    select status into v_old_status from public.questions where id = old.question_id;
    if v_old_status in ('published', 'archived') then
      raise exception 'questão %: retorne para draft antes de excluir comentários', v_old_status;
    end if;
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_guard_question_answer_keys_immutable
  before insert or update or delete on public.question_answer_keys
  for each row execute function public.guard_question_answer_keys_immutable();

-- (f) publish_question: única via de transição para published. Valida
--     conjunto completo antes de liberar. Não executável por estudante
--     (checagem interna de app.is_admin_active).
create or replace function public.publish_question(p_question_id uuid)
returns public.questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_option_count int;
  v_option_key_count int;
  v_correct_count int;
  v_missing_explanations int;
  v_answer_key_count int;
  v_general_commentary text;
  v_high_yield_summary text;
  v_result public.questions;
begin
  if not app.is_admin_active(auth.uid()) then
    raise exception 'apenas administradores ativos podem publicar questões';
  end if;

  -- Lock da linha da questão ANTES de qualquer validação (ver "Concorrência
  -- na publicação" no schema doc): serializa com qualquer trigger de
  -- question_options/question_option_keys/question_answer_keys que também
  -- adquira FOR UPDATE nesta mesma linha antes de checar o status. Isso
  -- impede que outra transação altere/remova uma alternativa entre a
  -- validação e o UPDATE final de status.
  perform 1 from public.questions where id = p_question_id for update;
  if not found then
    raise exception 'questão não encontrada: %', p_question_id;
  end if;

  select count(*) into v_option_count
  from public.question_options where question_id = p_question_id;
  if v_option_count < 2 then
    raise exception 'questão precisa de ao menos 2 alternativas';
  end if;

  select count(*) into v_option_key_count
  from public.question_option_keys where question_id = p_question_id;
  if v_option_key_count <> v_option_count then
    raise exception 'question_option_keys incompleto: % opções, % keys encontradas', v_option_count, v_option_key_count;
  end if;

  select count(*) into v_correct_count
  from public.question_option_keys
  where question_id = p_question_id and is_correct = true;
  if v_correct_count <> 1 then
    raise exception 'questão precisa de exatamente 1 alternativa correta (encontradas: %)', v_correct_count;
  end if;

  select count(*) into v_missing_explanations
  from public.question_option_keys
  where question_id = p_question_id
    and (explanation is null or length(trim(explanation)) = 0);
  if v_missing_explanations > 0 then
    raise exception 'todas as alternativas precisam de explicação preenchida';
  end if;

  select count(*), max(general_commentary), max(high_yield_summary)
    into v_answer_key_count, v_general_commentary, v_high_yield_summary
  from public.question_answer_keys where question_id = p_question_id;
  if v_answer_key_count <> 1 then
    raise exception 'questão precisa de registro em question_answer_keys';
  end if;
  if v_general_commentary is null or length(trim(v_general_commentary)) = 0 then
    raise exception 'general_commentary não pode estar vazio';
  end if;
  if v_high_yield_summary is null or length(trim(v_high_yield_summary)) = 0 then
    raise exception 'high_yield_summary não pode estar vazio';
  end if;

  update public.questions set status = 'published'
  where id = p_question_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.publish_question(uuid) from public, anon;
grant execute on function public.publish_question(uuid) to authenticated;

-- (g) submit_question_attempt: único caminho para o estudante conhecer o
--     gabarito — só depois de a tentativa ser registrada, e só da questão
--     respondida.
create or replace function public.submit_question_attempt(
  p_question_id uuid,
  p_selected_option_id uuid,
  p_time_spent_seconds int,
  p_error_reason text default null,
  p_user_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_question_status text;
  v_is_correct boolean;
  v_correct_option_id uuid;
  v_result jsonb;
begin
  if app.current_profile_status(v_uid) is distinct from 'active' then
    raise exception 'apenas estudantes ativos podem responder questões';
  end if;

  if p_time_spent_seconds is null or p_time_spent_seconds < 0 or p_time_spent_seconds > 21600 then
    raise exception 'time_spent_seconds fora do intervalo permitido (0-21600)';
  end if;
  if length(coalesce(p_user_notes, '')) > 2000 then
    raise exception 'user_notes excede o tamanho máximo permitido (2000 caracteres)';
  end if;
  if p_error_reason is not null and p_error_reason not in
     ('lacuna_teorica', 'pegadinha', 'falta_atencao', 'tempo_esgotado', 'raciocinio_clinico')
  then
    raise exception 'error_reason inválido: %', p_error_reason;
  end if;

  select status into v_question_status from public.questions where id = p_question_id;
  if not found then
    raise exception 'questão não encontrada: %', p_question_id;
  end if;
  if v_question_status <> 'published' then
    raise exception 'questão não está publicada';
  end if;

  if not exists (
    select 1 from public.question_options
    where id = p_selected_option_id and question_id = p_question_id
  ) then
    raise exception 'alternativa não pertence à questão informada';
  end if;

  select qok.is_correct into v_is_correct
  from public.question_option_keys qok
  where qok.option_id = p_selected_option_id;

  select qo.id into v_correct_option_id
  from public.question_options qo
  join public.question_option_keys qok on qok.option_id = qo.id
  where qo.question_id = p_question_id and qok.is_correct = true;

  insert into public.question_attempts
    (user_id, question_id, selected_option_id, is_correct, time_spent_seconds, error_reason, user_notes, answered_at)
  values
    (v_uid, p_question_id, p_selected_option_id, v_is_correct, p_time_spent_seconds, p_error_reason, p_user_notes, pg_catalog.now());

  if not v_is_correct then
    insert into public.error_notebook
      (user_id, question_id, selected_option_id, correct_option_id, error_reason, user_notes, resolved)
    values
      (v_uid, p_question_id, p_selected_option_id, v_correct_option_id,
       coalesce(p_error_reason, 'lacuna_teorica'), coalesce(p_user_notes, ''), false);
  end if;

  select jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_option_id', v_correct_option_id,
    'general_commentary', qak.general_commentary,
    'high_yield_summary', qak.high_yield_summary,
    'options', (
      select jsonb_agg(jsonb_build_object(
        'option_id', qo.id, 'letter', qo.letter,
        'is_correct', qok.is_correct, 'explanation', qok.explanation
      ) order by qo.sort_order)
      from public.question_options qo
      join public.question_option_keys qok on qok.option_id = qo.id
      where qo.question_id = p_question_id
    )
  ) into v_result
  from public.question_answer_keys qak
  where qak.question_id = p_question_id;

  return v_result;
end;
$$;

revoke all on function public.submit_question_attempt(uuid, uuid, int, text, text) from public, anon;
grant execute on function public.submit_question_attempt(uuid, uuid, int, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- DADOS PESSOAIS: reading_progress, bookmarks, notes, flashcards + SRS,
-- simulations + relacionadas, question_attempts (select/delete),
-- error_notebook, feedback
-- ----------------------------------------------------------------------------

create policy reading_progress_owner_all
  on public.reading_progress for all
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy bookmarks_owner_all
  on public.bookmarks for all
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy notes_owner_all
  on public.notes for all
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy flashcards_owner_all
  on public.flashcards for all
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy flashcard_srs_state_owner_all
  on public.flashcard_srs_state for all
  to authenticated
  using (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid())
  )
  with check (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid())
  );

create policy flashcard_reviews_owner_all
  on public.flashcard_reviews for all
  to authenticated
  using (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid())
  )
  with check (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid())
  );

-- question_attempts: só SELECT/DELETE direto para o dono. INSERT/UPDATE só
-- via submit_question_attempt (SECURITY DEFINER, roda como postgres).
revoke insert, update on public.question_attempts from authenticated;

create policy question_attempts_owner_select
  on public.question_attempts for select
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy question_attempts_owner_delete
  on public.question_attempts for delete
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

-- error_notebook: INSERT só via submit_question_attempt; dono pode SELECT e
-- editar apenas resolved/user_notes diretamente (nunca correct_option_id).
revoke insert, update on public.error_notebook from authenticated;
grant update (resolved, user_notes) on public.error_notebook to authenticated;

create policy error_notebook_owner_select
  on public.error_notebook for select
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy error_notebook_owner_update
  on public.error_notebook for update
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid());

create policy error_notebook_owner_delete
  on public.error_notebook for delete
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy simulations_owner_all
  on public.simulations for all
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy simulation_questions_owner_all
  on public.simulation_questions for all
  to authenticated
  using (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (select 1 from public.simulations s where s.id = simulation_id and s.user_id = auth.uid())
  )
  with check (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (select 1 from public.simulations s where s.id = simulation_id and s.user_id = auth.uid())
  );

create policy simulation_answers_owner_all
  on public.simulation_answers for all
  to authenticated
  using (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (
      select 1 from public.simulation_questions sq
      join public.simulations s on s.id = sq.simulation_id
      where sq.id = simulation_question_id and s.user_id = auth.uid()
    )
  )
  with check (
    app.current_profile_status(auth.uid()) = 'active'
    and exists (
      select 1 from public.simulation_questions sq
      join public.simulations s on s.id = sq.simulation_id
      where sq.id = simulation_question_id and s.user_id = auth.uid()
    )
  );

-- Garante que a alternativa respondida em simulation_answers pertence à mesma
-- questão do simulation_questions referenciado (prova estrutural de pertença).
create or replace function public.guard_simulation_answer_option()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expected_question_id uuid;
  v_option_question_id uuid;
begin
  select question_id into v_expected_question_id
  from public.simulation_questions where id = new.simulation_question_id;

  select question_id into v_option_question_id
  from public.question_options where id = new.selected_option_id;

  if v_option_question_id is distinct from v_expected_question_id then
    raise exception 'a alternativa selecionada não pertence à questão deste simulado';
  end if;

  return new;
end;
$$;

create trigger trg_guard_simulation_answer_option
  before insert or update on public.simulation_answers
  for each row execute function public.guard_simulation_answer_option();

-- feedback: exige autenticação e active; sem feedback anônimo nesta etapa.
-- Exceção documentada: admin active pode SELECT todo o feedback (moderação),
-- sem que isso implique acesso a nenhum outro dado pessoal.
create policy feedback_owner_insert
  on public.feedback for insert
  to authenticated
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy feedback_owner_select
  on public.feedback for select
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

create policy feedback_admin_select_all
  on public.feedback for select
  to authenticated
  using (app.is_admin_active(auth.uid()));
