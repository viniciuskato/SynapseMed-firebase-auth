-- ============================================================================
-- SynapseMed — Schema v2: preparação para conteúdo real
-- Migration: schema_v2_conteudo_real
--
-- Escopo: SOMENTE schema (DDL + RLS + grants). Nenhum dado é migrado nesta
-- rodada. Motivação: uma auditoria campo-a-campo contra os arquivos-fonte
-- reais da "Base de Estudos" (C:\Users\vinic\OneDrive\Questões\_banco\
-- banco-questoes.json, fontes.json, correcoes.json) encontrou metadados que
-- o schema da Etapa 1 (20260903120000_initial_schema.sql) não tinha onde
-- guardar.
--
-- DECISÕES DE AUDITORIA (CHECK vs. texto livre), com valores reais
-- encontrados rodando node contra os arquivos-fonte em 2026-09-04:
--
-- * questions.competencia — 393 questões auditadas, 6 valores distintos
--   (classificacao.competencia): CHECK fechado.
-- * questions.contexto — 393 questões auditadas, 3 valores distintos
--   (classificacao.contexto): CHECK fechado.
-- * questions.complexidade — não estava na lista original de colunas novas,
--   mas o pedido apontou que taxonomia.complexidades já é um enum fechado
--   confirmado (classificacao.complexidade): adicionada com CHECK.
-- * questions.editorial_state — mapeia o campo de topo `estadoEditorial`
--   (NÃO `auditoriaEditorial.status`, que é um enum diferente e mais aberto
--   de workflow interno — esse vai em audit_trail.status). 393 questões
--   auditadas, exatamente os 4 valores do pedido original: CHECK fechado.
-- * sources.tipo / sources.verificacao — 87/87 registros de fontes.json
--   (chave `fontesMeta`) batem exatamente com as listas exaustivas do
--   pedido original: CHECK fechado em ambos.
-- * sources.identificadores — chaves observadas: doi, pmid, pmcid, isbn,
--   url, bookshelfId, elocation, e também duas chaves ad-hoc de fonte única
--   (doi_hypertension, doi_jacc) — confirma que é de fato livre, jsonb sem
--   coluna dedicada por identificador está correto.
-- * sources.substituida_por — ACHADO DE AUDITORIA a documentar antes da
--   migração de dado: no único registro real com essa relação
--   (kumar2016-robbins-patologia), o valor gravado hoje é a CITAÇÃO
--   completa da obra substituta (livro ainda não cadastrado como fonte
--   própria), não um id de outra linha de fontes.json. A FK abaixo segue a
--   intenção estrutural pedida (auto-referência por id) porque é schema-only
--   nesta rodada; a migração de dado real vai precisar, para esse caso,
--   criar antes uma linha própria para a obra substituta (ou deixar
--   substituida_por NULL e preservar a citação só em observacoes) — decisão
--   de dado, não de schema, fica para a rodada de migração.
-- * question_corrections — ACHADO DE AUDITORIA: correcoes.json tem duas
--   listas. A canônica e consistente (`correcoes`, 95 registros, chaves em
--   português: data/tipo/camposAlterados/motivo/referencias/responsavel/
--   usoDeIA/questaoId, com `de`/`para` presentes em 12/95 registros) NÃO tem
--   previousVersion/newVersion/impactLevel/impactSummary/regenerateDerived.
--   A segunda lista (`corrections`, 59 registros) é majoritariamente as
--   MESMAS entradas em chave português (herdadas/duplicadas) e só 1 registro
--   tem de fato o formato inglês completo (previousVersion/newVersion/
--   material.kind/impact.level/derivatives). Mantido o conjunto de colunas
--   pedido (todas nullable) porque acomoda os dois formatos observados;
--   `before_snapshot`/`after_snapshot` recebem os pares `de`/`para` (arrays
--   de texto) quando existirem. `material.kind` é sempre "questao" nos dois
--   arquivos — confirma que question_id (FK direta a questions) é
--   suficiente, sem precisar de alvo polimórfico.
-- * questions.provenance_metadata — o pedido original chamava essa coluna de
--   `provenance` (mapeando `proveniencia`), mas `questions.provenance text`
--   já existe desde 20260903120000_initial_schema.sql com outro sentido
--   (campo simples livre, não o objeto estruturado origemDeclarada/usoDeIA/
--   finalidadesDaIA/validacaoHumanaDocumentada). Renomeada para
--   `provenance_metadata` para não colidir — `supabase db reset` acusou o
--   conflito (`column "provenance" of relation "questions" already exists`)
--   na primeira tentativa desta migration.
-- * question_corrections RLS — leitura restrita a admin (trilha de auditoria
--   editorial, não é conteúdo para o estudante ver). Alternativa considerada
--   e descartada: liberar SELECT para o estudante nas correções de questões
--   que ele já respondeu (mostraria "esta questão foi corrigida depois que
--   você respondeu") — não implementada nesta rodada por não haver pedido
--   de produto para isso ainda; revisitar se/quando existir essa feature.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) sources — bibliografia compartilhada
-- ----------------------------------------------------------------------------

create table public.sources (
  id text primary key,
  citation_text text not null,
  tipo text not null check (tipo in (
    'diretriz_consenso', 'ensaio_clinico_randomizado', 'revisao_narrativa',
    'livro_texto', 'material_interno', 'ensaio', 'revisao_sistematica',
    'revisao_sistematica_com_metanalise', 'artigo_revisao', 'material_de_aula',
    'padrao_tecnico'
  )),
  verificacao text not null check (verificacao in (
    'verificada', 'nao_verificavel_externamente', 'vaga_pendente',
    'verificada_por_busca_resumo', 'verificada_texto_integral_e_inspecao_visual',
    'verificada_texto_integral'
  )),
  jurisdicao text,
  vigente boolean,
  substituida_por text references public.sources(id),
  identificadores jsonb not null default '{}'::jsonb,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sources_substituida_por on public.sources (substituida_por);

-- ----------------------------------------------------------------------------
-- 2) question_references — join questions <-> sources (join estruturado,
--    complementa referencias soltas em texto que hoje só existem em
--    material_references.citation_text)
-- ----------------------------------------------------------------------------

create table public.question_references (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  source_id text not null references public.sources(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (question_id, source_id)
);

create index idx_question_references_question_id on public.question_references (question_id);
create index idx_question_references_source_id on public.question_references (source_id);

-- ----------------------------------------------------------------------------
-- 3) material_references — vínculo opcional a sources (não é breaking
--    change: citation_text continua sendo a fonte de verdade textual)
-- ----------------------------------------------------------------------------

alter table public.material_references
  add column source_id text references public.sources(id);

create index idx_material_references_source_id on public.material_references (source_id);

-- ----------------------------------------------------------------------------
-- 4) questions — metadados editoriais/taxonômicos novos (todas nullable)
-- ----------------------------------------------------------------------------

alter table public.questions
  add column subtema text,
  add column competencia text check (competencia in (
    'Conhecimento fundamental', 'Compreensão de mecanismo', 'Integração clínica',
    'Raciocínio diagnóstico', 'Interpretação diagnóstica', 'Decisão terapêutica'
  )),
  add column contexto text check (contexto in (
    'Pergunta direta', 'Caso clínico', 'Interpretação de imagem'
  )),
  add column complexidade text check (complexidade in (
    'Fundamental', 'Aplicação', 'Integração'
  )),
  add column disciplinas_relacionadas text[],
  add column editorial_state text check (editorial_state in (
    'aprovada', 'em_revisao', 'requer_atualizacao', 'pendente_revisao_conteudo'
  )),
  add column audit_trail jsonb,
  add column provenance_metadata jsonb,
  add column evidence jsonb,
  add column quality_checklist jsonb;

-- ----------------------------------------------------------------------------
-- 5) question_corrections — histórico de correções editoriais
-- ----------------------------------------------------------------------------

create table public.question_corrections (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  previous_version int,
  new_version int,
  correction_type text,
  changed_fields text[],
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  source_ids text[],
  responsible text,
  ai_usage text,
  impact_level text,
  impact_summary text,
  regenerate_derived boolean,
  occurred_at date,
  created_at timestamptz not null default now()
);

create index idx_question_corrections_question_id on public.question_corrections (question_id);

-- ----------------------------------------------------------------------------
-- 6) content_assets — legenda, direitos, hotlink externo
-- ----------------------------------------------------------------------------

alter table public.content_assets
  add column caption text,
  add column rights_status text,
  add column privacy_verified boolean,
  add column modifications text,
  add column notes text,
  add column external_url text;

alter table public.content_assets
  alter column storage_path drop not null;

alter table public.content_assets
  add constraint content_assets_storage_xor_external
  check (num_nonnulls(storage_path, external_url) = 1);

-- ----------------------------------------------------------------------------
-- 7) RLS
-- ----------------------------------------------------------------------------

alter table public.sources enable row level security;
alter table public.question_references enable row level security;
alter table public.question_corrections enable row level security;

-- sources: bibliografia, não sensível — leitura para qualquer authenticated
-- active (mesmo padrão de disciplines/themes); escrita só admin.
create policy sources_select_active
  on public.sources for select
  to authenticated
  using (app.current_profile_status(auth.uid()) = 'active' or app.is_admin_active(auth.uid()));

create policy sources_admin_write
  on public.sources for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

-- question_references: mesma regra de leitura de questions (só se a questão
-- pai estiver published, ou admin); escrita só admin.
create policy question_references_select_published
  on public.question_references for select
  to authenticated
  using (
    app.is_admin_active(auth.uid())
    or exists (
      select 1 from public.questions q
      where q.id = question_id and q.status = 'published'
    ) and app.current_profile_status(auth.uid()) = 'active'
  );

create policy question_references_admin_write
  on public.question_references for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

-- question_corrections: trilha de auditoria editorial — só admin (ver
-- decisão documentada no cabeçalho desta migration).
create policy question_corrections_admin_all
  on public.question_corrections for all
  to authenticated
  using (app.is_admin_active(auth.uid()))
  with check (app.is_admin_active(auth.uid()));

-- ----------------------------------------------------------------------------
-- Grants — anon/authenticated/service_role (causa raiz do bug do remoto na
-- rodada anterior, ver 20260904120000_grants.sql / 20260904130000_...).
-- ALTER DEFAULT PRIVILEGES já aplicado nessas migrations cobre tabelas
-- futuras criadas pelo mesmo role de migração, mas os GRANTs explícitos
-- abaixo tornam essa garantia auditável nesta migration em vez de depender
-- silenciosamente de um DEFAULT PRIVILEGES definido em outro arquivo.
-- ----------------------------------------------------------------------------

grant select, insert, update, delete
  on public.sources, public.question_references, public.question_corrections
  to anon, authenticated;

grant all
  on public.sources, public.question_references, public.question_corrections
  to service_role;
