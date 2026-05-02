# Epic 20: WS2 — Framework Registry, Schemas & Pipeline Agents

**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md`
**Architecture Reference:** `docs/architecture/ws2-course-creator-architecture.md` — Seções 4, 5, 6, 8
**Workstream:** WS2 (Course Creator — depende indiretamente de WS1 para InteractionTypes)

---

## Epic Goal

Construir a fundação do Course Creator: Framework Registry com 3 FrameworkConfigs plugáveis (ELC+, Kolb, PBL), schemas Zod completos para input/output de todas as 5 fases do pipeline, e os 5 agentes de design instrucional (Analyzer, Architect, Calculator, Validator, Generator) que transformam um Course Design Brief em um Blueprint Instrucional validado.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, AI SDK 6.0, Zod, TypeScript |
| **DB Tables** | `course_blueprints` (existente, estender), `blueprint_modules` (NOVO), `blueprint_objectives` (existente, estender), `blueprint_assessments` (existente, estender) |
| **AI Agents** | Analyzer (NOVO), Architect (NOVO), Calculator (NOVO), Validator (NOVO), Generator (NOVO) |
| **Providers** | OpenAI (gpt-4.1), DeepSeek V3, Gemini (fallback) — via Model Router existente |
| **Design Tokens** | N/A (backend-only neste epic) |
| **Roles Impactados** | manager (cria blueprints) |
| **Package** | `@eximia/agents` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| AI SDK generateObject | Implementado (reutilizar) | Via `ai` SDK |
| Model Router multi-provider | Implementado (reutilizar — Epic 16) | `packages/agents/src/model-router.ts` |
| Creator Agent | Implementado (manter — independente) | `packages/agents/src/creator.ts` |
| Schemas Zod pattern | Implementado (seguir pattern) | `packages/agents/src/schemas/` |
| Prompts pattern | Implementado (seguir pattern) | `packages/agents/src/prompts/` |
| Sentry spans | Implementado (reutilizar) | Observability existente |
| Blueprint proxy Python | Implementado (DEPRECAR — D5) | `POST /api/blueprint/generate` |

### Current Blueprint Flow

```
Manager clica "Gerar Blueprint"
    → POST /api/blueprint/generate (proxy Python)
    → Microservice Python gera blueprint limitado
    → Retorna JSON simples
    → Salva em course_blueprints
```

### What This Epic Changes

```
Manager preenche Wizard 6 steps (Epic 22)
    → POST /api/course-designer/generate (Epic 21)
    → PIPELINE DE 5 FASES (este Epic):
        → Fase 1: Analyzer (Input Parser + Framework Selector + Audience Profiler)
        → Fase 2: Architect (Objectives + Assessment + Sequencer + Framework Mapper)
        → Fase 3: Calculator (Duration + Cognitive Load + Chunks)
        → Fase 4: Validator (Alignment + Bloom + Completeness + Scorecard + Neuro)
        → Fase 5: Generator (Blueprint Builder + Activity Recommender)
    → Blueprint JSON completo com Quality Scorecard
```

---

## Enhancement Details

### Framework Registry: 3 Configs Plugáveis

```
┌─────────────────────────────────────────────┐
│           FRAMEWORK REGISTRY                 │
│                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────┐ │
│  │   ELC+ 2026  │ │  Kolb 4-Stage│ │ PBL  │ │
│  │   6 stages   │ │  4 stages    │ │Hmelo │ │
│  │   spiral     │ │  linear      │ │4 stg │ │
│  └──────────────┘ └──────────────┘ └──────┘ │
│                                              │
│  Cada um = 1 FrameworkConfig                 │
│  Pipeline opera genericamente sobre config   │
│  Zero `if framework === "x"` nos algoritmos  │
└──────────────┬──────────────────────────────┘
               │ injeta config
               ▼
┌──────────────────────────────────────────────┐
│  PIPELINE CORE (5 Fases — 16 Algoritmos)     │
│  Analyzer → Architect → Calculator →         │
│  Validator → Generator                        │
└──────────────────────────────────────────────┘
```

### Pipeline de 5 Fases (16 Algoritmos)

```
┌──────────────────────────────────────────────────────────┐
│              COURSE DESIGN BRIEF (6 Camadas)              │
└────────────────────────────┬─────────────────────────────┘
                             │
   ┌─────────┬───────────┬───┴───────┬───────────┬────────┐
   ▼         ▼           ▼           ▼           ▼        │
┌───────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│FASE 1 │ │FASE 2  │ │FASE 3  │ │FASE 4  │ │FASE 5  │    │
│ANALYZER│→│ARCHITECT│→│CALCULA-│→│VALIDA- │→│GENERA- │    │
│       │ │        │ │  TOR   │ │  TOR   │ │  TOR   │    │
│A1-A3  │ │A4-A7   │ │A8-A10  │ │A11-A14 │ │A15-A16 │    │
└───────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
                                               │          │
                                          BLUEPRINT       │
└──────────────────────────────────────────────────────────┘
```

| Fase | # | Algoritmo | Descrição |
|------|---|-----------|-----------|
| **1. Analyzer** | A1 | Input Parser & Validator | Valida e normaliza input |
| | A2 | Framework Selector | Decision tree: seleciona framework |
| | A3 | Audience Profiler | ZPD, motivação, Kolb style, andragogia |
| **2. Architect** | A4 | Objective Generator | Bloom Taxonomy (6 níveis) + ABCD format |
| | A5 | Assessment Designer | Backward Design: avaliação antes do conteúdo |
| | A6 | Module Sequencer | Prerequisites, spiral curriculum, progressão |
| | A7 | Framework Mapper | Aplica estágios do framework a cada módulo |
| **3. Calculator** | A8 | Duration Allocator | Distribui tempo entre módulos e estágios |
| | A9 | Cognitive Load Analyzer | Sweller CLT, intrinsic/extraneous/germane |
| | A10 | Chunk Optimizer | Miller 7±2, chunks de 5-15min |
| **4. Validator** | A11 | Alignment Checker | 1:1 objetivo ↔ avaliação |
| | A12 | Bloom Progression Validator | Sem drops > 1 nível |
| | A13 | Completeness Auditor | Completude do framework selecionado |
| | A14 | Quality Scorecard | Score: (Framework × 0.7) + (Neuro × 0.3) |
| **5. Generator** | A15 | Blueprint Builder | JSON final consolidado |
| | A16 | Activity Recommender | Atividades por estágio |

### Success Criteria

- [ ] 3 FrameworkConfigs completos (ELC+, Kolb, PBL) com stages, sequencing, quality_criteria
- [ ] Framework Selector decision tree funciona para seleção automática
- [ ] Todos os 16 algoritmos produzem output Zod-validated
- [ ] Neuroscience Layer valida 7 regras transversais
- [ ] Quality Scorecard: (Framework × 0.7) + (Neuro × 0.3) = score 0-100
- [ ] Pipeline sequencial Analyzer → Architect → Calculator → Validator → Generator
- [ ] Zero `if framework === "x"` nos algoritmos — tudo via FrameworkConfig

---

## Stories

---

### Story 20.1: Shared Schemas & Types Fundamentais

**As a** developer,
**I want** schemas Zod e types compartilhados para FrameworkConfig, Bloom, InteractionType e demais tipos fundamentais,
**so that** todos os agentes do pipeline operem com tipos consistentes e validáveis.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 4.1, 8.2 (shared types)

**Story Points:** 3
**Priority:** P0 (fundação — todos os demais schemas dependem deste)
**Risk:** LOW — tipos puros, sem side effects

#### Acceptance Criteria

- [ ] **AC1:** `FrameworkConfig` interface em `packages/agents/src/course-designer/schemas/shared.ts`
  - `id` (string enum: `elc_plus`, `kolb_4`, `pbl_hmelo`)
  - `name` (string)
  - `type` (literal `learning_cycle`)
  - `stages` (array de `{ id, name, description, time_percentage, default_interaction, purpose }`)
  - `sequencing` (object: `model`, `levels?`, `progression_rule`)
  - `bloom_interaction_map` (Record<BloomLevel, { interaction, turns, depth_range }>)
  - `positional_adjustments` (array de ajustes por spiral position)
  - `quality_criteria` (array de critérios com weight somando 100)
  - `assessment_dimensions` (array de dimensões)
  - `special_requirements?` (opcional: group_size, sdl_interval, etc.)
- [ ] **AC2:** `BloomLevel` enum: `remembering`, `understanding`, `applying`, `analyzing`, `evaluating`, `creating`
- [ ] **AC3:** `InteractionType` enum: `socratic_dialogue`, `quiz`, `scenario`, `assignment`
- [ ] **AC4:** `SpiralLevel` enum: `fundamentos`, `variacao`, `conflito_humano`, `mundo_real`, `sintese`
- [ ] **AC5:** `QualityVerdict` enum: `excellent`, `good`, `needs_revision`, `poor`
- [ ] **AC6:** `FrameworkId` type: `elc_plus | kolb_4 | pbl_hmelo`
- [ ] **AC7:** Todos os types exportados via barrel file `packages/agents/src/course-designer/schemas/index.ts`
- [ ] **AC8:** `pnpm typecheck` passa sem erros

#### Technical Notes

Seguir pattern existente em `packages/agents/src/schemas/`. Usar Zod com `z.object()` e `z.enum()`. Estes tipos são a fundação de todos os demais schemas do pipeline.

```typescript
// Pattern de referência
export const bloomLevelSchema = z.enum([
  "remembering", "understanding", "applying",
  "analyzing", "evaluating", "creating"
])
export type BloomLevel = z.infer<typeof bloomLevelSchema>
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar schemas e types |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

### Story 20.2: Framework Registry — 3 FrameworkConfigs + Selector

**As a** developer,
**I want** um Framework Registry com as 3 configurações completas (ELC+, Kolb, PBL) e um Framework Selector com decision tree,
**so that** o pipeline opere genericamente sobre qualquer framework v1.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 4.2-4.6

**Story Points:** 5
**Priority:** P0 (fundação)
**Risk:** LOW — configuração estática, decision tree simples

#### Acceptance Criteria

- [ ] **AC1:** `getFrameworkConfig(id)` em `packages/agents/src/course-designer/framework-registry.ts`
  - Retorna `FrameworkConfig` completo para o id fornecido
  - Suporta: `elc_plus`, `kolb_4`, `pbl_hmelo`
  - Throw se id desconhecido
- [ ] **AC2:** ELC+ 2026 config completo com 6 stages
  - Stages: immerse (18%), reflect (12%), conceptualize (18%), experiment (18%), calibrate (12%), integrate (22%)
  - Sequencing: spiral, 5 levels (fundamentos → síntese), bloom_ascending
  - 5 quality_criteria (all_stages 30%, time_balance 20%, bloom_progression 25%, objective_alignment 15%, spiral_coherence 10%)
  - 4 assessment_dimensions
- [ ] **AC3:** Kolb 4-Stage config completo com 4 stages
  - Stages: experience (25%), reflect (25%), conceptualize (25%), experiment (25%)
  - Sequencing: linear, bloom_ascending
  - 4 quality_criteria
- [ ] **AC4:** PBL (Hmelo-Silver) config completo com 4 stages
  - Stages: problem_presentation (15%), group_collaboration (25%), self_directed_learning (35%), application_reflection (25%)
  - Sequencing: problem_complexity, 3 levels
  - 5 quality_criteria
  - `special_requirements`: group_size 5-8, facilitator_role coach, whiteboard_tool true
- [ ] **AC5:** `selectFramework(characteristics)` — Decision tree conforme §4.6
  - Se `instructor_preferred_framework` set → retorna preferência
  - Se behavior_change envolve "resolver problemas" → `pbl_hmelo`
  - Se total_duration <= 10h e experience != iniciante → `kolb_4`
  - Default → `elc_plus`
- [ ] **AC6:** `listFrameworks()` retorna array com os 3 frameworks disponíveis (id, name, description)
- [ ] **AC7:** `bloom_interaction_map` preenchido para cada framework conforme §9.1

#### Technical Notes

Os FrameworkConfigs são objetos estáticos (não vêm do DB). Framework Selector é uma função pura (sem LLM).

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar registry e selector |
| **@architect (Aria)** | Validar configs contra arquitetura |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Soma de time_percentage = 100 para cada framework | Yes |
| Pre-PR | Soma de quality_criteria weights = 100 para cada framework | Yes |

---

### Story 20.3: Input Schema — Course Design Brief 6 Camadas

**As a** developer,
**I want** o schema Zod completo para o Course Design Brief (6 camadas de input) com Pre-validation Gate,
**so that** o input do wizard seja validável antes de entrar no pipeline.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 6.1-6.7

**Story Points:** 5
**Priority:** P0 (fundação)
**Risk:** LOW — schema de input, sem side effects

#### Acceptance Criteria

- [ ] **AC1:** `courseDesignerInputSchema` em `packages/agents/src/course-designer/schemas/input.ts`
  - Camada 1 (Propósito): `course_title`, `business_goal`, `behavior_change`, `success_metrics?`, `problem_statement?`
  - Camada 2 (Audiência): `target_audience` object com `role`, `experience_level`, `prior_knowledge?`, `group_size?`, `motivation_context?`, `learning_environment?`, `autonomy_level?`
  - Camada 3 (Escopo): `core_competencies?`, `topics_outline?`, `content_density?`, `assessment_preference?`, `context_files?`, `existing_materials_summary?`, `source_course_id?`
  - Camada 4 (Restrições): `total_duration_hours`, `constraints?` (weeks, hours_per_week, delivery_mode, cohort_based, session_length_preference)
  - Camada 5 (Preferências): `framework` (default `auto`), `interaction_strategy` (default `bloom_mapped`), `dominant_interaction_type?`, `language` (default `pt-br`)
- [ ] **AC2:** Pre-validation Gate — `validateBrief(input)` retorna `{ valid, errors, warnings, briefScore }`
  - Checks obrigatórios (bloqueiam): propósito mínimo, audiência mínima, duração mínima, fonte de conteúdo
  - Checks de qualidade (warnings): goal sem verbo, duração curta, sem contexto externo, grupo grande sem cohort, sem métricas
- [ ] **AC3:** `calculateBriefScore(input)` retorna score 0-100
  - Pesos conforme §6.6: course_title 5, business_goal 10, behavior_change 10, success_metrics 5, etc.
  - Faixas: 90-100 Excelente, 70-89 Bom, 50-69 Suficiente, <50 Mínimo
- [ ] **AC4:** Refinement `.refine()` para validação cruzada
  - `total_duration_hours` calculado se `weeks × hours_per_week` fornecido
  - `dominant_interaction_type` obrigatório se `interaction_strategy === "dominant"`
  - Ao menos 1 fonte: `core_competencies`, `topics_outline`, `context_files`, ou `source_course_id`
- [ ] **AC5:** Type `CourseDesignerInput` exportado via `z.infer`
- [ ] **AC6:** `pnpm typecheck` passa sem erros

#### Technical Notes

A Pre-validation Gate é chamada no Step 6 do Wizard (Epic 22) antes de submeter ao pipeline. O Brief Score é exibido visualmente ao instrutor.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar schema e validação |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Brief Score calcula corretamente para inputs de teste | Yes |

---

### Story 20.4: Analyzer Agent — Fase 1 (3 Algoritmos)

**As a** developer,
**I want** o agente Analyzer que executa Framework Selector, Audience Profiler e Gap Analysis,
**so that** o pipeline inicie com contexto rico e framework selecionado.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 8.1-8.2 (Analyzer Output)

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** MEDIUM — LLM-driven, qualidade do audience profiling impacta fases seguintes

#### Acceptance Criteria

- [ ] **AC1:** `runAnalyzer(input)` em `packages/agents/src/course-designer/analyzer.ts`
  - Input: `CourseDesignerInput`
  - Output: `AnalyzerOutput` (Zod-validated)
- [ ] **AC2:** Schema `AnalyzerOutput` em `packages/agents/src/course-designer/schemas/analyzer.ts`
  - `selected_framework`: primary, complementary[], rationale, was_user_selected, recommendation_confidence
  - `audience_profile`: zpd_level, motivation_type, prior_knowledge_summary, learning_preferences, attention_span_minutes, adult_learning_profile (4 booleans), kolb_style?
  - `gap_analysis`: current_state, desired_state, critical_gaps[], estimated_modules
  - `recommendations`: string[]
- [ ] **AC3:** Algoritmo A1 (Input Parser) — normaliza e valida input antes de processar
- [ ] **AC4:** Algoritmo A2 (Framework Selector) — usa `selectFramework()` do Registry (20.2) se `framework === "auto"`, senão usa preferência do instrutor
- [ ] **AC5:** Algoritmo A3 (Audience Profiler) — LLM infere ZPD, Kolb style, motivação, andragogia a partir de role + experience_level + prior_knowledge
  - ZPD conforme tabela da arquitetura §6.2
- [ ] **AC6:** Prompt do Analyzer em `packages/agents/src/course-designer/prompts/analyzer.ts`
  - Usa `generateObject` com schema Zod
  - Recebe: input completo + framework config selecionado
- [ ] **AC7:** Usa Model Router para selecionar modelo (reusa infra do Epic 16)

#### Technical Notes

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

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Analyzer + prompt |
| **@architect (Aria)** | Validar decision tree e ZPD mapping |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Output Zod-validated para inputs de teste | Yes |

---

### Story 20.5: Architect Agent — Fase 2 (4 Algoritmos)

**As a** developer,
**I want** o agente Architect que gera objetivos ABCD, assessments, sequencia módulos e aplica framework stages,
**so that** a estrutura do curso seja pedagogicamente sólida com Bloom progression.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 8.2 (Architect Output)

**Story Points:** 8
**Priority:** P0 (core — fase mais complexa do pipeline)
**Risk:** HIGH — 4 algoritmos interdependentes, output grande, qualidade impacta todo o resto

#### Acceptance Criteria

- [ ] **AC1:** `runArchitect(input)` em `packages/agents/src/course-designer/architect.ts`
  - Input: `CourseDesignerInput` + `AnalyzerOutput`
  - Input opcional: `revision_feedback` (para auto-retry do Quality Gate — D14)
  - Output: `ArchitectOutput` (Zod-validated)
- [ ] **AC2:** Schema `ArchitectOutput` em `packages/agents/src/course-designer/schemas/architect.ts`
  - `course_structure`: total_modules, primary_framework, complementary_frameworks, bloom_progression, spiral_levels
  - `modules[]`: order, title, description, spiral_level, objectives[] (com bloom_level + ABCD), assessments[], framework_stages[], problema_motor, rubrics, interaction_type, prerequisites
  - `assessment_strategy`: formative/summative/diagnostica counts, overall_approach, kirkpatrick_coverage (L1-L4)
  - `facilitation_notes?`
- [ ] **AC3:** Algoritmo A4 (Objective Generator) — gera objetivos no formato ABCD (Audience, Behavior, Condition, Degree) com Bloom level para cada módulo
- [ ] **AC4:** Algoritmo A5 (Assessment Designer) — Backward Design: assessments antes do conteúdo, alinhados 1:1 com objetivos, Kirkpatrick L1-L4
- [ ] **AC5:** Algoritmo A6 (Module Sequencer) — distribui módulos com Bloom ascending, spiral curriculum, prerequisites
  - Duração → Escopo: 1-4h = 1-2 módulos, 4-10h = 3-5, 10-40h = 5-10, 40-100h = 10-20, 100-200h = 20-30
- [ ] **AC6:** Algoritmo A7 (Framework Mapper) — aplica stages do FrameworkConfig a cada módulo com time_percentage e activities
- [ ] **AC7:** Problema-Motor gerado para cada módulo (frameworks experienciais)
  - Fórmula: Tensão = Pressão × Ambiguidade × Stakes (1-125)
  - Progressão por spiral level: fundamentos (1-25) → síntese (100-125)
- [ ] **AC8:** `interaction_type` por módulo via `bloom_mapped` strategy (default D17)
  - Remember/Understand → quiz, Apply/Analyze → socratic_dialogue, Evaluate → scenario, Create → assignment
  - Ajustes por spiral_level conforme §9.1
- [ ] **AC9:** Prompt do Architect em `packages/agents/src/course-designer/prompts/architect.ts`

#### Technical Notes

O Architect é o agente mais complexo do pipeline. O prompt deve ser rico em contexto: recebe AnalyzerOutput completo + FrameworkConfig + input do instrutor. O output pode ter 10-30 módulos com 3-7 objetivos cada.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Architect + prompt |
| **@architect (Aria)** | Validar Bloom progression e ABCD |
| **@qa (QA)** | Testar output para diferentes frameworks |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Output Zod-validated para 3 frameworks | Yes |
| Pre-PR | Bloom progression é ascending (sem drops > 1 nível) | Yes |
| Pre-PR | Problema-motor tension score escala com spiral level | Yes |

---

### Story 20.6: Calculator Agent — Fase 3 (3 Algoritmos)

**As a** developer,
**I want** o agente Calculator que distribui tempo, analisa carga cognitiva e otimiza chunks,
**so that** o blueprint respeite limites neurocientíficos e temporais.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 8.2 (Calculator Output)

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** MEDIUM — cálculos de tempo devem somar corretamente

#### Acceptance Criteria

- [ ] **AC1:** `runCalculator(input)` em `packages/agents/src/course-designer/calculator.ts`
  - Input: `ArchitectOutput` + `total_duration_hours`
  - Output: `CalculatorOutput` (Zod-validated)
- [ ] **AC2:** Schema `CalculatorOutput` em `packages/agents/src/course-designer/schemas/calculator.ts`
  - `time_allocation`: total_minutes, modules[] (module_order, total_minutes, per_stage, chunks[])
  - `cognitive_load`: modules[] (intrinsic/extraneous/germane load, new_concepts_count, concurrent_concepts, recommendation), overall_balance, warnings
  - `pacing_strategy`: recommended_schedule, spaced_repetition_points, break_pattern
- [ ] **AC3:** Algoritmo A8 (Duration Allocator) — distribui `total_duration_hours` entre módulos e estágios
  - Soma de minutos dos módulos = total_minutes ± 5%
  - Per_stage segue time_percentage do FrameworkConfig
- [ ] **AC4:** Algoritmo A9 (Cognitive Load Analyzer) — avalia CLT (Sweller)
  - Intrinsic load baseado em complexidade do conteúdo
  - `new_concepts_count` ≤ 5 por módulo (CLT rule N1)
  - `concurrent_concepts` ≤ 4 por chunk
  - Flag `overloaded` se regras CLT violadas
- [ ] **AC5:** Algoritmo A10 (Chunk Optimizer) — divide módulos em chunks de 5-30min
  - Tipos: content, activity, assessment, break, reflection
  - Nenhum chunk contínuo > 30min sem pausa (AGES rule N2)
  - Chunks respeitam `session_length_preference` do input
- [ ] **AC6:** `attention_span_respected` boolean no output
- [ ] **AC7:** Prompt do Calculator em `packages/agents/src/course-designer/prompts/calculator.ts`

#### Technical Notes

O Calculator pode ser LLM-assisted para pacing e cognitive load, mas durations devem ser matematicamente corretos. Considerar validação pós-LLM para somas.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Calculator + prompt |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Soma de minutos = total correto ± 5% | Yes |
| Pre-PR | Nenhum chunk > 30min | Yes |

---

### Story 20.7: Validator + Generator Agents — Fases 4-5 (6 Algoritmos)

**As a** developer,
**I want** o Validator (Quality Scorecard + Neuroscience Layer) e o Generator (Blueprint Builder + Activity Recommender),
**so that** o pipeline produza blueprints validados com score de qualidade composto.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 5.1, 8.2 (Validator Output, Blueprint Schema)

**Story Points:** 8
**Priority:** P0 (core — determina qualidade final)
**Risk:** HIGH — Quality Scorecard é o gatekeeper do pipeline, Neuroscience Layer define regras de validação

#### Acceptance Criteria

- [ ] **AC1:** `runValidator(input)` em `packages/agents/src/course-designer/validator.ts`
  - Input: `AnalyzerOutput` + `ArchitectOutput` + `CalculatorOutput`
  - Output: `ValidatorOutput` contendo `qualityScorecardSchema`
- [ ] **AC2:** Schema `qualityScorecardSchema` em `packages/agents/src/course-designer/schemas/validator.ts`
  - `framework_score` (70% do final): alignment (0.30), bloom_progression (0.20), framework_completeness (0.25), duration (0.15), cognitive_load (0.10)
  - `neuroscience_score` (30% do final): 7 regras (N1-N7) com id, name, passed, weight, details
  - `final_score`: 0-100
  - `verdict`: excellent (90-100), good (70-89), needs_revision (50-69), poor (<50)
  - `critical_issues[]`, `recommendations[]`
- [ ] **AC3:** Neuroscience rules em `packages/agents/src/course-designer/neuroscience-rules.ts`
  - N1: CLT chunk_size ≤ 5 conceitos (peso 20)
  - N2: AGES attention < 30min sem pausa (peso 15)
  - N3: AGES generation ≥ 1 atividade por módulo (peso 20)
  - N4: AGES emotion ≥ 50% módulos com hook (peso 10)
  - N5: Spacing: schedule de revisão se > 4h (peso 15)
  - N6: Retrieval: ≥ 1 quiz formativo por módulo (peso 15)
  - N7: Dual Coding: material visual + textual (peso 5)
- [ ] **AC4:** Algoritmos A11-A13 (Alignment, Bloom Progression, Completeness) executados antes do Scorecard
- [ ] **AC5:** `runGenerator(input)` em `packages/agents/src/course-designer/generator.ts`
  - Input: `AnalyzerOutput` + `ArchitectOutput` + `CalculatorOutput` + `ValidatorOutput`
  - Output: `Blueprint` (schema final completo conforme §8.2)
- [ ] **AC6:** Schema `blueprintSchema` em `packages/agents/src/course-designer/schemas/generator.ts`
  - metadata, audience, course_architecture, modules[], evaluation_plan, quality_scorecard, implementation_checklist
  - `requires_instructor_review` flag se verdict = needs_revision ou poor
- [ ] **AC7:** Algoritmo A15 (Blueprint Builder) — consolida todos os outputs em JSON final
- [ ] **AC8:** Algoritmo A16 (Activity Recommender) — sugere atividades do ACTIVITY_BANK por estágio
- [ ] **AC9:** Interaction mapper em `packages/agents/src/course-designer/interaction-mapper.ts`
  - `bloom_mapped`: atribui interaction_type por Bloom + spiral_level
  - `dominant`: usa interaction_type escolhido pelo instrutor
  - `custom`: gera com bloom_mapped, instrutor edita depois
- [ ] **AC10:** Prompts em `packages/agents/src/course-designer/prompts/validator.ts` e `prompts/generator.ts`

#### Technical Notes

```typescript
// Quality Scorecard — Score Final
const finalScore = (frameworkScore * 0.7) + (neuroscienceScore * 0.3)

const verdict = finalScore >= 90 ? 'excellent'
  : finalScore >= 70 ? 'good'
  : finalScore >= 50 ? 'needs_revision'
  : 'poor'
```

O Generator é majoritariamente consolidação (pouca IA), enquanto o Validator usa LLM para avaliar qualidade. Neuroscience rules podem ser programáticas (sem LLM).

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Validator + Generator + Neuroscience Rules |
| **@architect (Aria)** | Validar weights e thresholds do Scorecard |
| **@qa (QA)** | Testar cenários de cada verdict |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Neuroscience weights somam 100 | Yes |
| Pre-PR | Framework score weights somam 1.0 | Yes |
| Pre-PR | Verdict correto para diferentes faixas de score | Yes |

---

## Dependency Graph

```
Story 20.1 (Shared Schemas & Types)
    ↓
Story 20.2 (Framework Registry)    Story 20.3 (Input Schema)
    ↓                                    ↓
    └──────── Story 20.4 ────────────────┘  (Analyzer — Fase 1)
                   ↓
              Story 20.5 (Architect — Fase 2)
                   ↓
              Story 20.6 (Calculator — Fase 3)
                   ↓
              Story 20.7 (Validator + Generator — Fases 4-5)
```

**Ordem de execução sugerida:** 20.1 → (20.2 + 20.3 em paralelo) → 20.4 → 20.5 → 20.6 → 20.7

---

## Compatibility Requirements

- [ ] Pipeline socrático WS1 continua funcionando sem alterações
- [ ] Creator Agent existente não é afetado
- [ ] Model Router do Epic 16 é reutilizado (novos agent IDs adicionados)
- [ ] Schemas novos não conflitam com schemas existentes (namespace separado: `course-designer/`)
- [ ] Zero impacto no fluxo de Content Ingestion existente

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| FrameworkConfig incompleto para algum framework | Alto | Validar configs contra research papers | Ajustar config iterativamente |
| Output LLM inconsistente entre fases | Alto | Zod validation rigorosa, auto-retry 1x (D14) | Feedback ao agente anterior para corrigir |
| Architect gera módulos demais (>30) | Médio | Constraint no schema: max 30 módulos | Prompt adjustment |
| Neuroscience rules muito restritivas | Baixo | Thresholds configuráveis | Relaxar weights |
| Calculator não soma tempos corretamente | Médio | Validação pós-LLM programática | Recalcular programaticamente |

---

## New File Locations

```
packages/agents/src/
├── course-designer/                     # NOVO (diretório inteiro)
│   ├── analyzer.ts                      # NOVO — Fase 1
│   ├── architect.ts                     # NOVO — Fase 2
│   ├── calculator.ts                    # NOVO — Fase 3
│   ├── validator.ts                     # NOVO — Fase 4
│   ├── generator.ts                     # NOVO — Fase 5
│   ├── framework-registry.ts            # NOVO — 3 FrameworkConfigs
│   ├── neuroscience-rules.ts            # NOVO — 7 regras transversais
│   ├── interaction-mapper.ts            # NOVO — bloom_mapped/dominant/custom
│   ├── schemas/
│   │   ├── index.ts                     # NOVO — barrel
│   │   ├── shared.ts                    # NOVO — FrameworkConfig, Bloom, etc.
│   │   ├── input.ts                     # NOVO — Course Design Brief
│   │   ├── analyzer.ts                  # NOVO — Fase 1 I/O
│   │   ├── architect.ts                 # NOVO — Fase 2 I/O
│   │   ├── calculator.ts               # NOVO — Fase 3 I/O
│   │   ├── validator.ts                # NOVO — Fase 4 I/O (Scorecard + Neuro)
│   │   └── generator.ts                # NOVO — Fase 5 I/O (Blueprint)
│   └── prompts/
│       ├── analyzer.ts                  # NOVO
│       ├── architect.ts                 # NOVO
│       ├── calculator.ts               # NOVO
│       ├── validator.ts                # NOVO
│       └── generator.ts                # NOVO
```

---

## Definition of Done

- [ ] 3 FrameworkConfigs completos e validados (ELC+, Kolb, PBL)
- [ ] Framework Selector decision tree funcional
- [ ] Input schema com 6 camadas e Pre-validation Gate
- [ ] 5 agentes de pipeline produzem output Zod-validated
- [ ] Neuroscience Layer valida 7 regras transversais
- [ ] Quality Scorecard calcula score composto corretamente
- [ ] Blueprint schema final consolidado
- [ ] Interaction mapper suporta 3 estratégias (bloom_mapped, dominant, custom)
- [ ] `pnpm typecheck` e `pnpm build` passam
- [ ] Zero impacto no WS1

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 20.1 | Shared Schemas & Types | 3 | — |
| 20.2 | Framework Registry (3 Configs + Selector) | 5 | 20.1 |
| 20.3 | Input Schema (Brief 6 Camadas) | 5 | 20.1 |
| 20.4 | Analyzer Agent (Fase 1) | 5 | 20.2, 20.3 |
| 20.5 | Architect Agent (Fase 2) | 8 | 20.4 |
| 20.6 | Calculator Agent (Fase 3) | 5 | 20.5 |
| 20.7 | Validator + Generator (Fases 4-5) | 8 | 20.6 |
| **Total** | | **39** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-16 | 1.0 | Criação do épico | Morgan (PM) |
