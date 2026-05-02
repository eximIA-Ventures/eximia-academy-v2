# Story 1.5: CI/CD Pipeline

**Epic:** [Epic 1 — Foundation & Auth](../epics/epic-1-foundation-auth.md)
**Version:** 1.0
**Created:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1 (High)
**Blocked By:** 1.1
**Pode rodar em paralelo com:** 1.2, 1.3, 1.4
**Assigned To:** @dev (Dex), @devops (Gage) Vercel config

---

## User Story

**As a** developer,
**I want** pipeline de CI/CD configurado,
**so that** cada PR e validada e deploys sao automaticos.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2 — Section 13 |
| **Stack** | GitHub Actions + Vercel + pnpm + Node.js 22 |
| **CI** | lint → typecheck → test (Biome + TypeScript + Vitest) |
| **CD** | Vercel auto-deploy (preview per PR, staging on main) |
| **Target** | Pipeline completo < 3 minutos |

---

## Acceptance Criteria

- [ ] **AC1:** GitHub Actions workflow `ci.yml` roda em push e PR
  ```yaml
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
  ```
  Steps: install → lint → typecheck → test → build

- [ ] **AC2:** Vercel conectado ao repositorio para preview deploys automaticos por PR
  - Cada PR gera uma URL de preview (ex: `pr-123-eximia.vercel.app`)
  - Preview deploy roda `pnpm build` com sucesso

- [ ] **AC3:** Branch `main` deploya automaticamente para staging
  - Push para main → deploy para `staging.eximia.academy` (ou Vercel default URL)

- [ ] **AC4:** Variaveis de ambiente configuradas no Vercel
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

- [ ] **AC5:** Pipeline completo executa em < 3 minutos
  - pnpm cache via `actions/cache` ou `pnpm/action-setup` cache
  - Parallelism onde possivel (lint + typecheck em paralelo)

- [ ] **AC6:** Badge de status no README
  - CI badge mostrando status do ultimo build
  - Link para workflow runs

---

## Technical Implementation Guide

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Quality Checks
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

### Deploy Workflow (Optional — Vercel handles this natively)

```yaml
# .github/workflows/deploy.yml (only if needed for Supabase migrations)
name: Deploy

on:
  push:
    branches: [main]

jobs:
  migrate:
    name: Database Migrations
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.message, '[migrate]')

    steps:
      - uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Run migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
```

### Vercel Configuration

**`vercel.json` (root):**
```json
{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

**Nota:** Para monorepo, configurar "Root Directory" no Vercel dashboard como `apps/web`, ou usar `vercel.json` na raiz com paths configurados.

### README Badge

```markdown
[![CI](https://github.com/{org}/eximia-academy/actions/workflows/ci.yml/badge.svg)](https://github.com/{org}/eximia-academy/actions/workflows/ci.yml)
```

### Environments

| Environment | Frontend | Database | Trigger |
|-------------|----------|----------|---------|
| Local | localhost:3000 | Supabase local | `pnpm dev` |
| Preview | *.vercel.app | Supabase staging | PR criado |
| Staging | staging URL | Supabase staging | Push to main |
| Production | app.eximia.academy | Supabase production | Manual promote |

### Performance Tips

- **pnpm cache:** `pnpm/action-setup@v4` + `actions/setup-node@v4` with `cache: pnpm` handles this
- **Concurrency:** `cancel-in-progress: true` cancela runs anteriores do mesmo PR
- **Timeout:** 10 min max (target < 3 min)
- **Turbo cache:** Considerar `turbo --cache-dir=.turbo` com cache no GitHub Actions

---

## Tasks

- [x] 1. Criar `.github/workflows/ci.yml` com steps (install, lint, typecheck, test, build)
- [x] 2. Configurar pnpm + Node.js 22 + cache no workflow
- [x] 3. Adicionar concurrency group para cancelar runs duplicados
- [ ] 4. Conectar Vercel ao repositorio (via Vercel dashboard) — @devops
- [ ] 5. Configurar environment variables no Vercel (staging) — @devops
- [ ] 6. Configurar preview deploys por PR — @devops
- [ ] 7. Configurar deploy automatico main → staging — @devops
- [x] 8. Criar `vercel.json` para monorepo config (se necessario)
- [x] 9. Adicionar CI badge no `README.md`
- [ ] 10. Validar: pipeline completo < 3 minutos (after push)
- [ ] 11. (Opcional) Criar `.github/workflows/deploy.yml` para migrations Supabase

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Criar workflows GitHub Actions, vercel.json |
| **@devops (Gage)** | Configurar Vercel, environment variables, domain |

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Workflow YAML valido (actionlint) | Yes |
| Pre-PR | Pipeline executa com sucesso no PR | Yes |
| Performance | Pipeline < 3 minutos | No (target) |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] CI verde no PR (lint + typecheck + test)
- [ ] Preview deploy funciona (Vercel gera URL por PR)
- [ ] Main → staging deploy automatico
- [ ] Pipeline < 3 min
- [ ] Badge no README
- [ ] PR aprovada

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| pnpm cache miss no CI | LOW | `pnpm/action-setup@v4` tem cache built-in |
| Vercel monorepo config | MEDIUM | Testar `vercel.json` com outputDirectory correto |
| Secrets nao configurados | LOW | Documentar todas as env vars necessarias |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
