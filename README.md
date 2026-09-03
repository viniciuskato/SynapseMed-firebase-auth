# SynapseMed 🧠🩺

O **SynapseMed** é uma plataforma acadêmica e clínica de estudos voltada para estudantes de medicina e médicos residentes. O ecossistema reúne compêndios teóricos estruturados, banco de questões comentadas, simulados dinâmicos com cronômetro, flashcards com algoritmo de repetição espaçada (SRS), caderno inteligente de erros e painel administrativo (CMS) com controle de acesso baseado em papéis (RBAC).

---

## 📋 Requisitos do Sistema

- **Node.js**: v20.x ou v22.x (LTS recomendado)
- **npm**: v10.x ou superior
- **Navegador**: Navegadores modernos com suporte a ES Modules (Chrome, Firefox, Safari, Edge)
- **Projeto no Firebase**: Com os serviços **Authentication** e **Cloud Firestore** habilitados

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

Preencha o arquivo `.env` com as chaves do seu projeto Firebase Web. **Atenção**: os nomes das variáveis utilizadas pelo Vite são:

- `VITE_FIREBASE_API_KEY`: Chave de API da aplicação web do Firebase.
- `VITE_FIREBASE_AUTH_DOMAIN`: Domínio de autenticação do Firebase (`<project-id>.firebaseapp.com`).
- `VITE_FIREBASE_PROJECT_ID`: Identificador único do projeto no Firebase.
- `VITE_FIREBASE_STORAGE_BUCKET`: Bucket do Cloud Storage associado (`<project-id>.firebasestorage.app`).
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: ID numérico do remetente de mensagens do projeto.
- `VITE_FIREBASE_APP_ID`: Identificador exclusivo da aplicação web registrada no Firebase.

> ⚠️ **AVISO DE SEGURANÇA CRÍTICO**:
> - **NUNCA** versione arquivos `.env`, `.env.*` ou `.env.local` no Git.
> - **NUNCA** adicione chaves de Service Account (`*serviceAccount*.json`, `firebase-adminsdk*.json`) ou chaves privadas (`*.key`, `*.pem`) ao repositório.
> - O `.gitignore` do projeto já está configurado para bloquear esses arquivos e permitir apenas o `.env.example`.

---

## 🔐 Configuração do Firebase Authentication

Para que o fluxo de autenticação funcione integralmente:

1. Acesse o **Firebase Console** → **Authentication** → **Sign-in method**.
2. **Provedor E-mail/senha**:
   - Ative a opção **E-mail/senha**.
   - Mantenha a opção "Link do e-mail (login sem senha)" desmarcada.
3. **Provedor Google**:
   - Ative o provedor **Google** e configure o e-mail de suporte do projeto.
4. **Domínios Autorizados**:
   - Em **Settings** → **Authorized domains**, adicione o domínio em que o app está hospedado (ex.: `localhost` para desenvolvimento e os domínios de deploy em produção).
5. **Templates de E-mail**:
   - Em **Templates**, personalize o idioma e remetente para a **Verificação de endereço de e-mail** e **Redefinição de senha**.

---

## 🛡️ Regras de Segurança do Firestore (`firestore.rules`)

As regras de segurança estão definidas no arquivo `firestore.rules` na raiz do projeto. Elas garantem:
- Acesso e leitura estritamente restritos ao próprio titular (`/users/{userId}`).
- Impossibilidade de autopromoção para `role: "admin"` ou alteração de plano (`plan`) pelo cliente.
- Coleções compartilhadas (`/disciplines`, `/themes`, `/compendiums`, `/questions`) acessíveis apenas para leitura por usuários autenticados, com escrita cliente proibida.

### Implantação das Regras

Para publicar as regras no seu ambiente Firebase via Firebase CLI:

```bash
# Efetuar login no Firebase (caso ainda não tenha feito)
npx firebase-tools login

# Definir o projeto ativo
npx firebase-tools use <SEU_PROJECT_ID>

# Implantar exclusivamente as regras do Firestore
npx firebase-tools deploy --only firestore:rules
```

Alternativamente, é possível copiar o conteúdo de `firestore.rules` e colar diretamente na aba **Firestore Database** → **Regras** no Firebase Console.

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

### Testes Automatizados das Regras de Segurança

Executa a bateria de testes automatizados com 15 cenários de segurança do Firestore:

```bash
npm run test:rules
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
- `src/contexts/AuthContext.tsx`: Provedor central de autenticação e sessão com Firebase Auth.
- `src/services/storage.ts`: Serviço de persistência com isolamento de dados por UID (`synapse_<uid>_*`).
- `src/services/firebase.ts`: Inicialização modular do Firebase Client SDK.
- `firestore.rules`: Regras de segurança do Cloud Firestore.
- `tests/firestore-rules.test.ts`: Testes unitários das regras de segurança.
- `supabase/`: Fundação Supabase em preparação (ver seção abaixo).
- `docs/architecture/`: Documentação de arquitetura, incluindo a migração para Supabase.

---

## 🧱 Fundação Supabase (em preparação — não conectada ao frontend)

O diretório `supabase/` contém a modelagem PostgreSQL, migrações versionadas, Row Level Security e um seed local mínimo pensados para uma futura migração de backend (Firebase → Supabase). **Nesta etapa, nada aqui está em uso pela aplicação**: o app React continua 100% sobre Firebase Authentication, Firestore e `localStorage`, sem nenhuma dependência do Supabase instalada.

- `supabase/config.toml`: configuração do Supabase CLI (escrita manualmente nesta etapa — reconferir com `supabase init` quando o CLI estiver disponível).
- `supabase/migrations/`: DDL de tabelas, RLS/policies/funções/triggers e políticas de Storage, em ordem.
- `supabase/seed.sql`: dados demonstrativos mínimos e não sensíveis (sem usuário admin com senha fixa).
- `supabase/tests/database/rls_policies.test.sql`: suíte pgTAP planejada — **não executada** neste ambiente (Docker/Supabase CLI ausentes; ver `docs/architecture/migration-roadmap.md` para o inventário completo de testes planejados vs. executados).
- `docs/architecture/supabase-schema.md`: esquema completo, matriz de acesso e desenho de segurança.
- `docs/architecture/migration-roadmap.md`: o que já foi feito, o que falta, e pré-requisitos para rodar os testes localmente.

Variáveis futuras (documentadas em `.env.example`, sem valores reais): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` nunca deve ter prefixo `VITE_` nem aparecer em código cliente, Git ou logs.
