# Story 10.1: Profiler Agent & AI Profile Schema

**Epic:** [Epic 10 — Progressive AI Profiling](../../epics/epic-10-progressive-ai-profiling.md)
**Version:** 1.1
**Created:** 2026-02-10
**Author:** River (Scrum Master)
**Status:** Done
**Story Points:** 5
**Priority:** P0 (Foundation — Stories 10.2 and 10.3 depend on this)
**Blocked By:** —
**Blocks:** Story 10.2, Story 10.3
**Assigned To:** @dev (Dex)

---

## User Story

**As a** system,
**I want** an AI agent that analyzes completed Socratic sessions to infer student learning profiles,
**so that** the platform can progressively build understanding of each student's learning patterns.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `packages/agents/src/orchestrator.ts` (agent pattern), `packages/agents/src/types.ts` (OrchestratorInput) |
| **Epic Ref** | `docs/epics/epic-10-progressive-ai-profiling.md` v1.1 — Story 10.1 |
| **Stack** | TypeScript + Anthropic SDK (`@ai-sdk/anthropic`) + Vercel AI SDK (`ai`) + Zod |
| **DB Tables** | `users` (profile JSONB — campo `ai_learning_profile`), `sessions`, `messages`, `qa_reports` |
| **Agent Pattern** | `generateObject()` + Zod output schema + `withTimeout()` — mesma pattern de Socrates/Editor/Tester/Analyst |
| **Model** | `claude-haiku-4-5-20251001` (cost optimization ~$0.002/analise) |
| **CRITICAL** | `withTimeout()` e funcao local em `orchestrator.ts` (nao exportada). Precisa ser extraida para utility compartilhada. |
| **IMPORTANT** | Profiler faz analise PEDAGOGICA (padroes observaveis de aprendizado), NAO diagnostico psicologico. |

---

## Acceptance Criteria

- [x] **AC1:** Novo `runProfiler()` em `packages/agents/src/profiler.ts` seguindo padrao existente (generateObject + Zod schema + timeout)

- [x] **AC2:** Input do Profiler: historico de mensagens da sessao, pergunta inicial (com skill/intention), scores do QA (0-1 range), perfil AI existente (para merge incremental), contagem total de sessoes do aluno

- [x] **AC3:** Output do Profiler: schema `ProfilerOutput` com campos tipados (preferred_question_types, engagement_style, detail_orientation, reasoning_style, avg_depth_achieved, comprehension_trend, avg_qa_score, strengths, growth_areas, adaptation_hints, summary, confidence)

- [x] **AC4:** Profiler usa modelo leve (`claude-haiku-4-5-20251001`) para otimizar custo

- [x] **AC5:** System prompt do Profiler instrui analise pedagogica — foco em padroes de aprendizado observaveis, nao diagnosticos psicologicos

- [x] **AC6:** Profiler recebe perfil existente (se houver) e output inclui merge incremental — metricas numericas sao medias ponderadas (ex: `avg_depth_achieved = (old * sessionsCount + new) / (sessionsCount + 1)`), `sessions_analyzed` incrementa, `confidence` cresce

- [x] **AC7:** Schema Zod para input e output com validacao estrita em `packages/agents/src/schemas/profiler.ts`

- [x] **AC8:** Prompt do Profiler em `packages/agents/src/prompts/profiler.ts` seguindo padrao dos demais agentes

- [x] **AC9:** Export do Profiler no `packages/agents/src/index.ts`

- [x] **AC10:** Tipo `AILearningProfile` exportado em `packages/shared/src/types/models.ts`

- [x] **AC11:** `withTimeout()` extraida de `orchestrator.ts` para `packages/agents/src/utils.ts` e reutilizada por todos os agentes (refactor sem mudanca de comportamento)

- [x] **AC12:** Timeout de 15s para o Profiler (nao e critico, pode falhar silenciosamente)

- [x] **AC13:** Testes unitarios: input valido gera output valido, schema Zod rejeita input invalido, merge incremental calcula medias corretamente

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 11) Extrair `withTimeout()` para utility compartilhada
  - [x]Criar `packages/agents/src/utils.ts`
  - [x]Mover `withTimeout<T>()` de `orchestrator.ts:18-39` para `utils.ts`
  - [x]Importar `AgentTimeoutError` de `./errors` em `utils.ts` (dependencia de `withTimeout`)
  - [x]Exportar `withTimeout` de `utils.ts`
  - [x]Atualizar `orchestrator.ts` para importar de `./utils`
  - [x]Exportar `withTimeout` de `index.ts`
  - [x]Verificar que pipeline Socrates continua funcionando identicamente (zero mudanca de comportamento)

- [x] **Task 2** (AC: 10) Criar tipo `AILearningProfile` em shared
  - [x]Abrir `packages/shared/src/types/models.ts`
  - [x]Adicionar interface `AILearningProfile`:
    ```typescript
    export interface AILearningProfile {
      preferred_question_types: Array<
        'clarificacao' | 'suposicoes' | 'evidencias' |
        'perspectivas' | 'consequencias' | 'aplicacao' | 'metacognicao'
      >
      engagement_style: 'reflective' | 'impulsive' | 'balanced'
      detail_orientation: 'verbose' | 'concise' | 'balanced'
      reasoning_style: 'analytical' | 'creative' | 'systematic' | 'intuitive'
      avg_depth_achieved: number
      comprehension_trend: 'improving' | 'stable' | 'declining'
      avg_qa_score: number
      strengths: string[]
      growth_areas: string[]
      adaptation_hints: string[]
      summary: string
      sessions_analyzed: number
      last_updated: string
      confidence: number
      version: number
    }
    ```

- [x] **Task 3** (AC: 7) Criar schemas Zod do Profiler
  - [x]Criar `packages/agents/src/schemas/profiler.ts`
  - [x]Schema `profilerInputSchema`:
    ```typescript
    export const profilerInputSchema = z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        turn_number: z.number().int(),
      })).min(2),
      question: z.object({
        text: z.string(),
        skill: z.enum(['analise', 'sintese', 'aplicacao', 'reflexao']).optional(),
        intention: z.string().optional(),
        expected_depth: z.string().optional(),
      }),
      qaScores: z.array(z.object({
        score: z.number().min(0).max(1),
        verdict: z.enum(['APPROVED', 'REJECTED']),
      })),
      existingProfile: z.custom<AILearningProfile>().nullable(),
      sessionCount: z.number().int().min(0),
    })
    ```
  - [x]Schema `profilerOutputSchema`:
    ```typescript
    export const profilerOutputSchema = z.object({
      preferred_question_types: z.array(z.enum([
        'clarificacao', 'suposicoes', 'evidencias',
        'perspectivas', 'consequencias', 'aplicacao', 'metacognicao',
      ])).max(4),
      engagement_style: z.enum(['reflective', 'impulsive', 'balanced']),
      detail_orientation: z.enum(['verbose', 'concise', 'balanced']),
      reasoning_style: z.enum(['analytical', 'creative', 'systematic', 'intuitive']),
      avg_depth_achieved: z.number().min(1).max(6),
      comprehension_trend: z.enum(['improving', 'stable', 'declining']),
      avg_qa_score: z.number().min(0).max(1),
      strengths: z.array(z.string().max(100)).max(5),
      growth_areas: z.array(z.string().max(100)).max(3),
      adaptation_hints: z.array(z.string().max(200)).max(5),
      summary: z.string().max(500),  // Epic API Contract diz 300, mas 500 acomoda melhor PT-BR verboso. Schema e autoritativo.
      confidence: z.number().min(0).max(1),
    })
    ```
  - [x]Exportar tipos: `ProfilerInput`, `ProfilerOutput`

- [x] **Task 4** (AC: 5, 8) Criar system prompt do Profiler
  - [x]Criar `packages/agents/src/prompts/profiler.ts`
  - [x]Prompt DEVE conter:
    - Identidade: "Voce e um analista de padroes de aprendizado"
    - Foco: "Analisa padroes OBSERVAVEIS na conversa socratica"
    - Proibicao: "NAO faz diagnosticos psicologicos. Foque em COMO o aluno aprende, nao em QUEM o aluno e."
    - Instrucao de merge: "Se existingProfile != null, suas metricas numericas devem ser medias ponderadas"
    - Instrucao de confianca: "Se sessionCount < 3, seja conservador e use confidence < 0.3"
    - Instrucao de idioma: "Todos os textos (summary, strengths, growth_areas, adaptation_hints) em portugues do Brasil"
    - Disclaimer: "adaptation_hints sao instrucoes para o tutor Socrates, nao para o aluno"

- [x] **Task 5** (AC: 1, 2, 3, 4, 6, 12) Criar Profiler agent
  - [x]Criar `packages/agents/src/profiler.ts`
  - [x]Importar: `anthropic` de `@ai-sdk/anthropic`, `generateObject` de `ai`, schemas, prompt, `withTimeout` de `./utils`
  - [x]Funcao `buildProfilerPrompt(input: ProfilerInput): string` — monta prompt com mensagens, pergunta, QA scores, perfil existente
  - [x]Funcao `runProfiler(input: ProfilerInput, config?): Promise<ProfilerOutput>`:
    ```typescript
    export async function runProfiler(
      input: ProfilerInput,
      config: { model?: string; timeoutMs?: number } = {},
    ): Promise<ProfilerOutput> {
      const result = await withTimeout(
        generateObject({
          model: anthropic(config.model ?? "claude-haiku-4-5-20251001"),
          system: PROFILER_SYSTEM_PROMPT,
          prompt: buildProfilerPrompt(input),
          schema: profilerOutputSchema,
        }),
        config.timeoutMs ?? 15000,
        "Profiler",
      )
      return result.object
    }
    ```
  - [x]`buildProfilerPrompt` formata:
    - `## Conversa Socratica` — mensagens user/assistant
    - `## Pergunta Inicial` — text, skill, intention
    - `## Scores de Qualidade` — QA scores da sessao
    - `## Perfil Existente` — JSON do perfil atual (ou "Nenhum perfil existente")
    - `## Sessoes Completadas` — total sessions count

- [x] **Task 6** (AC: 9) Exportar Profiler no index
  - [x]Abrir `packages/agents/src/index.ts`
  - [x]Adicionar exports:
    ```typescript
    // Utilities (refactored from orchestrator — Epic 10)
    export { withTimeout } from "./utils"

    // Profiler (Epic 10)
    export { runProfiler } from "./profiler"
    export { PROFILER_SYSTEM_PROMPT } from "./prompts/profiler"
    export {
      profilerInputSchema,
      profilerOutputSchema,
      type ProfilerInput,
      type ProfilerOutput,
    } from "./schemas/profiler"
    ```

- [x] **Task 7** (AC: 13) Testes unitarios
  - [x]Criar `packages/agents/tests/profiler.test.ts`
  - [x]Test: `profilerInputSchema` valida input correto
  - [x]Test: `profilerInputSchema` rejeita mensagens vazias (min 2)
  - [x]Test: `profilerInputSchema` rejeita QA scores fora de range (0-1)
  - [x]Test: `profilerOutputSchema` valida output completo
  - [x]Test: `profilerOutputSchema` rejeita strengths > 5 items
  - [x]Test: `profilerOutputSchema` rejeita growth_areas > 3 items
  - [x]Test: `profilerOutputSchema` rejeita confidence > 1
  - [x]Test: `buildProfilerPrompt` inclui mensagens, pergunta, scores, perfil existente
  - [x]Test: `buildProfilerPrompt` formata "Nenhum perfil existente" quando null
  - [x]Test: `runProfiler` chama `generateObject` com modelo Haiku e retorna `result.object` (mock `generateObject`)
  - [x]Test: `withTimeout` rejeita com AgentTimeoutError apos timeout
  - [x]Test: `withTimeout` resolve normalmente antes do timeout

---

## Dev Notes

### Agent Pattern Reference [Source: packages/agents/src/orchestrator.ts]

```typescript
// All agents follow this pattern:
// 1. Import anthropic + generateObject + schema + prompt
// 2. Build prompt from input
// 3. Call generateObject with model, system prompt, user prompt, schema
// 4. Wrap in withTimeout for resilience
// 5. Return typed output

// Existing agents:
// - runSocrates() — orchestrator.ts:132-175
// - runEditor() — orchestrator.ts:177-206
// - runTester() — orchestrator.ts:208-237
// - runAnalyst() — analyst.ts
// ALL use: anthropic(), generateObject(), withTimeout(), Zod schema
```

### withTimeout Extraction [Source: packages/agents/src/orchestrator.ts:18-39]

```typescript
// Current location: orchestrator.ts (private function)
// Target: packages/agents/src/utils.ts (exported)

// CRITICAL: This is a refactor, NOT a behavior change.
// After extraction, orchestrator.ts must import from ./utils
// and all existing tests must still pass.

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  agentName: string,
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new AgentTimeoutError(agentName))
        })
      }),
    ])
    return result
  } finally {
    clearTimeout(timeout)
  }
}
```

### Socrates Question Types [Source: packages/agents/src/schemas/socrates.ts:47-56]

```typescript
// These are the question types the Socrates agent uses.
// The Profiler must output preferred_question_types from this SAME enum:
z.enum([
  "clarificacao",
  "suposicoes",
  "evidencias",
  "perspectivas",
  "consequencias",
  "aplicacao",
  "metacognicao",
])
```

### QA Score Range [Source: packages/agents/src/schemas/tester.ts:36]

```typescript
// CRITICAL: Tester score is 0-1, NOT 0-100
score: z.number().min(0).max(1)
// Profiler avg_qa_score must use same 0-1 range
```

### Existing Index Exports [Source: packages/agents/src/index.ts]

```typescript
// Current exports pattern:
// - Agent function (e.g., orchestrateSocraticDialogue, runAnalyst)
// - System prompt constant
// - Input/Output schemas and types
// - Errors and configs
// Follow exact same pattern for Profiler
```

### AILearningProfile in OrchestratorInput [Source: packages/agents/src/types.ts:66-80]

```typescript
// OrchestratorInput.studentProfile already has:
// ai_profile?: { summary: string; strengths: string[]; learning_style: string }
// This field will be populated from ai_learning_profile in Story 10.2
// Story 10.1 only creates the type — consumption happens in 10.2
```

### ProfilerOutput vs AILearningProfile — Shape Difference (IMPORTANT)

```typescript
// ProfilerOutput (schema Zod) = 12 campos — o que o agente Profiler RETORNA
// AILearningProfile (interface TS) = 15 campos — o que e PERSISTIDO no JSONB
//
// Campos EXTRAS em AILearningProfile (adicionados pelo pipeline em Story 10.2):
//   - sessions_analyzed: number   (incrementado por triggerProfiling)
//   - last_updated: string        (ISO 8601, setado por triggerProfiling)
//   - version: number             (schema version, setado por triggerProfiling)
//
// Fluxo: runProfiler() → ProfilerOutput → enrich com metadata → AILearningProfile → JSONB merge
// Isso e BY DESIGN: Profiler faz analise, pipeline adiciona metadata.
```

### Cost Estimation

```
// Haiku pricing (claude-haiku-4-5-20251001):
// Input: $0.80/MTok, Output: $4.00/MTok
// Per profiling call:
//   ~1500 tokens input (conversation) + ~500 tokens (profile + question)
//   ~500 tokens output (profile analysis)
// Cost: (2000 * 0.80 + 500 * 4.00) / 1_000_000 = ~$0.0036 per analysis
```

### File Locations

```
packages/agents/src/
├── utils.ts                    # NEW: withTimeout extracted (Task 1)
├── profiler.ts                 # NEW: runProfiler + buildProfilerPrompt (Task 5)
├── orchestrator.ts             # UPDATED: import withTimeout from ./utils (Task 1)
├── prompts/
│   └── profiler.ts             # NEW: PROFILER_SYSTEM_PROMPT (Task 4)
├── schemas/
│   └── profiler.ts             # NEW: profilerInput/OutputSchema (Task 3)
└── index.ts                    # UPDATED: export Profiler (Task 6)

packages/shared/src/types/
└── models.ts                   # UPDATED: add AILearningProfile interface (Task 2)

packages/agents/tests/
└── profiler.test.ts            # NEW: unit tests (Task 7)
```

### Testing

- **Test location:** `packages/agents/tests/profiler.test.ts`
- **Framework:** Vitest
- **Mock pattern:** Mock `generateObject` from `ai` SDK, mock `anthropic` constructor
- **Key concern:** Schema validation accuracy, withTimeout behavior, prompt formatting

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Profiler exportado corretamente em index.ts. Schema Zod valida. orchestrator.ts usa withTimeout de utils.ts. | Yes |
| Pre-PR | Profiler gera output valido para conversa de teste (mock). Schema rejeita inputs invalidos. withTimeout refactor nao quebra pipeline existente. Custo estimado < $0.005 por analise. AILearningProfile exportado de shared. | Yes |

---

## Definition of Done

- [x] `withTimeout` extraida para `utils.ts` sem mudanca de comportamento
- [x] `AILearningProfile` interface exportada de `packages/shared`
- [ ] Schemas Zod (input + output) validam corretamente
- [ ] Prompt do Profiler segue guidelines pedagogicas (nao psicologicas)
- [x] `runProfiler()` funcional com modelo Haiku e timeout de 15s
- [ ] Exports adicionados ao `index.ts`
- [ ] Testes unitarios passam (schema validation, prompt building, timeout)
- [ ] Pipeline Socrates existente nao afetado (regression check)
- [x] `pnpm lint && pnpm typecheck` passam

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa: utility extraction, schemas, prompt, agent function, exports, testes |
| **@qa (Quinn)** | Validacao: output schema correto, merge incremental logic, custo por analise, regression check |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| withTimeout refactor quebra pipeline | HIGH | Zero behavior change — apenas move function. Testes existentes devem passar. |
| Profiler output muito verboso (tokens) | MEDIUM | Schema Zod limita: strengths max 5, growth_areas max 3, summary max 500 chars. |
| Haiku model nao suporta generateObject | LOW | Haiku suporta structured outputs. Se falhar, fallback para Sonnet (config.model param). |
| question_type enum desalinhado entre Socrates e Profiler | MEDIUM | Ambos usam EXATAMENTE o mesmo enum. Extrair para shared constant se necessario. |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Story created from Epic 10 v1.1 (QA reviewed). Includes withTimeout extraction, shared type, Zod schemas, Profiler agent, prompt, exports, and unit tests. | River (SM) |
| 2026-02-10 | 1.1 | QA fixes: M-1 summary max 500 note, M-2 ProfilerOutput vs AILearningProfile shape gap documented, L-1 added runProfiler() integration test, L-2 AgentTimeoutError import in utils.ts, X-1 withTimeout added to index.ts exports. | Quinn (QA) |

---

## QA Results

**Gate Decision: PASS**
**Reviewed:** 2026-02-10
**Reviewer:** Quinn (Test Architect)

**AC Traceability:** 13/13 PASS

| AC | Verification | Status |
|----|-------------|--------|
| AC1 | `runProfiler()` in `profiler.ts:47` — generateObject + Zod + withTimeout | PASS |
| AC2 | Input: messages, question (skill/intention), qaScores (0-1), existingProfile, sessionCount | PASS |
| AC3 | Output: 12 campos (preferred_question_types through confidence) | PASS |
| AC4 | Default model `claude-haiku-4-5-20251001` at `profiler.ts:53` | PASS |
| AC5 | Prompt: "OBSERVAVEIS", "NAO faz diagnosticos psicologicos" | PASS |
| AC6 | Prompt: weighted averages formula, confidence growth rules, merge incremental | PASS |
| AC7 | `schemas/profiler.ts` — min(2) messages, score 0-1, enum constraints, max limits | PASS |
| AC8 | `prompts/profiler.ts` — follows Tester/Editor/Analyst pattern | PASS |
| AC9 | `index.ts:59-70` — all Profiler exports present | PASS |
| AC10 | `AILearningProfile` in `shared/types/models.ts`, re-exported via barrel | PASS |
| AC11 | `withTimeout()` in `utils.ts`, orchestrator imports from `./utils` | PASS |
| AC12 | Default timeout 15s — `profiler.ts:58` | PASS |
| AC13 | 21 unit tests covering schemas, prompt, withTimeout, runProfiler | PASS |

**Build Verification:** typecheck PASS, lint PASS, tests 69/69 PASS
**Regression:** orchestrator.test.ts 4/4 PASS (withTimeout refactor zero behavior change)
**Constraint Compliance:** No unrelated files, no extra features, question_type enum matches Socrates

### Round 1: PASS WITH CONCERNS
| Issue ID | Severity | Issue | Resolution |
|----------|----------|-------|------------|
| FIX-10.1-001 | P1 | `AILearningProfile` in models.ts used tabs, Biome requires 2-space | FIXED — `biome check --fix` applied |

### Round 2 (re-review): All concerns resolved
- FIX-10.1-001: VERIFIED — `models.ts:1-25` now uses 2-space indentation
- `pnpm --filter @eximia/shared lint`: PASS
- All 5 verifications clean (shared lint, shared typecheck, agents lint, agents typecheck, agents test)

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Biome auto-format required: tabs→spaces in utils.ts, profiler.ts, schemas/profiler.ts (4 files fixed)
- `existingProfile` in input schema uses `z.object().nullable()` instead of `z.custom<AILearningProfile>()` for runtime validation

### Completion Notes
- All 7 tasks implemented. 69 tests pass (21 new profiler tests + 48 existing).
- `withTimeout` extracted to `utils.ts` — zero behavior change, orchestrator tests still pass.
- `AILearningProfile` interface added to `packages/shared/src/types/models.ts`.
- Profiler agent follows exact same pattern as Socrates/Editor/Tester/Analyst.
- Default model: `claude-haiku-4-5-20251001`, default timeout: 15s.
- `buildProfilerPrompt` exported for testability.

### File List
**New files:**
- `packages/agents/src/utils.ts`
- `packages/agents/src/profiler.ts`
- `packages/agents/src/prompts/profiler.ts`
- `packages/agents/src/schemas/profiler.ts`
- `packages/agents/tests/profiler.test.ts`

**Modified files:**
- `packages/agents/src/orchestrator.ts` (import withTimeout from ./utils)
- `packages/agents/src/index.ts` (added Profiler + withTimeout exports)
- `packages/shared/src/types/models.ts` (added AILearningProfile interface)

---

*Story criada por River (Scrum Master) — exímIA Academy*
