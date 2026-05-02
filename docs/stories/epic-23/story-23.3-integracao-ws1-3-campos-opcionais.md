# Story 23.3: Integracao WS1 — 2 Campos Opcionais (D13)

**Epic:** [Epic 23 — WS2: Integration: Auditor, Apply & WS1](../../epics/epic-23-ws2-integration-auditor-apply-ws1.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (enhancement — WS1 funciona sem isto)
**Blocked By:** Story 23.2
**Blocks:** None
**Assigned To:** @data-engineer (Tasks 1-2), @dev (Tasks 3-7)

---

## User Story

**As a** developer,
**I want** que o pipeline socratico WS1 leia interaction_type e bloom_target dos chapters quando disponiveis,
**so that** o Mestre ajuste comportamento e profundidade baseado no design instrucional do WS2.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 11 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, Supabase, Drizzle ORM, AI SDK 6.0, TypeScript |
| **Package** | `@eximia/agents`, `packages/database` |
| **Existing Pattern** | `packages/agents/src/orchestrator.ts` (WS1 pipeline) |
| **Risk** | LOW — campos opcionais, backward-compatible |

---

## Acceptance Criteria

- [ ] **AC1:** Chapters table: ADD COLUMN (migration)
  - `interaction_type` TEXT nullable (CHECK: socratic_dialogue, quiz, scenario, assignment)
  - `bloom_target` TEXT nullable (CHECK: remembering, understanding, applying, analyzing, evaluating, creating)
  - Nota: `framework_stage` adiado para v2 (D16)
- [ ] **AC2:** Drizzle schema atualizado para chapters
- [ ] **AC3:** Orquestrador v2 (WS1) le `interaction_type` do chapter quando disponivel:
  - Se `interaction_type` definido: usa config de turns/comportamento do tipo
  - Se null: comportamento padrao atual (socratic_dialogue)
- [ ] **AC4:** Mestre (WS1) le `bloom_target` do chapter quando disponivel:
  - Se definido: ajusta `expectedDepth` conforme mapeamento Bloom -> Depth (S11.4)
  - Se null: usa depth default
- [ ] **AC5:** Bloom -> expectedDepth mapping:
  - Remember -> "1"-"2", Understand -> "2"-"3", Apply -> "3"-"4"
  - Analyze -> "4"-"5", Evaluate -> "5"-"6", Create -> "6"-"7"
- [ ] **AC6:** WS1 continua funcionando normalmente para chapters sem campos WS2
- [ ] **AC7:** Testes E2E existentes do WS1 continuam passando

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar migration para chapters
  - [ ] Criar `supabase/migrations/YYYYMMDD_add_ws2_fields_to_chapters.sql`
  - [ ] ADD COLUMN `interaction_type` TEXT nullable com CHECK (socratic_dialogue, quiz, scenario, assignment)
  - [ ] ADD COLUMN `bloom_target` TEXT nullable com CHECK (remembering, understanding, applying, analyzing, evaluating, creating)
  - [ ] Nota: `framework_stage` adiado para v2 (D16) — nao incluir

- [ ] **Task 2** (AC: 2) Atualizar Drizzle schema
  - [ ] Atualizar `packages/database/src/schema/chapters.ts`
  - [ ] Adicionar campo `interaction_type` (text, nullable)
  - [ ] Adicionar campo `bloom_target` (text, nullable)

- [ ] **Task 3** (AC: 3) Atualizar Orquestrador v2 para ler interaction_type
  - [ ] Em `packages/agents/src/orchestrator.ts`, ler `chapter.interaction_type`
  - [ ] Se definido: usar config de turns/comportamento do tipo
  - [ ] Se null: fallback para `socratic_dialogue` (comportamento padrao atual)

- [ ] **Task 4** (AC: 4, 5) Atualizar Mestre para ler bloom_target
  - [ ] Em `packages/agents/src/orchestrator.ts`, ler `chapter.bloom_target`
  - [ ] Implementar mapeamento Bloom -> expectedDepth:
    - Remember -> "1"-"2", Understand -> "2"-"3", Apply -> "3"-"4"
    - Analyze -> "4"-"5", Evaluate -> "5"-"6", Create -> "6"-"7"
  - [ ] Se bloom_target null: usar depth default

- [ ] **Task 5** (AC: 6) Validar backward compatibility
  - [ ] Testar WS1 com chapters sem campos WS2 (null)
  - [ ] Confirmar comportamento identico ao atual

- [ ] **Task 6** (AC: 7) Rodar testes E2E existentes
  - [ ] Rodar testes E2E do WS1
  - [ ] Todos devem passar sem alteracao

- [ ] **Task 7** (AC: implicitly all) Validar typecheck
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

Mudanca minima no WS1. O Orquestrador v2 ja recebe contexto do capitulo — basta ler os novos campos quando presentes.

```typescript
// No Orquestrador v2 — leitura condicional
const interactionType = chapter.interaction_type ?? 'socratic_dialogue'
const maxInteractions = TYPE_DEFAULTS[interactionType].turns

const bloomTarget = chapter.bloom_target
const expectedDepth = bloomTarget ? BLOOM_DEPTH_MAP[bloomTarget] : undefined
```

**Nota PO (Dual Assignment):** @data-engineer for SQL migration and Drizzle schema (Tasks 1-2), @dev for orchestrator integration (Tasks 3-7)

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@data-engineer (Dara)** | SQL migration + Drizzle schema (Tasks 1-2) |
| **@dev (Dex)** | Orquestrador integration (Tasks 3-7) |
| **@qa (QA)** | Testar backward compatibility |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | WS1 funciona com chapters sem campos WS2 | Yes |
| Pre-PR | WS1 ajusta comportamento quando campos WS2 presentes | Yes |
| Pre-PR | Testes E2E existentes passam | Yes |

### File Locations

```
supabase/migrations/
└── YYYYMMDD_add_ws2_fields_to_chapters.sql  # NOVO

packages/database/src/schema/
└── chapters.ts                        # ATUALIZAR

packages/agents/src/
└── orchestrator.ts                    # ATUALIZAR
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: NO-GO → GO após fixes — Título corrigido (3→2 campos); Assigned To: dual @data-engineer/@dev; Status Draft → Ready | Pax (PO) |

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
