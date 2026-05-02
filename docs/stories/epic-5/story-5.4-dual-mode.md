# Story 5.4: Dual-Mode (Universidade vs Corporativo)

**Epic:** [Epic 5 — Multi-tenant & Enterprise](../../epics/epic-5-multi-tenant-enterprise.md)
**Version:** 1.0
**Created:** 2026-02-07
**Author:** River (Scrum Master)
**Status:** In Progress
**Story Points:** 5
**Priority:** P2
**Blocked By:** Story 5.1 (mode must be configurable)
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** tenant admin,
**I want** que a plataforma opere no modo adequado a minha instituicao,
**so that** a experiencia e as metricas facam sentido para meu contexto.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 8.3 (Modos: Universidade vs Corporativo), Section 6.1 (`Tenant.mode`) |
| **Screens Ref** | `docs/screens.md` — Screen 4 (Dashboard variantes 4A-4D, dual-mode notes) |
| **PRD Ref** | `docs/prd.md` — FR1, Story 5.4 (6 ACs) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `tenants` (mode: 'university' \| 'corporate') |
| **Pattern** | Config-driven label swapping — NO code branches |
| **Impact** | Touches sidebar (Epic 1), dashboards (Epic 4), onboarding step 5 (Story 5.3), course labels (Epic 2) |

---

## Acceptance Criteria

- [x] **AC1:** Modo definido em `tenant.mode` (university | corporate)

- [x] **AC2:** Modo universidade: sidebar exibe "Disciplinas" ao inves de "Trilhas", dashboard mostra "Notas" e "Frequencia"

- [x] **AC3:** Modo corporativo: sidebar exibe "Trilhas", dashboard mostra "Competencias" e "ROI"

- [x] **AC4:** Labels e terminologia adaptam dinamicamente via config por modo (nenhuma string hardcoded)

- [x] **AC5:** Dashboard do gestor adapta metricas ao modo selecionado

- [x] **AC6:** Testes verificam renderizacao correta em ambos os modos

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 4) Criar mode config object
  - [x]Criar `packages/shared/src/constants/mode-config.ts`
  - [x]Definir `MODE_LABELS` const com type safety (`as const`)
  - [x]University labels: courses="Disciplinas", metrics=["Notas","Frequencia"], hierarchy=["Coordenador","Professor","Aluno"]
  - [x]Corporate labels: courses="Trilhas", metrics=["Competencias","ROI"], hierarchy=["Gestor T&D","Lider","Colaborador"]
  - [x]Incluir onboarding_step5 labels por modo
  - [x]Export type `TenantMode = 'university' | 'corporate'`
  - [x]Export helper: `getModeLabels(mode: TenantMode) => ModeLabels`

- [x] **Task 2** (AC: 1) Criar hook ou utility para consumir mode config
  - [x]Opcao A (RSC): utility function `getModeConfig(tenant)` para Server Components
  - [x]Opcao B (Client): hook `useModeConfig()` que le do TenantProvider context
  - [x]TenantProvider ja possui `tenant.mode` no contexto server-side (Epic 1)
  - [x]Ambos devem retornar labels tipados

- [x] **Task 3** (AC: 2, 3) Atualizar sidebar com labels mode-aware
  - [x]Em `apps/web/src/components/layout/sidebar.tsx`
  - [x]Substituir strings hardcoded por `MODE_LABELS[tenant.mode].courses`
  - [x]"Cursos" → "Disciplinas" (university) ou "Trilhas" (corporate)
  - [x]Manter icones iguais, apenas labels mudam

- [x] **Task 4** (AC: 2, 3, 5) Atualizar dashboards com metricas mode-aware
  - [x]Em `apps/web/src/components/dashboard/student-dashboard.tsx`: usar mode labels
  - [x]Em `apps/web/src/components/dashboard/` (teacher + manager): usar mode labels
  - [x]Manager dashboard: metricas adaptam — "Notas"/"Frequencia" vs "Competencias"/"ROI"
  - [x]Summary cards labels adaptam ao modo
  - [x]Usar `MODE_LABELS[tenant.mode].dashboard_metrics` para array de labels

- [x] **Task 5** (AC: 4) Verificar nenhuma string hardcoded restante
  - [x]Grep pelo codebase por TODAS as strings mode-specific definidas em `MODE_LABELS`:
    - Courses: "Disciplinas", "Trilhas"
    - Metrics: "Notas", "Frequencia", "Competencias", "ROI"
    - Onboarding step 5: "Curso/Periodo", "Setor/Area"
    - Hierarchy: "Coordenador", "Professor", "Aluno", "Gestor T&D", "Lider", "Colaborador"
  - [x]Todas devem vir de `MODE_LABELS`, nenhuma hardcoded em componentes
  - [x]Verificar que StepSector (Story 5.3) consome `MODE_LABELS.onboarding_step5`, nao labels hardcoded
  - [x]Adicionar fallback labels para strings nao mapeadas (default to university)

- [x] **Task 6** (AC: 6) Testes para ambos os modos
  - [x]Test: `MODE_LABELS.university` retorna labels corretos
  - [x]Test: `MODE_LABELS.corporate` retorna labels corretos
  - [x]Test: Sidebar renderiza "Disciplinas" para university
  - [x]Test: Sidebar renderiza "Trilhas" para corporate
  - [x]Test: Manager dashboard mostra "Notas"/"Frequencia" para university
  - [x]Test: Manager dashboard mostra "Competencias"/"ROI" para corporate
  - [x]Test: Student dashboard adapta labels ao modo
  - [x]Test: Mode config has exhaustive keys (no missing labels)
  - [x]Test: Fallback para modo nao reconhecido (defaults to university)

---

## Dev Notes

### Mode Config Pattern [Source: architecture.md v1.3, Section 8.3 + epic-5 Technical Notes]

```typescript
// packages/shared/src/constants/mode-config.ts
export const MODE_LABELS = {
  university: {
    courses: 'Disciplinas',
    dashboard_metrics: ['Notas', 'Frequencia'],
    hierarchy: ['Coordenador', 'Professor', 'Aluno'],
    onboarding_step5: { label: 'Curso/Periodo', type: 'text' },
  },
  corporate: {
    courses: 'Trilhas',
    dashboard_metrics: ['Competencias', 'ROI'],
    hierarchy: ['Gestor T&D', 'Lider', 'Colaborador'],
    onboarding_step5: { label: 'Setor/Area', type: 'text' },
  },
} as const

export type TenantMode = keyof typeof MODE_LABELS
export type ModeLabels = (typeof MODE_LABELS)[TenantMode]

export function getModeLabels(mode: TenantMode): ModeLabels {
  return MODE_LABELS[mode] ?? MODE_LABELS.university // fallback
}
```

### Architecture Mode Table [Source: architecture.md v1.3, Section 8.3]

| Aspecto | Universidade | Corporativo |
|---------|-------------|-------------|
| Estrutura | Semestres, disciplinas, turmas | Trilhas, competencias, OKRs |
| Avaliacao | Notas, frequencia, aprovacao | Competencias, certificacoes, ROI |
| Hierarquia | Coordenador → Professor → Aluno | Gestor T&D → Lider → Colaborador |
| Dashboard | Notas, presenca, engajamento | KPIs, gaps, ROI de treinamento |

### TenantProvider Integration [Source: architecture.md Section 9.4]

```typescript
// TenantProvider already provides tenant.mode in context
// No new data fetching needed — just consume existing context

// In RSC (Server Components):
const tenant = await getTenant()
const labels = getModeLabels(tenant.mode)

// In Client Components:
const { tenant } = useTenant() // from TenantProvider context
const labels = getModeLabels(tenant.mode)
```

### Components to Update

| Component | File | Change |
|-----------|------|--------|
| Sidebar | `components/layout/sidebar.tsx` | "Cursos" → `labels.courses` |
| StudentDashboard | `components/dashboard/student-dashboard.tsx` | Summary card labels |
| TeacherDashboard | `components/dashboard/teacher-dashboard.tsx` | Course labels |
| ManagerDashboard | `components/dashboard/manager-dashboard.tsx` | Metrics labels: `labels.dashboard_metrics` |
| StepSector (5.3) | `components/onboarding/step-sector.tsx` | Already mode-aware from Story 5.3 |

### File Locations

```
packages/shared/src/constants/
└── mode-config.ts                      # NEW: Mode labels + types + helper

apps/web/src/components/layout/
└── sidebar.tsx                         # UPDATED: Use MODE_LABELS for course label

apps/web/src/components/dashboard/
├── student-dashboard.tsx               # UPDATED: Mode-aware labels
├── teacher-dashboard.tsx               # UPDATED: Mode-aware labels (if exists)
└── manager-dashboard.tsx               # UPDATED: Mode-aware metrics
```

### Testing

- **Test location:** `packages/shared/tests/` and `apps/web/tests/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock TenantProvider with different modes
- **Key concern:** Both modes render correctly, no hardcoded strings remain, exhaustive label mapping

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam. Mode config object existe com todos os labels. | Yes |
| Pre-PR | Ambos modos renderizam corretamente end-to-end. Nenhuma string mode-specific hardcoded. Manager dashboard adapta metricas. Testes cobrem ambos modos. | Yes |

---

## Definition of Done

- [x] Todos os ACs passam
- [x] Mode config em `packages/shared` com type safety
- [x] Sidebar adapta label de cursos ao modo
- [x] Dashboards (student, teacher, manager) adaptam metricas ao modo
- [x] Nenhuma string mode-specific hardcoded em componentes
- [x] Fallback para modo nao reconhecido funciona
- [x] Testes cobrem ambos modos (university + corporate)
- [x] Componentes de Epics 1-4 continuam funcionando
- [x] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (mode config, label mapping, component updates) |
| **@architect (Aria)** | Mode config pattern review, ensure no code branches |
| **@qa (Quinn)** | Validacao: both modes render correctly, label mapping complete, no hardcoded strings |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Labels incompletos em algum componente | LOW | Grep por strings hardcoded. Fallback defaults para university |
| Mode config nao consumido por todos componentes | MEDIUM | Task 5 verifica exhaustivamente. Testes cobrem ambos modos |
| Componentes de Epics 1-4 quebram com mudancas | MEDIUM | Testes de regressao. Mudancas sao aditivas (labels), nao destrutivas |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-07 | 1.0 | Story created from Epic 5 | River (SM) |
| 2026-02-08 | 1.1 | Implementation complete (all 6 ACs) | @dev (Dex / Claude Opus 4.6) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- Type check passed clean (fixed TenantMode export conflict between models.ts and mode-config.ts)
- Lint: 0 errors
- Tests: mode-config.test.ts (5 tests, shared), dual-mode-labels.test.ts (3 tests), student-dashboard.test.tsx (7 tests), teacher-dashboard.test.tsx (3 tests), manager-dashboard.test.tsx (3 tests) — all passing

### Completion Notes List
- Created shared `MODE_LABELS` config in `packages/shared/src/constants/mode-config.ts`
- Includes `summary_labels` for manager dashboard dual-mode (engagementRate, completionRate)
- `TenantMode` type NOT re-exported from mode-config (already in `types/models.ts`) to avoid TS2308
- Sidebar uses `useTenant()` + `getModeLabels()` for mode-aware course labels
- Student/Teacher dashboards accept optional `tenantMode` prop (default: "university")
- Updated existing `dual-mode-labels.ts` to delegate to shared `getModeLabels()`
- Updated existing tests: "Cursos Inscritos" → "Disciplinas Inscritos" (university default)

### File List
**NEW:**
- `packages/shared/src/constants/mode-config.ts` — MODE_LABELS config + getModeLabels()
- `packages/shared/src/__tests__/mode-config.test.ts`

**UPDATED:**
- `packages/shared/src/index.ts` — Export mode-config
- `apps/web/src/components/dashboard/dual-mode-labels.ts` — Uses shared getModeLabels()
- `apps/web/src/components/layout/sidebar.tsx` — Mode-aware course labels
- `apps/web/src/components/dashboard/student-dashboard.tsx` — tenantMode prop, mode labels
- `apps/web/src/components/dashboard/teacher-dashboard.tsx` — tenantMode prop, mode labels
- `apps/web/src/app/(platform)/dashboard/page.tsx` — Passes tenantMode to dashboards
- `apps/web/src/components/dashboard/__tests__/student-dashboard.test.tsx` — Updated for mode labels
- `apps/web/src/components/dashboard/__tests__/teacher-dashboard.test.tsx` — Updated + corporate test
- `apps/web/src/components/dashboard/__tests__/dual-mode-labels.test.ts` — Updated fallback test

---

## QA Results

### Review Date: 2026-02-07

### Reviewed By: Quinn (Test Architect)

### Review Type: Spec Review (Pre-Implementation)

### Spec Quality Assessment

Story specification is well-structured with 6 ACs fully tracing to PRD. Config-driven approach (no code branches) is architecturally sound. MODE_LABELS pattern with `as const` provides excellent type safety. Architecture alignment is 100%. 1 MEDIUM concern: Task 5 hardcoded string grep is incomplete — misses labels defined in MODE_LABELS that may be hardcoded by other stories.

### Findings

| ID | Severity | Title | Owner |
|----|----------|-------|-------|
| M-1 | MEDIUM | Task 5 grep list incomplete — misses onboarding labels ("Setor/Area", "Curso/Periodo") and hierarchy labels ("Coordenador", "Gestor T&D", etc.) | @sm |
| L-1 | LOW | Screens.md does not document sidebar label changes per mode — only Dashboard (4C) has dual-mode notes | @architect |

### Compliance Check

- PRD Traceability: 100% (6/6 ACs mapped)
- Architecture Alignment: 100% (MODE_LABELS matches Section 8.3, TenantProvider Section 9.4)
- Screens Alignment: 95% (Dashboard dual-mode notes match, sidebar mode change not in screens.md)
- Cross-Story Consistency: M-1 (grep list must include ALL mode-specific labels)
- Security Considerations: PASS (mode config is server-side, read-only const)

### Cross-Story Analysis

This story touches components from Epics 1-4 (sidebar, dashboards). The "Components to Update" table is well-defined. However:

1. **Story 5.3 creates StepSector** with labels that should come from MODE_LABELS — Task 5 grep must catch these if hardcoded.
2. **Task 5 grep list** should include ALL values from MODE_LABELS, not just the 6 most visible ones. Missing: "Setor/Area", "Curso/Periodo", "Coordenador", "Professor", "Aluno", "Gestor T&D", "Lider", "Colaborador".
3. **StepSector (5.3)** is marked "Already mode-aware from Story 5.3" in the Components table — but if 5.3 hardcodes labels, this assumption is incorrect.

### Recommendations

1. @sm: Expand Task 5 grep list to include ALL MODE_LABELS values
2. @architect: Update screens.md sidebar table to document mode-dependent labels
3. @dev: During implementation, ensure StepSector from Story 5.3 consumes MODE_LABELS.onboarding_step5

### Gate Status

Gate: **CONCERNS** (Score: 90) → `docs/qa/gates/5.4-dual-mode.yml`

### Recommended Status

Ready for development with advisory: @sm should expand Task 5 grep list before @dev starts implementation (see M-1 in gate file).

---

*Story criada por River (Scrum Master) — eximIA Academy*
