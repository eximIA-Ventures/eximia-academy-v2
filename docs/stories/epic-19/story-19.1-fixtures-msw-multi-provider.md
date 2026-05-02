# Story 19.1: Fixtures MSW Multi-Provider para Novos Agentes

**Epic:** [Epic 19 — Quality Framework & Testes](../../epics/epic-19-ws1-quality-framework-testes.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (fundacao testes)
**Blocked By:** Epic 16 (schemas dos agentes), Epic 17 (schemas Detector/Perfilador)
**Blocks:** Story 19.2, Story 19.3
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** fixtures tipadas para os 5 novos agentes e MSW handlers multi-provider,
**so that** testes E2E interceptem chamadas a OpenAI e DeepSeek corretamente.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 17.2-17.3, 17.6 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | MSW v2, Vitest, Playwright, Zod |
| **Existing MSW** | `apps/web/src/mocks/handlers.ts` (handler Anthropic existente) |
| **Existing Fixtures** | `apps/web/src/mocks/fixtures/` (Harven_* existentes) |
| **Risk** | LOW — fixtures e handlers, sem side effects em producao |

---

## Acceptance Criteria

- [ ] **AC1:** Fixtures criadas em `apps/web/src/mocks/fixtures/`:
  - `mestre.ts` — MestreOutput conforme schema (depth_layer, question_type, quality_checks)
  - `polidor.ts` — PolidorOutput conforme schema (2 paragrafos, ends_with_question)
  - `guardiao.ts` — GuardiaoOutput APPROVED (score 0.88, todos criterios pass)
  - `guardiao-rejected.ts` — GuardiaoOutput REJECTED (score 0.45, feedback para retry)
  - `detector.ts` — DetectorOutput conforme schema (cognitive_patterns, ai_detection, linguistic)
  - `perfilador.ts` — PerfiladorOutput conforme schema (Kolb, engagement, strengths)
- [ ] **AC2:** Fixtures tipadas com schemas Zod (import schema, validate fixture)
  - Cada fixture exporta dados que passam `.parse()` do schema correspondente
  - CI falha se schema muda sem atualizar fixture
- [ ] **AC3:** MSW handler `detectAgent()` atualizado:
  - `Eximia_Mestre` → mestreFixture
  - `Eximia_Polidor` → polidorFixture
  - `Eximia_Guardiao` → guardiaoFixture (ou rejected variant)
  - `Eximia_Detector` → detectorFixture
  - `Eximia_Perfilador` → perfiladorFixture
- [ ] **AC4:** MSW intercepta 2 endpoints adicionais:
  - `http.post("https://api.openai.com/v1/chat/completions", handler)`
  - `http.post("https://api.deepseek.com/v1/chat/completions", handler)`
  - Ambos usam formato OpenAI Chat Completions (DeepSeek e OpenAI-compatible)
- [ ] **AC5:** Handler Anthropic legado mantido durante transicao
  - `http.post("https://api.anthropic.com/v1/messages", legacyHandler)`
- [ ] **AC6:** Env vars adicionais no `playwright.config.ts`:
  - `OPENAI_API_KEY: "sk-e2e-mock-openai-not-real"`
  - `DEEPSEEK_API_KEY: "sk-e2e-mock-deepseek-not-real"`
- [ ] **AC7:** Coexistencia `Harven_*` + `Eximia_*` no handler (ambos funcionam)
- [ ] **AC8:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Criar fixtures tipadas
  - [ ] `apps/web/src/mocks/fixtures/mestre.ts` — MestreOutput valido
  - [ ] `apps/web/src/mocks/fixtures/polidor.ts` — PolidorOutput valido
  - [ ] `apps/web/src/mocks/fixtures/guardiao.ts` — GuardiaoOutput APPROVED (score 0.88)
  - [ ] `apps/web/src/mocks/fixtures/guardiao-rejected.ts` — GuardiaoOutput REJECTED (score 0.45)
  - [ ] `apps/web/src/mocks/fixtures/detector.ts` — DetectorOutput valido
  - [ ] `apps/web/src/mocks/fixtures/perfilador.ts` — PerfiladorOutput valido
  - [ ] Cada fixture: `import { schema } from '@eximia/agents'` + `schema.parse(data)` para validacao

- [ ] **Task 2** (AC: 3) Atualizar detectAgent()
  - [ ] Abrir `apps/web/src/mocks/handlers.ts`
  - [ ] Adicionar deteccao por `Eximia_*` identifiers
  - [ ] Manter deteccao por `Harven_*` identifiers (legado)
  - [ ] Fallback: creatorFixture (existente)

- [ ] **Task 3** (AC: 4) Adicionar MSW handlers multi-provider
  - [ ] Handler OpenAI: `http.post("https://api.openai.com/v1/chat/completions", openaiHandler)`
  - [ ] Handler DeepSeek: `http.post("https://api.deepseek.com/v1/chat/completions", deepseekHandler)`
  - [ ] Ambos usam mesma logica de `detectAgent()` (formato OpenAI Chat Completions)
  - [ ] Response format: `{ choices: [{ message: { content: JSON.stringify(fixture) } }] }`

- [ ] **Task 4** (AC: 5) Manter handler legado
  - [ ] Handler Anthropic: `http.post("https://api.anthropic.com/v1/messages", legacyHandler)`
  - [ ] NAO remover — coexiste com novos handlers

- [ ] **Task 5** (AC: 6) Atualizar playwright config
  - [ ] Adicionar `OPENAI_API_KEY` e `DEEPSEEK_API_KEY` fake no env do webServer

- [ ] **Task 6** (AC: 7, 8) Validar coexistencia
  - [ ] Testes existentes com Harven_* continuam passando
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Handler Multi-Provider Pattern

```typescript
// apps/web/src/mocks/handlers.ts
import { http, HttpResponse } from "msw"

function detectAgent(system: string): Record<string, unknown> {
  // Novo pipeline (Eximia)
  if (system.includes("Eximia_Mestre")) return mestreFixture
  if (system.includes("Eximia_Polidor")) return polidorFixture
  if (system.includes("Eximia_Guardiao")) return guardiaoFixture
  if (system.includes("Eximia_Detector")) return detectorFixture
  if (system.includes("Eximia_Perfilador")) return perfiladorFixture

  // Pipeline legado (Harven)
  if (system.includes("Harven_Socrates")) return socratesFixture
  if (system.includes("Harven_Editor")) return editorFixture
  if (system.includes("Harven_Tester")) return testerFixture
  if (system.includes("Harven_Analyst")) return analystFixture
  if (system.includes("Harven_Creator")) return creatorFixture

  return creatorFixture // fallback
}

const openaiCompatibleHandler = async ({ request }: { request: Request }) => {
  const body = await request.json()
  const system = body.messages?.find((m: any) => m.role === 'system')?.content ?? ''
  const fixture = detectAgent(system)

  return HttpResponse.json({
    id: "mock-completion",
    object: "chat.completion",
    choices: [{
      index: 0,
      message: { role: "assistant", content: JSON.stringify(fixture) },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  })
}

export const handlers = [
  http.post("https://api.openai.com/v1/chat/completions", openaiCompatibleHandler),
  http.post("https://api.deepseek.com/v1/chat/completions", openaiCompatibleHandler),
  http.post("https://api.anthropic.com/v1/messages", legacyAnthropicHandler),
]
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 17.3]

### Fixture Validation Pattern

```typescript
// apps/web/src/mocks/fixtures/mestre.ts
import { mestreOutputSchema } from '@eximia/agents'

export const mestreFixture = {
  depth_layer: 4,
  question_type: "perspectiva",
  // ... campos completos
}

// Validacao em build time (CI falha se schema muda)
mestreOutputSchema.parse(mestreFixture)
```

### Existing MSW Pattern

O projeto ja usa MSW v2 `setupServer` ativado via `instrumentation.ts` com `E2E_TESTING=true`. O handler Anthropic existente e referencia para o pattern.

[Source: apps/web/src/mocks/handlers.ts, apps/web/src/instrumentation.ts]

### File Locations

```
apps/web/src/mocks/fixtures/
├── mestre.ts              # NOVO
├── polidor.ts             # NOVO
├── guardiao.ts            # NOVO
├── guardiao-rejected.ts   # NOVO
├── detector.ts            # NOVO
└── perfilador.ts          # NOVO

apps/web/src/mocks/
└── handlers.ts            # ATUALIZAR (multi-provider + Eximia_*)

apps/web/
└── playwright.config.ts   # ATUALIZAR (env vars)
```

### Testing

- Fixtures validam contra schemas Zod (CI falha se inconsistente)
- Testes E2E (Story 19.3, 19.4) usam estas fixtures

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |

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
