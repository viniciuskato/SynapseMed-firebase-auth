-- ============================================================================
-- SynapseMed — piloto Cardiologia/Insuficiência Cardíaca
-- Migration: material_dependencies
--
-- Escopo: SOMENTE schema (DDL + RLS + grants). Pré-requisito descoberto
-- durante a carga do piloto: cada compêndio extraído traz uma lista
-- `dependencies[]` (pré-requisitos de estudo, ex. "Cardiac cycle
-- (physiology)"), e quando o pré-requisito corresponde a outro compêndio já
-- carregado (não a um tópico genérico sem material próprio, tipo "General
-- anatomy"), essa relação precisa de uma tabela própria — não existia na
-- migration anterior porque schema_v2 não previu esse vínculo.
-- ============================================================================

create table public.material_dependencies (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  depends_on_material_id uuid not null references public.materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (material_id, depends_on_material_id),
  check (material_id <> depends_on_material_id)
);

create index idx_material_dependencies_material_id on public.material_dependencies (material_id);
create index idx_material_dependencies_depends_on on public.material_dependencies (depends_on_material_id);

alter table public.material_dependencies enable row level security;

-- Mesmo padrão de material_references: leitura só se o compêndio "de origem"
-- (material_id) estiver published (ou admin); escrita só admin.
create policy material_dependencies_select_published
  on public.material_dependencies for select
  to authenticated
  using (
    app.is_admin_active(auth.uid())
    or exists (
      select 1 from public.materials m
      where m.id = material_id and m.status = 'published'
    ) and app.current_profile_status(auth.uid()) = 'active'
  );

create policy material_dependencies_admin_write
  on public.material_dependencies for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

grant select, insert, update, delete on public.material_dependencies to anon, authenticated;
grant all on public.material_dependencies to service_role;
