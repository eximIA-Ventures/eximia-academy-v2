# Story 20.5: Architect Agent — Fase 2 (4 Algoritmos)

**Epic:** [Epic 20 — WS2: Framework Registry, Schemas & Pipeline Agents](../../epics/epic-20-ws2-framework-registry-schemas-pipeline-agents.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P0 (core — fase mais complexa do pipeline)
**Blocked By:** Story 20.4
**Blocks:** Story 20.6
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** o agente Architect que gera objetivos ABCD, assessments, sequencia modulos e aplica framework stages,
**so that** a estrutura do curso seja pedagogicamente solida com Bloom progression.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 8.2 (Architect Output) |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | TypeScript, Zod, AI SDK 6.0 |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/src/analyzer.ts` (Story 20.4) |
| **Risk** | HIGH — 4 algoritmos interdependentes, output grande, qualidade impacta todo o resto |

---

## Acceptance Criteria

- [x] **AC1:** `runArchitect(input)` em `packages/course-designer/src/architect.ts`
  - Input: `CourseDesignerInput` + `AnalyzerOutput`
  - Input opcional: `revision_feedback` (para auto-retry do Quality Gate — D14)
  - Output: `ArchitectOutput` (Zod-validated)
- [x] **AC2:** Schema `ArchitectOutput` em `packages/course-designer/src/schemas/architect.ts`
  - `course_structure`: total_modules, primary_framework, complementary_frameworks, bloom_progression, spiral_levels
  - `modules[]`: order, title, description, spiral_level, objectives[] (com bloom_level + ABCD), assessments[], framework_stages[], problema_motor, rubrics, interaction_type, prerequisites
  - `assessment_strategy`: formative/summative/diagnostica counts, overall_approach, kirkpatrick_coverage (L1-L4)
  - `facilitation_notes?`
- [x] **AC3:** Algoritmo A4 (Objective Generator) — gera objetivos no formato ABCD (Audience, Behavior, Condition, Degree) com Bloom level para cada modulo
- [x] **AC4:** Algoritmo A5 (Assessment Designer) — Backward Design: assessments antes do conteudo, alinhados 1:1 com objetivos, Kirkpatrick L1-L4
- [x] **AC5:** Algoritmo A6 (Module Sequencer) — distribui modulos com Bloom ascending, spiral curriculum, prerequisites
  - Duracao -> Escopo: 1-4h = 1-2 modulos, 4-10h = 3-5, 10-40h = 5-10, 40-100h = 10-20, 100-200h = 20-30
- [x] **AC6:** Algoritmo A7 (Framework Mapper) — aplica stages do FrameworkConfig a cada modulo com time_percentage e activities
- [x] **AC7:** Problema-Motor gerado para cada modulo (frameworks experienciais)
  - Formula: Tensao = Pressao x Ambiguidade x Stakes (1-125)
  - Progressao por spiral level: fundamentos (1-25) -> sintese (100-125)
- [x] **AC8:** `interaction_type` por modulo via `bloom_mapped` strategy (default D17)
  - Remember/Understand -> quiz, Apply/Analyze -> socratic_dialogue, Evaluate -> scenario, Create -> assignment
  - Ajustes por spiral_level conforme arquitetura secao 9.1
- [x] **AC9:** Prompt do Architect em `packages/course-designer/src/prompts/architect.ts`

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 2) Criar schema ArchitectOutput
  - [x] Criar `packages/course-designer/src/schemas/architect.ts`
  - [x] Definir `frameworkStageSchema` (key, name, percentage, activities array, deliverable optional)
  - [x] Definir `moduleSchema` com todos os campos: order, title, description, spiral_level, objectives[] (text + bloom_level + abcd object), assessments[] (type + method + description + alignment + kirkpatrick_level), framework_stages[], problema_motor (nullable), rubrics (nullable), interaction_type, prerequisites optional
  - [x] Definir `assessmentStrategySchema` (formative_count, summative_count, diagnostica_count, overall_approach, kirkpatrick_coverage L1-L4 booleans)
  - [x] Definir `architectOutputSchema` (course_structure + modules array min 1 max 30 + assessment_strategy + facilitation_notes optional)
  - [x] Exportar `ArchitectOutput` type via `z.infer`
  - [x] Atualizar barrel file `schemas/index.ts`

- [x] **Task 2** (AC: 9) Criar prompt do Architect
  - [x] Criar `packages/course-designer/src/prompts/architect.ts`
  - [x] Definir `buildArchitectPrompt(input, analyzerOutput, frameworkConfig, revisionFeedback?)` que gera prompt rico
  - [x] Incluir instrucoes para ABCD format de objetivos
  - [x] Incluir instrucoes para Backward Design (assessments antes do conteudo)
  - [x] Incluir instrucoes para Bloom ascending e spiral curriculum
  - [x] Incluir instrucoes para Problema-Motor com formula de tensao
  - [x] Incluir instrucoes para bloom_mapped interaction type com ajustes por spiral_level
  - [x] Incluir duracao -> escopo mapping (1-4h = 1-2 modulos, etc.)

- [x] **Task 3** (AC: 1, 3, 4, 5, 6, 7, 8) Implementar runArchitect
  - [x] Criar `packages/course-designer/src/architect.ts`
  - [x] A4 (Objective Generator): gera objetivos ABCD com Bloom level por modulo
  - [x] A5 (Assessment Designer): Backward Design, 1:1 alinhamento objetivo-avaliacao, Kirkpatrick L1-L4
  - [x] A6 (Module Sequencer): distribuir modulos com Bloom ascending, spiral, prerequisites
  - [x] A7 (Framework Mapper): aplicar stages do FrameworkConfig a cada modulo
  - [x] Gerar Problema-Motor com tensao escalando por spiral level
  - [x] Atribuir interaction_type via bloom_mapped com ajustes por spiral_level
  - [x] Aceitar revision_feedback opcional para auto-retry (D14)
  - [x] Usar Model Router para selecionar modelo
  - [x] Chamar generateObject com architectOutputSchema

- [x] **Task 4** (AC: 1) Validar
  - [x] Rodar `pnpm typecheck` — deve passar sem erros
  - [x] Validar output Zod-validated para 3 frameworks
  - [x] Validar Bloom progression e ascending (sem drops > 1 nivel)
  - [x] Validar Problema-Motor tension score escala com spiral level

---

## Dev Notes

### Technical Notes

O Architect e o agente mais complexo do pipeline. O prompt deve ser rico em contexto: recebe AnalyzerOutput completo + FrameworkConfig + input do instrutor. O output pode ter 10-30 modulos com 3-7 objetivos cada.

**NOTA InteractionType (D19):** `InteractionType` ja existe em `packages/agents/src/types.ts:59` com valores `socratic_dialogue`, `quiz`, `scenario`, `assignment`. Deve ser importado de `@eximia/shared` em vez de redefinido no course-designer. A migracao real do type para `@eximia/shared` e escopo de codigo (story separada ou parte de 20.1), nao de documentacao.

Schemas completos de referencia na arquitetura secao 8.2 (Architect Output).

Problema-Motor — Formula de Tensao:
```
Tensao = Pressao (1-5) x Ambiguidade (1-5) x Stakes (1-5)
Total: 1-125

Progressao por Spiral Level:
- Fundamentos: 1-25 (baixa)
- Variacao: 26-50 (media)
- Conflito Humano: 51-75 (alta)
- Mundo Real: 76-100 (muito alta)
- Sintese: 100-125 (maxima)
```

bloom_mapped ajustes por spiral_level (secao 9.1):
- fundamentos (1-2): Se Bloom >= Analyze: manter socratic (cedo demais para scenario)
- variacao (3-4): Sem ajuste
- conflito_humano (5-6): Se Bloom == Apply: upgrade para scenario (trade-offs humanos)
- mundo_real (7-8): Se Bloom <= Analyze: upgrade para scenario (contexto real)
- sintese (9-10): FORCAR assignment (entregavel final obrigatorio)

### File Locations

```
packages/course-designer/src/
├── architect.ts             # NOVO
├── schemas/architect.ts     # NOVO
└── prompts/architect.ts     # NOVO
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
- Schema ArchitectOutput with moduleSchema (ABCD objectives, assessments, framework_stages, problema_motor)
- Interaction Mapper created early (PO note option b) with bloom_mapped + spiral_level adjustments
- Prompt includes ABCD format, Backward Design, Bloom ascending, Problema-Motor formula, bloom_mapped
- runArchitect accepts revisionFeedback for Quality Gate auto-retry (D14)
- Duration->Scope mapping: 1-4h=1-2, 4-10h=3-5, 10-40h=5-10, 40-100h=10-20, 100-200h=20-30

### File List
- `packages/course-designer/src/schemas/architect.ts` — NEW: ArchitectOutput schema
- `packages/course-designer/src/prompts/architect.ts` — NEW: buildArchitectPrompt
- `packages/course-designer/src/architect.ts` — NEW: runArchitect (A4-A7)
- `packages/course-designer/src/interaction-mapper.ts` — NEW: mapBloomToInteraction, mapInteractions
- `packages/course-designer/src/schemas/index.ts` — MODIFIED: added architect exports
- `packages/course-designer/src/index.ts` — MODIFIED: added runArchitect, mapInteractions exports

---

## QA Results
_To be filled by @qa_
