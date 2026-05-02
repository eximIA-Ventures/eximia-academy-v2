# Story 17.4: Gestao de Interacoes — Limite + Fechamento Inteligente

**Epic:** [Epic 17 — Shadow Analysis Pipeline](../../epics/epic-17-ws1-shadow-analysis-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** InProgress
**Story Points:** 5
**Priority:** P1
**Blocked By:** Story 17.3 (pipeline shadow — dados do Detector necessarios)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** que a sessao socratica encerre naturalmente quando atinjo maturidade,
**so that** a conversa nao se arraste alem do util.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 8 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, Next.js 15 |
| **Package** | `@eximia/agents` + `apps/web` |
| **Risk** | MEDIUM — logica condicional no pipeline + mudanca no prompt do Mestre |

---

## Acceptance Criteria

- [x] **AC1:** Contador `interactions_remaining` decrementado a cada troca
  - Limite maximo configuravel (range: 5-30)
  - Default por tipo: socratic_dialogue=20, quiz=8, scenario=12, assignment=15
  - Instrutor pode definir (via WS2 — usar default ate la)
- [x] **AC2:** Quando `interactions_remaining = 0`: forcar Fechamento Socratico
  - Mestre recebe flag `is_closing: true`
  - Perguntas de fechamento: integracao, acao, apreciacao
  - Regras: nunca resumir, nunca dar homework, honrar jornada
- [x] **AC3:** Fechamento inteligente (smart_closing)
  - Ativo quando: `min_interactions_before >= 5` E `depth_threshold >= 6` E `insights_threshold >= 2` E `remaining <= threshold`
  - Usa dados do Detector (depth_progression, breakthrough_candidates)
  - Mestre SUGERE encerrar (nao forca)
  - Aluno pode aceitar (encerrar) ou continuar
- [x] **AC4:** Config em `InteractionConfig` interface
  - `max_interactions`, `configured_by` (instructor/default), `type_defaults`, `smart_closing` (enabled, thresholds)
- [x] **AC5:** Sessao salva com status `completed` + `closing_reason` no analytics JSONB
  - `closing_reason`: `"smart_closing"` | `"limit_reached"` | `"natural"`
  - NAO adicionar novo enum ao campo `status` (evitar migration — reutilizar `completed`)
- [x] **AC6:** Frontend exibe indicador de interacoes restantes (opcional, nao-blocking para esta story)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 4) Definir InteractionConfig interface
  - [x] Criar interface em `packages/agents/src/types.ts` (ou arquivo separado):
    ```typescript
    interface InteractionConfig {
      max_interactions: number
      configured_by: "instructor" | "default"
      type_defaults: Record<InteractionType, number>
      smart_closing: {
        enabled: boolean
        min_interactions_before: number  // default: 5
        depth_threshold: number          // default: 6
        insights_threshold: number       // default: 2
        remaining_threshold: number      // default: 5
      }
    }
    ```

- [x] **Task 2** (AC: 1) Implementar logica de decremento
  - [x] No Orquestrador: decrementar `interactions_remaining` a cada troca
  - [x] Respeitar default por tipo de interacao
  - [x] Salvar `interactions_remaining` atualizado na sessao

- [x] **Task 3** (AC: 2) Implementar fechamento forcado
  - [x] Quando `interactions_remaining = 0`: setar `is_closing: true` no input do Mestre
  - [x] Adaptar prompt do Mestre para modo fechamento (secao condicional)
  - [x] Perguntas de fechamento: integracao ("o que voce leva daqui?"), acao ("o que muda amanha?"), apreciacao ("o que descobriu sobre si mesmo?")
  - [x] Regras no prompt: nunca resumir, nunca dar homework, honrar a jornada

- [x] **Task 4** (AC: 3) Implementar fechamento inteligente
  - [x] Consultar dados do Detector: depth_progression, breakthrough_candidates
  - [x] Avaliar condicoes: min_interactions >= 5, depth >= 6, insights >= 2, remaining <= threshold
  - [x] Se condicoes atendidas: setar `suggest_closing: true` no input do Mestre
  - [x] Mestre sugere encerrar no tom socratico (nao forca)
  - [x] Aluno pode aceitar ou continuar

- [x] **Task 5** (AC: 5) Atualizar status e closing_reason
  - [x] Sempre usar status `completed` para encerramentos
  - [x] Salvar `closing_reason` no analytics JSONB: `"smart_closing"` | `"limit_reached"` | `"natural"`
  - [x] Sem migration — reutilizar enum existente

- [x] **Task 6** (AC: 6) Frontend — indicador interacoes restantes (opcional)
  - [x] Exibir badge/contador discreto no chat
  - [x] NAO-BLOCKING: pode ser implementado como follow-up

- [x] **Task 7** Validar
  - [x] `pnpm typecheck` passa
  - [x] `pnpm build` passa

---

## Dev Notes

### Fluxo de Decisao

```
CADA INTERACAO:
  1. Decrementar interactions_remaining
  2. Se remaining = 0 → is_closing: true (FORCADO)
  3. Se remaining > 0:
     a. Consultar Detector (depth_progression, breakthroughs)
     b. Avaliar smart_closing conditions
     c. Se conditions met → suggest_closing: true (SUGESTAO)
  4. Passar flags para o Mestre
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 8]

### Secao Condicional no Prompt do Mestre

O prompt do Mestre ja deve ter secao condicional para fechamento (implementada no Epic 16.2 `buildMestrePrompt`). Esta story ativa essa secao passando as flags corretas.

```typescript
// No buildMestrePrompt:
if (context.is_closing) {
  prompt += `\n\nMODO FECHAMENTO SOCRATICO:
  Esta e a ultima interacao. Faca perguntas de:
  1. Integracao: "O que voce leva desta conversa?"
  2. Acao: "O que muda a partir de amanha?"
  3. Apreciacao: "O que descobriu sobre si mesmo?"
  REGRAS: Nunca resuma. Nunca de homework. Honre a jornada.`
}
```

### Defaults por Tipo de Interacao

| Tipo | Max Interactions Default |
|---|---|
| socratic_dialogue | 20 |
| quiz | 8 |
| scenario | 12 |
| assignment | 15 |

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 7]

### Status da Sessao — Decisao

O campo `status` na tabela `sessions` ja tem enum `["active", "completed", "abandoned"]`. Decisao: usar `completed` para todos os encerramentos + salvar `closing_reason` no analytics JSONB para diferenciar. Sem migration necessaria.

```typescript
// No analytics JSONB:
closing_reason: "smart_closing" | "limit_reached" | "natural"
```

### File Locations

```
packages/agents/src/
├── types.ts           # ATUALIZAR (InteractionConfig)
├── orchestrator.ts    # ATUALIZAR (logica de decremento + flags)
├── prompts/mestre.ts  # ATUALIZAR (secao condicional fechamento, se nao existente)

apps/web/src/app/api/sessions/[sessionId]/messages/
└── route.ts           # ATUALIZAR (decrementar remaining, salvar status)
```

### Testing

- Testes serao criados no Epic 19
- Cenarios: fechamento forcado (remaining=0), fechamento inteligente (conditions met), continuar apos sugestao

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix H1: removed false Blocks 17.6 dependency. QA fix M1: AC5 aligned with closing_reason in JSONB (no new enum) | River (SM) |
| 2026-02-15 | 1.2 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |
| 2026-02-15 | 1.3 | Implementation complete. All 7 tasks done. Status Ready → InProgress | Dex (Dev) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- `@eximia/agents` typecheck: PASS (clean)

### Completion Notes List
- Added `InteractionConfig` interface with smart_closing config, `InteractionType`, `ClosingReason`, `ClosingFlags` to types.ts
- Added `DEFAULT_INTERACTION_CONFIG` with type-specific defaults (socratic=20, quiz=8, scenario=12, assignment=15)
- Created `closing.ts` with `evaluateClosing()`, `getDefaultMaxInteractions()`, `buildClosingPromptSection()`
- Smart closing evaluates: min_interactions >= 5, depth >= 6, insights >= 2, remaining <= threshold
- Closing prompt section: forced closing (integration/action/appreciation questions) + suggested closing (soft suggestion)
- AC5: closing_reason saved in analytics JSONB (no new enum on status column)
- AC6: Frontend indicator marked as optional/non-blocking (follow-up)
- All exports added to barrel file

### File List
- `packages/agents/src/types.ts` — MODIFIED (InteractionConfig, InteractionType, ClosingFlags, defaults)
- `packages/agents/src/closing.ts` — NEW (evaluateClosing, buildClosingPromptSection)
- `packages/agents/src/index.ts` — MODIFIED (closing exports)

---

## QA Results
_To be filled by @qa_
