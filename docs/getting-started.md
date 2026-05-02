# Getting Started — exímIA Academy

Guia completo para configurar o ambiente de desenvolvimento e rodar o projeto localmente.

---

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [1. Clone e Instalação](#1-clone-e-instalação)
- [2. Configuração do Supabase](#2-configuração-do-supabase)
- [3. Variáveis de Ambiente](#3-variáveis-de-ambiente)
- [4. Iniciando o Servidor](#4-iniciando-o-servidor)
- [5. Primeiro Acesso](#5-primeiro-acesso)
- [6. Resolução de Tenant (Multi-Tenant)](#6-resolução-de-tenant-multi-tenant)
- [7. Scripts Disponíveis](#7-scripts-disponíveis)
- [8. Estrutura de Diretórios](#8-estrutura-de-diretórios)
- [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

| Ferramenta | Versão Mínima | Como verificar | Instalação |
|------------|--------------|----------------|------------|
| **Node.js** | 22+ | `node -v` | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 10+ | `pnpm -v` | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Git** | 2.30+ | `git --version` | [git-scm.com](https://git-scm.com/) |

**Contas necessárias:**

| Serviço | Obrigatório | Para que serve |
|---------|-------------|----------------|
| **Supabase** | Sim | Banco de dados PostgreSQL, autenticação, storage |
| **OpenAI** | Sim | Provedor principal de IA (gpt-4.1, gpt-4.1-mini) |
| **Upstash** | Sim | Redis para rate limiting |
| **DeepSeek** | Não | Provedor secundário de IA (DeepSeek V3) |
| **Google AI** | Não | Provedor de fallback (Gemini 2.5 Pro) |
| **Vercel KV** | Não | Cache adicional |

---

## 1. Clone e Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd eximia-academy

# Instale todas as dependências (apps + packages)
pnpm install
```

O `pnpm install` resolve as dependências de todos os workspaces automaticamente:
- `apps/web` — aplicação Next.js
- `packages/agents` — pipeline de agentes IA
- `packages/database` — schemas Drizzle ORM
- `packages/shared` — tipos e validadores
- `packages/ui` — design system
- `packages/course-designer` — WS2

---

## 2. Configuração do Supabase

### Opção A: Supabase Cloud (recomendado)

1. Crie um projeto em [supabase.com](https://supabase.com/)
2. Na dashboard do projeto, vá em **Settings → API**
3. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Opção B: Supabase Local (via Docker)

```bash
# Instale o Supabase CLI
brew install supabase/tap/supabase

# Inicie o Supabase local
supabase start

# As credenciais serão exibidas no terminal
```

### Aplicando Migrations

As migrations ficam em `supabase/migrations/` e incluem:
- Schema das 17 tabelas
- Políticas RLS para multi-tenant
- Functions auxiliares (`auth_tenant_id()`, `auth_user_role()`)

```bash
# Se usando Supabase Cloud — aplique via CLI linkado ao projeto
supabase link --project-ref <project-ref>
supabase db push

# Se usando Supabase Local
supabase db reset   # Aplica todas as migrations + seed
```

---

## 3. Variáveis de Ambiente

Copie o template e preencha:

```bash
cp apps/web/.env.example apps/web/.env.local
```

### Variáveis obrigatórias

| Variável | Onde obter | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | `eyJhbGci...` |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/) → API Keys | `sk-...` |
| `UPSTASH_REDIS_REST_URL` | [console.upstash.com](https://console.upstash.com/) → Redis → REST API | `https://xxxxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → Redis → REST API | `AXxx...` |
| `NEXT_PUBLIC_APP_URL` | Fixo para dev | `http://localhost:3000` |

### Variáveis opcionais

| Variável | Quando necessário |
|----------|------------------|
| `DEEPSEEK_API_KEY` | Para usar DeepSeek V3 como provedor secundário |
| `GOOGLE_API_KEY` | Para usar Gemini como provedor de fallback |
| `KV_REST_API_URL` | Para cache via Vercel KV |
| `KV_REST_API_TOKEN` | Token do Vercel KV |

> **Sem Upstash?** O rate limiting falha "open" (permite requests) se o Redis não estiver configurado. O app funciona, mas sem proteção contra abuso.

> **Sem DeepSeek/Google?** O Model Router usa apenas OpenAI. O fallback chain fica desabilitado, mas o app funciona normalmente.

---

## 4. Iniciando o Servidor

```bash
pnpm dev
```

Isso inicia o Turborepo que roda em paralelo:
- Next.js 15 dev server com Turbopack em `http://localhost:3000`
- Watch mode nos packages (`agents`, `database`, `shared`, `ui`, `course-designer`)

---

## 5. Primeiro Acesso

1. Acesse [http://localhost:3000](http://localhost:3000)
2. Você será redirecionado para `/login`
3. Crie uma conta ou use as credenciais de seed (se `supabase db reset` foi rodado)

### Roles e permissões

| Role | Acesso | Rota inicial |
|------|--------|-------------|
| `student` | Dashboard, cursos, sessões de aprendizado | `/dashboard` |
| `manager` | Tudo do student + analytics de gestor | `/dashboard` |
| `admin` | Tudo do manager + gestão de cursos, capítulos, usuários, áreas | `/dashboard` |
| `super_admin` | Gestão de tenants, dashboard da plataforma, auditoria | `/super-admin/tenants` |

---

## 6. Resolução de Tenant (Multi-Tenant)

O sistema resolve o tenant de 3 formas:

| Método | Quando | Exemplo |
|--------|--------|---------|
| **Subdomínio** | Produção | `empresa-a.eximia.co` |
| **Query param** | Desenvolvimento | `localhost:3000?tenant=demo` |
| **Default "demo"** | Dev sem param | Automático em `NODE_ENV=development` |

Em desenvolvimento local, o tenant `demo` é usado automaticamente se nenhum `?tenant=` for fornecido.

---

## 7. Scripts Disponíveis

Todos os scripts rodam via Turborepo e afetam todos os workspaces:

| Script | O que faz | Quando usar |
|--------|-----------|------------|
| `pnpm dev` | Servidor de dev com hot reload | Desenvolvimento diário |
| `pnpm build` | Build de produção | Antes de deploy ou para testar build |
| `pnpm lint` | Lint com Biome | Antes de commitar |
| `pnpm typecheck` | Type checking TypeScript strict | Antes de commitar |
| `pnpm test` | Testes unitários (Vitest) | Antes de commitar |
| `pnpm test:e2e` | Testes E2E (Playwright + MSW) | Antes de abrir PR |
| `pnpm format` | Formata código com Biome | A qualquer momento |
| `pnpm check` | Biome check + auto-fix | A qualquer momento |

**Ordem recomendada antes de commitar:**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## 8. Estrutura de Diretórios

```
eximia-academy/
├── apps/web/                  # Aplicação Next.js 15
│   ├── src/app/               #   App Router (rotas + API)
│   ├── src/components/        #   Componentes React
│   ├── src/lib/               #   Utilitários (supabase, rate-limit, analytics)
│   ├── src/styles/            #   CSS global + theme tokens
│   └── src/middleware.ts      #   Auth + rate limiting + tenant resolution
├── packages/agents/           # Pipeline de 12 agentes IA
├── packages/database/         # Drizzle ORM — 17 tabelas
├── packages/shared/           # Tipos, constantes, validadores Zod
├── packages/ui/               # Design system — 29 componentes
├── packages/course-designer/  # WS2 — Design instrucional
├── supabase/migrations/       # 28+ migrations SQL com RLS
└── docs/                      # Documentação completa
```

> Para a estrutura detalhada, veja o [README.md raiz](../README.md#estrutura-do-monorepo).

---

## Troubleshooting

### `pnpm install` falha

```bash
# Limpe o cache e reinstale
rm -rf node_modules apps/web/node_modules packages/*/node_modules
pnpm install
```

### Porta 3000 ocupada

```bash
# Encontre e mate o processo
lsof -i :3000
kill -9 <PID>
```

### Erro de conexão com Supabase

- Verifique se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretos
- Para Supabase local: confirme que `supabase start` está rodando
- Verifique se as migrations foram aplicadas

### Rate limiting retornando 429 em dev

O rate limiting está ativo mesmo em desenvolvimento. Se estiver atrapalhando:
- Verifique se `UPSTASH_REDIS_REST_URL` está configurado
- Sem Redis configurado, o rate limiting falha "open" (permite tudo)
- Se o Redis está configurado e está bloqueando, aguarde o reset do limitador

### TypeScript errors após `pnpm install`

```bash
# Rebuild dos packages
pnpm build

# Ou apenas typecheck para ver os erros
pnpm typecheck
```

### Testes E2E falhando

- Instale os browsers do Playwright: `npx playwright install`
- Testes E2E usam MSW para mock — não precisam de APIs de IA reais
- Verifique se `E2E_TESTING=true` está no environment do teste

---

> Para mais detalhes sobre o projeto, veja o [README.md raiz](../README.md). Para padrões de contribuição, veja [CONTRIBUTING.md](../CONTRIBUTING.md).
