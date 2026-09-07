-- ----------------------------------------------------------------------------
-- Feedback contextual (vinculado a questão/compêndio) + reação rápida
-- 👍/👎 em questões + status de triagem no admin.
-- ----------------------------------------------------------------------------

-- ── feedback: contexto opcional + status de triagem ─────────────────────────

alter table public.feedback
  add column question_id uuid references public.questions(id) on delete set null;

alter table public.feedback
  add column material_id uuid references public.materials(id) on delete set null;

alter table public.feedback
  add column status text not null default 'pendente'
    check (status in ('pendente', 'em_analise', 'resolvido'));

create index idx_feedback_question_id on public.feedback (question_id);
create index idx_feedback_material_id on public.feedback (material_id);
create index idx_feedback_status on public.feedback (status);

-- Admin pode alterar SÓ o status de triagem (não o conteúdo do relato de
-- outra pessoa) — mesmo padrão de privilégio de coluna já usado em
-- public.profiles (ver rls_policies.sql).
revoke update on public.feedback from authenticated;
grant update (status) on public.feedback to authenticated;

create policy feedback_admin_update_status
  on public.feedback for update
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

-- ── question_reactions: reação rápida 👍/👎, uma ativa por usuário/questão ──

create table public.question_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  reaction text not null check (reaction in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index idx_question_reactions_question_id on public.question_reactions (question_id);
create index idx_question_reactions_user_id on public.question_reactions (user_id);

alter table public.question_reactions enable row level security;

-- Dono: lê/escreve só a própria reação (upsert por on conflict cobre
-- insert+update; mesmo padrão "owner_all" de bookmarks/notes).
create policy question_reactions_owner_all
  on public.question_reactions for all
  to authenticated
  using (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active')
  with check (user_id = auth.uid() and app.current_profile_status(auth.uid()) = 'active');

-- Admin: SELECT em tudo, para a contagem agregada (👍 N / 👎 N) na aba
-- "Questões Comentadas" do admin. Sem write — moderação de reação de outro
-- usuário não faz sentido aqui.
create policy question_reactions_admin_select_all
  on public.question_reactions for select
  to authenticated
  using (app.is_admin_active(auth.uid()));
