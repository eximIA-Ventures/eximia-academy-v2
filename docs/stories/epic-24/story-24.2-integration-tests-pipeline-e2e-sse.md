# Story 24.2: Integration Tests — Pipeline E2E + SSE

**Epic:** [Epic 24 — WS2: Quality: Tests, Benchmarks & Polish](../../epics/epic-24-ws2-quality-tests-benchmarks-polish.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (qualidade)
**Blocked By:** Story 24.1, Epics 20-23
**Blocks:** Story 24.3
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** integration tests que validem o fluxo completo do Course Creator end-to-end,
**so that** regressões sejam detectadas automaticamente.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Seções 10, 16 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Vitest, Playwright, MSW v2, TypeScript, Next.js 15 |
| **Package** | `@eximia/course-designer`, `apps/web` |
| **Existing Pattern** | `apps/web/src/mocks/handlers.ts` (MSW pattern), `apps/web/src/instrumentation.ts` (MSW server-side), `apps/web/e2e/` (Playwright E2E) |
| **Risk** | MEDIUM — E2E com SSE requer setup específico |

---

## Acceptance Criteria

- [ ] **AC1:** Integration test: pipeline completo
  - Input: CourseDesignerInput fixture válido
  - Executa: designCourse() com MSW mocks
  - Valida: Blueprint output completo, Zod-validated
  - Valida: quality_score ≥ 50, todas as fases executadas
- [ ] **AC2:** Integration test: Apply Blueprint
  - Input: Blueprint fixture
  - Executa: applyBlueprint()
  - Valida: course criado, chapters count = modules count, questions por tipo corretas
  - Valida: tenant_id e created_by preenchidos
- [ ] **AC3:** Integration test: Quality Gate retry
  - Mock Validator para retornar `needs_revision` na 1a chamada
  - Verifica: auto-retry executa (Architect re-chamado com feedback)
  - Mock Validator retorna `good` na 2a chamada
  - Verifica: blueprint final tem score bom
- [ ] **AC4:** Integration test: API routes
  - POST /generate → retorna jobId
  - GET /jobs/[jobId] → retorna status
  - GET /blueprints → lista do tenant
  - GET /blueprints/[id] → blueprint completo
  - PUT /blueprints/[id] → edição com recálculo
  - DELETE /blueprints/[id] → remoção
- [ ] **AC5:** E2E test (Playwright): fluxo completo no browser
  - Login → Cursos → "Criar Blueprint" → Wizard 6 steps → Gerar → Blueprint Viewer
  - MSW server-side mocking (pattern do Epic 16: instrumentation.ts + E2E_TESTING=true)
  - Valida: wizard navegável, geração inicia, blueprint exibido
- [ ] **AC6:** E2E test: edição de blueprint
  - Abre Blueprint Viewer → modo edição → edita título → salva → score recalculado
- [ ] **AC7:** `pnpm test` e `pnpm test:e2e` passam

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar integration test para pipeline completo
  - [ ] Criar `packages/course-designer/src/__tests__/orchestrator.test.ts`
  - [ ] Criar CourseDesignerInput fixture válido
  - [ ] Configurar MSW mocks para todos os agentes do pipeline
  - [ ] Testar `designCourse()` retorna Blueprint Zod-validated
  - [ ] Testar quality_score ≥ 50
  - [ ] Verificar todas as fases executadas (analyzer → architect → calculator → validator → generator)

- [ ] **Task 2** (AC: 2) Criar integration test para Apply Blueprint
  - [ ] Criar `packages/course-designer/src/__tests__/apply-blueprint.test.ts`
  - [ ] Criar Blueprint fixture completo
  - [ ] Testar `applyBlueprint()` cria course no banco
  - [ ] Testar chapters count = modules count
  - [ ] Testar questions por tipo corretas
  - [ ] Testar tenant_id e created_by preenchidos

- [ ] **Task 3** (AC: 3) Criar integration test para Quality Gate retry
  - [ ] Mock Validator para retornar `needs_revision` na 1a chamada
  - [ ] Verificar auto-retry executa (Architect re-chamado com feedback)
  - [ ] Mock Validator retorna `good` na 2a chamada
  - [ ] Verificar blueprint final tem score bom

- [ ] **Task 4** (AC: 4) Criar integration tests para API routes
  - [ ] Testar POST /generate → retorna jobId
  - [ ] Testar GET /jobs/[jobId] → retorna status
  - [ ] Testar GET /blueprints → lista do tenant
  - [ ] Testar GET /blueprints/[id] → blueprint completo
  - [ ] Testar PUT /blueprints/[id] → edição com recálculo
  - [ ] Testar DELETE /blueprints/[id] → remoção

- [ ] **Task 5** (AC: 5) Criar E2E test (Playwright) para fluxo completo
  - [ ] Criar `apps/web/e2e/course-designer.spec.ts`
  - [ ] Criar `apps/web/src/mocks/course-designer-handlers.ts` com MSW handlers
  - [ ] Configurar MSW server-side mocking (instrumentation.ts + E2E_TESTING=true)
  - [ ] Testar Login → Cursos → "Criar Blueprint" → Wizard 6 steps → Gerar → Blueprint Viewer
  - [ ] Usar identifiers únicos: CourseDesigner_Analyzer, CourseDesigner_Architect, etc.

- [ ] **Task 6** (AC: 6) Criar E2E test para edição de blueprint
  - [ ] Criar `apps/web/e2e/blueprint-viewer.spec.ts`
  - [ ] Testar Blueprint Viewer → modo edição → edita título → salva → score recalculado

- [ ] **Task 7** (AC: 7) Validar test suite completa
  - [ ] Rodar `pnpm test` — deve passar sem erros
  - [ ] Rodar `pnpm test:e2e` — deve passar sem erros

---

## Dev Notes

### Technical Notes

MSW server-side mocking via `instrumentation.ts` com `E2E_TESTING=true` (pattern comprovado no Epic 16). Usar identifiers únicos nos prompts para handler routing.

```typescript
// Pattern: MSW handler com identifier único
import { http, HttpResponse } from 'msw'

export const courseDesignerHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json()
    const prompt = JSON.stringify(body.messages)

    if (prompt.includes('CourseDesigner_Analyzer')) {
      return HttpResponse.json(mockAnalyzerResponse)
    }
    if (prompt.includes('CourseDesigner_Architect')) {
      return HttpResponse.json(mockArchitectResponse)
    }
    // ... etc
  })
]
```

LEMBRETE: Agent detection em MSW handler deve usar identifiers UNICOS (não keywords genéricas que podem cross-match). Usar prefixo `CourseDesigner_` para evitar conflito com handlers do WS1.

**Nota PO (API Route Coverage):** AC4 testa 5 de 10 API routes. Routes ausentes: `POST /blueprints/[id]/apply`, `GET /blueprints/[id]/export`, `GET /frameworks`, `POST /analyze-content`. O @dev deve expandir AC4 para cobrir todas as 10 routes da architecture doc Seção 16, ou documentar explicitamente quais são cobertas por outros ACs (ex: AC2 cobre apply como função).

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm test` passa | Yes |
| Pre-PR | E2E fluxo completo passa | Yes |

### File Locations

```
packages/course-designer/src/__tests__/
├── orchestrator.test.ts                # NOVO
├── apply-blueprint.test.ts             # NOVO

apps/web/e2e/
├── course-designer.spec.ts             # NOVO
├── blueprint-viewer.spec.ts            # NOVO

apps/web/src/mocks/
├── course-designer-handlers.ts         # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Nota sobre API route coverage adicionada; Status Draft → Ready | Pax (PO) |
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
