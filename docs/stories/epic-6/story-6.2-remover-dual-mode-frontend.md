# Story 6.2: Remover Dual-Mode do Frontend

**Epic:** [Epic 6 — Simplificacao & Seguranca](../../epics/epic-6-simplificacao-seguranca.md)
**Version:** 1.1
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 6.1 (tipos e schemas devem estar limpos)
**Blocks:** —
**Assigned To:** @dev (Dex)
**Risk:** MEDIUM — toca 12 componentes em layers distintas

---

## User Story

**As a** platform maintainer,
**I want** remover toda logica condicional de dual-mode da UI,
**so that** os componentes exibam terminologia corporativa fixa sem complexidade desnecessaria.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 8.3 (Modos), Section 9.4 (TenantProvider) |
| **PRD Ref** | `docs/prd.md` — FR1 (simplificado) |
| **Sprint Ref** | `docs/stories/sprint-remove-dual-mode/sprint-overview.md` — Stories R.2 + R.3 |
| **Stack** | Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui |
| **Depends On** | Story 6.1 completa (tipos, schemas, labels.ts prontos) |
| **Impact** | 12 componentes UI, 6+ arquivos de teste, architecture.md |

---

## Acceptance Criteria

- [x] **AC1:** Seletor de modo removido de `tenant-settings-form.tsx`
- [x] **AC2:** Dropdown de modo removido de `course-form-dialog.tsx`
- [x] **AC3:** Sidebar exibe "Trilhas" fixo (sem getModeLabels)
- [x] **AC4:** Student dashboard exibe "Trilhas" fixo
- [x] **AC5:** Teacher dashboard exibe "Trilhas" fixo
- [x] **AC6:** Manager dashboard exibe "Competencias Ativas" e "ROI de Treinamento" fixo
- [x] **AC7:** Onboarding step-sector unificado para input corporativo (Setor/Area)
- [x] **AC8:** `mode` removido do TenantProvider context
- [x] **AC9:** Arquivo `dual-mode-labels.ts` deletado
- [x] **AC10:** Course card, course table e course detail sem mode badge/column
- [x] **AC11:** Todos os testes de dual-mode atualizados ou removidos (6+ arquivos)
- [x] **AC12:** Build do Next.js sem erros
- [x] **AC13:** `architecture.md` atualizado — remover Section 8.3, atualizar Sections 1 e 6.1, remover todas referencias a mode

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 8) Remover mode do TenantProvider
  - [x] `apps/web/src/components/providers/tenant-provider.tsx` — remover campo `mode` da interface `TenantData`
  - [x] Remover `mode: "university" | "corporate"` do contexto
  - [x] Atualizar `TenantSettings` interface se necessario
  - [x] Verificar que `useTenant()` nao retorna mais `mode`

- [x] **Task 2** (AC: 1) Remover seletor de modo do tenant settings
  - [x] `apps/web/src/components/admin/tenant-settings-form.tsx` — remover secao de selecao de modo
  - [x] Remover state e handlers relacionados a mode

- [x] **Task 3** (AC: 2) Remover dropdown de modo do course form
  - [x] `apps/web/src/app/(platform)/courses/_components/course-form-dialog.tsx` — remover select de modo
  - [x] Remover mode do form state e submission

- [x] **Task 4** (AC: 3) Atualizar sidebar com label fixo
  - [x] `apps/web/src/components/layout/sidebar.tsx` — usa `PLATFORM_LABELS.courses` ("Trilhas")
  - [x] Importar de `@eximia/shared` o `PLATFORM_LABELS` de `labels.ts`
  - [x] Remover import de `getModeLabels` e `useTenant().mode`

- [x] **Task 5** (AC: 4, 5) Atualizar dashboards student e teacher
  - [x] `apps/web/src/components/dashboard/student-dashboard.tsx` — usa PLATFORM_LABELS.courses
  - [x] Dashboard teacher usa labels fixos
  - [x] `apps/web/src/app/(platform)/dashboard/page.tsx` — sem passagem de `tenantMode` prop
  - [x] Usar `PLATFORM_LABELS.courses` em vez de labels dinamicos

- [x] **Task 6** (AC: 6) Atualizar manager dashboard
  - [x] `apps/web/src/components/dashboard/manager-dashboard.tsx` — usa PLATFORM_LABELS.engagementRate e completionRate
  - [x] Remover logica condicional de mode labels

- [x] **Task 7** (AC: 7) Unificar onboarding step-sector
  - [x] Onboarding unificado para input corporativo fixo (Setor/Area)
  - [x] Usa `PLATFORM_LABELS.onboarding_sector`

- [x] **Task 8** (AC: 9) Deletar dual-mode-labels.ts
  - [x] `apps/web/src/components/dashboard/dual-mode-labels.ts` — confirmado deletado
  - [x] Todos os imports atualizados para `PLATFORM_LABELS`

- [x] **Task 9** (AC: 10) Limpar course components
  - [x] `course-detail-client.tsx` — sem mode display/badge
  - [x] `course-card.tsx` — sem mode badge
  - [x] `course-table.tsx` — sem mode column

- [x] **Task 10** (AC: 11) Atualizar testes
  - [x] `packages/shared/src/__tests__/labels.test.ts` — testa PLATFORM_LABELS fixos
  - [x] `dual-mode-labels.test.ts` — confirmado deletado
  - [x] Dashboard tests sem assertions de mode ou tenantMode prop
  - [x] Onboarding tests simplificados

- [x] **Task 11** (AC: 13) Atualizar architecture.md
  - [x] Section 8.3 removida
  - [x] Section 1 atualizada — sem referencia a dois modos
  - [x] Section 6.1 — sem Tenant.mode
  - [x] Zero referencias restantes a mode no architecture.md

- [x] **Task 12** (AC: 12) Validacao final
  - [x] `pnpm typecheck` — passa
  - [x] Grep extensivo: zero resultados para `"university"`, `TenantMode`, `getModeLabels`, `dual-mode` no codigo
  - [x] dashboard/page.tsx verificado — sem labels mode-aware

---

## Dev Notes

### TenantProvider — Current State [Source: apps/web/src/components/providers/tenant-provider.tsx]

```typescript
interface TenantData {
  id: string
  name: string
  slug: string
  mode: "university" | "corporate"  // ← REMOVER
  branding: TenantBranding
  settings: TenantSettings
}
```

### Componentes Afetados (12) [Source: epic-6, sprint-overview]

| # | Component | File | Change |
|---|-----------|------|--------|
| 1 | TenantProvider | `components/providers/tenant-provider.tsx` | Remove mode from context |
| 2 | TenantSettingsForm | `components/admin/tenant-settings-form.tsx` | Remove mode selector (lines ~155-179) |
| 3 | CourseFormDialog | `courses/_components/course-form-dialog.tsx` | Remove mode dropdown (lines ~100-106) |
| 4 | Sidebar | `components/layout/sidebar.tsx` | `getModeLabels()` → `PLATFORM_LABELS.courses` |
| 5 | StudentDashboard | `components/dashboard/student-dashboard.tsx` | Remove `tenantMode` prop, use PLATFORM_LABELS |
| 6 | TeacherDashboard | `components/dashboard/teacher-dashboard.tsx` | Remove `tenantMode` prop, use PLATFORM_LABELS |
| 7 | ManagerDashboard | `components/dashboard/manager-dashboard.tsx` | Hardcode "Competencias Ativas", "ROI de Treinamento" |
| 8 | StepSector | `components/onboarding/step-sector.tsx` | Unify to corporate input (Setor/Area) |
| 9 | DualModeLabels | `components/dashboard/dual-mode-labels.ts` | DELETE entire file |
| 10 | CourseDetailClient | `courses/[courseId]/_components/course-detail-client.tsx` | Remove mode display |
| 11 | CourseCard | `courses/_components/course-card.tsx` | Remove mode badge |
| 12 | CourseTable | `courses/_components/course-table.tsx` | Remove mode column |

### dual-mode-labels.ts — Current State [Source: apps/web/src/components/dashboard/dual-mode-labels.ts]

```typescript
export function getDualModeLabel(mode: string, key: LabelKey): string {
  const labels = getModeLabels((mode as TenantMode) || "university")
  return labels.summary_labels[key] ?? defaultLabels[key]
}
```
**Acao:** Deletar arquivo. Substituir chamadas por `PLATFORM_LABELS` direto.

### Labels Corporativos (apos Story 6.1) [Source: epic-6 Technical Notes]

```typescript
// packages/shared/src/constants/labels.ts (criado pela Story 6.1)
export const PLATFORM_LABELS = {
  courses: 'Trilhas',
  dashboard_metrics: ['Competencias', 'ROI'],
  hierarchy: ['Gestor T&D', 'Lider', 'Colaborador'],
  onboarding_sector: { label: 'Setor/Area', type: 'text' },
  engagementRate: 'Competencias Ativas',
  completionRate: 'ROI de Treinamento',
} as const
```

### Dashboard Page — Passa tenantMode [Source: apps/web/src/app/(platform)/dashboard/page.tsx]

Atualmente passa `tenantMode` como prop para StudentDashboard e TeacherDashboard. Remover esse prop e o modo de obtencao do mode do tenant.

### Testes a Atualizar (6 arquivos) [Source: sprint-overview Story R.3]

| Arquivo | Acao |
|---------|------|
| `packages/shared/src/__tests__/mode-config.test.ts` | Adaptar para PLATFORM_LABELS ou deletar |
| `apps/web/src/components/dashboard/__tests__/dual-mode-labels.test.ts` | DELETAR |
| `apps/web/src/components/dashboard/__tests__/student-dashboard.test.tsx` | Remover assertions de mode |
| `apps/web/src/components/dashboard/__tests__/teacher-dashboard.test.tsx` | Remover testes dual-mode |
| `apps/web/src/components/dashboard/__tests__/manager-dashboard.test.tsx` | Remover testes mode labels |
| `apps/web/src/components/onboarding/__tests__/step-sector.test.tsx` | Simplificar |

### architecture.md Updates [Source: epic-6 AC13]

- **Remove Section 8.3** ("Modos: Universidade vs Corporativo")
- **Update Section 1** — Remove "A plataforma opera em dois modos (universidade e corporativo)"
- **Update Section 6.1** — Remove `Tenant.mode` from data models
- **Grep all** — Remove remaining `mode`, `university`, `TenantMode` references

### Source Tree

```
apps/web/src/
├── components/
│   ├── providers/tenant-provider.tsx     # UPDATED: Remove mode
│   ├── admin/tenant-settings-form.tsx    # UPDATED: Remove mode selector
│   ├── layout/sidebar.tsx               # UPDATED: Use PLATFORM_LABELS
│   ├── dashboard/
│   │   ├── student-dashboard.tsx        # UPDATED: Remove tenantMode prop
│   │   ├── teacher-dashboard.tsx        # UPDATED: Remove tenantMode prop
│   │   ├── manager-dashboard.tsx        # UPDATED: Hardcode corporate labels
│   │   ├── dual-mode-labels.ts          # DELETED
│   │   └── __tests__/                   # UPDATED: Remove mode tests
│   └── onboarding/step-sector.tsx       # UPDATED: Unify to corporate
├── app/(platform)/
│   ├── dashboard/page.tsx               # UPDATED: Remove tenantMode prop passing
│   └── courses/_components/
│       ├── course-form-dialog.tsx        # UPDATED: Remove mode dropdown
│       ├── course-card.tsx              # UPDATED: Remove mode badge
│       ├── course-table.tsx             # UPDATED: Remove mode column
│       └── [courseId]/_components/
│           └── course-detail-client.tsx  # UPDATED: Remove mode display

docs/
└── architecture.md                      # UPDATED: Remove Section 8.3, update 1 + 6.1
```

### Testing

- **Framework:** Vitest + React Testing Library
- **Test location:** `apps/web/src/components/**/__tests__/` and `packages/shared/src/__tests__/`
- **Key validacao:** Todos os dashboards renderizam labels corporativos sem condicional
- **Build check:** `pnpm build` deve completar sem erros (Next.js build validation)
- **Grep final:** Zero resultados para `"university"`, `TenantMode`, `getModeLabels`, `dual-mode`, `getDualModeLabel` no codigo

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Build sem erros | Yes |
| Pre-PR | Grep por `"university"`, `TenantMode`, `getModeLabels`, `dual-mode` retorna 0 resultados no codigo (excl. docs deprecated). Todos os testes passam | Yes |

---

## Definition of Done

- [x] 12 componentes atualizados/deletados
- [x] TenantProvider sem mode
- [x] Labels corporativos fixos em todos os componentes
- [x] dual-mode-labels.ts deletado
- [x] 6+ testes atualizados/removidos
- [x] architecture.md atualizado (Section 8.3 removida)
- [x] Build sem erros
- [x] typecheck + lint passam
- [x] Zero referencias a dual-mode no codigo

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Refactor UI, atualizar testes |
| **@qa (Quinn)** | Validacao visual: labels corretos, nenhuma referencia restante |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Componente esquecido com mode | MEDIUM | Grep extensivo pos-implementacao. typecheck captura maioria |
| Testes quebrando em cadeia | MEDIUM | Executar testes apos cada componente atualizado |
| architecture.md desatualizado | LOW | Grep por `mode`, `university`, `TenantMode` no doc |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 6 | River (SM) |
| 2026-02-08 | 1.1 | PO FIX: 6.2-M-1 add dashboard/page.tsx to Task 5, 6.2-M-2 add admin inline JSX to grep scope | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Full audit of 14 files: 0 dual-mode references in source
- Grep for getModeLabels, getDualModeLabel, tenantMode, TenantMode: 0 results
- architecture.md confirmed Section 8.3 removed

### Completion Notes List
- All 12 components were pre-cleaned in commit `7ef869a`
- teacher-dashboard and step-sector are inline (not separate files) — functionality verified clean
- PLATFORM_LABELS correctly used in sidebar, student-dashboard, manager-dashboard
- dual-mode-labels.ts confirmed deleted

### File List
- `apps/web/src/components/providers/tenant-provider.tsx` — MODIFIED (mode removed)
- `apps/web/src/components/admin/tenant-settings-form.tsx` — MODIFIED (mode selector removed)
- `apps/web/src/app/(platform)/courses/_components/course-form-dialog.tsx` — MODIFIED (mode dropdown removed)
- `apps/web/src/components/layout/sidebar.tsx` — MODIFIED (uses PLATFORM_LABELS)
- `apps/web/src/components/dashboard/student-dashboard.tsx` — MODIFIED (uses PLATFORM_LABELS)
- `apps/web/src/components/dashboard/manager-dashboard.tsx` — MODIFIED (uses PLATFORM_LABELS)
- `apps/web/src/components/dashboard/dual-mode-labels.ts` — DELETED
- `apps/web/src/app/(platform)/courses/_components/course-card.tsx` — MODIFIED (mode badge removed)
- `apps/web/src/app/(platform)/courses/_components/course-table.tsx` — MODIFIED (mode column removed)
- `docs/architecture.md` — MODIFIED (Section 8.3 removed, mode refs cleaned)

---

## QA Results
_(to be filled by @qa)_

---

*Story criada por River (Scrum Master) — exímIA Academy*

— River, removendo obstaculos 🌊
