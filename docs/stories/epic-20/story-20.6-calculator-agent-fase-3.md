# Story 20.6: Calculator Agent — Fase 3 (3 Algoritmos)

**Epic:** [Epic 20 — WS2: Framework Registry, Schemas & Pipeline Agents](../../epics/epic-20-ws2-framework-registry-schemas-pipeline-agents.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 20.5
**Blocks:** Story 20.7
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** o agente Calculator que distribui tempo, analisa carga cognitiva e otimiza chunks,
**so that** o blueprint respeite limites neurocientificos e temporais.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 8.2 (Calculator Output) |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | TypeScript, Zod, AI SDK 6.0 |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/src/architect.ts` (Story 20.5) |
| **Risk** | MEDIUM — calculos de tempo devem somar corretamente |

---

## Acceptance Criteria

- [x] **AC1:** `runCalculator(input)` em `packages/course-designer/src/calculator.ts`
  - Input: `ArchitectOutput` + `total_duration_hours`
  - Output: `CalculatorOutput` (Zod-validated)
- [x] **AC2:** Schema `CalculatorOutput` em `packages/course-designer/src/schemas/calculator.ts`
  - `time_allocation`: total_minutes, modules[] (module_order, total_minutes, per_stage, chunks[])
  - `cognitive_load`: modules[] (intrinsic/extraneous/germane load, new_concepts_count, concurrent_concepts, recommendation), overall_balance, warnings
  - `pacing_strategy`: recommended_schedule, spaced_repetition_points, break_pattern
- [x] **AC3:** Algoritmo A8 (Duration Allocator) — distribui `total_duration_hours` entre modulos e estagios
  - Soma de minutos dos modulos = total_minutes +/- 5%
  - Per_stage segue time_percentage do FrameworkConfig
- [x] **AC4:** Algoritmo A9 (Cognitive Load Analyzer) — avalia CLT (Sweller)
  - Intrinsic load baseado em complexidade do conteudo
  - `new_concepts_count` <= 5 por modulo (CLT rule N1)
  - `concurrent_concepts` <= 4 por chunk
  - Flag `overloaded` se regras CLT violadas
- [x] **AC5:** Algoritmo A10 (Chunk Optimizer) — divide modulos em chunks de 5-30min
  - Tipos: content, activity, assessment, break, reflection
  - Nenhum chunk continuo > 30min sem pausa (AGES rule N2)
  - Chunks respeitam `session_length_preference` do input
- [x] **AC6:** `attention_span_respected` boolean no output
- [x] **AC7:** Prompt do Calculator em `packages/course-designer/src/prompts/calculator.ts`

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 2) Criar schema CalculatorOutput
  - [x] Criar `packages/course-designer/src/schemas/calculator.ts`
  - [x] Definir `timeAllocationSchema` com total_minutes, modules array (module_order, total_minutes, per_stage record, chunks array com title + duration_min 5-30 + type enum), attention_span_respected boolean
  - [x] Definir `cognitiveLoadSchema` com modules array (module_order, intrinsic_load enum, extraneous_load enum, germane_load enum, new_concepts_count number, concurrent_concepts number, recommendation string), overall_balance enum, warnings array
  - [x] Definir `pacingStrategySchema` com recommended_schedule string, spaced_repetition_points array, break_pattern string
  - [x] Definir `calculatorOutputSchema` completo
  - [x] Exportar `CalculatorOutput` type via `z.infer`
  - [x] Atualizar barrel file `schemas/index.ts`

- [x] **Task 2** (AC: 7) Criar prompt do Calculator
  - [x] Criar `packages/course-designer/src/prompts/calculator.ts`
  - [x] Definir `buildCalculatorPrompt(architectOutput, totalDurationHours, frameworkConfig)` que gera prompt rico
  - [x] Incluir instrucoes para CLT (Sweller): max 5 conceitos novos por modulo, max 4 concurrent por chunk
  - [x] Incluir instrucoes para AGES: nenhum bloco > 30min sem pausa
  - [x] Incluir instrucoes para chunks de 5-30min com tipos variados
  - [x] Incluir instrucoes para distribuir tempo conforme time_percentage dos stages

- [x] **Task 3** (AC: 1, 3, 4, 5, 6) Implementar runCalculator
  - [x] Criar `packages/course-designer/src/calculator.ts`
  - [x] A8 (Duration Allocator): distribuir total_duration_hours entre modulos e estagios, soma = total +/- 5%, per_stage segue time_percentage
  - [x] A9 (Cognitive Load Analyzer): avaliar CLT, flag new_concepts_count > 5, flag concurrent_concepts > 4, overall_balance (optimal/adjustable/overloaded)
  - [x] A10 (Chunk Optimizer): dividir modulos em chunks 5-30min, tipos variados, respeitar session_length_preference
  - [x] Calcular attention_span_respected boolean
  - [x] Validacao pos-LLM para somas de tempo (programatica)
  - [x] Usar Model Router para selecionar modelo
  - [x] Chamar generateObject com calculatorOutputSchema

- [x] **Task 4** (AC: 1) Validar
  - [x] Rodar `pnpm typecheck` — deve passar sem erros
  - [x] Validar soma de minutos = total correto +/- 5%
  - [x] Validar nenhum chunk > 30min

---

## Dev Notes

### Technical Notes

O Calculator pode ser LLM-assisted para pacing e cognitive load, mas durations devem ser matematicamente corretos. Considerar validacao pos-LLM para somas.

Schema completo de referencia na arquitetura secao 8.2 (Calculator Output).

CLT Rules:
- N1: max 4+/-1 conceitos novos por bloco (usamos <= 5)
- Concurrent concepts: max 4 por chunk

AGES Rules:
- N2: nenhum bloco continuo > 30min sem pausa (max 25-30min)

```typescript
// Validacao pos-LLM
const totalModuleMinutes = output.time_allocation.modules
  .reduce((sum, m) => sum + m.total_minutes, 0)
const expectedMinutes = totalDurationHours * 60
const tolerance = expectedMinutes * 0.05
assert(Math.abs(totalModuleMinutes - expectedMinutes) <= tolerance)
```

**Nota PO (Chunk Range):** A tabela de algoritmos na architecture doc diz "5-15min" para A10, mas o schema Zod diz `min(5).max(30)` e a regra AGES N2 permite até 30min sem pausa. O range correto para implementação é **5-30min** (consistente com epic e schema).

**Nota PO (Model Router):** Mesma nota de Story 20.4 — verificar localização real do Model Router.

### File Locations

```
packages/course-designer/src/
├── calculator.ts            # NOVO
├── schemas/calculator.ts    # NOVO
└── prompts/calculator.ts    # NOVO
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
Claude Opus 4.6 (via orchestrator — LanguageModel param)

### Debug Log References
_To be filled by @dev_

### Completion Notes List
- Schema CalculatorOutput with timeAllocation, cognitiveLoad, pacingStrategy
- Post-LLM validation ensures time sums ±5% tolerance
- Chunk validation: no chunk > 30min, types: content/activity/assessment/break/reflection
- CLT rules: new_concepts_count ≤ 5, concurrent_concepts ≤ 4
- Prompt includes CLT (Sweller), AGES framework, chunk optimization instructions

### File List
- `packages/course-designer/src/schemas/calculator.ts` — NEW: CalculatorOutput schema
- `packages/course-designer/src/prompts/calculator.ts` — NEW: buildCalculatorPrompt
- `packages/course-designer/src/calculator.ts` — NEW: runCalculator (A8-A10) + validateTimeSums
- `packages/course-designer/src/schemas/index.ts` — MODIFIED: added calculator exports
- `packages/course-designer/src/index.ts` — MODIFIED: added runCalculator export

---

## QA Results
_To be filled by @qa_
