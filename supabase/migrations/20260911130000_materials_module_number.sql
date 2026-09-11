-- ============================================================================
-- SynapseMed — Número de módulo como coluna própria
-- Migration: materials_module_number
--
-- Contexto: 11 dos 14 materiais de Imunologia tinham o número do módulo
-- cravado como texto livre no título ("M7 — ...", "Módulo 10 — ..."),
-- sem coluna própria. Isso obrigava a UI a fazer parsing de regex em cima
-- do título pra ordenar os cards (ver CompendiumView.tsx). Nenhuma outra
-- disciplina usa esse padrão — campo nullable, só preenchido onde faz
-- sentido.
-- ============================================================================

alter table public.materials
  add column module_number int check (module_number > 0);
