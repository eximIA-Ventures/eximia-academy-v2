# Story 0.2: Atualizar Paths das 26 Stories WS2 para @eximia/course-designer

**Epic:** Prereq — Modularizacao WS2
**Version:** 1.2
**Created:** 2026-02-17
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Done
**Story Points:** 2
**Priority:** P0 (blocker — stories referenciam paths incorretos sem esta correcao)
**Blocked By:** Story 0.1
**Blocks:** Story 20.1
**Assigned To:** @po

---

## User Story

**As a** product owner,
**I want** todas as 26 stories do WS2 (Epics 20-24) atualizadas com os paths corretos do novo package `@eximia/course-designer`,
**so that** os devs implementem nos arquivos certos desde o inicio, sem retrabalho.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | Decisao arquitetural da sessao 2026-02-17 (Aria) — modularizacao comercial |
| **Decision** | D19: Modularizacao — WS2 como package separado `@eximia/course-designer` |
| **Scope** | 26 stories em `docs/stories/epic-{20..24}/` |
| **Risk** | LOW — alteracao documental, sem codigo |

---

## Acceptance Criteria

- [x] **AC1:** Em todas as stories afetadas, substituir `packages/agents/src/course-designer/` por `packages/course-designer/src/` (incluindo dentro de ACs, Dev Notes, File Locations e Story Context)
- [x] **AC2:** Em todas as stories afetadas, substituir referencias de import `@eximia/agents` (para tipos WS2) por `@eximia/course-designer`
- [x] **AC3:** Story Context de cada story atualizado: campo `Package` de `@eximia/agents` para `@eximia/course-designer`
- [x] **AC4:** Story Context de cada story atualizado: campo `Existing Pattern` para referenciar `packages/course-designer/src/` em vez de `packages/agents/src/course-designer/`
- [x] **AC5:** Adicionar nota informativa nas stories 20.1 e 20.5 (Dev Notes) informando que `InteractionType` ja existe em `@eximia/agents/types.ts` e deve ser importado de `@eximia/shared` (nao redefinido). A migracao real do type e escopo de codigo, nao desta story.
- [x] **AC6:** Change Log de cada story atualizada com entrada v1.2 documentando a alteracao de paths
- [x] **AC7:** Nenhuma story referencia mais `packages/agents/src/course-designer/` (verificacao final via grep)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2, 3, 4) Atualizar stories do Epic 20 (7 stories — todas afetadas)
  - [x] `story-20.1-shared-schemas-types-fundamentais.md` — ACs, paths, Package, Existing Pattern
  - [x] `story-20.2-framework-registry-3-configs-selector.md` — ACs, paths, Package, Existing Pattern
  - [x] `story-20.3-input-schema-course-design-brief.md` — ACs, paths, Package, Existing Pattern
  - [x] `story-20.4-analyzer-agent-fase-1.md` — ACs, paths, Package, Existing Pattern
  - [x] `story-20.5-architect-agent-fase-2.md` — ACs, paths, Package, Existing Pattern
  - [x] `story-20.6-calculator-agent-fase-3.md` — ACs, paths, Package, Existing Pattern
  - [x] `story-20.7-validator-generator-fases-4-5.md` — ACs, paths, Package, Existing Pattern

- [x] **Task 2** (AC: 1, 2, 3, 4) Atualizar stories do Epic 21 (5 stories — 2 afetadas pelo path antigo)
  - [x] `story-21.1-database-migration-extend-blueprints.md` — verificado: sem refs WS2 (Package: `packages/database`)
  - [x] `story-21.2-design-orchestrator-pipeline-quality-gate.md` — paths, Package, Existing Pattern atualizados
  - [x] `story-21.3-blueprint-jobs-sse-streaming.md` — verificado: sem refs WS2 (Package: `apps/web`)
  - [x] `story-21.4-api-routes-crud-frameworks-export.md` — Package atualizado: `@eximia/course-designer`
  - [x] `story-21.5-content-analyzer-llm-pdf-pptx.md` — paths, Package, Existing Pattern atualizados

- [x] **Task 3** (AC: 2, 3) Verificar stories do Epic 22 (6 stories — 0 com path antigo, verificar `@eximia/agents` refs)
  - [x] `story-22.1-course-designer-wizard-stepper-6-steps.md` — sem refs WS2 (Package: `apps/web`)
  - [x] `story-22.2-steps-1-2-proposito-audiencia.md` — sem refs WS2
  - [x] `story-22.3-steps-3-4-escopo-restricoes.md` — sem refs WS2
  - [x] `story-22.4-steps-5-6-preferencias-prevalidation-generate.md` — sem refs WS2
  - [x] `story-22.5-blueprint-viewer-modulos-editabilidade.md` — sem refs WS2
  - [x] `story-22.6-quality-scorecard-bloom-visual-components.md` — sem refs WS2
  - Nota: grep retornou 0 ocorrencias de `packages/agents/src/course-designer` neste epic. Todas as stories usam `apps/web` como Package.

- [x] **Task 4** (AC: 1, 2, 3, 4) Atualizar stories do Epic 23 (4 stories — 2 afetadas pelo path antigo)
  - [x] `story-23.1-auditor-analise-curso-existente.md` — paths, Package, Existing Pattern atualizados
  - [x] `story-23.2-blueprint-apply-curso-capitulos-questions.md` — paths, Package, Existing Pattern atualizados
  - [x] `story-23.3-integracao-ws1-3-campos-opcionais.md` — verificado: `@eximia/agents` e referencia WS1 legitima (orchestrator.ts)
  - [x] `story-23.4-course-selector-caminho-b-ux.md` — sem refs WS2 (Package: `apps/web`)

- [x] **Task 5** (AC: 1, 2, 3, 4) Atualizar stories do Epic 24 (4 stories — 3 afetadas pelo path antigo)
  - [x] `story-24.1-unit-tests-pipeline-agents-registry.md` — paths, Package, Existing Pattern atualizados
  - [x] `story-24.2-integration-tests-pipeline-e2e-sse.md` — paths, Package, Existing Pattern atualizados
  - [x] `story-24.3-benchmark-validation-elc-real-courses.md` — paths, Package, Existing Pattern atualizados
  - [x] `story-24.4-ux-polish-error-handling-loading-accessibility.md` — sem refs WS2 (Package: `apps/web`)

- [x] **Task 6** (AC: 5) Adicionar notas sobre InteractionType
  - [x] Em story 20.1: nota adicionada em Dev Notes
  - [x] Em story 20.5: nota adicionada em Dev Notes

- [x] **Task 7** (AC: 6) Atualizar Change Log de cada story modificada
  - [x] Entrada v1.2 adicionada em 14 stories modificadas com autor Pax (PO)

- [x] **Task 8** (AC: 7) Verificacao final
  - [x] grep `packages/agents/src/course-designer` em epic-{20..24}: ZERO resultados
  - [x] grep `@eximia/agents` em epic-{20..24}: apenas Change Log entries + Story 23.3 (ref WS1 legitima)

---

## Dev Notes

### Technical Notes

**Mapeamento de substituicao:**

| De | Para |
|----|------|
| `packages/agents/src/course-designer/schemas/` | `packages/course-designer/src/schemas/` |
| `packages/agents/src/course-designer/registry/` | `packages/course-designer/src/registry/` |
| `packages/agents/src/course-designer/agents/` | `packages/course-designer/src/agents/` |
| `packages/agents/src/course-designer/pipeline/` | `packages/course-designer/src/pipeline/` |
| `packages/agents/src/course-designer/` | `packages/course-designer/src/` |
| Package: `@eximia/agents` (WS2 context) | `@eximia/course-designer` |
| Existing Pattern: `packages/agents/src/schemas/` | `packages/course-designer/src/schemas/` |

**Secoes a atualizar em cada story:**
- **Acceptance Criteria** — paths dentro de ACs que referenciam localizacao de arquivos
- **Story Context** — campos Package e Existing Pattern
- **Dev Notes / File Locations** — paths de arquivos
- **Tasks / Subtasks** — paths referenciados nas instrucoes

**InteractionType:**
- Atualmente em `packages/agents/src/types.ts:59`
- Valores: `socratic_dialogue`, `quiz`, `scenario`, `assignment`
- Nesta story: apenas adicionar nota informativa em 20.1 e 20.5
- A migracao real do type para `@eximia/shared` sera feita como codigo em story separada ou parte de 20.1

### Stories por Epic (contagem real verificada)

| Epic | Qtd Stories | Com path antigo | Pasta |
|------|-------------|-----------------|-------|
| 20 | 7 | 7 (100%) | `docs/stories/epic-20/` |
| 21 | 5 | 2 (21.2, 21.5) | `docs/stories/epic-21/` |
| 22 | 6 | 0 | `docs/stories/epic-22/` |
| 23 | 4 | 2 (23.1, 23.2) | `docs/stories/epic-23/` |
| 24 | 4 | 3 (24.1, 24.2, 24.3) | `docs/stories/epic-24/` |
| **Total** | **26** | **14** | |

### Dados do grep (referencia para execucao)

```
Epic 20: 100 ocorrencias em 7 arquivos
Epic 21: ~9 ocorrencias em 2 arquivos (21.2, 21.5)
Epic 22: 0 ocorrencias
Epic 23: ~11 ocorrencias em 2 arquivos (23.1, 23.2)
Epic 24: ~16 ocorrencias em 3 arquivos (24.1, 24.2, 24.3)
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-17 | 1.0 | Story creation — atualizacao de paths WS2 | River (SM) |
| 2026-02-17 | 1.1 | PO validation: 5 fixes aplicados — contagens, CUIDADO note, filenames, autor, AC5. Status Draft → Ready | Pax (PO) |
| 2026-02-17 | 1.2 | Story executada: 14 stories atualizadas (paths + Package + Existing Pattern + Change Log), notas InteractionType em 20.1/20.5, grep final ZERO. Status Ready → Done | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (via Claude Code)

### Debug Log References
_To be filled by @po_

### Completion Notes List
- 14 stories modificadas de 26 totais (12 nao tinham refs WS2)
- Story 23.3 mantida com `@eximia/agents` — referencia WS1 legitima (orchestrator.ts)
- Epic 22 inteiro sem mudancas — todas `apps/web`
- Stories 21.1 e 21.3 sem mudancas — sem refs WS2

### File List
- `docs/stories/epic-20/story-20.1-shared-schemas-types-fundamentais.md` — MODIFIED
- `docs/stories/epic-20/story-20.2-framework-registry-3-configs-selector.md` — MODIFIED
- `docs/stories/epic-20/story-20.3-input-schema-course-design-brief.md` — MODIFIED
- `docs/stories/epic-20/story-20.4-analyzer-agent-fase-1.md` — MODIFIED
- `docs/stories/epic-20/story-20.5-architect-agent-fase-2.md` — MODIFIED
- `docs/stories/epic-20/story-20.6-calculator-agent-fase-3.md` — MODIFIED
- `docs/stories/epic-20/story-20.7-validator-generator-fases-4-5.md` — MODIFIED
- `docs/stories/epic-21/story-21.2-design-orchestrator-pipeline-quality-gate.md` — MODIFIED
- `docs/stories/epic-21/story-21.4-api-routes-crud-frameworks-export.md` — MODIFIED
- `docs/stories/epic-21/story-21.5-content-analyzer-llm-pdf-pptx.md` — MODIFIED
- `docs/stories/epic-23/story-23.1-auditor-analise-curso-existente.md` — MODIFIED
- `docs/stories/epic-23/story-23.2-blueprint-apply-curso-capitulos-questions.md` — MODIFIED
- `docs/stories/epic-24/story-24.1-unit-tests-pipeline-agents-registry.md` — MODIFIED
- `docs/stories/epic-24/story-24.2-integration-tests-pipeline-e2e-sse.md` — MODIFIED
- `docs/stories/epic-24/story-24.3-benchmark-validation-elc-real-courses.md` — MODIFIED

---

## QA Results
_To be filled by @qa_
