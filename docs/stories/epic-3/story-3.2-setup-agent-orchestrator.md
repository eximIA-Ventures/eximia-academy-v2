# Story 3.2: Setup do Agent Orchestrator (packages/agents)

**Epic:** [Epic 3 — Socratic Learning Engine](../epics/epic-3-socratic-learning-engine.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Done
**Story Points:** 13
**Priority:** P0 (Blocker)
**Blocked By:** Epic 2 Story 2.3 (packages/agents inicializado)
**Blocks:** 3.4
**Assigned To:** @dev (Dex)

---

## User Story

**As a** developer,
**I want** o orchestrator de agentes configurado com prompts e schemas dos 4 agentes socraticos,
**so that** o pipeline socratico possa ser chamado via API.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.3 — Section 7 (Agent Orchestrator), Section 7.3 (Pipeline Pattern) |
| **Benchmark Ref** | `docs/benchmark-agentes-socraticos.md` — Socrates (9.2), Editor (9.3), Tester, Analyst |
| **Benchmark Prompts** | `Benchmarks/Agentes/Harven_*/03_prompt/prompt_operacional.md` |
| **Benchmark Schemas** | `Benchmarks/Agentes/Harven_*/03_prompt/schemas/` (input_schema.json + output_schema.json) |
| **Stack** | Vercel AI SDK + `@ai-sdk/anthropic` + Zod |
| **Package** | `packages/agents` (inicializado em Epic 2, Story 2.3 — Creator Agent) |
| **Model** | `claude-sonnet-4-5-20250929` (default, configuravel) |

---

## Acceptance Criteria

- [x] **AC1:** System prompts dos 4 agentes migrados literalmente de `Benchmarks/Agentes/Harven_*/03_prompt/prompt_operacional.md` para `packages/agents/src/prompts/` (socrates.ts, editor.ts, tester.ts, analyst.ts)

- [x] **AC2:** Schemas I/O de cada agente tipados com Zod em `packages/agents/src/schemas/` conforme `Benchmarks/Agentes/Harven_*/03_prompt/schemas/` (input_schema.json + output_schema.json)

- [x] **AC3:** Pipeline executor `orchestrateSocraticDialogue()` que encadeia: Socrates → Editor → Tester com retry logic

- [x] **AC4:** Funcao `runAnalyst()` separada que roda em paralelo (nao bloqueia pipeline principal)

- [x] **AC5:** Retry logic: se Tester retorna `REJECTED`, re-executa Socrates → Editor → Tester (max 2 retries). Na 3a rejeicao, retorna melhor resposta disponivel com flag de warning

- [x] **AC6:** Timeout de 30s por agente — se exceder, lanca `AgentTimeoutError` com nome do agente

- [x] **AC7:** Integracao com Vercel AI SDK + Anthropic provider (`@ai-sdk/anthropic`) usando `generateText()`

- [x] **AC8:** Testes unitarios para cada schema Zod (validacao de input/output com dados reais dos benchmarks)

- [x] **AC9:** Export principal: `orchestrateSocraticDialogue(input) → { response, qaReport, retryCount }` e `runAnalyst(input) → AnalysisResult`

- [x] **AC10:** Cada agente recebe contexto correto conforme contratos I/O do benchmark:
  - Socrates: `session_context` (chapter_content, initial_question, interactions_remaining, **conversation_history**: array de mensagens anteriores student+tutor) + `student_message`
  - Editor: `socrates_response` (resposta bruta)
  - Tester: `edited_response` + `context` (chapter_title, student_message)
  - Analyst: `student_message` + `context` (chapter_id, turn_number) + `interaction_metadata` (session_id, timestamp)

- [x] **AC11:** Model configuravel por agente via `AgentPipelineConfig` (default: `claude-sonnet-4-5-20250929`)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Migrar system prompts para `packages/agents/src/prompts/`
  - [x] `socrates.ts`: migrar literalmente de `Benchmarks/Agentes/Harven_Socrates/03_prompt/prompt_operacional.md`
  - [x] `editor.ts`: migrar literalmente de `Benchmarks/Agentes/Harven_Editor/03_prompt/prompt_operacional.md`
  - [x] `tester.ts`: migrar literalmente de `Benchmarks/Agentes/Harven_Tester/03_prompt/prompt_operacional.md`
  - [x] `analyst.ts`: migrar literalmente de `Benchmarks/Agentes/Harven_Analyst/03_prompt/prompt_operacional.md`
  - [x] Export cada prompt como `const` string (template literal)

- [x] **Task 2** (AC: 2) Criar Zod schemas em `packages/agents/src/schemas/`
  - [x] `socrates.ts`: input (session_context + student_message + conversation_history) + output (response text)
  - [x] `editor.ts`: input (socrates_response) + output (edited_response)
  - [x] `tester.ts`: input (edited_response + context) + output (verdict, score, criteria_results, recommendation)
  - [x] `analyst.ts`: input (student_message + context + interaction_metadata) + output (ai_detection, metrics, flags, observations)
  - [x] Converter JSON schemas de `Benchmarks/Agentes/Harven_*/03_prompt/schemas/` para Zod

- [x] **Task 3** (AC: 6) Criar tipos de erro em `packages/agents/src/errors.ts`
  - [x] `AgentTimeoutError`: extends Error, includes agent name
  - [x] `AgentInvalidOutputError`: extends Error, includes agent name + validation errors
  - [x] `PipelineMaxRetriesError`: extends Error, includes retry count + best response

- [x] **Task 4** (AC: 3, 7) Implementar `PipelineStep` interface conforme architecture.md Section 7.3
  - [x] Interface: `PipelineStep<TInput, TOutput>` com `name`, `execute`, `timeout`, `retryable`
  - [x] `socratesStep`: chamada Vercel AI SDK `generateText()` com system prompt + Zod output schema
  - [x] `editorStep`: chamada `generateText()` com Editor prompt
  - [x] `testerStep`: chamada `generateText()` com Tester prompt, retorna verdict + score

- [x] **Task 5** (AC: 3, 5, 6) Implementar pipeline executor `orchestrateSocraticDialogue()` em `packages/agents/src/orchestrator.ts`
  - [x] Sequencia: Socrates → Editor → Tester
  - [x] Retry: se Tester REJECTED, loop Socrates → Editor → Tester (max 2 retries)
  - [x] Na 3a rejeicao: retornar melhor resposta (highest score) com `warning: true`
  - [x] Timeout: 30s por agente via `AbortController` ou `Promise.race`
  - [x] Feedback do Tester enviado ao Socrates como contexto adicional no retry
  - [x] Return: `{ response, qaReport, retryCount }`

- [x] **Task 6** (AC: 4) Implementar `runAnalyst()` em `packages/agents/src/analyst.ts`
  - [x] Funcao standalone que roda em paralelo (chamada com `Promise`, awaited depois)
  - [x] Return: `AnalysisResult` (ai_detection score, metrics, flags, observations)

- [x] **Task 7** (AC: 11) Implementar `AgentPipelineConfig`
  - [x] Config type: `{ model: string, maxRetries: number, timeoutMs: number }`
  - [x] Defaults: `{ model: 'claude-sonnet-4-5-20250929', maxRetries: 2, timeoutMs: 30000 }`
  - [x] Cada agente pode ter model override

- [x] **Task 8** (AC: 8) Testes unitarios — schemas
  - [x] Test cada Zod schema com dados validos (usar exemplos de `Benchmarks/Agentes/Harven_*/04_validation/`)
  - [x] Test cada schema com dados invalidos (missing fields, wrong types)

- [x] **Task 9** (AC: 3, 5) Testes unitarios — pipeline
  - [x] Test fluxo normal: Socrates → Editor → Tester APPROVED → return response
  - [x] Test retry 1x: Tester REJECTED → Socrates → Editor → Tester APPROVED
  - [x] Test retry 2x: Tester REJECTED 2x → APPROVED on 3rd try
  - [x] Test max retries fallback: Tester REJECTED 3x → return best response with warning
  - [x] Mock LLM: usar mock do `generateText()` que retorna responses pre-definidas

- [x] **Task 10** (AC: 6) Testes unitarios — timeout
  - [x] Test: agente exceeds 30s → `AgentTimeoutError` lancado com nome do agente
  - [x] Mock: delay no `generateText()` para simular timeout

---

## Dev Notes

### Pipeline Architecture [Source: architecture.md Section 7]

```
Student Message
    │
    ├──────────────────────┐
    │                      │
    ▼                      ▼
Socrates Agent       Analyst Agent (paralelo)
    │                      │
    ▼                      │
Editor Agent               │
    │                      │
    ▼                      │
Tester Agent               │
    │                      │
    ├── APPROVED ──────────┤
    │                      │
    ├── REJECTED ──┐       │
    │              │       │
    │    (retry: Socrates → Editor → Tester)
    │    (max 2 retries)   │
    │              │       │
    ▼              ▼       ▼
Return { response, qaReport, analysisResult }
```

### Pipeline Step Interface [Source: architecture.md Section 7.3]

```typescript
interface PipelineStep<TInput, TOutput> {
  name: string
  execute: (input: TInput, config: AgentPipelineConfig) => Promise<TOutput>
  timeout: number
  retryable: boolean
}
```

### Vercel AI SDK Integration Pattern [Source: Story 2.3]

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

async function runAgent<T>(
  systemPrompt: string,
  userMessage: string,
  schema: z.ZodSchema<T>,
  config: AgentPipelineConfig
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const { text } = await generateText({
      model: anthropic(config.model),
      system: systemPrompt,
      prompt: userMessage,
      abortSignal: controller.signal,
    })
    clearTimeout(timeout)
    const parsed = schema.parse(JSON.parse(text))
    return parsed
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AgentTimeoutError('Agent timeout', { agentName: 'unknown' })
    }
    throw error
  }
}
```

### Conversation History (H-2 Resolution)

`orchestrateSocraticDialogue()` receives `conversationHistory: Message[]` — array of previous messages (student + tutor) ordered by turn_number. For turn 1, array is empty. For turns 2-3, contains previous messages. Socrates NEEDS this history to:
- (a) Reference something the student said (Invariant #6 of SocratOS)
- (b) Progressively deepen reasoning
- (c) Not repeat feedback

### Agent Constraints [Source: benchmark-agentes-socraticos.md]

| Agent | Constraints |
|-------|-------------|
| **Socrates** | NEVER gives direct answer, ALWAYS ends with ?, 2 paragraphs, 80-200 words, PT-BR |
| **Editor** | Remove labels, ensure 2 paragraphs, preserve meaning |
| **Tester** | 6 criteria (C1-C6), min score 0.7, CRITICAL failures = auto-reject |
| **Analyst** | AI detection (0.0-1.0), metrics, flags, < 1s execution |

### Retry Flow Detail

```
Tester REJECTED (attempt 1)
  → Socrates receives: original context + tester feedback as additional context
  → Socrates generates new response
  → Editor polishes
  → Tester validates again

Tester REJECTED (attempt 2)
  → Same flow with accumulated feedback

Tester REJECTED (attempt 3)
  → Return best response (highest score across all attempts)
  → Set warning: true flag
```

### Important Notes

- **Prompts must be migrated LITERALLY** — no modification. Each prompt is a `const` string export
- **Creator agent already exists** in `packages/agents/src/prompts/creator.ts` (from Story 2.3) — do NOT duplicate
- `packages/agents` was initialized in Story 2.3 with AI SDK + Anthropic provider already configured

### File Locations

```
packages/agents/src/
├── prompts/
│   ├── creator.ts              # Already exists (Story 2.3)
│   ├── socrates.ts             # NEW — system prompt
│   ├── editor.ts               # NEW — system prompt
│   ├── tester.ts               # NEW — system prompt
│   └── analyst.ts              # NEW — system prompt
├── schemas/
│   ├── socrates.ts             # NEW — Zod I/O schemas
│   ├── editor.ts               # NEW — Zod I/O schemas
│   ├── tester.ts               # NEW — Zod I/O schemas
│   └── analyst.ts              # NEW — Zod I/O schemas
├── errors.ts                   # NEW — custom error types
├── orchestrator.ts             # NEW — orchestrateSocraticDialogue()
├── analyst.ts                  # NEW — runAnalyst()
├── types.ts                    # NEW — PipelineStep, AgentPipelineConfig
└── index.ts                    # Updated — exports
```

### Testing

- **Test location:** `packages/agents/tests/`
- **Framework:** Vitest
- **Mock pattern:** Mock `generateText()` from `ai` package to return pre-defined responses
- **Benchmark data:** Use examples from `Benchmarks/Agentes/Harven_*/04_validation/` as test fixtures

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, Zod schemas compilam, prompts exportados corretamente | Yes |
| Pre-PR | Pipeline end-to-end com mock LLM, retry funciona, timeout lanca erro correto | Yes |
| Architecture | Pipeline pattern aprovado por @architect — extensivel para futuros agentes | Yes |

---

## Definition of Done

- [x] Todos os ACs passam
- [x] 4 prompts migrados literalmente dos benchmarks
- [x] 4 schemas Zod compilam e validam com dados de exemplo
- [x] Pipeline executa: Socrates → Editor → Tester end-to-end (com mock LLM)
- [x] Retry funciona quando Tester rejeita (1x, 2x, fallback)
- [x] Timeout lanca erro correto por agente
- [x] Analyst roda em paralelo sem bloquear pipeline
- [x] @architect aprovou pipeline pattern
- [x] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (prompts, schemas, pipeline, retry, exports) |
| **@architect (Aria)** | Review do pipeline pattern — validar que e extensivel e reutilizavel |
| **@qa (Quinn)** | Validacao: schemas Zod vs benchmark schemas, retry logic, timeout handling |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Prompts modificados durante migracao (perdem benchmark score) | HIGH | Migracao LITERAL — diff contra source. QA valida match |
| `generateText()` output nao e JSON parseable | MEDIUM | Usar `generateObject()` como alternativa ou output formatting in prompt |
| Retry loop degrada latencia (3 full pipeline cycles = ~36s) | HIGH | Timeout de 30s/agente, fallback apos max retries, streaming mitiga percecao |
| Zod schema mismatch com LLM output real | MEDIUM | Validar com dados reais dos benchmarks (`04_validation/`), loose parsing com `.passthrough()` |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 3 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Dex (@dev) — Claude Opus 4.6

### Debug Log References
Session: 2026-02-08

### Completion Notes List
All tasks completed. Migrated 4 agent system prompts (Socrates, Editor, Tester, Analyst) from benchmarks. Created Zod I/O schemas for all 4 agents. Implemented orchestrator pipeline with Socrates -> Editor -> Tester flow, retry logic (max 2 retries with fallback to best response), and 30s timeout per agent. Analyst runs in parallel via standalone function. Custom error types created (AgentTimeoutError, AgentInvalidOutputError, PipelineMaxRetriesError). Full test coverage for schemas, pipeline flow, retries, and timeout handling.

### File List
- `packages/agents/src/prompts/socrates.ts`
- `packages/agents/src/prompts/editor.ts`
- `packages/agents/src/prompts/tester.ts`
- `packages/agents/src/prompts/analyst.ts`
- `packages/agents/src/schemas/socrates.ts`
- `packages/agents/src/schemas/editor.ts`
- `packages/agents/src/schemas/tester.ts`
- `packages/agents/src/schemas/analyst.ts`
- `packages/agents/src/errors.ts`
- `packages/agents/src/types.ts`
- `packages/agents/src/orchestrator.ts`
- `packages/agents/src/analyst.ts`
- `packages/agents/src/index.ts` (updated)
- `packages/agents/tests/schemas.test.ts`
- `packages/agents/tests/orchestrator.test.ts`

---

## QA Results

### Review Date: 2026-02-08

### Reviewed By: Quinn (Test Architect)

### Review Type: Pre-Development Story Proposal Review

### Code Quality Assessment

**Overall:** Excellent story quality — the most comprehensive of the 5 stories. Pipeline architecture, retry logic, timeout handling, and error types are thoroughly documented. Benchmark references are precise with exact file paths. Agent constraints table is valuable for dev context. Dev Notes provide complete implementation guidance.

### Findings

#### MEDIUM Severity

**S3.2-M1: PRD says "5 agentes" — story correctly implements "4 agentes"**
- **Location:** PRD Story 3.2 AC2 vs Story AC1
- **Issue:** PRD says "System prompts dos 5 agentes migrados" but story correctly migrates only 4 (Socrates, Editor, Tester, Analyst). Creator was already migrated in Story 2.3.
- **Impact:** None — story is correct. PRD count includes Creator which is out of scope.
- **Action Required:** Document as intentional PRD deviation in Dev Notes: "PRD references 5 agents; Creator already migrated in Story 2.3 — this story handles the remaining 4."
- **Suggested Owner:** @sm (River)

**S3.2-M2: `generateText()` vs `generateObject()` for structured output**
- **Location:** Dev Notes → Vercel AI SDK Integration Pattern
- **Issue:** Code uses `generateText()` then `JSON.parse(text)` then Zod validation. This is fragile — LLM may not always output valid JSON. Vercel AI SDK provides `generateObject()` with built-in Zod schema enforcement.
- **Impact:** Pipeline may fail intermittently on malformed JSON output.
- **Action Required:** Dev Notes should recommend `generateObject()` as primary approach with `generateText()` as fallback. Risk Assessment already mentions this — good. Consider adding to AC7: "Use `generateObject()` with Zod schema where structured output is required."
- **Suggested Owner:** @dev (Dex) — implementation decision

#### LOW Severity

**S3.2-L1: Model ID partial in architecture — `claude-sonnet-4-5` vs `claude-sonnet-4-5-20250929`**
- Architecture Section 7 uses `claude-sonnet-4-5` (short form); stories use `claude-sonnet-4-5-20250929` (full ID).
- Both are valid — the AI SDK accepts both. No action needed.

**S3.2-L2: Retry flow sends "feedback do Tester" to Socrates but AC10 Socrates input doesn't include tester feedback field**
- AC10 defines Socrates input as `session_context + student_message + conversation_history` — no field for tester feedback.
- Dev Notes describe retry flow: "feedback do Tester enviado ao Socrates como contexto adicional."
- **Action:** Dev should inject tester feedback into `student_message` or add `tester_feedback` optional field to Socrates input schema.

### Compliance Check

- Architecture Alignment: ✓ — Pipeline pattern matches Section 7.3, step interface correct
- PRD Alignment: MINOR DEVIATION — 4 agents vs PRD's "5 agents" (intentional, correct)
- Benchmark Alignment: ✓ — All 4 agent prompts reference correct Benchmark paths
- Story Structure: ✓ — All sections complete, comprehensive Dev Notes

### Security Review

- No direct security concerns for this story (backend package, no user-facing endpoints)
- Prompt isolation: ✓ — Agents receive system prompts separately from user content
- Tool restriction: ✓ — Agents have no tool access (text generation only)

### Performance Considerations

- Retry worst-case: 3 full pipeline cycles (~36s) — documented in Risk Assessment
- Analyst parallelism: ✓ — Correctly non-blocking
- 30s timeout per agent: ✓ — Appropriate safety net

### Gate Status

Gate: **PASS** → `docs/qa/gates/3.2-setup-agent-orchestrator.yml`
Quality Score: **90/100** (2 MEDIUM = -10)

### Recommended Status

✓ Ready for Development — No blocking findings. M1 is documentation only, M2 is an implementation recommendation.

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
