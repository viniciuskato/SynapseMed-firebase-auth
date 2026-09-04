-- Complementa 20260904120000_grants.sql: aquela migration só cobriu
-- anon/authenticated. O smoke test remoto (2026-09-04) mostrou que
-- service_role também carece de privilégios nas tabelas deste projeto novo
-- (limpeza via service_role falhava silenciosamente com 42501). service_role
-- tem rolbypassrls=true e é só para uso de backend/admin confiável — RLS
-- nunca é a defesa dela, por isso recebe ALL em vez de um subconjunto.
grant usage on schema public to service_role;

grant all
  on all tables in schema public
  to service_role;

grant all
  on all sequences in schema public
  to service_role;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant all on sequences to service_role;
