# Story 16.1: Schemas Zod e Types para Novos Agentes

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 3
**Priority:** P0 (fundacao)
**Blocked By:** None
**Blocks:** Story 16.2, Story 16.3, Story 16.4
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** Zod schemas para Mestre, Polidor e Guardiao com output types,
**so that** os agentes produzam structured output validavel e tipado.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 6.1-6.3 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, Zod, AI SDK 6.0 |
| **Package** | `@eximia/agents` |
| **Existing Pattern** | `packages/agents/src/schemas/creator.ts` (seguir pattern) |
| **Risk** | LOW — schemas puros, sem side effects |

---

## Acceptance Criteria

- [ ] **AC1:** Schema `MestreOutput` em `packages/agents/src/schemas/mestre.ts`
  - `response.content` (string, 50-1500 chars)
  - `response.question_type` (enum: clarificacao, pressupostos, perspectiva, evidencia, consequencias, metacognicao)
  - `response.question_technique` (optional enum: paradoxal, temporal, inversao, essencia, permissao)
  - `response.depth_layer` (1-7)
  - `response.is_closing` (boolean)
  - `response.resistance_detected` (optional enum: intelectualizacao, deflexao, minimizacao, agressao, desistencia)
  - `response.emotional_calibration` (optional enum: confuso, defensivo, frustrado, insight)
  - `quality_checks` (7 booleans: no_direct_answer, no_labels, ends_with_question, single_question, connected_to_chapter, references_student_input, within_length_limit)
- [ ] **AC2:** Schema `PolidorOutput` em `packages/agents/src/schemas/polidor.ts`
  - `edited_response.content` (string, 80-1500 chars)
  - `edited_response.paragraph_count` (literal 2)
  - `edited_response.word_count` (optional number, 80-200)
  - `edited_response.ends_with_question` (literal true)
  - `changes_made` (optional: labels_removed, formatting_removed, paragraphs_restructured, content_condensed)
  - `quality_checks` (optional: no_labels, two_paragraphs, ends_with_question, within_word_limit, meaning_preserved)
- [ ] **AC3:** Schema `GuardiaoOutput` em `packages/agents/src/schemas/guardiao.ts`
  - `verdict` (enum: APPROVED, REJECTED)
  - `score` (number, 0.0-1.0)
  - `criteria_results` (7 criterios, cada um com pass, score, note)
  - `recommendation` (optional string)
- [ ] **AC4:** Types atualizados em `packages/agents/src/types.ts`
  - `AgentId` type inclui: mestre, polidor, guardiao, detector, perfilador (5 agentes — Detector e Perfilador sao Epic 17 mas Model Router 16.3 precisa dos 5)
  - `TenantPlan` type: essencial, standard, premium
  - `InteractionType` type: socratic_dialogue, quiz, scenario, assignment
  - `ModelSpec` interface: provider, model, api_key_env, max_retries, timeout_ms
  - `DepthLayer` type: 1 | 2 | 3 | 4 | 5 | 6 | 7 (opcional — melhora clareza para o dev)
- [ ] **AC5:** Todos os schemas exportados via barrel file `packages/agents/src/index.ts`
- [ ] **AC6:** `pnpm typecheck` passa sem erros

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar schema do Mestre
  - [ ] Criar `packages/agents/src/schemas/mestre.ts`
  - [ ] Definir `mestreResponseSchema` (nested: content, question_type enum, question_technique optional enum, depth_layer 1-7, is_closing boolean, resistance_detected optional enum, emotional_calibration optional enum)
  - [ ] Definir `mestreQualityChecksSchema` (7 booleans)
  - [ ] Definir `mestreOutputSchema` (response + quality_checks)
  - [ ] Exportar schema + types inferidos (`MestreOutput`, `MestreResponse`, `MestreQualityChecks`)

- [ ] **Task 2** (AC: 2) Criar schema do Polidor
  - [ ] Criar `packages/agents/src/schemas/polidor.ts`
  - [ ] Definir `polidorEditedResponseSchema` (content 80-1500, paragraph_count literal 2, word_count optional 80-200, ends_with_question literal true)
  - [ ] Definir `polidorChangesMadeSchema` (optional: labels_removed string[], formatting_removed string[], paragraphs_restructured boolean, content_condensed boolean)
  - [ ] Definir `polidorQualityChecksSchema` (optional: 5 booleans)
  - [ ] Definir `polidorOutputSchema` (edited_response + changes_made + quality_checks)
  - [ ] Exportar schema + types

- [ ] **Task 3** (AC: 3) Criar schema do Guardiao
  - [ ] Criar `packages/agents/src/schemas/guardiao.ts`
  - [ ] Definir `guardiaoCriterionResultSchema` (pass boolean, score 0-1, note optional string)
  - [ ] Definir `guardiaoCriteriaResultsSchema` (7 criterios nomeados: no_direct_answer, no_labels, ends_with_question, single_question, connected_to_chapter, references_student, within_limits)
  - [ ] Definir `guardiaoOutputSchema` (verdict enum APPROVED/REJECTED, score 0-1, criteria_results, recommendation optional)
  - [ ] Exportar schema + types

- [ ] **Task 4** (AC: 4) Atualizar types.ts
  - [ ] Adicionar `AgentId` type union: `"mestre" | "polidor" | "guardiao" | "detector" | "perfilador"` (5 agentes — Detector/Perfilador necessarios para Model Router 16.3)
  - [ ] Adicionar `TenantPlan` type: `"essencial" | "standard" | "premium"`
  - [ ] Adicionar `InteractionType` type: `"socratic_dialogue" | "quiz" | "scenario" | "assignment"`
  - [ ] Adicionar `ModelSpec` interface: `{ provider: "openai" | "deepseek" | "google", model: string, api_key_env: string, max_retries?: number, timeout_ms?: number }` (inclui "google" para fallback Gemini — Story 16.3)
  - [ ] Adicionar `RoutingContext` interface: `{ tenantPlan: TenantPlan, interactionType?: InteractionType }`

- [ ] **Task 5** (AC: 5) Atualizar barrel file
  - [ ] Adicionar exports em `packages/agents/src/index.ts` para mestre, polidor, guardiao schemas e types

- [ ] **Task 6** (AC: 6) Validar
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Existing Pattern Reference

Seguir o pattern de `packages/agents/src/schemas/creator.ts`:

```typescript
import { z } from "zod"

export const mestreOutputSchema = z.object({
  response: z.object({
    content: z.string().min(50).max(1500),
    question_type: z.enum(["clarificacao", "pressupostos", "perspectiva", "evidencia", "consequencias", "metacognicao"]),
    // ...
  }),
  quality_checks: z.object({
    no_direct_answer: z.boolean(),
    // ...
  }),
})

export type MestreOutput = z.infer<typeof mestreOutputSchema>
```

[Source: packages/agents/src/schemas/creator.ts — pattern existente]

### Schema Field Details

**Mestre — 6 question types** (Bloom taxonomy):
1. `clarificacao` — "O que voce quer dizer quando diz X?"
2. `pressupostos` — "Que suposicoes voce esta fazendo aqui?"
3. `perspectiva` — "Como alguem que discorda veria isso?"
4. `evidencia` — "Que evidencias sustentam essa crenca?"
5. `consequencias` — "Se isso for verdade, o que mais deve ser verdade?"
6. `metacognicao` — "Por que essa pergunta e importante para voce?"

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.1]

**Mestre — 5 question techniques**:
1. `paradoxal` — "Como o seu maior problema poderia ser sua maior solucao?"
2. `temporal` — "O que o voce de 80 anos diria sobre isso?"
3. `inversao` — "E se o problema fosse nao mudar nada?"
4. `essencia` — "Se tirassemos todas as camadas, o que sobraria?"
5. `permissao` — "O que voce se permitiria se soubesse que nao pode falhar?"

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.1]

**Mestre — 7 depth layers** (Hybrid Bloom + Socratic):
1. FATOS, 2. COMPREENSAO, 3. APLICACAO, 4. ANALISE, 5. PERSPECTIVA, 6. AVALIACAO, 7. SINTESE

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.1]

**Guardiao — 7 validation criteria**:
1. no_direct_answer, 2. no_labels, 3. ends_with_question, 4. single_question, 5. connected_to_chapter, 6. references_student, 7. within_limits

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.3]

### File Locations

```
packages/agents/src/schemas/
├── mestre.ts      # NOVO
├── polidor.ts     # NOVO
├── guardiao.ts    # NOVO
├── creator.ts     # EXISTENTE (referencia de pattern)
├── organizer.ts   # EXISTENTE
└── socrates.ts    # EXISTENTE (sera deletado no 16.7)

packages/agents/src/
├── types.ts       # ATUALIZAR
└── index.ts       # ATUALIZAR
```

### Testing

- Localizacao dos testes: `packages/agents/tests/schemas/`
- Framework: Vitest
- Pattern: testar valid + invalid inputs para cada schema
- Testes serao criados no Epic 19 (Story 19.2) — nao nesta story

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix: AgentId expandido para 5 agentes (detector+perfilador), ModelSpec provider inclui "google", DepthLayer type adicionado | Quinn (QA) + River (SM) |

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
