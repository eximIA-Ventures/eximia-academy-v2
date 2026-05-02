# eximIA Academy v2

Plataforma de aprendizado com IA socrática para empresas — arquitetura multi-tenant, white-label e pronta para escala.

---

## Visão Geral

eximIA Academy v2 é uma LMS (Learning Management System) B2B onde cada empresa cliente (tenant) tem seu próprio espaço isolado, com branding customizável e uma IA que guia o aprendizado de forma socrática — fazendo perguntas, nunca entregando respostas prontas.

### Diferenciais

- **IA Socrática** — O aluno pensa, a IA provoca. Não é tutoria passiva.
- **Multi-tenant isolado** — Dados de um tenant nunca vazam para outro (Row Level Security no Supabase).
- **White-label** — Cada empresa pode ter cores, logo e domínio próprio.
- **App Router first** — Next.js 15 com Server Components e Server Actions nativos.
- **Zero lock-in** — Stack 100% open-source (exceto Supabase, que tem self-hosted).

---

## Hierarquia de Acesso

```
Super Admin (eximIA)
  └── Tenant (empresa cliente, ex: "Harven Agribusiness")
        └── Unidade Operacional (filial / departamento)
              └── Usuários
                    ├── admin         → gerencia o tenant
                    ├── manager       → gerencia unidades e times
                    ├── instructor    → cria e publica cursos
                    └── student       → consome conteúdo
```

### Planos de Tenant

| Plano     | Capacidades                                  |
|-----------|----------------------------------------------|
| essencial | Cursos básicos, sem white-label, sem IA avançada |
| standard  | White-label parcial, IA socrática inclusa    |
| premium   | White-label completo, domínio próprio, analytics avançado |

---

## Arquitetura do Monorepo

```
eximia-academy-v2/
├── apps/
│   └── web/                    # App principal Next.js 15
│       ├── src/
│       │   ├── app/            # App Router — layouts, pages, loading, error
│       │   │   ├── (auth)/     # Grupo de rotas públicas (login, reset)
│       │   │   ├── (app)/      # Grupo de rotas protegidas (dashboard)
│       │   │   ├── layout.tsx  # Root layout com providers
│       │   │   ├── page.tsx    # Landing / redirect
│       │   │   └── globals.css # Design tokens OKLCh + Tailwind v4
│       │   ├── components/     # Componentes de página (importam @eximia/ui)
│       │   ├── hooks/          # Custom hooks React
│       │   ├── lib/            # Utilitários, helpers, actions
│       │   └── middleware.ts   # Auth guard + tenant resolution
│       ├── package.json
│       ├── next.config.ts
│       └── tsconfig.json
│
├── packages/
│   ├── ui/                     # Design System compartilhado
│   │   ├── src/
│   │   │   ├── components/     # Button, Input, Card, Modal, etc.
│   │   │   └── lib/utils.ts    # cn() helper (clsx + tailwind-merge)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── supabase/               # Cliente Supabase + tipos gerados
│       ├── src/
│       │   ├── client.ts       # Browser client (singleton)
│       │   ├── server.ts       # Server client + Service Role client
│       │   ├── types.ts        # Database types (gerado pelo CLI)
│       │   └── index.ts        # Re-exports
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   ├── migrations/             # SQL migrations versionadas
│   └── config.toml             # Config local do Supabase CLI
│
├── package.json                # Root — scripts turbo + devDeps
├── pnpm-workspace.yaml         # Definição dos workspaces
├── turbo.json                  # Pipeline de tasks do Turborepo
├── biome.json                  # Linter + formatter (substitui ESLint/Prettier)
├── tsconfig.json               # tsconfig base compartilhado
├── .env.example                # Template de variáveis de ambiente
└── .gitignore
```

---

## Stack Técnica

| Camada            | Tecnologia              | Versão   | Motivo da Escolha                          |
|-------------------|-------------------------|----------|--------------------------------------------|
| Framework         | Next.js (App Router)    | ^15.3    | Server Components, Server Actions, Turbopack |
| Linguagem         | TypeScript              | ^5.7     | Strict mode, tipos Supabase gerados        |
| Estilo            | TailwindCSS             | v4       | `@import "tailwindcss"` — sem config JS    |
| Cores             | OKLCh                   | CSS nativo | Perceptually uniform, dark mode nativo   |
| Linter/Formatter  | Biome                   | 1.9.4    | 10-100x mais rápido que ESLint + Prettier  |
| Monorepo          | Turborepo v2 + pnpm     | ^2.5     | Cache remoto, pipeline declarativo         |
| Backend/DB        | Supabase                | ^2.49    | Postgres + Auth + RLS + Storage            |
| Auth Middleware   | @supabase/ssr           | ^0.6     | Cookie-based SSR auth                      |
| Fontes            | next/font/google        | —        | Inter (body), Outfit (headings), JetBrains Mono (code) |

---

## Pré-requisitos

- **Node.js** >= 20 (recomendado 22 LTS)
- **pnpm** >= 10.29.1 — `npm install -g pnpm`
- **Supabase CLI** (opcional, para desenvolvimento local) — `brew install supabase/tap/supabase`
- Conta no [Supabase](https://supabase.com) (ou Docker para local)

---

## Rodando Localmente

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example apps/web/.env.local
# Editar apps/web/.env.local com suas credenciais Supabase
```

### 3. Iniciar Supabase local (opcional)

```bash
supabase start
# Copiar as URLs e keys geradas para .env.local
```

### 4. Rodar o servidor de desenvolvimento

```bash
pnpm dev
# Abre em http://localhost:3000 com Turbopack
```

---

## Comandos Disponíveis

### Raiz do monorepo

| Comando             | O que faz                                          |
|---------------------|----------------------------------------------------|
| `pnpm dev`          | Inicia todos os apps em modo dev (Turbopack)       |
| `pnpm build`        | Build de produção de todos os apps/packages        |
| `pnpm lint`         | Lint em todos os workspaces via Biome              |
| `pnpm lint:fix`     | Lint com auto-fix                                  |
| `pnpm format`       | Formata todos os arquivos com Biome                |
| `pnpm check`        | Lint + format check (CI)                           |
| `pnpm type-check`   | TypeScript check em todos os workspaces            |
| `pnpm clean`        | Remove `.next`, `dist`, `node_modules`, `.turbo`   |

### Supabase

| Comando                                      | O que faz                                   |
|----------------------------------------------|---------------------------------------------|
| `supabase start`                             | Inicia Supabase local (Docker)              |
| `supabase db push`                           | Aplica migrations pendentes                 |
| `supabase migration new <nome>`              | Cria nova migration                         |
| `supabase gen types typescript --local > packages/supabase/src/types.ts` | Regenera tipos do banco |
| `supabase stop`                              | Para o ambiente local                       |

---

## Design System

### Paleta de Cores

As cores usam **OKLCh** (perceptually uniform), garantindo contraste consistente em dark e light mode:

| Token CSS               | Cor                  | Uso                        |
|-------------------------|----------------------|----------------------------|
| `--brand-cerrado`       | Laranja-âmbar        | Primária — CTAs, destaques |
| `--brand-pampa`         | Verde-oliva          | Sucesso, progresso         |
| `--brand-sertao`        | Terracotta           | Warning, atenção           |
| `--brand-pantanal`      | Azul-profundo        | Info, links                |
| `--brand-varzea`        | Verde-água           | Acento secundário          |
| `--brand-caatinga`      | Amarelo-areia        | Background de destaque     |
| `--brand-mangue`        | Verde-escuro         | Sidebar, navegação         |
| `--brand-aurora`        | Rosa-claro           | Tags, badges               |

### Tipografia

- **Headings**: Outfit (rounded, moderno, legível)
- **Body**: Inter (workhorse, altamente legível)
- **Code/Mono**: JetBrains Mono (desenvolvimento, snippets)

### Utility: `cn()`

```typescript
import { cn } from "@eximia/ui"

// Combina classes condicionalmente, resolve conflitos Tailwind
cn("text-sm", isActive && "font-bold", "text-muted-foreground")
```

---

## Adicionando Novas Features

### 1. Nova rota protegida

Criar em `apps/web/src/app/(app)/nova-rota/page.tsx`. O middleware já protege automaticamente.

### 2. Novo componente no Design System

```
packages/ui/src/components/meu-componente.tsx
```

Exportar em `packages/ui/src/index.ts`:
```typescript
export * from "./components/meu-componente"
```

Usar no app:
```typescript
import { MeuComponente } from "@eximia/ui"
```

### 3. Nova migration de banco

```bash
supabase migration new nome_da_migration
# Escrever SQL em supabase/migrations/[timestamp]_nome.sql
supabase db push
supabase gen types typescript --local > packages/supabase/src/types.ts
```

### 4. Nova Server Action

```typescript
// apps/web/src/lib/actions/minha-action.ts
"use server"

import { createServerClient } from "@eximia/supabase"

export async function minhaAction(data: FormData) {
  const supabase = await createServerClient()
  // ...
}
```

### 5. Novo tenant / white-label

O sistema de tenant é resolvido via `TENANT_SLUG` no environment. Cada instância do app (deploy separado ou subdomínio) define seu próprio `TENANT_SLUG`, e o middleware garante isolamento via RLS no Supabase.

---

## Estrutura de Auth

```
Requisição chegando
  ↓
middleware.ts
  ├── Path público (/entrar, /api/auth)? → next()
  ├── Sem sessão Supabase? → redirect /entrar?redirect=<original>
  └── Com sessão válida? → next() + cookie refresh
```

A sessão é mantida via cookies HttpOnly, gerenciada pelo `@supabase/ssr`. Server Components acessam via `createServerClient()` do `@eximia/supabase/server`.

---

## Deploy

O app não usa Vercel. O deploy é via **Docker + EasyPanel** na VPS do projeto.

### Build de imagem

```bash
docker build -t eximia-academy-v2 .
```

### Variáveis obrigatórias em produção

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TENANT_SLUG=
NEXT_PUBLIC_APP_URL=
```

---

## Contribuindo

1. Branch a partir de `main`: `git checkout -b feat/nome-da-feature`
2. Commits seguem Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`
3. Rodar `pnpm check` antes de commitar (Biome lint + format)
4. PR para `main` — revisão obrigatória

---

## Licença

Proprietário — eximIA Ventures. Todos os direitos reservados.
