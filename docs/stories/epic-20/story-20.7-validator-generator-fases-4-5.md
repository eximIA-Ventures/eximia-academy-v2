# Story 20.7: Validator + Generator Agents — Fases 4-5 (6 Algoritmos)

**Epic:** [Epic 20 — WS2: Framework Registry, Schemas & Pipeline Agents](../../epics/epic-20-ws2-framework-registry-schemas-pipeline-agents.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P0 (core — determina qualidade final)
**Blocked By:** Story 20.6
**Blocks:** None (within Epic 20; blocks Epic 21 stories)
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** o Validator (Quality Scorecard + Neuroscience Layer) e o Generator (Blueprint Builder + Activity Recommender),
**so that** o pipeline produza blueprints validados com score de qualidade composto.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 5.1, 8.2 (Validator Output, Blueprint Schema) |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | TypeScript, Zod, AI SDK 6.0 |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/src/calculator.ts` (Story 20.6) |
| **Risk** | HIGH — Quality Scorecard e o gatekeeper do pipeline, Neuroscience Layer define regras de validacao |

---

## Acceptance Criteria

- [x] **AC1:** `runValidator(input)` em `packages/course-designer/src/validator.ts`
  - Input: `AnalyzerOutput` + `ArchitectOutput` + `CalculatorOutput`
  - Output: `ValidatorOutput` contendo `qualityScorecardSchema`
- [x] **AC2:** Schema `qualityScorecardSchema` em `packages/course-designer/src/schemas/validator.ts`
  - `framework_score` (70% do final): alignment (0.30), bloom_progression (0.20), framework_completeness (0.25), duration (0.15), cognitive_load (0.10)
  - `neuroscience_score` (30% do final): 7 regras (N1-N7) com id, name, passed, weight, details
  - `final_score`: 0-100
  - `verdict`: excellent (90-100), good (70-89), needs_revision (50-69), poor (<50)
  - `critical_issues[]`, `recommendations[]`
- [x] **AC3:** Neuroscience rules em `packages/course-designer/src/neuroscience-rules.ts`
  - N1: CLT chunk_size <= 5 conceitos (peso 20)
  - N2: AGES attention < 30min sem pausa (peso 15)
  - N3: AGES generation >= 1 atividade por modulo (peso 20)
  - N4: AGES emotion >= 50% modulos com hook (peso 10)
  - N5: Spacing: schedule de revisao se > 4h (peso 15)
  - N6: Retrieval: >= 1 quiz formativo por modulo (peso 15)
  - N7: Dual Coding: material visual + textual (peso 5)
- [x] **AC4:** Algoritmos A11-A13 (Alignment, Bloom Progression, Completeness) executados antes do Scorecard
- [x] **AC5:** `runGenerator(input)` em `packages/course-designer/src/generator.ts`
  - Input: `AnalyzerOutput` + `ArchitectOutput` + `CalculatorOutput` + `ValidatorOutput`
  - Output: `Blueprint` (schema final completo conforme arquitetura secao 8.2)
- [x] **AC6:** Schema `blueprintSchema` em `packages/course-designer/src/schemas/generator.ts`
  - metadata, audience, course_architecture, modules[], evaluation_plan, quality_scorecard, implementation_checklist
  - `requires_instructor_review` flag se verdict = needs_revision ou poor
- [x] **AC7:** Algoritmo A15 (Blueprint Builder) — consolida todos os outputs em JSON final
- [x] **AC8:** Algoritmo A16 (Activity Recommender) — sugere atividades do ACTIVITY_BANK por estagio
- [x] **AC9:** Interaction mapper em `packages/course-designer/src/interaction-mapper.ts`
  - `bloom_mapped`: atribui interaction_type por Bloom + spiral_level
  - `dominant`: usa interaction_type escolhido pelo instrutor
  - `custom`: gera com bloom_mapped, instrutor edita depois
- [x] **AC10:** Prompts em `packages/course-designer/src/prompts/validator.ts` e `prompts/generator.ts`

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 2) Criar schema qualityScorecardSchema
  - [x] Criar `packages/course-designer/src/schemas/validator.ts`
  - [x] Definir `frameworkScoreSchema` com total 0-100 e dimensions: alignment (score, weight 0.30, details, issues[]), bloom_progression (score, weight 0.20, details, issues[]), framework_completeness (score, weight 0.25, details, issues[], framework_used, stages_covered[], stages_missing[]), duration (score, weight 0.15, details, issues[]), cognitive_load (score, weight 0.10, details, issues[])
  - [x] Definir `neuroscienceScoreSchema` com total 0-100 e rules array (id, name, passed, weight, details)
  - [x] Definir `qualityScorecardSchema` completo (framework_score, neuroscience_score, final_score 0-100, verdict enum, critical_issues[], recommendations[])
  - [x] Exportar `ValidatorOutput` type via `z.infer`
  - [x] Atualizar barrel file `schemas/index.ts`

- [x] **Task 2** (AC: 3) Criar neuroscience-rules.ts
  - [x] Criar `packages/course-designer/src/neuroscience-rules.ts`
  - [x] Implementar N1: CLT chunk_size <= 5 conceitos (peso 20)
  - [x] Implementar N2: AGES attention < 30min sem pausa (peso 15)
  - [x] Implementar N3: AGES generation >= 1 atividade por modulo (peso 20)
  - [x] Implementar N4: AGES emotion >= 50% modulos com hook (peso 10)
  - [x] Implementar N5: Spacing schedule de revisao se > 4h (peso 15)
  - [x] Implementar N6: Retrieval >= 1 quiz formativo por modulo (peso 15)
  - [x] Implementar N7: Dual Coding material visual + textual (peso 5)
  - [x] Exportar `evaluateNeuroscienceRules(architectOutput, calculatorOutput): NeuroscienceResult`

- [x] **Task 3** (AC: 9) Criar interaction-mapper.ts
  - [x] Criar `packages/course-designer/src/interaction-mapper.ts`
  - [x] Implementar `bloom_mapped` strategy: Remember/Understand -> quiz, Apply/Analyze -> socratic_dialogue, Evaluate -> scenario, Create -> assignment, com ajustes por spiral_level
  - [x] Implementar `dominant` strategy: usa interaction_type escolhido pelo instrutor para todos os modulos
  - [x] Implementar `custom` strategy: gera com bloom_mapped, instrutor edita depois
  - [x] Exportar `mapInteractions(modules, strategy, dominantType?): Module[]`

- [x] **Task 4** (AC: 6) Criar schema blueprintSchema
  - [x] Criar `packages/course-designer/src/schemas/generator.ts`
  - [x] Definir `blueprintSchema` com metadata (title, version, generated_at, primary_framework, complementary_frameworks, total_duration_hours, total_modules, quality_score, neuroscience_score, language, interaction_strategy)
  - [x] Definir audience (role, experience_level, zpd_level, motivation_type, kolb_style optional, adult_learning_profile)
  - [x] Definir course_architecture (bloom_progression, spiral_curriculum)
  - [x] Definir modules[] com todos os campos (order, title, description, duration_minutes, spiral_level, objectives[], framework_stages[], problema_motor nullable, assessments[], rubrics nullable, chunks[], interaction_type)
  - [x] Definir evaluation_plan (kirkpatrick L1-L4)
  - [x] Definir quality_scorecard (reusa qualityScorecardSchema)
  - [x] Definir implementation_checklist (item, priority enum must/should/could)
  - [x] Exportar `Blueprint` type via `z.infer`

- [x] **Task 5** (AC: 10) Criar prompts do Validator e Generator
  - [x] Criar `packages/course-designer/src/prompts/validator.ts`
  - [x] Criar `packages/course-designer/src/prompts/generator.ts`
  - [x] Definir `buildValidatorPrompt(analyzerOutput, architectOutput, calculatorOutput)`
  - [x] Definir `buildGeneratorPrompt(analyzerOutput, architectOutput, calculatorOutput, validatorOutput)`

- [x] **Task 6** (AC: 1, 4) Implementar runValidator
  - [x] Criar `packages/course-designer/src/validator.ts`
  - [x] A11 (Alignment Checker): verificar 1:1 objetivo-avaliacao
  - [x] A12 (Bloom Progression Validator): sem drops > 1 nivel
  - [x] A13 (Completeness Auditor): completude do framework selecionado (todos os stages presentes)
  - [x] A14 (Quality Scorecard): calcular framework_score (70%) + neuroscience_score (30%) = final_score
  - [x] Chamar evaluateNeuroscienceRules para neuroscience_score
  - [x] Determinar verdict: excellent (90-100), good (70-89), needs_revision (50-69), poor (<50)
  - [x] Usar Model Router para selecionar modelo
  - [x] Chamar generateObject com qualityScorecardSchema

- [x] **Task 7** (AC: 5, 7, 8) Implementar runGenerator
  - [x] Criar `packages/course-designer/src/generator.ts`
  - [x] A15 (Blueprint Builder): consolidar todos os outputs em JSON final conforme blueprintSchema
  - [x] A16 (Activity Recommender): sugerir atividades por estagio
  - [x] Set requires_instructor_review flag se verdict = needs_revision ou poor
  - [x] Usar Model Router para selecionar modelo
  - [x] Chamar generateObject com blueprintSchema

- [x] **Task 8** (AC: 1, 5) Validar
  - [x] Rodar `pnpm typecheck` — deve passar sem erros
  - [x] Validar neuroscience weights somam 100
  - [x] Validar framework score weights somam 1.0
  - [x] Validar verdict correto para diferentes faixas de score

---

## Dev Notes

### Technical Notes

```typescript
// Quality Scorecard — Score Final
const finalScore = (frameworkScore * 0.7) + (neuroscienceScore * 0.3)

const verdict = finalScore >= 90 ? 'excellent'
  : finalScore >= 70 ? 'good'
  : finalScore >= 50 ? 'needs_revision'
  : 'poor'
```

O Generator e majoritariamente consolidacao (pouca IA), enquanto o Validator usa LLM para avaliar qualidade. Neuroscience rules podem ser programaticas (sem LLM).

Neuroscience Layer — 7 regras (pesos somam 100):
- N1: CLT chunk_size <= 5 conceitos (20)
- N2: AGES attention < 30min (15)
- N3: AGES generation >= 1 atividade/modulo (20)
- N4: AGES emotion >= 50% modulos com hook (10)
- N5: Spacing schedule se > 4h (15)
- N6: Retrieval >= 1 quiz/modulo (15)
- N7: Dual Coding visual + textual (5)

Framework Score dimensions (weights somam 1.0):
- alignment: 0.30
- bloom_progression: 0.20
- framework_completeness: 0.25
- duration: 0.15
- cognitive_load: 0.10

**Nota PO (Interaction Mapper — Dependência Temporal):** AC9 coloca o Interaction Mapper nesta story (20.7), mas Story 20.5 (Architect) precisa do `bloom_mapped` strategy para atribuir `interaction_type` por módulo (AC8 de 20.5). Como 20.5 é implementada ANTES de 20.7, o @dev deve: (a) implementar o Interaction Mapper inline em 20.5 e extrair para módulo dedicado em 20.7, ou (b) criar `interaction-mapper.ts` antecipadamente em 20.5.

**Nota PO (Model Router):** Mesma nota de Story 20.4 — verificar localização real do Model Router.

### File Locations

```
packages/course-designer/src/
├── validator.ts             # NOVO
├── generator.ts             # NOVO
├── neuroscience-rules.ts    # NOVO
├── interaction-mapper.ts    # NOVO
├── schemas/validator.ts     # NOVO
├── schemas/generator.ts     # NOVO
├── prompts/validator.ts     # NOVO
└── prompts/generator.ts     # NOVO
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
- qualityScorecardSchema: framework_score (70%) + neuroscience_score (30%) = final_score
- 7 neuroscience rules (N1-N7) implemented programmatically, weights sum to 100
- Validator: LLM evaluates framework score, programmatic neuro score, recalculates final_score + verdict
- Generator: consolidates all pipeline outputs into Blueprint JSON
- Blueprint schema: metadata, audience, course_architecture, modules[], evaluation_plan, quality_scorecard, implementation_checklist
- interaction-mapper.ts created in Story 20.5 per PO note (option b)
- Neuroscience rules are pure functions (no LLM), tested via programmatic evaluation

### File List
- `packages/course-designer/src/schemas/validator.ts` — NEW: qualityScorecardSchema
- `packages/course-designer/src/schemas/generator.ts` — NEW: blueprintSchema
- `packages/course-designer/src/neuroscience-rules.ts` — NEW: evaluateNeuroscienceRules (N1-N7)
- `packages/course-designer/src/prompts/validator.ts` — NEW: buildValidatorPrompt
- `packages/course-designer/src/prompts/generator.ts` — NEW: buildGeneratorPrompt
- `packages/course-designer/src/validator.ts` — NEW: runValidator (A11-A14)
- `packages/course-designer/src/generator.ts` — NEW: runGenerator (A15-A16)
- `packages/course-designer/src/schemas/index.ts` — MODIFIED: added validator + generator exports
- `packages/course-designer/src/index.ts` — MODIFIED: added runValidator, runGenerator, evaluateNeuroscienceRules exports

---

## QA Results
_To be filled by @qa_
