-- ============================================================================
-- SynapseMed — Fundação Supabase — Etapa 1
-- Migration: initial_schema
--
-- Escopo: definição de tabelas (DDL puro). RLS, policies, funções e triggers
-- de segurança/integridade editorial ficam em 20260903120100_rls_policies.sql.
--
-- Não inclui: Casos Clínicos (módulo removido definitivamente do produto).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Conteúdo compartilhado / editorial
-- ----------------------------------------------------------------------------

create table public.disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  icon text,
  description text,
  cycle text not null check (cycle in ('basico', 'clinico', 'internato_residencia')),
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines(id) on delete cascade,
  name text not null,
  description text,
  high_yield boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discipline_id, name)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  theme_id uuid not null references public.themes(id) on delete restrict,
  title text not null,
  subtitle text,
  mode text check (mode in ('atlas', 'mecanismos')),
  study_lens text check (study_lens in (
    'fisiopatologia', 'diagnostico', 'conduta', 'farmacologia', 'alto_rendimento'
  )),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  estimated_read_time_minutes int check (estimated_read_time_minutes >= 0),
  author text,
  tags text[] not null default '{}',
  provenance text,
  source text,
  license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.material_sections (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  mechanism_tag text,
  content text not null,
  key_takeaways text[] not null default '{}',
  clinical_pearl text,
  warning_alert text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, sort_order)
);

create table public.material_references (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  citation_text text not null,
  url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Banco de questões (público vs. protegido — ver seção "Gabarito" no schema doc)
-- ----------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  theme_id uuid not null references public.themes(id) on delete restrict,
  material_id uuid references public.materials(id) on delete set null,
  material_section_id uuid references public.material_sections(id) on delete set null,
  cycle text not null check (cycle in ('basico', 'clinico', 'internato_residencia')),
  difficulty text not null check (difficulty in ('facil', 'medio', 'dificil')),
  institution text,
  year int check (year between 1980 and 2100),
  clinical_vignette text not null,
  question_stem text not null,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  provenance text,
  source text,
  license text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  letter text not null check (letter in ('A', 'B', 'C', 'D', 'E')),
  option_text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, letter),
  unique (question_id, sort_order)
);

-- Protegidas: sem policy de SELECT para estudante (ver rls_policies.sql).
create table public.question_answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  general_commentary text not null,
  high_yield_summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- question_id é redundante em relação a question_options.question_id, mas é
-- necessário aqui para viabilizar o índice único parcial "no máximo 1 correta
-- por questão" (índices não podem referenciar outra tabela). É preenchido
-- automaticamente por trigger (trg_set_question_option_keys_question_id em
-- rls_policies.sql) — nunca aceito diretamente do cliente.
create table public.question_option_keys (
  option_id uuid primary key references public.question_options(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  is_correct boolean not null default false,
  explanation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index question_option_keys_one_correct_per_question
  on public.question_option_keys (question_id)
  where is_correct;

-- ----------------------------------------------------------------------------
-- Ativos de conteúdo (metadados; binários ficam no Supabase Storage)
-- ----------------------------------------------------------------------------

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete cascade,
  material_section_id uuid references public.material_sections(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  is_primary boolean not null default false,
  storage_path text not null unique,
  mime_type text not null,
  author text,
  source text,
  license text,
  alt_text text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(material_id, material_section_id, question_id) = 1)
);

create unique index content_assets_one_primary_per_section
  on public.content_assets (material_section_id)
  where is_primary and material_section_id is not null;

-- ----------------------------------------------------------------------------
-- Perfis (origem de identidade: auth.users)
-- ----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Flashcards pessoais + SRS (estado atual separado do histórico)
-- ----------------------------------------------------------------------------

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  theme_id uuid not null references public.themes(id) on delete restrict,
  material_id uuid references public.materials(id) on delete set null,
  question_origin_id uuid references public.questions(id) on delete set null,
  front text not null,
  back text not null,
  mechanism_highlight text,
  tags text[] not null default '{}',
  difficulty text not null check (difficulty in ('facil', 'medio', 'dificil')),
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flashcard_srs_state (
  flashcard_id uuid primary key references public.flashcards(id) on delete cascade,
  interval_days int not null default 0,
  repetition_count int not null default 0,
  ease_factor numeric(4, 2) not null default 2.5,
  next_due_date date not null default current_date,
  last_reviewed_date date,
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'mastered')),
  updated_at timestamptz not null default now()
);

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  rating int not null check (rating between 1 and 4)
);

-- ----------------------------------------------------------------------------
-- Favoritos e anotações (FKs reais, sem alvo polimórfico solto)
-- ----------------------------------------------------------------------------

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  flashcard_id uuid references public.flashcards(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(material_id, question_id, flashcard_id) = 1)
);

create unique index bookmarks_user_material_uq on public.bookmarks (user_id, material_id) where material_id is not null;
create unique index bookmarks_user_question_uq on public.bookmarks (user_id, question_id) where question_id is not null;
create unique index bookmarks_user_flashcard_uq on public.bookmarks (user_id, flashcard_id) where flashcard_id is not null;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  material_section_id uuid references public.material_sections(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  flashcard_id uuid references public.flashcards(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(material_id, material_section_id, question_id, flashcard_id) = 1)
);

-- ----------------------------------------------------------------------------
-- Progresso de leitura
-- ----------------------------------------------------------------------------

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  read_section_ids uuid[] not null default '{}',
  percent int not null default 0 check (percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, material_id)
);

-- ----------------------------------------------------------------------------
-- Tentativas de questão (só gravadas via RPC submit_question_attempt)
-- e caderno de erros (correct_option_id sempre derivado da tentativa)
-- ----------------------------------------------------------------------------

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid not null references public.question_options(id) on delete restrict,
  is_correct boolean not null,
  time_spent_seconds int not null default 0 check (time_spent_seconds >= 0),
  error_reason text check (error_reason in (
    'lacuna_teorica', 'pegadinha', 'falta_atencao', 'tempo_esgotado', 'raciocinio_clinico'
  )),
  user_notes text,
  answered_at timestamptz not null default now()
);

create table public.error_notebook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid not null references public.question_options(id) on delete restrict,
  correct_option_id uuid not null references public.question_options(id) on delete restrict,
  error_reason text not null check (error_reason in (
    'lacuna_teorica', 'pegadinha', 'falta_atencao', 'tempo_esgotado', 'raciocinio_clinico'
  )),
  user_notes text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Simulados (question_ids normalizados em tabela associativa)
-- ----------------------------------------------------------------------------

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric(5, 2),
  total_time_seconds int not null default 0,
  created_at timestamptz not null default now()
);

create table public.simulation_questions (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position int not null,
  created_at timestamptz not null default now(),
  unique (simulation_id, question_id),
  unique (simulation_id, position)
);

create table public.simulation_answers (
  id uuid primary key default gen_random_uuid(),
  simulation_question_id uuid not null unique references public.simulation_questions(id) on delete cascade,
  selected_option_id uuid not null references public.question_options(id) on delete restrict,
  time_spent_seconds int not null default 0 check (time_spent_seconds >= 0),
  answered_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Feedback (exige usuário autenticado nesta etapa — sem feedback anônimo)
-- ----------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('sugestao', 'problema', 'elogio')),
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Índices de apoio a consultas frequentes (FKs não indexadas automaticamente)
-- ----------------------------------------------------------------------------

create index idx_themes_discipline_id on public.themes (discipline_id);
create index idx_materials_discipline_id on public.materials (discipline_id);
create index idx_materials_theme_id on public.materials (theme_id);
create index idx_materials_status on public.materials (status);
create index idx_material_sections_material_id on public.material_sections (material_id);
create index idx_material_references_material_id on public.material_references (material_id);
create index idx_questions_discipline_id on public.questions (discipline_id);
create index idx_questions_theme_id on public.questions (theme_id);
create index idx_questions_material_id on public.questions (material_id);
create index idx_questions_status on public.questions (status);
create index idx_question_options_question_id on public.question_options (question_id);
create index idx_content_assets_material_id on public.content_assets (material_id);
create index idx_content_assets_material_section_id on public.content_assets (material_section_id);
create index idx_content_assets_question_id on public.content_assets (question_id);
create index idx_flashcards_user_id on public.flashcards (user_id);
create index idx_bookmarks_user_id on public.bookmarks (user_id);
create index idx_notes_user_id on public.notes (user_id);
create index idx_reading_progress_user_id on public.reading_progress (user_id);
create index idx_question_attempts_user_id on public.question_attempts (user_id);
create index idx_question_attempts_question_id on public.question_attempts (question_id);
create index idx_error_notebook_user_id on public.error_notebook (user_id);
create index idx_simulations_user_id on public.simulations (user_id);
create index idx_simulation_questions_simulation_id on public.simulation_questions (simulation_id);
create index idx_feedback_user_id on public.feedback (user_id);
