# Story 24.1: Unit Tests — Pipeline Agents + Framework Registry

**Epic:** [Epic 24 — WS2: Quality: Tests, Benchmarks & Polish](../../epics/epic-24-ws2-quality-tests-benchmarks-polish.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (qualidade — protege todo o pipeline)
**Blocked By:** Epics 20-23
**Blocks:** Story 24.2
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** unit tests completos para cada agente do pipeline e Framework Registry,
**so that** mudanças futuras sejam protegidas por testes automatizados.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Seções 4, 8 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Vitest, MSW v2, TypeScript, Zod |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/vitest.config.ts`, `apps/web/src/mocks/handlers.ts` (MSW pattern) |
| **Risk** | LOW — testes puros, sem side effects |

---

## Acceptance Criteria

- [ ] **AC1:** Tests para Framework Registry em `packages/course-designer/src/__tests__/framework-registry.test.ts`
  - `getFrameworkConfig("elc_plus")` retorna config com 6 stages
  - `getFrameworkConfig("kolb_4")` retorna config com 4 stages
  - `getFrameworkConfig("pbl_hmelo")` retorna config com 4 stages
  - `getFrameworkConfig("unknown")` throws
  - `listFrameworks()` retorna array com 3 entries
  - Soma de time_percentage = 100 para cada framework
  - Soma de quality_criteria weights = 100 para cada framework
- [ ] **AC2:** Tests para Framework Selector em `__tests__/framework-selector.test.ts`
  - Instructor preference overrides auto selection
  - "resolver problemas" → pbl_hmelo
  - Duration ≤ 10h + non-beginner → kolb_4
  - Default → elc_plus
- [ ] **AC3:** Tests para Input Schema + Brief Score em `__tests__/input-schema.test.ts`
  - Valid input passes schema validation
  - Missing required fields rejects
  - Brief Score calcula corretamente para inputs conhecidos
  - Pre-validation Gate: blocking checks + warnings
  - Cross-validation: weeks × hours_per_week → total_duration_hours
- [ ] **AC4:** Tests para cada agente com MSW mocks em `__tests__/`:
  - `analyzer.test.ts`: output Zod-validated, framework selection logic
  - `architect.test.ts`: output com modules, Bloom progression, ABCD objectives
  - `calculator.test.ts`: soma de minutos = total, chunks ≤ 30min
  - `validator.test.ts`: scorecard calculation, verdict thresholds, neuroscience rules
  - `generator.test.ts`: blueprint schema complete
- [ ] **AC5:** Tests para Neuroscience Rules em `__tests__/neuroscience-rules.test.ts`
  - Cada regra N1-N7 testada com inputs que passam e falham
  - Weights somam 100
- [ ] **AC6:** Tests para Interaction Mapper em `__tests__/interaction-mapper.test.ts`
  - bloom_mapped: correct type per Bloom level
  - Positional adjustments per spiral level
  - dominant: same type for all modules
- [ ] **AC7:** Coverage ≥ 80% para `packages/course-designer/src/`
- [ ] **AC8:** `pnpm test` passa sem erros

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar tests para Framework Registry
  - [ ] Criar `packages/course-designer/src/__tests__/framework-registry.test.ts`
  - [ ] Testar `getFrameworkConfig("elc_plus")` retorna config com 6 stages
  - [ ] Testar `getFrameworkConfig("kolb_4")` retorna config com 4 stages
  - [ ] Testar `getFrameworkConfig("pbl_hmelo")` retorna config com 4 stages
  - [ ] Testar `getFrameworkConfig("unknown")` throws error
  - [ ] Testar `listFrameworks()` retorna array com 3 entries
  - [ ] Testar soma de `time_percentage` = 100 para cada framework
  - [ ] Testar soma de `quality_criteria` weights = 100 para cada framework

- [ ] **Task 2** (AC: 2) Criar tests para Framework Selector
  - [ ] Criar `packages/course-designer/src/__tests__/framework-selector.test.ts`
  - [ ] Testar instructor preference overrides auto selection
  - [ ] Testar "resolver problemas" → pbl_hmelo
  - [ ] Testar duration ≤ 10h + non-beginner → kolb_4
  - [ ] Testar default → elc_plus

- [ ] **Task 3** (AC: 3) Criar tests para Input Schema + Brief Score
  - [ ] Criar `packages/course-designer/src/__tests__/input-schema.test.ts`
  - [ ] Testar valid input passes schema validation
  - [ ] Testar missing required fields rejects
  - [ ] Testar Brief Score calcula corretamente para inputs conhecidos
  - [ ] Testar Pre-validation Gate: blocking checks + warnings
  - [ ] Testar cross-validation: weeks × hours_per_week → total_duration_hours

- [ ] **Task 4** (AC: 4) Criar tests para cada agente com MSW mocks
  - [ ] Criar `__tests__/analyzer.test.ts` — output Zod-validated, framework selection logic
  - [ ] Criar `__tests__/architect.test.ts` — output com modules, Bloom progression, ABCD objectives
  - [ ] Criar `__tests__/calculator.test.ts` — soma de minutos = total, chunks ≤ 30min
  - [ ] Criar `__tests__/validator.test.ts` — scorecard calculation, verdict thresholds, neuroscience rules
  - [ ] Criar `__tests__/generator.test.ts` — blueprint schema complete
  - [ ] Configurar MSW v2 `setupServer` para mockar chamadas LLM

- [ ] **Task 5** (AC: 5) Criar tests para Neuroscience Rules
  - [ ] Criar `__tests__/neuroscience-rules.test.ts`
  - [ ] Testar cada regra N1-N7 com inputs que passam
  - [ ] Testar cada regra N1-N7 com inputs que falham
  - [ ] Testar weights somam 100

- [ ] **Task 6** (AC: 6) Criar tests para Interaction Mapper
  - [ ] Criar `__tests__/interaction-mapper.test.ts`
  - [ ] Testar bloom_mapped: correct type per Bloom level
  - [ ] Testar positional adjustments per spiral level
  - [ ] Testar dominant: same type for all modules

- [ ] **Task 7** (AC: 7, 8) Validar coverage e test suite
  - [ ] Rodar `pnpm test` — deve passar sem erros
  - [ ] Verificar coverage ≥ 80% para `packages/course-designer/src/`
  - [ ] Ajustar testes se coverage insuficiente

---

## Dev Notes

### Technical Notes

Usar MSW v2 `setupServer` para mockar chamadas LLM nos testes dos agentes. Seguir pattern existente em `apps/web/src/mocks/handlers.ts`.

```typescript
// Pattern: MSW mock para agente
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json()
    if (body.messages[0].content.includes('CourseDesigner_Analyzer')) {
      return HttpResponse.json(mockAnalyzerResponse)
    }
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm test` passa | Yes |
| Pre-PR | Coverage ≥ 80% | Yes |

### File Locations

```
packages/course-designer/src/__tests__/
├── framework-registry.test.ts          # NOVO
├── framework-selector.test.ts          # NOVO
├── input-schema.test.ts                # NOVO
├── analyzer.test.ts                    # NOVO
├── architect.test.ts                   # NOVO
├── calculator.test.ts                  # NOVO
├── validator.test.ts                   # NOVO
├── generator.test.ts                   # NOVO
├── neuroscience-rules.test.ts          # NOVO
├── interaction-mapper.test.ts          # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |
| 2026-02-17 | 1.2 | Paths atualizados: @eximia/agents → @eximia/course-designer (D19 modularizacao) | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
