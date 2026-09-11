-- ============================================================================
-- SynapseMed — Histórico de edições de seção de compêndio
-- Migration: material_section_versions
--
-- Contexto: material_sections não tinha nenhum histórico (só updated_at).
-- Modelo copiado de public.question_corrections (20260904140000), que já
-- resolve o mesmo problema para questões mas nunca foi usada pelo app.
-- Snapshot completo por versão (não diff) — decisão registrada no plano
-- desta feature: "log simples com revert".
-- ============================================================================

create table public.material_section_versions (
  id uuid primary key default gen_random_uuid(),
  material_section_id uuid not null references public.material_sections(id) on delete cascade,
  changed_by uuid references auth.users(id),
  changed_fields text[] not null,
  reason text,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_material_section_versions_section_id
  on public.material_section_versions (material_section_id);

alter table public.material_section_versions enable row level security;

-- Mesmo padrão de question_corrections_admin_all: trilha de auditoria
-- editorial, só admin ativo lê/escreve — nunca exposta ao estudante.
create policy material_section_versions_admin_all
  on public.material_section_versions for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

grant select, insert, update, delete
  on public.material_section_versions
  to anon, authenticated;

grant all
  on public.material_section_versions
  to service_role;
