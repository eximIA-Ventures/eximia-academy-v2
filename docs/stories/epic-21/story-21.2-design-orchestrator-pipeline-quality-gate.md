# Story 21.2: Design Orchestrator — Pipeline 5 Fases + Quality Gate

**Epic:** [Epic 21 — WS2: Orchestrator, API & Database](../../epics/epic-21-ws2-orchestrator-api-database.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (core)
**Blocked By:** Story 21.1, Epic 20 (all stories)
**Blocks:** Story 21.3
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** um Design Orchestrator que executa as 5 fases sequencialmente com quality gate hibrido (D14),
**so that** blueprints sejam gerados com retry automatico e estado duravel.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 10 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, TypeScript, AI SDK 6.0, Supabase, Drizzle ORM, Sentry |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/src/` (pipeline agents from Epic 20) |
| **Risk** | HIGH — orquestra todo o pipeline, quality gate define UX |

---

## Acceptance Criteria

- [ ] **AC1:** `designCourse(input)` em `packages/course-designer/src/orchestrator.ts`
  - Executa sequencialmente: runAnalyzer -> runArchitect -> runCalculator -> runValidator -> runGenerator
  - Persiste cada phase_result no `blueprint_generation_jobs` (JSONB)
  - Retorna Blueprint completo
- [ ] **AC2:** Quality Gate Hibrido (D14)
  - Se verdict = `needs_revision` ou `poor`: auto-retry 1x silencioso
  - Retry: re-executa Architect -> Calculator -> Validator com `revision_feedback`
  - Se ainda falha apos retry: `blueprint.metadata.requires_instructor_review = true`
  - Nunca falha silenciosamente — sempre retorna blueprint (com flag se necessario)
- [ ] **AC3:** Job tracking
  - Cria `blueprint_generation_job` com status `processing` ao iniciar
  - Atualiza `current_phase` (1-5) a cada fase
  - Salva `phase_results` JSONB a cada fase concluida
  - Atualiza status `completed` ou `failed` ao final
- [ ] **AC4:** Timeout total de 5 minutos
  - Se timeout: salva phase_results parciais, marca job como `failed` com error_message
- [ ] **AC5:** Sentry spans por fase (reutilizar pattern do Epic 16)
- [ ] **AC6:** Retry parcial: se fase N falha, pode reiniciar da fase N (usando phase_results salvos)
- [ ] **AC7:** Orchestrator aceita callback `onProgress(phase, status, progress_pct)` para integracao com SSE (Story 21.3 consome este callback)
- [ ] **AC8:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar `designCourse` function
  - [ ] Criar `packages/course-designer/src/orchestrator.ts`
  - [ ] Definir `CourseDesignerInput` type (ou importar de schemas Epic 20)
  - [ ] Implementar execucao sequencial: runAnalyzer -> runArchitect -> runCalculator -> runValidator -> runGenerator
  - [ ] Persiste cada phase_result no `blueprint_generation_jobs` via Drizzle
  - [ ] Retornar Blueprint completo ao final

- [ ] **Task 2** (AC: 2) Implementar Quality Gate Hibrido (D14)
  - [ ] Verificar verdict apos runValidator
  - [ ] Se `needs_revision` ou `poor`: auto-retry 1x silencioso (re-executa Architect -> Calculator -> Validator com revision_feedback)
  - [ ] Se ainda falha apos retry: setar `blueprint.metadata.requires_instructor_review = true` e `blueprint.metadata.review_reason`
  - [ ] Garantir que nunca falha silenciosamente — sempre retorna blueprint

- [ ] **Task 3** (AC: 3) Implementar Job tracking
  - [ ] Criar job com status `processing` ao iniciar
  - [ ] Atualizar `current_phase` (1-5) a cada fase
  - [ ] Salvar `phase_results` JSONB a cada fase concluida
  - [ ] Atualizar status `completed` ou `failed` ao final

- [ ] **Task 4** (AC: 4) Implementar timeout total de 5 minutos
  - [ ] Wrappear execucao com AbortSignal ou Promise.race (5 min)
  - [ ] Se timeout: salvar phase_results parciais, marcar job como `failed` com error_message descritiva

- [ ] **Task 5** (AC: 5) Adicionar Sentry spans por fase
  - [ ] Reutilizar pattern de tracing do Epic 16
  - [ ] Criar span por fase: `course-designer.phase.{n}`

- [ ] **Task 6** (AC: 6) Implementar retry parcial
  - [ ] Se fase N falha, permitir reiniciar da fase N usando phase_results salvos no DB
  - [ ] Carregar phase_results do job existente ao reiniciar

- [ ] **Task 7** (AC: 7) Implementar callback onProgress
  - [ ] `designCourse` aceita `onProgress?: (phase: number, status: string, progress_pct: number) => void`
  - [ ] Chamar callback a cada mudanca de fase e status

- [ ] **Task 8** (AC: 8) Validar typecheck
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

```typescript
export async function designCourse(
  input: CourseDesignerInput,
  onProgress?: (phase: number, status: string, progress_pct: number) => void
): Promise<Blueprint> {
  const analysis = await runAnalyzer(input)
  let architecture = await runArchitect({ ...input, analysis })
  let calculations = await runCalculator({ architecture, total_duration_hours: input.total_duration_hours })
  let validation = await runValidator({ analysis, architecture, calculations })

  // Auto-retry 1x silencioso (D14)
  if (validation.scorecard.verdict === "needs_revision" || validation.scorecard.verdict === "poor") {
    architecture = await runArchitect({
      ...input, analysis,
      revision_feedback: validation.scorecard.recommendations,
    })
    calculations = await runCalculator({ architecture, total_duration_hours: input.total_duration_hours })
    validation = await runValidator({ analysis, architecture, calculations })
  }

  const blueprint = await runGenerator({ analysis, architecture, calculations, validation })

  if (validation.scorecard.verdict === "needs_revision" || validation.scorecard.verdict === "poor") {
    blueprint.metadata.requires_instructor_review = true
    blueprint.metadata.review_reason = validation.scorecard.recommendations
  }

  return blueprint
}
```

### File Locations

```
packages/course-designer/src/
├── orchestrator.ts              # NOVO
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
