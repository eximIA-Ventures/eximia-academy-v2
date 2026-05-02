# Story 19.2: Unit Tests — Schemas, Model Router e Orchestrator

**Epic:** [Epic 19 — Quality Framework & Testes](../../epics/epic-19-ws1-quality-framework-testes.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (core quality)
**Blocked By:** Epic 16 (schemas, model router, orchestrator), Epic 17 (Detector/Perfilador schemas). Nota: NAO depende de 19.1 — unit tests mockam generateObject diretamente, nao usam MSW fixtures
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** testes unitarios para schemas Zod, Model Router e Orchestrator v2,
**so that** a logica core do pipeline seja validada automaticamente.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 17.4-17.5 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Vitest, Zod |
| **Package** | `@eximia/agents` |
| **Existing Config** | `packages/agents/vitest.config.ts` |
| **Risk** | LOW — testes puros, sem side effects |

---

## Acceptance Criteria

- [ ] **AC1:** Schema tests (~30 testes) em `packages/agents/tests/schemas/`:
  - `mestre.test.ts` — MestreOutput: valid + invalid (depth_layer fora de range, content vazio, question_type invalido)
  - `polidor.test.ts` — PolidorOutput: valid + paragraph_count != 2 + ends_with_question false
  - `guardiao.test.ts` — GuardiaoOutput: APPROVED valid + REJECTED valid + score fora de range
  - `detector.test.ts` — DetectorOutput: valid + probability fora de range + verdict invalido
  - `perfilador.test.ts` — PerfiladorOutput: valid + kolb axes fora de range + confidence > 1
- [ ] **AC2:** Model Router tests (~25 testes) em `packages/agents/tests/model-router.test.ts`:
  - Tabela de decisao exaustiva: 15 combinacoes (5 agentes x 3 planos)
  - Override por interaction_type: Standard quiz → mini, Standard socratic → gpt-4.1, Premium quiz → gpt-4.1
  - Guardiao invariant: sempre gpt-4.1 em todos os planos
  - Fallback chain: OpenAI down → DeepSeek, DeepSeek down → gpt-4.1-nano, all down → throws
- [ ] **AC3:** Orchestrator v2 tests (~10 testes) em `packages/agents/tests/orchestrator-v2.test.ts`:
  - Happy path: Mestre → Polidor → Guardiao APPROVED
  - Retry 1x: Guardiao REJECTED → feedback → APPROVED na 2a tentativa
  - Max retries: 2x REJECTED → mantem best response + warning
  - Shadow parallel: Detector + Perfilador rodam em paralelo
  - Shadow failure tolerant: Detector falha → superficie continua
  - Fechamento inteligente: Mestre `is_closing: true` → resultado correto
- [ ] **AC4:** Prompt tests (~10 testes) em `packages/agents/tests/prompts/`:
  - Identifier `Eximia_Mestre` presente no prompt
  - Identifier `Eximia_Polidor` presente
  - Identifier `Eximia_Guardiao` presente
  - Identifier `Eximia_Detector` presente
  - Identifier `Eximia_Perfilador` presente
  - Context injection: conteudo do capitulo injetado corretamente
  - Context injection: perfil do aluno injetado se existente
  - Context injection: feedback do Guardiao injetado se retry
- [ ] **AC5:** Todos os testes passam com `pnpm test`
- [ ] **AC6:** Coverage minimo: 80% nos arquivos testados

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Schema tests
  - [ ] Criar `packages/agents/tests/schemas/mestre.test.ts` (~6 testes)
  - [ ] Criar `packages/agents/tests/schemas/polidor.test.ts` (~6 testes)
  - [ ] Criar `packages/agents/tests/schemas/guardiao.test.ts` (~6 testes)
  - [ ] Criar `packages/agents/tests/schemas/detector.test.ts` (~6 testes)
  - [ ] Criar `packages/agents/tests/schemas/perfilador.test.ts` (~6 testes)
  - [ ] Cada test file: valid input, boundary values, invalid types, missing fields

- [ ] **Task 2** (AC: 2) Model Router tests
  - [ ] Criar `packages/agents/tests/model-router.test.ts`
  - [ ] Tabela de decisao com `it.each` (15 combinacoes):
    ```typescript
    const cases: Array<[TenantPlan, AgentId, string, string]> = [
      ["essencial", "mestre", "openai", "gpt-4.1-mini"],
      // ... 15 combinacoes
    ]
    ```
  - [ ] Override tests: Standard + quiz → mini, Premium + quiz → gpt-4.1
  - [ ] Guardiao invariant: always gpt-4.1 regardless of plan
  - [ ] Fallback chain tests (mock provider failure)

- [ ] **Task 3** (AC: 3) Orchestrator v2 tests
  - [ ] Criar `packages/agents/tests/orchestrator-v2.test.ts`
  - [ ] Mock `generateObject` do AI SDK
  - [ ] Happy path: pipeline completo sem retries
  - [ ] Retry 1x: REJECTED → feedback → APPROVED
  - [ ] Max retries: 2x REJECTED → best response + warning
  - [ ] Shadow parallel: verify Detector + Perfilador called
  - [ ] Shadow failure: Detector throws → superficie retorna normalmente
  - [ ] Fechamento: is_closing flag passada corretamente

- [ ] **Task 4** (AC: 4) Prompt tests
  - [ ] Criar `packages/agents/tests/prompts/mestre-prompt.test.ts`
  - [ ] Criar testes para cada identifier Eximia_*
  - [ ] Context injection tests: capitulo, perfil, feedback
  - [ ] Verificar que prompts nao contem texto em ingles (devem ser em portugues BR)

- [ ] **Task 5** (AC: 5, 6) Executar e validar coverage
  - [ ] `pnpm test` passa
  - [ ] Coverage >= 80% em schemas/, model-router.ts, orchestrator.ts, prompts/

---

## Dev Notes

### Model Router — Tabela Exaustiva

```typescript
describe("Model Router - Routing Table", () => {
  const cases: Array<[TenantPlan, AgentId, string, string]> = [
    // Essencial
    ["essencial", "mestre",     "openai",   "gpt-4.1-mini"],
    ["essencial", "polidor",    "deepseek", "deepseek-chat"],
    ["essencial", "guardiao",   "openai",   "gpt-4.1"],
    ["essencial", "detector",   "deepseek", "deepseek-chat"],
    ["essencial", "perfilador", "deepseek", "deepseek-chat"],
    // Standard
    ["standard", "mestre",     "openai",   "gpt-4.1"],
    ["standard", "polidor",    "deepseek", "deepseek-chat"],
    ["standard", "guardiao",   "openai",   "gpt-4.1"],
    ["standard", "detector",   "deepseek", "deepseek-chat"],
    ["standard", "perfilador", "deepseek", "deepseek-chat"],
    // Premium
    ["premium", "mestre",     "openai", "gpt-4.1"],
    ["premium", "polidor",    "openai", "gpt-4.1-mini"],
    ["premium", "guardiao",   "openai", "gpt-4.1"],
    ["premium", "detector",   "openai", "gpt-4.1-mini"],
    ["premium", "perfilador", "openai", "gpt-4.1-mini"],
  ]

  it.each(cases)(
    "plan=%s agent=%s → provider=%s model=%s",
    (plan, agent, expectedProvider, expectedModel) => {
      const result = getModelSpec(agent, { tenantPlan: plan })
      expect(result.provider).toBe(expectedProvider)
      expect(result.model).toBe(expectedModel)
    }
  )
})
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 17.4]

### Orchestrator Mock Pattern

```typescript
// Mock generateObject
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

const mockGenerateObject = vi.mocked(generateObject)

// Happy path
mockGenerateObject
  .mockResolvedValueOnce({ object: mestreFixture })  // Mestre
  .mockResolvedValueOnce({ object: polidorFixture })  // Polidor
  .mockResolvedValueOnce({ object: guardiaoFixture }) // Guardiao APPROVED
```

### File Locations

```
packages/agents/tests/
├── schemas/
│   ├── mestre.test.ts           # NOVO (~6 testes)
│   ├── polidor.test.ts          # NOVO (~6 testes)
│   ├── guardiao.test.ts         # NOVO (~6 testes)
│   ├── detector.test.ts         # NOVO (~6 testes)
│   └── perfilador.test.ts       # NOVO (~6 testes)
├── model-router.test.ts         # NOVO (~25 testes)
├── orchestrator-v2.test.ts      # NOVO (~10 testes)
└── prompts/
    ├── mestre-prompt.test.ts    # NOVO
    ├── polidor-prompt.test.ts   # NOVO
    └── ...                      # NOVO
```

### Testing

- Total estimado: ~75 testes (30 schemas + 25 router + 10 orchestrator + 10 prompts)
- Framework: Vitest (ja configurado em `packages/agents/vitest.config.ts`)
- Coverage tool: `vitest --coverage`

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix M4: corrected Blocked By from 19.1 to Epic 16+17 (unit tests dont need MSW fixtures) | River (SM) |
| 2026-02-15 | 1.2 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |

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
