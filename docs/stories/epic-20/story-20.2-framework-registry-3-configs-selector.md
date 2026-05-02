# Story 20.2: Framework Registry — 3 FrameworkConfigs + Selector

**Epic:** [Epic 20 — WS2: Framework Registry, Schemas & Pipeline Agents](../../epics/epic-20-ws2-framework-registry-schemas-pipeline-agents.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0 (fundacao)
**Blocked By:** Story 20.1
**Blocks:** Story 20.4
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** um Framework Registry com as 3 configuracoes completas (ELC+, Kolb, PBL) e um Framework Selector com decision tree,
**so that** o pipeline opere genericamente sobre qualquer framework v1.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 4.2-4.6 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | TypeScript, Zod, AI SDK 6.0 |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/src/schemas/shared.ts` (Story 20.1) |
| **Risk** | LOW — configuracao estatica, decision tree simples |

---

## Acceptance Criteria

- [x] **AC1:** `getFrameworkConfig(id)` em `packages/course-designer/src/framework-registry.ts`
  - Retorna `FrameworkConfig` completo para o id fornecido
  - Suporta: `elc_plus`, `kolb_4`, `pbl_hmelo`
  - Throw se id desconhecido
- [x] **AC2:** ELC+ 2026 config completo com 6 stages
  - Stages: immerse (18%), reflect (12%), conceptualize (18%), experiment (18%), calibrate (12%), integrate (22%)
  - Sequencing: spiral, 5 levels (fundamentos -> sintese), bloom_ascending
  - 5 quality_criteria (all_stages 30%, time_balance 20%, bloom_progression 25%, objective_alignment 15%, spiral_coherence 10%)
  - 4 assessment_dimensions
- [x] **AC3:** Kolb 4-Stage config completo com 4 stages
  - Stages: experience (25%), reflect (25%), conceptualize (25%), experiment (25%)
  - Sequencing: linear, bloom_ascending
  - 4 quality_criteria
- [x] **AC4:** PBL (Hmelo-Silver) config completo com 4 stages
  - Stages: problem_presentation (15%), group_collaboration (25%), self_directed_learning (35%), application_reflection (25%)
  - Sequencing: problem_complexity, 3 levels
  - 5 quality_criteria
  - `special_requirements`: group_size 5-8, facilitator_role coach, whiteboard_tool true
- [x] **AC5:** `selectFramework(characteristics)` — Decision tree conforme arquitetura secao 4.6
  - Se `instructor_preferred_framework` set -> retorna preferencia
  - Se behavior_change envolve "resolver problemas" -> `pbl_hmelo`
  - Se total_duration <= 10h e experience != iniciante -> `kolb_4`
  - Default -> `elc_plus`
- [x] **AC6:** `listFrameworks()` retorna array com os 3 frameworks disponiveis (id, name, description)
- [x] **AC7:** `bloom_interaction_map` preenchido para cada framework conforme arquitetura secao 9.1

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 6) Criar framework-registry.ts com getFrameworkConfig e listFrameworks
  - [x] Criar `packages/course-designer/src/framework-registry.ts`
  - [x] Implementar `getFrameworkConfig(id: FrameworkId): FrameworkConfig`
  - [x] Implementar `listFrameworks(): Array<{ id, name, description }>`
  - [x] Throw error descritivo se id desconhecido

- [x] **Task 2** (AC: 2, 7) Definir ELC+ 2026 FrameworkConfig
  - [x] 6 stages com time_percentage somando 100 (immerse 18, reflect 12, conceptualize 18, experiment 18, calibrate 12, integrate 22)
  - [x] Sequencing spiral com 5 levels e progression_rule bloom_ascending
  - [x] 5 quality_criteria com weights somando 100
  - [x] 4 assessment_dimensions (Knowledge Application 30, Experiential Depth 25, Reflection Quality 20, Integration Transfer 25)
  - [x] bloom_interaction_map completo (6 niveis Bloom -> interaction + turns + depth_range)

- [x] **Task 3** (AC: 3, 7) Definir Kolb 4-Stage FrameworkConfig
  - [x] 4 stages com time_percentage 25% cada
  - [x] Sequencing linear com progression_rule bloom_ascending
  - [x] 4 quality_criteria com weights somando 100
  - [x] bloom_interaction_map completo

- [x] **Task 4** (AC: 4, 7) Definir PBL (Hmelo-Silver) FrameworkConfig
  - [x] 4 stages com time_percentage somando 100 (15, 25, 35, 25)
  - [x] Sequencing problem_complexity com 3 levels
  - [x] 5 quality_criteria com weights somando 100
  - [x] special_requirements: group_size { min: 5, max: 8 }, facilitator_role "coach", whiteboard_tool true
  - [x] bloom_interaction_map completo

- [x] **Task 5** (AC: 5) Implementar selectFramework decision tree
  - [x] Implementar `selectFramework(characteristics): FrameworkConfig`
  - [x] Prioridade 1: instructor_preferred_framework
  - [x] Prioridade 2: behavior_change com "resolver problemas" -> pbl_hmelo
  - [x] Prioridade 3: total_duration <= 10h e experience != iniciante -> kolb_4
  - [x] Default: elc_plus

- [x] **Task 6** (AC: 2, 3, 4) Validar integridade dos configs
  - [x] Verificar soma de time_percentage = 100 para cada framework
  - [x] Verificar soma de quality_criteria weights = 100 para cada framework
  - [x] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

Os FrameworkConfigs sao objetos estaticos (nao vem do DB). Framework Selector e uma funcao pura (sem LLM). Configs devem ser `as const satisfies FrameworkConfig` para garantir type safety.

Referencia de configs completos na arquitetura:
- ELC+ 2026: secao 4.2
- Kolb 4-Stage: secao 4.3
- PBL (Hmelo-Silver): secao 4.4
- Decision Tree: secao 4.6
- bloom_interaction_map: secao 9.1

### File Locations

```
packages/course-designer/src/
├── framework-registry.ts    # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |
| 2026-02-17 | 1.2 | Paths atualizados: @eximia/agents → @eximia/course-designer (D19 modularizacao) | Pax (PO) |
| 2026-02-17 | 1.3 | Implementation complete — 3 configs, selector, all integrity checks pass | Dex (Dev) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (via Claude Code CLI)

### Debug Log References
No debug issues encountered.

### Completion Notes List
- Fixed `specialRequirementsSchema` in 20.1: `group_size` now `{ min, max }` object (was `z.number()`), `whiteboard_tool` now `z.boolean()` (was `z.string()`)
- Fixed `sequencingSchema` in 20.1: added `problem_complexity` to model enum, added `sequencingLevelSchema` with `{ id, name, position, modules_range }`
- `bloom_interaction_map` shared across all 3 v1 frameworks (Architecture §9.1)
- `positional_adjustments` only for ELC+ (spiral-based); Kolb and PBL have empty arrays
- All sums verified: time_percentage=100, quality_criteria.weight=100, assessment_dimensions.weight=100 for all 3 frameworks

### File List
| File | Action | Description |
|------|--------|-------------|
| `packages/course-designer/src/framework-registry.ts` | Created | 3 FrameworkConfigs + getFrameworkConfig + listFrameworks + selectFramework |
| `packages/course-designer/src/schemas/shared.ts` | Modified | Fixed specialRequirementsSchema (group_size object, whiteboard_tool boolean), added sequencingLevelSchema, problem_complexity model |
| `packages/course-designer/src/schemas/index.ts` | Modified | Added sequencingLevelSchema export |
| `packages/course-designer/src/index.ts` | Modified | Added framework-registry exports |

---

## QA Results

**Reviewer:** Quinn (Test Architect)
**Date:** 2026-02-17
**Gate Decision:** PASS

### Review Summary
- All 7 ACs verified and passing
- 3 FrameworkConfigs integrity verified (time=100, quality=100, assessment=100 for all)
- bloom_interaction_map matches Architecture §9.1 exactly
- selectFramework decision tree covers all 4 priority paths
- `experience_level` fixed to literal union type (FIX-20.2-001)
- 21 unit tests in `framework-registry.test.ts`
- typecheck passes

### Findings
All issues resolved. No remaining concerns.
