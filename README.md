# SynapseMed 🧠🩺

O **SynapseMed** é uma plataforma acadêmica e clínica de estudos voltada para estudantes de medicina e médicos residentes. O ecossistema reúne compêndios teóricos estruturados, banco de questões comentadas, simulados dinâmicos com cronômetro, flashcards com algoritmo de repetição espaçada (SRS), caderno inteligente de erros e painel administrativo (CMS) com controle de acesso baseado em papéis (RBAC).

---

## 📋 Requisitos do Sistema

- **Node.js**: v20.x ou v22.x (LTS recomendado)
- **npm**: v10.x ou superior
- **Navegador**: Navegadores modernos com suporte a ES Modules (Chrome, Firefox, Safari, Edge)
- **Projeto no Supabase**: Com URL e chave anônima (`anon key`) disponíveis

---

## 🚀 Instalação e Configuração

### 1. Clonar e Instalar Dependências

O projeto utiliza o **npm** como gerenciador oficial de pacotes.

```bash
# Instalar todas as dependências do projeto
npm install
```

### 2. Configuração de Variáveis de Ambiente

Copie o arquivo de exemplo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha o arquivo `.env` com as chaves do seu projeto Supabase. **Atenção**: os nomes das variáveis utilizadas pelo Vite são:

- `VITE_SUPABASE_URL`: URL do projeto Supabase (`https://<project-ref>.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Chave anônima (`anon key`) do projeto, segura para uso no cliente desde que a Row Level Security esteja configurada corretamente.
- `GEMINI_API_KEY`: Chave da API Gemini (uso exclusivamente server-side).

> ⚠️ **AVISO DE SEGURANÇA CRÍTICO**:
> - **NUNCA** versione arquivos `.env`, `.env.*` ou `.env.local` no Git.
> - **NUNCA** adicione a `SUPABASE_SERVICE_ROLE_KEY` ou chaves privadas (`*.key`, `*.pem`) ao repositório.
> - O `.gitignore` do projeto já está configurado para bloquear esses arquivos e permitir apenas o `.env.example`.

---

## 🔐 Configuração do Supabase Authentication

Para que o fluxo de autenticação funcione integralmente:

1. Acesse o **Supabase Dashboard** → **Authentication** → **Providers**.
2. **Provedor E-mail/senha**:
   - Ative o provedor **Email**.
   - Configure a exigência de confirmação de e-mail conforme o desejado.
3. **Provedor Google**:
   - Ative o provedor **Google** e configure o Client ID/Secret do OAuth.
4. **URLs de Redirecionamento**:
   - Em **URL Configuration**, adicione a Site URL e as Redirect URLs do app (ex.: `localhost` para desenvolvimento e os domínios de deploy em produção).
5. **Templates de E-mail**:
   - Em **Email Templates**, personalize o idioma e remetente para a **Confirmação de e-mail** e **Redefinição de senha**.

A segurança de acesso aos dados é garantida por Row Level Security (RLS) no Postgres — ver `supabase/migrations/` e `docs/architecture/supabase-schema.md` para o desenho completo das políticas.

---

## 💻 Scripts de Execução

### Executar em Desenvolvimento

Inicia o servidor de desenvolvimento local na porta 3000:

```bash
npm run dev
```

### Validação de Tipos e Lint

Executa a checagem rigorosa de tipos TypeScript sem emitir arquivos:

```bash
npm run lint
```

### Compilação para Produção

Gera o build otimizado da aplicação na pasta `dist/`:

```bash
npm run build
```

### Pré-visualização do Build

Executa um servidor local servindo a pasta `dist/`:

```bash
npm run preview
```

---

## 📂 Estrutura Principal do Projeto

- `src/components/auth/`: Telas e modais de login, cadastro, verificação de e-mail e redefinição de senha.
- `src/components/admin/`: Painel administrativo com controle de acesso protegido.
- `src/components/compendium/`: Módulos de leitura e navegação do compêndio médico.
- `src/components/questions/` e `src/components/simulados/`: Banco de questões e motor de simulados.
- `src/components/flashcards/`: Flashcards com algoritmo SRS de repetição espaçada.
- `src/contexts/AuthContext.tsx`: Provedor central de autenticação e sessão com Supabase Auth.
- `src/services/storage.ts`: Serviço de persistência com isolamento de dados por UID (`synapse_<uid>_*`).
- `supabase/`: Modelagem PostgreSQL, migrações versionadas e Row Level Security (ver seção abaixo).
- `docs/architecture/`: Documentação de arquitetura, incluindo a migração para Supabase.

---

## 🧱 Backend Supabase

O diretório `supabase/` contém a modelagem PostgreSQL, migrações versionadas, Row Level Security e um seed local mínimo. Supabase (Auth + Postgres) é o backend ativo em produção: o app React autentica e persiste dados via Supabase.

- `supabase/config.toml`: configuração do Supabase CLI.
- `supabase/migrations/`: DDL de tabelas, RLS/policies/funções/triggers e políticas de Storage, em ordem.
- `supabase/seed.sql`: dados demonstrativos mínimos e não sensíveis (sem usuário admin com senha fixa).
- `supabase/tests/database/rls_policies.test.sql`: suíte pgTAP de testes de RLS.
- `docs/architecture/supabase-schema.md`: esquema completo, matriz de acesso e desenho de segurança.
- `docs/architecture/migration-roadmap.md`: histórico da migração de backend para Supabase.

Variáveis de ambiente (documentadas em `.env.example`, sem valores reais): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` nunca deve ter prefixo `VITE_` nem aparecer em código cliente, Git ou logs.
