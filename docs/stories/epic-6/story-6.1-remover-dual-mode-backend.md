# Story 6.1: Remover Dual-Mode do Backend

**Epic:** [Epic 6 — Simplificacao & Seguranca](../../epics/epic-6-simplificacao-seguranca.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0 (Blocker — precede Story 6.2)
**Blocked By:** —
**Blocks:** Story 6.2
**Assigned To:** @dev (Dex)
**Risk:** MEDIUM — migration destrutiva (DROP COLUMN), referencias em cadeia

---

## User Story

**As a** platform maintainer,
**I want** remover a infraestrutura de dual-mode (university/corporate) das camadas de dados e tipos,
**so that** a plataforma opere exclusivamente no modo corporativo sem complexidade condicional.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 8.3 (Modos), Section 14.2 (Input Validation) |
| **PRD Ref** | `docs/prd.md` — FR1 (simplificado) |
| **Sprint Ref** | `docs/stories/sprint-remove-dual-mode/sprint-overview.md` — Story R.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 |
| **DB Tables** | `tenants` (DROP mode), `courses` (DROP mode) |
| **Impact** | Types, Drizzle schemas, Zod validators, seeds, server actions, API routes |

---

## Acceptance Criteria

- [x] **AC1:** Nova migration remove coluna `mode` da tabela `tenants`
- [x] **AC2:** Nova migration remove coluna `mode` da tabela `courses`
- [x] **AC3:** Tipo `TenantMode` removido de `packages/shared/src/types/models.ts`
- [x] **AC4:** Campo `mode` removido dos Drizzle schemas (`tenants.ts`, `courses.ts`)
- [x] **AC5:** Validador Zod de courses (`packages/shared/src/validators/courses.ts`) sem campo `mode`
- [x] **AC6:** `mode-config.ts` renomeado para `labels.ts`, exporta apenas labels corporativos como constantes fixas, todos os imports atualizados
- [x] **AC7:** Seed files (`seed.sql`, `seed-remote.ts`) sem referencias a mode
- [x] **AC8:** Server Actions (`admin/settings/actions.ts`, `courses/actions.ts`) sem campo mode
- [x] **AC9:** API routes admin sem mode nos payloads
- [x] **AC10:** `pnpm typecheck` passa sem erros em todos os packages
- [x] **AC11:** `pnpm lint` passa sem erros

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2) Criar migration SQL
  - [x] Criar `supabase/migrations/20260208000001_remove_dual_mode.sql`
  - [x] `ALTER TABLE tenants DROP COLUMN mode;`
  - [x] `ALTER TABLE courses DROP COLUMN mode;`
  - [x] Remover CHECK constraints associadas ao campo mode

- [x] **Task 2** (AC: 4) Atualizar Drizzle schemas
  - [x] `packages/database/src/schema/tenants.ts` — remover campo `mode: text("mode", { enum: ["university", "corporate"] }).notNull()`
  - [x] `packages/database/src/schema/courses.ts` — remover campo `mode: text("mode", { enum: ["university", "corporate"] }).notNull()`

- [x] **Task 3** (AC: 3) Remover tipo TenantMode
  - [x] `packages/shared/src/types/models.ts` — remover `export type TenantMode = "university" | "corporate"`
  - [x] Verificar e atualizar todos os imports de `TenantMode` no codebase

- [x] **Task 4** (AC: 5) Atualizar validador Zod de courses
  - [x] `packages/shared/src/validators/courses.ts` — remover campo `mode: z.enum(["university", "corporate", "both"])`
  - [x] Atualizar `updateCourseSchema` que herda de `createCourseSchema`

- [x] **Task 5** (AC: 6) Renomear mode-config.ts para labels.ts
  - [ ] Renomear `packages/shared/src/constants/mode-config.ts` → `packages/shared/src/constants/labels.ts`
  - [ ] Conteudo: exportar `PLATFORM_LABELS` com labels corporativos fixos:
    ```typescript
    export const PLATFORM_LABELS = {
      courses: 'Trilhas',
      dashboard_metrics: ['Competencias', 'ROI'],
      hierarchy: ['Gestor T&D', 'Lider', 'Colaborador'],
      onboarding_sector: { label: 'Setor/Area', type: 'text' },
      engagementRate: 'Competencias Ativas',
      completionRate: 'ROI de Treinamento',
    } as const
    ```
  - [x] Remover `getModeLabels()`, `MODE_LABELS`, `ModeLabels` type
  - [x] Atualizar `packages/shared/src/index.ts` — re-export de `labels.ts` em vez de `mode-config.ts`
  - [x] Grep e atualizar todos os imports de `mode-config` no codebase

- [x] **Task 6** (AC: 7) Limpar seed files
  - [x] `supabase/seed.sql` — remover valores de `mode` nos INSERTs de tenants e courses
  - [x] `supabase/seed-remote.ts` — remover referencias a mode

- [x] **Task 7** (AC: 8) Atualizar Server Actions
  - [x] `apps/web/src/app/(platform)/admin/settings/actions.ts` — remover `mode` do schema Zod e da logica de `saveTenantSettings()`
  - [x] `apps/web/src/app/(platform)/courses/actions.ts` — remover `mode: formData.get("mode")` de `createCourse()` e `updateCourse()`

- [x] **Task 8** (AC: 9) Atualizar API routes
  - [x] `apps/web/src/app/api/admin/tenants/route.ts` — remover mode do response (se necessario, pois nao aparece nos payloads de criacao)
  - [x] Verificar outras API routes que possam referenciar mode

- [x] **Task 9** (AC: 10, 11) Validacao final
  - [x] `pnpm typecheck` — zero erros em todos os packages
  - [x] `pnpm lint` — zero erros
  - [x] Grep extensivo: nenhuma referencia a `TenantMode`, `"university"` no codigo backend (excl. docs)

---

## Dev Notes

### Migration SQL [Source: epic-6 Technical Notes]

```sql
-- supabase/migrations/20260208000001_remove_dual_mode.sql
-- IRREVERSIVEL — fazer backup antes de executar

ALTER TABLE tenants DROP COLUMN IF EXISTS mode;
ALTER TABLE courses DROP COLUMN IF EXISTS mode;
```

**Timestamp:** `20260208000001` — Story 6.4 (LGPD) usa `20260208000002` para garantir ordering.

### Drizzle Schema — Current State [Source: packages/database/src/schema/]

**tenants.ts** (campo a remover):
```typescript
mode: text("mode", { enum: ["university", "corporate"] }).notNull(),
```

**courses.ts** (campo a remover):
```typescript
mode: text("mode", { enum: ["university", "corporate"] }).notNull(),
```

### Type TenantMode — Current State [Source: packages/shared/src/types/models.ts]

```typescript
export type TenantMode = "university" | "corporate"
// Usado em: mode-config.ts, tenant-provider.tsx, dual-mode-labels.ts, validators
```

### Zod Validator — Current State [Source: packages/shared/src/validators/courses.ts]

```typescript
export const createCourseSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().optional(),
  mode: z.enum(["university", "corporate", "both"]),  // ← REMOVER
})
```
**Nota:** Validator aceita `"both"` mas DB nao — sera corrigido pela remocao completa.

### Mode Config — Current State [Source: packages/shared/src/constants/mode-config.ts]

```typescript
export const MODE_LABELS = {
  university: { courses: "Disciplinas", dashboard_metrics: ["Notas", "Frequencia"], ... },
  corporate: { courses: "Trilhas", dashboard_metrics: ["Competencias", "ROI"], ... },
}
export function getModeLabels(mode: TenantMode): ModeLabels
```

**Deve ser substituido por:**
```typescript
// packages/shared/src/constants/labels.ts
export const PLATFORM_LABELS = {
  courses: 'Trilhas',
  dashboard_metrics: ['Competencias', 'ROI'],
  hierarchy: ['Gestor T&D', 'Lider', 'Colaborador'],
  onboarding_sector: { label: 'Setor/Area', type: 'text' },
  engagementRate: 'Competencias Ativas',
  completionRate: 'ROI de Treinamento',
} as const
```

### Server Actions — Current State

**admin/settings/actions.ts:** `saveTenantSettings()` aceita `mode: z.enum(["university", "corporate"]).optional()`
**courses/actions.ts:** `createCourse()` extrai `mode: formData.get("mode") as string`

### Seed Files — Current References

**seed.sql:** INSERTs de tenants incluem `mode` column
**seed-remote.ts:** Referencia `mode` na criacao de tenants

### Source Tree [Source: project structure]

```
packages/database/src/schema/
├── tenants.ts          # UPDATED: Remove mode field
├── courses.ts          # UPDATED: Remove mode field
└── users.ts            # NOT CHANGED (needed for Story 6.4)

packages/shared/src/
├── types/models.ts     # UPDATED: Remove TenantMode
├── constants/
│   ├── mode-config.ts  # RENAME → labels.ts (corporate labels only)
│   └── limits.ts       # NOT CHANGED
├── validators/
│   └── courses.ts      # UPDATED: Remove mode from schema
└── index.ts            # UPDATED: Re-export labels.ts

supabase/
├── migrations/
│   ├── 20260207000000_initial_schema.sql  # NOT CHANGED
│   └── 20260208000001_remove_dual_mode.sql  # NEW
├── seed.sql            # UPDATED: Remove mode values
└── seed-remote.ts      # UPDATED: Remove mode references

apps/web/src/app/(platform)/
├── admin/settings/actions.ts  # UPDATED: Remove mode
└── courses/actions.ts         # UPDATED: Remove mode
```

### Testing

- **Framework:** Vitest
- **Test location:** `packages/shared/src/__tests__/`
- **Key test:** `mode-config.test.ts` — Deve ser atualizado ou deletado (Story 6.2 lida com testes de frontend)
- **Validacao:** `pnpm typecheck && pnpm lint` devem passar limpo em todos os packages
- **Grep final:** Zero resultados para `TenantMode`, `"university"`, `getModeLabels` no codigo backend

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass across all packages | Yes |
| Pre-PR | Migration executa sem erros. Nenhuma referencia a `TenantMode` ou `"university"` no codigo backend | Yes |

---

## Definition of Done

- [x] Migration `20260208000001_remove_dual_mode.sql` criada e funcional
- [x] Drizzle schemas sem campo mode
- [x] TenantMode removido de types
- [x] Zod validator sem mode
- [x] mode-config.ts renomeado para labels.ts com labels corporativos fixos
- [x] Seeds limpos
- [x] Server actions limpos
- [x] API routes limpos
- [x] typecheck + lint passam
- [x] Zero referencias a dual-mode no backend

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Migration, schemas, types, validators, actions |
| **@data-engineer** | Validacao de migration e integridade do schema |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migration DROP COLUMN irreversivel | HIGH | Backup completo antes. Testar em staging primeiro |
| Referencias esquecidas a dual-mode | MEDIUM | Grep extensivo pos-implementacao. CI type-check captura maioria |
| Discrepancia Zod "both" vs DB | LOW | Removido completamente pela Story 6.1 |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 6 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Grep confirmed zero `TenantMode`, `getModeLabels`, `mode-config` refs in source
- seed-remote.ts already clean, seed.sql already clean
- Only fix needed: `tests/e2e/helpers/seed.ts` had `mode: "university"` — removed

### Completion Notes List
- All tasks pre-implemented in commit `7ef869a`
- Only remaining gap was `tests/e2e/helpers/seed.ts` line 10 — fixed in this session
- Full grep validation passed: zero dual-mode refs in backend code

### File List
- `supabase/migrations/20260208000001_remove_dual_mode.sql` — NEW
- `packages/database/src/schema/tenants.ts` — MODIFIED (mode field removed)
- `packages/database/src/schema/courses.ts` — MODIFIED (mode field removed)
- `packages/shared/src/types/models.ts` — MODIFIED (TenantMode removed)
- `packages/shared/src/validators/courses.ts` — MODIFIED (mode removed from Zod)
- `packages/shared/src/constants/labels.ts` — NEW (replaces mode-config.ts)
- `packages/shared/src/index.ts` — MODIFIED (re-exports labels.ts)
- `supabase/seed.sql` — MODIFIED (mode refs removed)
- `supabase/seed-remote.ts` — VERIFIED clean
- `tests/e2e/helpers/seed.ts` — MODIFIED (mode field removed)

---

## QA Results
_(to be filled by @qa)_

---

*Story criada por River (Scrum Master) — exímIA Academy*

— River, removendo obstaculos 🌊
