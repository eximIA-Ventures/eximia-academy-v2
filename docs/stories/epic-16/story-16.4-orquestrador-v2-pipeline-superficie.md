# Story 16.4: Orquestrador v2 — Pipeline de Superficie

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (core)
**Blocked By:** Story 16.2 (prompts), Story 16.3 (model router)
**Blocks:** Story 16.5, Story 16.6
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** um Orquestrador v2 que executa o pipeline Mestre → Polidor → Guardiao com retry loop,
**so that** o aluno receba respostas socraticas validadas com qualidade garantida.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 3, 5 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, AI SDK 6.0 (`generateObject`), Sentry |
| **Package** | `@eximia/agents` |
| **Existing File** | `packages/agents/src/orchestrator.ts` (REESCREVER) |
| **Risk** | HIGH — substitui pipeline inteiro, ponto central do sistema |

---

## Acceptance Criteria

- [ ] **AC1:** `orchestrateSocraticDialogueV2()` em `packages/agents/src/orchestrator.ts`
  - Recebe: mensagem do aluno, historico, contexto do capitulo, perfil do aluno, config de interacao
  - Executa pipeline: Mestre → Polidor → Guardiao
  - Usa Model Router para selecionar modelo por agente
- [ ] **AC2:** Retry loop funcional
  - Se Guardiao REJECTED: feedback vai ao Mestre com `recommendation`
  - Maximo 2 retries (configuravel)
  - Mantem best response (maior score) entre tentativas
  - Warning se max retries excedido (nunca falha silenciosamente)
- [ ] **AC3:** Output final contem:
  - `response` (string — texto polido e aprovado)
  - `mestreOutput` (output completo do Mestre — depth_layer, question_type, etc.)
  - `guardiaoOutput` (verdict, score, criteria)
  - `retryCount` (quantas tentativas foram necessarias)
  - `modelUsed` (provider + model para cada agente)
- [ ] **AC4:** Integracao com AI SDK `generateObject` para cada agente
- [ ] **AC5:** Sentry spans por agente (reutilizar pattern existente)
- [ ] **AC6:** Hook para pipeline shadow (preparar para Epic 17)
  - Emitir dados necessarios para Detector e Perfilador
  - Nao bloquear resposta de superficie
- [ ] **AC7:** Fallback: se todos os retries falharem, retorna best response com warning

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 3) Definir interfaces de resultado
  - [ ] Definir `OrchestratorV2Input` interface em orchestrator.ts (separada do `OrchestratorInput` existente — coexistem ate Story 16.7 remover v1)
  - [ ] Definir `OrchestratorV2Result` interface:
    ```typescript
    interface OrchestratorV2Result {
      response: string
      mestreOutput: MestreOutput
      guardiaoOutput: GuardiaoOutput
      retryCount: number
      modelUsed: Record<AgentId, ModelSpec>
      shadowData?: {
        studentMessage: string
        mestreResponse: string
        sessionHistory: ConversationMessage[]
        chapterContent: string
      }
    }
    ```

- [ ] **Task 2** (AC: 1, 4, 5) Implementar pipeline sequencial
  - [ ] Implementar `runMestre(input, config, feedback?)` com Sentry span
    - Usa `generateObject` com `mestreOutputSchema`
    - Model via `getModel("mestre", context)`
    - System prompt via `buildMestrePrompt(context)`
    - User message: mensagem do aluno
  - [ ] Implementar `runPolidor(mestreOutput, config)` com Sentry span
    - Usa `generateObject` com `polidorOutputSchema`
    - Model via `getModel("polidor", context)`
    - System prompt: `POLIDOR_SYSTEM_PROMPT`
    - User message: output do Mestre
  - [ ] Implementar `runGuardiao(polidorOutput, config)` com Sentry span
    - Usa `generateObject` com `guardiaoOutputSchema`
    - Model via `getModel("guardiao", context)`
    - System prompt: `GUARDIAO_SYSTEM_PROMPT`
    - User message: output do Polidor + contexto original

- [ ] **Task 3** (AC: 2, 7) Implementar retry loop
  - [ ] Loop `for (attempt = 0; attempt <= maxRetries; attempt++)`
  - [ ] Se APPROVED: retornar resultado imediatamente
  - [ ] Se REJECTED: capturar `recommendation`, passar como feedback ao Mestre na proxima iteracao
  - [ ] Tracking de bestResponse (maior score entre tentativas)
  - [ ] Se max retries excedido: retornar bestResponse com `warning: true`

- [ ] **Task 4** (AC: 1) Implementar funcao principal
  - [ ] Implementar `orchestrateSocraticDialogueV2(input, config?)` que orquestra tudo
  - [ ] Config default: `{ maxRetries: 2, timeoutMs: 30000 }`
  - [ ] Merge com config parcial do caller

- [ ] **Task 5** (AC: 6) Preparar hook shadow
  - [ ] Emitir `shadowData` no resultado (mensagem aluno, resposta mestre, historico, conteudo capitulo)
  - [ ] Nao executar nenhum pipeline shadow nesta story — apenas preparar os dados
  - [ ] Comentario no codigo: `// Shadow pipeline — Epic 17`

- [ ] **Task 6** Atualizar barrel file e validar
  - [ ] Exportar `orchestrateSocraticDialogueV2` em index.ts
  - [ ] Manter export do `orchestrateSocraticDialogue` antigo (sera removido na 16.7)
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Existing Orchestrator Pattern

O orquestrador existente em `packages/agents/src/orchestrator.ts` usa:

```typescript
import * as Sentry from "@sentry/nextjs"
import { generateObject } from "ai"

export async function orchestrateSocraticDialogue(input, config) {
  const result = await Sentry.startSpan(
    { name: "agent.Socrates", op: "ai.pipeline" },
    async (span) => {
      span.setAttribute("agent.name", "Socrates")
      return await generateObject({
        model: openai("gpt-4.1"),
        system: SOCRATES_SYSTEM_PROMPT,
        prompt: userMessage,
        schema: socratesOutputSchema,
        abortSignal: AbortSignal.timeout(120_000),
      })
    }
  )
  // ... retry with Editor + Tester ...
}
```

**Mudancas do v2**:
- Pipeline muda de Socrates→Editor→Tester para Mestre→Polidor→Guardiao
- Model Router seleciona modelo por agente + plano (em vez de hardcoded)
- Retry loop baseado no verdict do Guardiao (em vez do Tester)
- Shadow data emitido para Epic 17

[Source: packages/agents/src/orchestrator.ts — pattern existente]

### Sentry Span Pattern

```typescript
const mestreResult = await Sentry.startSpan(
  { name: "agent.Mestre", op: "ai.pipeline" },
  async (span) => {
    span.setAttribute("agent.name", "Mestre")
    span.setAttribute("agent.step", 1)
    span.setAttribute("agent.model", modelSpec.model)
    span.setAttribute("agent.plan", context.tenantPlan)
    return await generateObject({ ... })
  }
)
```

[Source: packages/agents/src/orchestrator.ts — reutilizar pattern]

### generateObject Pattern

```typescript
const { object } = await generateObject({
  model: getModel("mestre", routingContext),
  system: buildMestrePrompt(promptContext),
  prompt: studentMessage,
  schema: mestreOutputSchema,
  abortSignal: AbortSignal.timeout(config.timeoutMs),
})
```

[Source: packages/agents/src/creator.ts — pattern de `generateObject` com Zod]

### File Locations

```
packages/agents/src/
├── orchestrator.ts    # REESCREVER (manter export antigo + novo v2)
├── model-router.ts    # Criado na 16.3
├── types.ts           # Atualizado na 16.1
├── prompts/mestre.ts  # Criado na 16.2
├── prompts/polidor.ts # Criado na 16.2
├── prompts/guardiao.ts # Criado na 16.2
├── schemas/mestre.ts  # Criado na 16.1
├── schemas/polidor.ts # Criado na 16.1
└── schemas/guardiao.ts # Criado na 16.1
```

### Testing

- Testes do orquestrador serao criados no Epic 19 (Story 19.2)
- ~10 testes: happy path, retry 1x, max retries, shadow parallel, shadow failure tolerant, fechamento

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix: OrchestratorV2Input definido em orchestrator.ts (coexiste com v1 ate 16.7) | Quinn (QA) + River (SM) |

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
