-- Concede aos roles anon/authenticated os privilégios de tabela que o
-- Postgres exige ANTES de sequer avaliar RLS (SELECT/INSERT/UPDATE/DELETE).
--
-- Achado durante o smoke test do Fase 3 contra o projeto remoto real
-- (2026-09-04): tabelas criadas por CREATE TABLE em migration não recebem
-- automaticamente esses grants em todo projeto Supabase — o ambiente local
-- (imagem Docker do Supabase CLI) já vinha com esses defaults de fábrica,
-- mascarando a ausência deles aqui. RLS continua sendo o controle de acesso
-- por linha; estes GRANTs só liberam a operação no nível da tabela.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

grant usage, select
  on all sequences in schema public
  to anon, authenticated;

-- Garante que tabelas/sequences criadas por migrations futuras também
-- recebam esses grants automaticamente, sem depender de lembrar de repetir
-- este arquivo.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

-- O GRANT amplo acima reabre restrições de coluna/tabela que a migration de
-- RLS (20260903120100_rls_policies.sql) tinha deliberadamente estreitado
-- para forçar escrita só via função SECURITY DEFINER ou só em colunas
-- específicas. Reaplica essas três restrições na mesma ordem/forma do
-- original para não reabrir esses caminhos de escrita.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

revoke insert, update on public.question_attempts from authenticated;

revoke insert, update on public.error_notebook from authenticated;
grant update (resolved, user_notes) on public.error_notebook to authenticated;
