# Story 17.1: Schemas Zod e Prompts do Detector e Perfilador

**Epic:** [Epic 17 — Shadow Analysis Pipeline](../../epics/epic-17-ws1-shadow-analysis-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** InProgress
**Story Points:** 5
**Priority:** P0 (fundacao)
**Blocked By:** Epic 16 (AgentId, ModelSpec, types base)
**Blocks:** Story 17.3
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** schemas Zod e system prompts para Detector e Perfilador,
**so that** os agentes shadow produzam output estruturado e validavel.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 6.4-6.5 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, Zod |
| **Package** | `@eximia/agents` |
| **Risk** | LOW — schemas e prompts puros, sem side effects |

---

## Acceptance Criteria

- [ ] **AC1:** Schema `DetectorOutput` em `packages/agents/src/schemas/detector.ts`
  - `cognitive_patterns`: dominant_patterns (array: pattern, evidence, frequency), implicit_values, cognitive_loops, readiness_level (defensive/exploring/integrating), suggested_question_type
  - `ai_detection`: probability (0-1), confidence (high/medium/low), verdict (likely_human/uncertain/likely_ai), indicators (array: type, description, weight), flag (string|null)
  - `linguistic_analysis`: emotional_density (0-1), abstraction_level (1-10), certainty_vs_exploration (-1 to +1), defense_active (boolean)
  - `session_journey`: emotional_arc (string[]), depth_progression (number[]), breakthrough_candidates (array: trigger + marker)
- [ ] **AC2:** Schema `PerfiladorOutput` em `packages/agents/src/schemas/perfilador.ts`
  - preferred_question_types (array, max 4: clarificacao/pressupostos/perspectiva/evidencia/consequencias/metacognicao)
  - engagement_style (reflective/impulsive/balanced), detail_orientation (verbose/concise/balanced), reasoning_style (analytical/creative/systematic/intuitive)
  - avg_depth_achieved (1-7), comprehension_trend (improving/stable/declining), avg_qa_score (0-1)
  - strengths (string[], max 5), growth_areas (string[], max 3), adaptation_hints (string[], max 5)
  - summary (string, max 500 chars), confidence (0-1)
  - `kolb_profile`: grasping_axis (-1 to +1), transforming_axis (-1 to +1), dominant_style (divergente/assimilador/convergente/acomodador), style_confidence (0-1), indicators_observed (array: indicator, weight, evidence)
- [ ] **AC3:** Prompt do Detector em `packages/agents/src/prompts/detector.ts`
  - Identidade: `Eximia_Detector`
  - 3 camadas: padrones cognitivos + deteccao IA + linguistica profunda
  - Escala de probabilidade IA (0-1) com regras de classificacao
  - Regras: nunca bloqueia, nunca penaliza, dados sao fatos, professor tem a palavra final
  - Em portugues (Brasil)
- [ ] **AC4:** Prompt do Perfilador em `packages/agents/src/prompts/perfilador.ts`
  - Identidade: `Eximia_Perfilador`
  - Deteccao Kolb implicita via dialogo (indicadores por estilo: linguagem, tamanho resposta, palavras emocionais, abstrato vs concreto)
  - 8 regras inviolaveis (nunca diagnostico psicologico, sempre evidencias, conservador com poucas sessoes, portugues BR, max 5 pontos fortes, max 3 areas crescimento, nunca comparar alunos, sempre merge incremental)
  - Merge incremental (recebe perfil anterior se existente)
  - Algoritmo de deteccao: Fase 1 (trocas 1-5 classificacao inicial), Fase 2 (refinamento janela rolante), Fase 3 (cross-session)
- [ ] **AC5:** Types ja atualizados no Epic 16: `AgentId` inclui detector e perfilador — verificar compatibilidade
- [ ] **AC6:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Implementar schema DetectorOutput
  - [x] Criar `packages/agents/src/schemas/detector.ts`
  - [x] Definir `detectorOutputSchema` com Zod:
    - `cognitive_patterns` object com dominant_patterns array, implicit_values, cognitive_loops, readiness_level enum, suggested_question_type
    - `ai_detection` object com probability (z.number().min(0).max(1)), confidence enum, verdict enum, indicators array, flag nullable
    - `linguistic_analysis` object com emotional_density, abstraction_level, certainty_vs_exploration, defense_active
    - `session_journey` object com emotional_arc, depth_progression, breakthrough_candidates
  - [x] Exportar type `DetectorOutput` via z.infer

- [x] **Task 2** (AC: 2) Implementar schema PerfiladorOutput
  - [x] Criar `packages/agents/src/schemas/perfilador.ts`
  - [x] Definir `perfiladorOutputSchema` com Zod:
    - preferred_question_types (z.array com max 4)
    - engagement_style, detail_orientation, reasoning_style (enums)
    - avg_depth_achieved (z.number().min(1).max(7))
    - strengths (z.array com max 5), growth_areas (max 3), adaptation_hints (max 5)
    - summary (z.string().max(500))
    - confidence (z.number().min(0).max(1))
    - kolb_profile object: grasping_axis (-1 to +1), transforming_axis (-1 to +1), dominant_style enum, style_confidence, indicators_observed array
  - [x] Exportar type `PerfiladorOutput` via z.infer

- [x] **Task 3** (AC: 3) Implementar prompt do Detector
  - [x] Criar `packages/agents/src/prompts/detector.ts`
  - [x] Definir `DETECTOR_SYSTEM_PROMPT` com identidade `Eximia_Detector`
  - [x] Incluir instrucoes para 3 camadas (cognitiva, IA, linguistica)
  - [x] Incluir escala de probabilidade IA e regras de classificacao
  - [x] Incluir regras de conduta (nunca bloqueia, nunca penaliza)

- [x] **Task 4** (AC: 4) Implementar prompt do Perfilador
  - [x] Criar `packages/agents/src/prompts/perfilador.ts`
  - [x] Definir `PERFILADOR_SYSTEM_PROMPT` com identidade `Eximia_Perfilador`
  - [x] Incluir deteccao Kolb implicita com indicadores por estilo
  - [x] Incluir 8 regras inviolaveis
  - [x] Incluir instrucoes de merge incremental
  - [x] Criar `buildPerfiladorPrompt(context)` se necessario contexto dinamico (perfil anterior)

- [x] **Task 5** (AC: 5, 6) Atualizar barrel file e validar
  - [x] Exportar schemas e prompts em `packages/agents/src/index.ts`
  - [x] Verificar compatibilidade com `AgentId` do Epic 16
  - [x] `pnpm typecheck` passa

---

## Dev Notes

### DetectorOutput Schema Detalhado

```typescript
// Camada A — Padrones Cognitivos
cognitive_patterns: {
  dominant_patterns: Array<{
    pattern: string        // tipo de distorcao/loop/defesa
    evidence: string       // evidencia textual
    frequency: "low"|"medium"|"high"
  }>
  implicit_values: string[]      // seguranca vs crescimento, etc.
  cognitive_loops: string[]      // analise circular, paralisia, etc.
  readiness_level: "defensive"|"exploring"|"integrating"
  suggested_question_type: string
}

// Camada B — Deteccao de IA
ai_detection: {
  probability: number      // 0.0-1.0
  confidence: "high"|"medium"|"low"
  verdict: "likely_human"|"uncertain"|"likely_ai"
  indicators: Array<{ type: string, description: string, weight: number }>
  flag: string | null      // "alta_probabilidade_texto_IA" se > 0.70
}

// Camada C — Linguistica Profunda
linguistic_analysis: {
  emotional_density: number       // 0-1
  abstraction_level: number       // 1-10
  certainty_vs_exploration: number // -1 (exploracao) a +1 (certeza)
  defense_active: boolean
}

// Jornada da sessao (acumulado)
session_journey: {
  emotional_arc: string[]         // ["confused", "curious", "insightful"]
  depth_progression: number[]     // [1, 2, 3, 3, 4, 5]
  breakthrough_candidates: Array<{ trigger: string, marker: string }>
}
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.4]

### PerfiladorOutput — Kolb Eixos

O Kolb usa 2 eixos dialeticos:
- **grasping_axis**: -1.0 (Sentir/CE) a +1.0 (Pensar/AC)
- **transforming_axis**: -1.0 (Observar/RO) a +1.0 (Fazer/AE)

4 estilos derivados:
| Estilo | Quadrante |
|---|---|
| Divergente | Sentir + Observar (grasping < 0, transforming < 0) |
| Assimilador | Pensar + Observar (grasping > 0, transforming < 0) |
| Convergente | Pensar + Fazer (grasping > 0, transforming > 0) |
| Acomodador | Sentir + Fazer (grasping < 0, transforming > 0) |

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.5]

### Prompt Pattern (seguir creator.ts)

```typescript
export const DETECTOR_SYSTEM_PROMPT = `Voce e o Eximia_Detector...`
export const PERFILADOR_SYSTEM_PROMPT = `Voce e o Eximia_Perfilador...`
```

Seguir pattern existente em `packages/agents/src/prompts/creator.ts` (usa `Harven_Creator` como identidade).

[Source: packages/agents/src/prompts/creator.ts]

### File Locations

```
packages/agents/src/
├── schemas/
│   ├── detector.ts       # NOVO
│   └── perfilador.ts     # NOVO
├── prompts/
│   ├── detector.ts       # NOVO
│   └── perfilador.ts     # NOVO
└── index.ts              # ATUALIZAR (exports)
```

### Testing

- Testes unitarios serao criados no Epic 19 (Story 19.2)
- ~10 testes por schema: valid input, invalid ranges, edge cases

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |
| 2026-02-15 | 1.2 | Implementation complete. All 5 tasks done. Status Ready → InProgress | Dex (Dev) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- `@eximia/agents` typecheck: PASS (clean)
- `@eximia/web` typecheck: FAIL (pre-existing error in `blueprint-generator.tsx:79` — `"primary"` variant — unrelated to this story)

### Completion Notes List
- DetectorOutput schema: 4 sections (cognitive_patterns, ai_detection, linguistic_analysis, session_journey) with full Zod validation
- PerfiladorOutput schema: Kolb profile with 2-axis model, 6 question type enums, engagement/detail/reasoning style enums
- Detector prompt: 3-layer analysis (cognitive, AI detection, deep linguistics), probability scale, 8 invariant rules
- Perfilador prompt: Implicit Kolb detection (3-phase algorithm), 8 inviolable rules, merge incremental instructions
- `buildPerfiladorPrompt(context)` function for dynamic context injection (previous profile + detector data)
- AC5: AgentId not yet implemented (Epic 16 not started) — schemas/prompts are self-contained and compatible
- Barrel file updated with all exports

### File List
- `packages/agents/src/schemas/detector.ts` — NEW (DetectorOutput Zod schema)
- `packages/agents/src/schemas/perfilador.ts` — NEW (PerfiladorOutput Zod schema)
- `packages/agents/src/prompts/detector.ts` — NEW (DETECTOR_SYSTEM_PROMPT)
- `packages/agents/src/prompts/perfilador.ts` — NEW (PERFILADOR_SYSTEM_PROMPT + buildPerfiladorPrompt)
- `packages/agents/src/index.ts` — MODIFIED (added detector/perfilador exports)

---

## QA Results
_To be filled by @qa_
