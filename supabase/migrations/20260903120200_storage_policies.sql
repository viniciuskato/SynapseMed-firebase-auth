-- ============================================================================
-- SynapseMed — Fundação Supabase — Etapa 1
-- Migration: storage_policies
--
-- Bucket privado "editorial-assets" para imagens/anexos de conteúdo editorial.
-- Nenhum upload real é feito nesta etapa — apenas bucket + policies.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'editorial-assets',
  'editorial-assets',
  false,
  10485760, -- 10 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Leitura: active lê apenas objetos cujo content_assets.storage_path aponte
-- para um material/seção/questão com status published. Caminho esperado:
-- materials/{material_id}/{asset_id}.{ext} ou questions/{question_id}/{asset_id}.{ext}
-- (contrato documentado em docs/architecture/supabase-schema.md).
create policy editorial_assets_select_published
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'editorial-assets'
    and app.current_profile_status(auth.uid()) = 'active'
    and exists (
      select 1 from public.content_assets ca
      left join public.materials m on m.id = ca.material_id
      left join public.material_sections ms on ms.id = ca.material_section_id
      left join public.materials msm on msm.id = ms.material_id
      left join public.questions q on q.id = ca.question_id
      where ca.storage_path = storage.objects.name
        and (
          m.status = 'published'
          or msm.status = 'published'
          or q.status = 'published'
        )
    )
  );

create policy editorial_assets_select_admin_all
  on storage.objects for select
  to authenticated
  using (bucket_id = 'editorial-assets' and app.is_admin_active(auth.uid()));

create policy editorial_assets_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'editorial-assets'
    and app.is_admin_active(auth.uid())
    and (
      (storage.foldername(name))[1] = 'materials'
      or (storage.foldername(name))[1] = 'questions'
    )
  );

create policy editorial_assets_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'editorial-assets' and app.is_admin_active(auth.uid()))
  with check (
    bucket_id = 'editorial-assets'
    and app.is_admin_active(auth.uid())
    and (
      (storage.foldername(name))[1] = 'materials'
      or (storage.foldername(name))[1] = 'questions'
    )
  );

create policy editorial_assets_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'editorial-assets' and app.is_admin_active(auth.uid()));
