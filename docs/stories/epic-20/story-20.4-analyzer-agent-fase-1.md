# Story 20.4: Analyzer Agent — Fase 1 (3 Algoritmos)

**Epic:** [Epic 20 — WS2: Framework Registry, Schemas & Pipeline Agents](../../epics/epic-20-ws2-framework-registry-schemas-pipeline-agents.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 20.2, Story 20.3
**Blocks:** Story 20.5
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** o agente Analyzer que executa Input Parser & Validator, Framework Selector e Audience Profiler,
**so that** o pipeline inicie com contexto rico e framework selecionado.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 8.1-8.2 (Analyzer Output) |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | TypeScript, Zod, AI SDK 6.0 |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/src/framework-registry.ts` (Story 20.2), `packages/course-designer/src/schemas/input.ts` (Story 20.3) |
| **Risk** | MEDIUM — LLM-driven, qualidade do audience profiling impacta fases seguintes |

---

## Acceptance Criteria

- [x] **AC1:** `runAnalyzer(input)` em `packages/course-designer/src/analyzer.ts`
  - Input: `CourseDesignerInput`
  - Output: `AnalyzerOutput` (Zod-validated)
- [x] **AC2:** Schema `AnalyzerOutput` em `packages/course-designer/src/schemas/analyzer.ts`
  - `selected_framework`: primary, complementary[], rationale, was_user_selected, recommendation_confidence
  - `audience_profile`: zpd_level, motivation_type, prior_knowledge_summary, learning_preferences, attention_span_minutes, adult_learning_profile (4 booleans), kolb_style?
  - `gap_analysis`: current_state, desired_state, critical_gaps[], estimated_modules
  - `recommendations`: string[]
- [x] **AC3:** Algoritmo A1 (Input Parser) — normaliza e valida input antes de processar
- [x] **AC4:** Algoritmo A2 (Framework Selector) — usa `selectFramework()` do Registry (20.2) se `framework === "auto"`, senao usa preferencia do instrutor
- [x] **AC5:** Algoritmo A3 (Audience Profiler) — LLM infere ZPD, Kolb style, motivacao, andragogia a partir de role + experience_level + prior_knowledge
  - ZPD conforme tabela da arquitetura secao 6.2
- [x] **AC6:** Prompt do Analyzer em `packages/course-designer/src/prompts/analyzer.ts`
  - Usa `generateObject` com schema Zod
  - Recebe: input completo + framework config selecionado
- [x] **AC7:** Usa Model Router para selecionar modelo (reusa infra do Epic 16)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 2) Criar schema AnalyzerOutput
  - [x] Criar `packages/course-designer/src/schemas/analyzer.ts`
  - [x] Definir `selectedFrameworkSchema` (primary frameworkId, complementary array, rationale string, was_user_selected boolean, recommendation_confidence number)
  - [x] Definir `audienceProfileSchema` (zpd_level enum, motivation_type enum, prior_knowledge_summary string, learning_preferences array, attention_span_minutes number 5-120, adult_learning_profile object com 4 booleans, kolb_style optional enum)
  - [x] Definir `gapAnalysisSchema` (current_state string, desired_state string, critical_gaps array, estimated_modules number 1-30)
  - [x] Definir `analyzerOutputSchema` completo
  - [x] Exportar `AnalyzerOutput` type via `z.infer`
  - [x] Atualizar barrel file `schemas/index.ts`

- [x] **Task 2** (AC: 6) Criar prompt do Analyzer
  - [x] Criar `packages/course-designer/src/prompts/analyzer.ts`
  - [x] Definir `buildAnalyzerPrompt(input, frameworkConfig)` que gera prompt rico
  - [x] Incluir instrucoes para ZPD mapping conforme tabela da arquitetura secao 6.2
  - [x] Incluir instrucoes para Kolb style inference
  - [x] Incluir instrucoes para andragogia profile (4 booleans)

- [x] **Task 3** (AC: 1, 3, 4, 5, 7) Implementar runAnalyzer
  - [x] Criar `packages/course-designer/src/analyzer.ts`
  - [x] A1 (Input Parser): validar e normalizar input via courseDesignerInputSchema
  - [x] A2 (Framework Selector): chamar selectFramework() se framework === "auto", senao getFrameworkConfig()
  - [x] A3 (Audience Profiler): chamar generateObject com analyzerOutputSchema e buildAnalyzerPrompt
  - [x] Usar Model Router para selecionar modelo (getModel('course_analyzer', context))
  - [x] Retornar AnalyzerOutput Zod-validated

- [x] **Task 4** (AC: 1) Validar
  - [x] Rodar `pnpm typecheck` — deve passar sem erros
  - [x] Testar output Zod-validated para inputs de teste

---

## Dev Notes

### Technical Notes

```typescript
export async function runAnalyzer(input: CourseDesignerInput): Promise<AnalyzerOutput> {
  const frameworkConfig = input.framework === 'auto'
    ? selectFramework(input)
    : getFrameworkConfig(input.framework)

  const result = await generateObject({
    model: getModel('course_analyzer', context),
    schema: analyzerOutputSchema,
    prompt: buildAnalyzerPrompt(input, frameworkConfig),
  })

  return result.object
}
```

ZPD Mapping (secao 6.2 da arquitetura):
- iniciante: Faz sozinho Remember/Understand, faz com ajuda Apply
- intermediario: Faz sozinho Remember-Apply, faz com ajuda Analyze
- avancado: Faz sozinho Remember-Analyze, faz com ajuda Evaluate/Create
- especialista: Faz sozinho todos, faz com ajuda Create (novos contextos)

**Nota PO (Model Router):** O epic referencia `model-router.ts` como "implementado (Epic 16)", mas o arquivo pode não existir nesse path. Verificar localização real do Model Router ou usar pattern existente dos agentes atuais (receber model como parâmetro). Consultar `packages/course-designer/src/` para pattern de referência.

### File Locations

```
packages/course-designer/src/
├── analyzer.ts              # NOVO
├── schemas/analyzer.ts      # NOVO
└── prompts/analyzer.ts      # NOVO
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
- Schema AnalyzerOutput with 4 sub-schemas (selectedFramework, audienceProfile, gapAnalysis, recommendations)
- Prompt includes ZPD mapping, Kolb inference, andragogy, motivation type
- runAnalyzer accepts LanguageModel param (decoupled from Model Router)
- A1 Input Parser uses courseDesignerInputSchema.parse()
- A2 Framework Selector uses selectFramework() or getFrameworkConfig()
- A3 Audience Profiler uses generateObject with analyzerOutputSchema

### File List
- `packages/course-designer/src/schemas/analyzer.ts` — NEW: AnalyzerOutput schema + enums
- `packages/course-designer/src/prompts/analyzer.ts` — NEW: buildAnalyzerPrompt
- `packages/course-designer/src/analyzer.ts` — NEW: runAnalyzer (A1, A2, A3)
- `packages/course-designer/src/schemas/index.ts` — MODIFIED: added analyzer exports
- `packages/course-designer/src/index.ts` — MODIFIED: added runAnalyzer export

---

## QA Results
_To be filled by @qa_
