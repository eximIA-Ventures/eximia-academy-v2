# Story 1.1: Setup do Monorepo e Configuracao Inicial

**Epic:** [Epic 1 — Foundation & Auth](../epics/epic-1-foundation-auth.md)
**Version:** 1.0
**Created:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocks:** 1.2, 1.3, 1.4, 1.5
**Assigned To:** @dev (Dex)

---

## User Story

**As a** developer,
**I want** um monorepo configurado com todos os packages e ferramentas,
**so that** eu possa comecar a desenvolver com DX otimizado.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2 — Section 11 |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.2 |
| **Stack** | Turborepo + pnpm 9+ + Node.js 22 LTS |
| **Framework** | Next.js 15 (App Router) + TypeScript 5.x strict |
| **UI** | Tailwind CSS 4 + shadcn/ui |
| **Lint/Format** | Biome (substitui ESLint + Prettier) |
| **Testing** | Vitest 3.x + Testing Library |

---

## Acceptance Criteria

- [ ] **AC1:** Monorepo Turborepo com pnpm workspaces criado com a estrutura:
  ```
  eximia-academy/
  ├── apps/
  │   └── web/                    # Next.js 15 Application
  │       ├── src/app/            # App Router
  │       ├── src/components/     # UI components
  │       ├── src/hooks/          # Custom hooks
  │       ├── src/lib/            # Utilities, clients
  │       ├── src/styles/         # Global styles
  │       └── public/             # Static assets
  ├── packages/
  │   ├── shared/                 # Shared types + utilities
  │   │   ├── src/types/          # TypeScript interfaces
  │   │   ├── src/constants/      # Enums, limits
  │   │   ├── src/validators/     # Zod schemas
  │   │   └── src/utils/          # Pure utilities
  │   ├── agents/                 # Agent orchestration (placeholder)
  │   │   ├── src/orchestrator.ts
  │   │   ├── src/prompts/
  │   │   └── src/schemas/
  │   ├── database/               # Drizzle schema + migrations
  │   │   ├── src/schema/
  │   │   ├── src/migrations/
  │   │   └── src/client.ts
  │   └── ui/                     # Shared UI (shadcn/ui)
  ├── supabase/                   # Migrations, seed, config
  ├── .github/workflows/
  └── docs/
  ```

- [ ] **AC2:** Next.js 15 (App Router) configurado em `apps/web` com TypeScript strict
  - `tsconfig.json` com `"strict": true`
  - App Router (`src/app/`) como estrutura base
  - `next.config.ts` com transpilePackages para packages internos

- [ ] **AC3:** Tailwind CSS 4 + shadcn/ui inicializado em `packages/ui`
  - shadcn CLI configurado com `components.json` apontando para `packages/ui/src/components`
  - Path aliases no tsconfig de cada app consumidora (ex: `@ui/*`)
  - Pelo menos 1 componente shadcn instalado (Button) para validar pipeline

- [ ] **AC4:** Biome configurado para lint + format
  - `biome.json` na raiz com regras para TypeScript/React
  - Substitui ESLint + Prettier completamente
  - Integrado com turbo pipeline

- [ ] **AC5:** `pnpm dev` inicia o servidor de desenvolvimento sem erros
  - Next.js dev server roda em `localhost:3000`
  - Hot reload funcional

- [ ] **AC6:** `pnpm lint` e `pnpm typecheck` passam sem erros
  - `pnpm lint` executa Biome em todos os packages
  - `pnpm typecheck` executa `tsc --noEmit` em todos os packages

- [ ] **AC7:** `.env.example` criado com todas as variaveis necessarias documentadas
  ```env
  # Supabase
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=

  # Anthropic (LLM)
  ANTHROPIC_API_KEY=

  # Upstash Redis (Rate Limiting)
  UPSTASH_REDIS_REST_URL=
  UPSTASH_REDIS_REST_TOKEN=

  # Vercel KV (Cache)
  KV_REST_API_URL=
  KV_REST_API_TOKEN=

  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [ ] **AC8:** `README.md` com instrucoes de setup local
  - Requisitos: Node.js 22+, pnpm 9+
  - Steps: clone → `pnpm install` → configurar `.env` → `pnpm dev`
  - Listagem de scripts disponíveis

- [ ] **AC9:** Vitest configurado com config base em `apps/web` e `packages/shared`
  - `vitest.config.ts` em ambos os packages
  - `pnpm test` executa sem erros (mesmo sem testes, config deve existir)
  - Integrado com turbo pipeline

---

## Technical Implementation Guide

### 1. Inicializacao do Monorepo

```bash
# Criar estrutura base
npx create-turbo@latest eximia-academy --package-manager pnpm

# Ou manualmente:
mkdir eximia-academy && cd eximia-academy
pnpm init
```

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"]
    }
  }
}
```

### 2. Next.js 15 em `apps/web`

```bash
npx create-next-app@latest apps/web --typescript --app --src-dir --tailwind --no-eslint
```

**`apps/web/next.config.ts`:**
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@eximia/shared', '@eximia/ui', '@eximia/database', '@eximia/agents'],
}

export default nextConfig
```

### 3. Packages Structure

Cada package deve ter:
- `package.json` com `"name": "@eximia/{name}"`
- `tsconfig.json` extends da raiz
- `src/index.ts` como entry point

**`packages/shared/src/types/models.ts`:**
```typescript
// Tipos base — expandidos na Story 1.2
export type TenantMode = 'university' | 'corporate'
export type UserRole = 'student' | 'teacher' | 'admin' | 'manager'
export type CourseStatus = 'draft' | 'published' | 'archived'
export type SessionStatus = 'active' | 'completed' | 'abandoned'
```

### 4. shadcn/ui em `packages/ui`

```bash
cd packages/ui
npx shadcn@latest init
```

**Importante:** Configurar `components.json` para gerar componentes em `packages/ui/src/components`. Apps consumidoras precisam de path alias:

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

### 5. Biome

**`biome.json` (raiz):**
```json
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

### 6. Vitest

**`apps/web/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

---

## Tasks

- [x] 1. Inicializar monorepo com Turborepo (`npx create-turbo@latest`)
- [x] 2. Configurar pnpm workspaces (`pnpm-workspace.yaml`)
- [x] 3. Criar `apps/web` com Next.js 15 + TypeScript strict
- [x] 4. Criar `packages/shared` com tipos base (`types/models.ts`, `validators/`, `constants/`)
- [x] 5. Criar `packages/database` (placeholder para Drizzle — `src/schema/`, `src/client.ts`)
- [x] 6. Criar `packages/agents` (placeholder — `src/orchestrator.ts`, `src/prompts/`, `src/schemas/`)
- [x] 7. Criar `packages/ui` com Tailwind CSS 4 + shadcn/ui + Button component
- [x] 8. Configurar Biome (`biome.json` na raiz)
- [x] 9. Configurar `turbo.json` com pipelines (build, dev, lint, typecheck, test)
- [x] 10. Criar `.env.example` com todas as variaveis documentadas
- [x] 11. Criar `README.md` com instrucoes de setup local
- [x] 12. Configurar Vitest em `apps/web` e `packages/shared` (config base)
- [x] 13. Verificar: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa |

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam | Yes |
| Pre-PR | Todos os ACs verificados, `pnpm build` sem erros | Yes |
| CI | Pipeline `pnpm install → lint → typecheck → test → build` verde | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] `pnpm dev` inicia sem erros
- [ ] `pnpm lint && pnpm typecheck && pnpm build` passam
- [ ] `pnpm test` executa sem erros (config existe)
- [ ] PR aprovada com review

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Tailwind CSS 4 incompatibilidade com shadcn | MEDIUM | Verificar compatibilidade antes de avancar; fallback para Tailwind 3 |
| Turborepo path resolution issues | LOW | Usar `transpilePackages` no next.config |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
