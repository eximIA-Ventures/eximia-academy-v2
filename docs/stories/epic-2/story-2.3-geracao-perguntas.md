# Story 2.3: Geracao de Perguntas via Creator Agent

**Epic:** [Epic 2 — Course & Content Management](../epics/epic-2-course-content-management.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 13
**Priority:** P0 (Blocker)
**Blocked By:** 2.2
**Blocks:** 2.4
**Assigned To:** @dev (Dex)

---

## User Story

**As a** teacher,
**I want** gerar perguntas socraticas automaticamente a partir do conteudo do capitulo,
**so that** eu nao precise criar perguntas manualmente.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.2 — Sections 9 (Schema), 10 (RLS/API), 11 (Structure), 14.3 (Rate Limiting) |
| **Screens Ref** | `docs/screens.md` — Screen 9 (Question Review) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 + Supabase + Vercel AI SDK + Anthropic Claude + Drizzle ORM |
| **DB Tables** | `questions` (created in Epic 1, Story 1.2) |
| **Agent Schemas** | `Benchmarks/Agentes/Harven_Creator/03_prompt/schemas/` (input + output) |
| **System Prompt** | `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md` |

| **Dependencies** | Story 2.2 completed (chapter CRUD, published chapters exist) |
| **QA Advisory** | M-8: add maxLength for chapter_content LLM input |
| **CRITICAL** | **PRIMEIRO USO DE LLM NA PLATAFORMA** — sets pattern for Epic 3 |

---

## Acceptance Criteria

- [ ] **AC1:** Botao "Gerar Perguntas" no capitulo publicado (na pagina do curso e na pagina de perguntas)
  - Only visible for chapters with `status = 'published'`
  - Disabled during generation (loading state)

- [ ] **AC2:** API route `POST /api/chapters/[chapterId]/generate-questions` que chama o Creator Agent
  - Next.js API Route (NOT Server Action — needs streaming support and rate limiting)

- [ ] **AC3:** Creator Agent recebe: `chapter_title`, `chapter_content`, `learning_objective`, `max_questions: 3`
  - Input validated with Zod schema matching Creator input_schema.json

- [ ] **AC4:** System prompt do Creator Agent migrado de `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md` para `packages/agents/src/prompts/creator.ts`
  - Copy LITERALLY — no modifications to the prompt text
  - Export as string constant

- [ ] **AC5:** Input/output schemas tipados com Zod em `packages/agents/src/schemas/creator.ts` conforme `Benchmarks/Agentes/Harven_Creator/03_prompt/schemas/`
  - Mirror JSON Schema → Zod conversion
  - Strict validation of LLM output

- [ ] **AC6:** Response parseada e salva na tabela `questions` com todos os metadados
  - Fields: text, skill, intention, expected_depth, common_shallow_answer, citations, followup_prompts, metadata
  - Status: `pending` (awaiting teacher review)

- [ ] **AC7:** Loading state durante geracao (5-15s) com feedback visual (spinner + "Gerando perguntas...")
  - Button disabled, spinner icon, "Gerando perguntas..." text
  - Progress indicator (optional: "Analisando conteudo...", "Gerando perguntas...")

- [ ] **AC8:** Tratamento de erro se LLM falhar (retry 1x automatico, mensagem de erro amigavel se falhar 2x)
  - Retry on: Zod parse failure, API timeout, 5xx errors
  - After 2nd failure: toast "Nao foi possivel gerar perguntas. Tente novamente mais tarde."

- [ ] **AC9:** Limite: nao regerar se ja existem perguntas ativas para o capitulo (dialog de confirmacao para substituir)
  - Check: `questions` where `chapter_id = X AND status IN ('pending', 'active')`
  - If exists: AlertDialog "Ja existem perguntas para este capitulo. Deseja substituir?"

- [ ] **AC10:** Integracao com Vercel AI SDK + Anthropic provider (`@ai-sdk/anthropic`)
  - Use `generateObject()` from Vercel AI SDK for structured output
  - Model: `claude-sonnet-4-5-20250929`

- [ ] **AC11:** Rate limiting implementado no endpoint `/api/chapters/[chapterId]/generate-questions` conforme architecture.md Section 14.3 (5 req / 5 min por user). Requisicoes excedentes retornam HTTP 429 com mensagem amigavel ("Aguarde alguns minutos antes de gerar novas perguntas")
  - Use `@upstash/ratelimit` with Redis/Vercel KV
  - 5 requests per 5-minute sliding window per user

---

## 🤖 CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 4) Migrar system prompt
  - [x] Read `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md`
  - [x] Create `packages/agents/src/prompts/creator.ts`
  - [x] Export as `CREATOR_SYSTEM_PROMPT` string constant
  - [x] Copy text LITERALLY — do not modify

- [x] **Task 2** (AC: 5) Criar Zod schemas em `packages/agents/src/schemas/creator.ts`
  - [x] `creatorInputSchema`: mirrors Creator input_schema.json
    - Required: `chapter_content` (minLength: 100, maxLength: 50000 — M-8 fix)
    - Optional: `chapter_title`, `learning_objective`, `max_questions` (1-3, default 3), `difficulty`
  - [x] `creatorOutputSchema`: mirrors Creator output_schema.json
    - `analysis`: { main_concepts, key_relationships, potential_angles, content_complexity }
    - `questions[]`: { text, skill, intention, expected_depth, common_shallow_answer, followup_prompts, citations, has_practical_scenario }
    - `quality_checks`: { all_questions_non_generic, skills_diversity, has_practical_scenario, all_metadata_complete, unique_angles }
    - `metadata`: { chapter_title, questions_generated, skills_covered, has_practical_scenario }
    - `warnings`: string[]
  - [x] Export types: `CreatorInput`, `CreatorOutput`, `GeneratedQuestion`

- [x] **Task 3** (AC: 10) Instalar dependencias em `packages/agents`
  - [x] `pnpm add ai @ai-sdk/anthropic zod -F agents`
  - [x] Update `packages/agents/package.json`
  - [x] Ensure `packages/agents/src/index.ts` exports public API

- [x] **Task 4** (AC: 3, 10) Criar funcao `generateQuestions()` em `packages/agents/src/creator.ts`
  - [x] Import `generateObject` from `ai`
  - [x] Import `anthropic` from `@ai-sdk/anthropic`
  - [x] Configure model: `anthropic('claude-sonnet-4-5-20250929')`
  - [x] Call `generateObject({ model, system: CREATOR_SYSTEM_PROMPT, prompt: userMessage, schema: creatorOutputSchema })`
  - [x] Parse and validate output with Zod
  - [x] Return typed `CreatorOutput`

- [x] **Task 5** (AC: 2, 11) Criar API route `POST /api/chapters/[chapterId]/generate-questions/route.ts`
  - [x] Auth guard: verify user is authenticated
  - [x] Role guard: verify `teacher` or `admin` role
  - [x] Tenant guard: verify chapter belongs to user's tenant (RLS handles this)
  - [x] Status guard: verify chapter `status = 'published'`
  - [ ] Rate limiting: `@upstash/ratelimit` (5 req / 5 min / user) — deferred (needs Upstash credentials)
  - [x] Call `generateQuestions()` from `packages/agents`
  - [x] Parse output and save to `questions` table
  - [x] Return questions array
  - [x] **Replace mode (for Story 2.4):** Accept `?replace=true` query param. When true:
    1. Use `createServiceRoleClient()` to DELETE existing `rejected`/`pending` questions for this chapter (`questions_delete` RLS is admin-only — S2.4-H1 resolution)
    2. Generate new questions and insert as usual
    3. Active questions are never touched
    4. This makes the replace operation atomic (delete + generate in single request)

- [x] **Task 6** (AC: 2) Implementar auth + role + tenant guard na API route
  - [x] Get session from Supabase Auth
  - [x] Query user role from `users` table
  - [x] Return 401 if not authenticated, 403 if not teacher/admin
  - [x] Fetch chapter and verify `status = 'published'`

- [ ] **Task 7** (AC: 11) Implementar rate limiting — DEFERRED (needs Upstash Redis credentials)
  - [ ] `pnpm add @upstash/ratelimit @upstash/redis -F web`
  - [ ] Create rate limiter instance: `Ratelimit.slidingWindow(5, '5 m')`
  - [ ] Check rate limit before calling LLM
  - [ ] Return 429 with message if exceeded
  - [x] Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.example`

- [x] **Task 8** (AC: 8) Implementar retry logic
  - [x] Wrap `generateQuestions()` call in try/catch
  - [x] On Zod parse failure or API error: retry 1x
  - [x] On 2nd failure: return 500 with friendly error message
  - [x] Log errors for monitoring

- [x] **Task 9** (AC: 6) Implementar parse de output + save na tabela `questions`
  - [x] Map each question from CreatorOutput to `questions` table INSERT
  - [x] Fields mapping: text, skill, intention, expected_depth, common_shallow_answer, followup_prompts (JSONB), citations (JSONB), metadata (JSONB with full CreatorOutput.metadata)
  - [x] Set `status = 'pending'` for all new questions
  - [x] Set `chapter_id`, `tenant_id` (from chapter)

- [x] **Task 10** Criar Zod schema de validacao: `packages/shared/src/validators/questions.ts`
  - [x] Schema for question data that aligns with DB table structure
  - [x] Used for validating data before DB insert

- [x] **Task 11** (AC: 1, 7) Criar componente `GenerateQuestionsButton`
  - [x] Props: `chapterId`, `chapterStatus`, `hasExistingQuestions`
  - [x] Only visible when `chapterStatus === 'published'`
  - [x] Loading state: spinner + "Gerando perguntas..." text
  - [x] Calls API route via `fetch()`
  - [x] On success: `router.refresh()` to update question list
  - [x] On error: `toast.error()` with friendly message

- [x] **Task 12** (AC: 9) Implementar dialog de confirmacao quando perguntas ativas ja existem
  - [x] Before calling API: check if chapter has existing pending/active questions
  - [x] If yes: AlertDialog "Ja existem perguntas. Gerar novas ira substituir as pendentes."
  - [x] On confirm: call API with flag to replace existing

- [x] **Task 13** Adicionar `.env.example` com `ANTHROPIC_API_KEY`
  - [x] Add to existing `.env.example` if not present
  - [x] Also add Upstash Redis env vars

- [x] **Task 14** Testes unitarios: Zod schema validation
  - [x] Test input schema with valid/invalid data
  - [x] Test output schema parsing with mock LLM response
  - [x] Test boundary cases: minLength, maxLength, required fields

- [ ] **Task 15** Teste de integracao: API route completa — DEFERRED (requires mocked Supabase + Anthropic setup)
  - [ ] Mock Anthropic API response
  - [ ] Test full flow: auth → rate limit → generate → parse → save
  - [ ] Test rate limiting (6th request returns 429)
  - [ ] Test retry logic (mock failure then success)

---

## Dev Notes

### Database Schema [Source: architecture.md Section 9]

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  text TEXT NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('analise', 'sintese', 'aplicacao', 'reflexao')),
  intention TEXT NOT NULL,
  expected_depth TEXT,
  common_shallow_answer TEXT,
  followup_prompts JSONB DEFAULT '[]',
  citations JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  approved_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** The `status` enum in DB is `('pending', 'active', 'rejected')`. Story 2.4 introduces `'replaced'` status — this may require a DB migration or the `replaced` questions can simply be deleted.

### RLS Policies [Source: architecture.md Section 10.3]

```sql
CREATE POLICY questions_select ON questions FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY questions_insert ON questions FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));

CREATE POLICY questions_update ON questions FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));

CREATE POLICY questions_delete ON questions FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('admin'));
```

### Creator Agent I/O Schemas [Source: Benchmarks/Agentes/Harven_Creator/03_prompt/schemas/]

**Input (required fields):**
```typescript
{
  chapter_content: string      // minLength: 100, maxLength: 50000 (M-8)
  chapter_title?: string
  learning_objective?: string
  max_questions?: number       // 1-3, default 3
  difficulty?: 'iniciante' | 'intermediario' | 'avancado'  // default 'intermediario'
}
```

**Output (required fields per question):**
```typescript
{
  analysis: {
    main_concepts: string[]         // 3-7 items
    key_relationships: string[]
    potential_angles: string[]
    content_complexity: 'baixa' | 'media' | 'alta'
  }
  questions: Array<{
    text: string                    // 50-500 chars, must end with ?
    skill: 'analise' | 'sintese' | 'aplicacao' | 'reflexao'
    intention: string               // 30-200 chars
    expected_depth: string          // 50-300 chars
    common_shallow_answer: string   // 20-150 chars
    followup_prompts: string[]      // 2-3 items
    citations: string[]             // min 1 item
    has_practical_scenario?: boolean
  }>
  quality_checks: {
    all_questions_non_generic: boolean
    skills_diversity: boolean
    has_practical_scenario: boolean
    all_metadata_complete: boolean
    unique_angles: boolean
  }
  metadata: {
    chapter_title: string
    questions_generated: number
    skills_covered: string[]
    has_practical_scenario: boolean
  }
  warnings?: string[]
}
```

### Rate Limiting [Source: architecture.md Section 14.3]

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const generateQuestionsRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  prefix: 'rl:generate-questions',
})

// In API route:
const { success, remaining } = await generateQuestionsRateLimit.limit(userId)
if (!success) {
  return NextResponse.json(
    { error: 'Aguarde alguns minutos antes de gerar novas perguntas' },
    { status: 429 }
  )
}
```

### Vercel AI SDK Pattern [Source: architecture.md Section 3]

```typescript
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { creatorOutputSchema } from './schemas/creator'
import { CREATOR_SYSTEM_PROMPT } from './prompts/creator'

export async function generateQuestions(input: CreatorInput): Promise<CreatorOutput> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: CREATOR_SYSTEM_PROMPT,
    prompt: `Capitulo: ${input.chapter_title}\n\nConteudo:\n${input.chapter_content}\n\nObjetivo: ${input.learning_objective || 'Nao especificado'}\n\nGere ${input.max_questions || 3} perguntas socraticas.`,
    schema: creatorOutputSchema,
  })

  return object
}
```

### File Locations [Source: architecture.md Section 11]

```
packages/agents/
├── src/
│   ├── index.ts                    # Public exports
│   ├── creator.ts                  # generateQuestions() function
│   ├── prompts/
│   │   └── creator.ts              # CREATOR_SYSTEM_PROMPT (migrated from cliente-piloto)
│   └── schemas/
│       └── creator.ts              # Zod input/output schemas
└── package.json

apps/web/src/app/api/chapters/[chapterId]/generate-questions/
└── route.ts                        # POST endpoint

apps/web/src/app/(platform)/courses/[courseId]/_components/
└── generate-questions-button.tsx    # UI component

packages/shared/src/validators/
└── questions.ts                    # Zod schema for questions table
```

### System Prompt Migration

The system prompt at `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md` must be copied **literally** to `packages/agents/src/prompts/creator.ts`. Do NOT modify the prompt text — it was validated at cliente-piloto with score 9.3/10.

```typescript
// packages/agents/src/prompts/creator.ts
export const CREATOR_SYSTEM_PROMPT = `
... (entire content of prompt_operacional.md)
`
```

### API Route Full Flow

```
Client                    API Route                        packages/agents
  |                           |                                |
  |-- POST /generate-questions|                                |
  |                           |-- Auth check (Supabase)        |
  |                           |-- Role check (teacher/admin)   |
  |                           |-- Rate limit check (Upstash)   |
  |                           |-- Chapter status check         |
  |                           |-- generateQuestions(input) ---->|
  |                           |                                |-- Anthropic API call
  |                           |                                |-- Zod parse output
  |                           |<-- CreatorOutput --------------|
  |                           |-- Map to questions table       |
  |                           |-- INSERT questions (status=pending)
  |<-- 200 { questions }      |
```

### Cost Estimation

- ~1000-2000 tokens per call
- At $3/1M input tokens + $15/1M output tokens (Claude Sonnet 4.5)
- Estimated: ~$0.02-0.04 per generation
- Rate limit (5/5min) caps at ~$12/day per user maximum

### Testing

- **Test location:** `packages/agents/tests/` and `apps/web/tests/`
- **Framework:** Vitest
- **Mock LLM:** Create mock responses matching output schema for unit tests
- **Integration test:** Mock Anthropic API, test full route flow

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, Zod schemas validam contra output schema do Creator Agent | Yes |
| Pre-PR | Geracao funcional end-to-end, perguntas salvas com todos os campos, retry testado | Yes |
| Security | API route verifica auth + role + tenant, input sanitizado, prompt injection mitigado, rate limiting 5 req/5 min enforced | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Creator Agent gera perguntas a partir de conteudo de capitulo
- [ ] Perguntas salvas com todos os metadados na tabela `questions`
- [ ] Retry funciona quando LLM falha
- [ ] Rate limiting funciona (429 after 5 requests in 5 min)
- [ ] Zod valida output antes de salvar
- [ ] PR aprovada com architecture review

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao do API route, migracao do prompt, Zod schemas, integracao AI SDK |
| **@architect (Aria)** | Review do setup do `packages/agents` — validar pattern para reuso em Epic 3 |
| **@qa (Quinn)** | Validacao: output schema compliance, retry logic, error handling, rate limiting |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Creator Agent output invalido | HIGH | Zod validation + retry 1x + friendly error |
| LLM API cost overrun | HIGH | Rate limiting 5 req/5 min per user |
| Prompt injection via chapter content | HIGH | Input sanitization + delimiters in system prompt + output validation |
| LLM latency (5-15s) | MEDIUM | Loading state with progressive feedback |
| Output schema mismatch JSON → Zod | MEDIUM | Test with real Anthropic calls during development |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 2 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- Fixed QuestionStatus type in models.ts (pending|active|rejected, not draft|active|archived)
- Added @eximia/agents workspace dependency to web package.json
- Consolidated duplicate imports from @eximia/agents in API route
- Rate limiting (Task 7) deferred — requires Upstash Redis credentials
- Integration tests (Task 15) deferred — requires mocked Supabase + Anthropic setup

### Completion Notes List
- 13/15 tasks completed (2 deferred: rate limiting, integration tests)
- All Zod schemas mirror benchmark JSON schemas exactly
- System prompt copied literally from benchmark
- API route supports replace mode for Story 2.4 (service role for delete)
- Retry logic: 2 attempts with error logging
- 12 schema unit tests passing
- Typecheck clean

### File List
- `packages/agents/src/prompts/creator.ts` — NEW (CREATOR_SYSTEM_PROMPT)
- `packages/agents/src/schemas/creator.ts` — NEW (creatorInputSchema, creatorOutputSchema)
- `packages/agents/src/creator.ts` — NEW (generateQuestions function)
- `packages/agents/src/index.ts` — MODIFIED (public API exports)
- `packages/agents/package.json` — MODIFIED (ai, @ai-sdk/anthropic, zod, vitest deps)
- `packages/agents/tests/schemas/creator.test.ts` — NEW (12 tests)
- `packages/shared/src/validators/questions.ts` — NEW (questionDbSchema)
- `packages/shared/src/index.ts` — MODIFIED (questions validator export)
- `apps/web/src/app/api/chapters/[chapterId]/generate-questions/route.ts` — NEW (POST API route)
- `apps/web/src/app/(platform)/courses/[courseId]/_components/generate-questions-button.tsx` — NEW (UI component)
- `apps/web/package.json` — MODIFIED (@eximia/agents workspace dep)

---

## QA Results

### Review Date: 2026-02-08

### Review Type: Pre-Development Story Proposal Review

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**Overall:** Exceptional story quality — the most critical story in Epic 2 and it shows. Complete Creator Agent I/O schemas, full API route flow diagram, rate limiting implementation, retry logic, cost estimation, and testing strategy. This story sets the pattern for all LLM integrations in the platform.

### Compliance Check

- Architecture Alignment: ✓ — DB schema, RLS, API route, rate limiting, file locations all verified against architecture.md v1.2.2
- Screens Alignment: ✓ — Screen 9 "Gerar Perguntas" button correctly referenced
- Epic Findings: ✓ — H-3 (rate limiting) fully incorporated as AC11, M-8 (maxLength) as advisory in input schema
- Validated Schemas: ✓ — Input/output schema specifications match `Benchmarks/Agentes/Harven_Creator/03_prompt/schemas/`
- Story Structure: ✓ — All sections complete, CRITICAL banner for first LLM usage

### Findings

**MEDIUM:**

- **S2.3-M1: Architecture.md rate limiting code sample vs endpoint table discrepancy.** Section 14.3 code sample shows `Ratelimit.slidingWindow(10, '1 m')` with prefix `rl:llm` (for sessions/messages endpoint), but the endpoint table specifies `/api/generate-questions` at 5 req/5 min. **Story correctly implements the table value (5/5m)**. However, @dev may see the code sample and be confused. **Recommendation:** @dev should use the story's code pattern (line 296-309) with `slidingWindow(5, '5 m')` and prefix `rl:generate-questions`, NOT the generic `llmRateLimit` from architecture.md.
  - **Suggested Owner:** @dev (Dex) — awareness note
  - **Refs:** Dev Notes line 296, architecture.md Section 14.3

- **S2.3-M2: `has_practical_scenario` per-question field has no dedicated DB column.** Creator output includes `has_practical_scenario` per question, but the `questions` table has no such column. It must be stored in `metadata JSONB`. Task 9 maps "metadata (JSONB with full CreatorOutput.metadata)" at the generation level, but doesn't explicitly mention per-question `has_practical_scenario`. **Recommendation:** Add to Task 9: "Store `has_practical_scenario` in each question's `metadata` JSONB field."
  - **Suggested Owner:** @dev (Dex)
  - **Refs:** Task 9, DB schema line 217

**LOW:**

- **S2.3-L1: AC9 replace behavior deferred to Story 2.4.** AC9 checks for existing questions and shows confirmation dialog, but the actual replacement logic (delete old + generate new) is specified in Story 2.4 AC8. This is acceptable since 2.3 blocks 2.4 — the basic generate flow is implemented in 2.3, and the replace flow in 2.4.
- **S2.3-L2: M-8 advisory incorporated.** `maxLength: 50000` added to `creatorInputSchema` (Task 2, line 107). Good.
- **S2.3-L3: Cost estimation is reasonable.** ~$0.02-0.04/generation with 5/5min rate limit caps daily exposure.

### Security Review

- Auth + role guard: ✓ — Task 5/6 specify auth, role (teacher/admin), tenant check
- Rate limiting: ✓ — AC11 + Task 7 with @upstash/ratelimit (5 req/5 min)
- Input sanitization: ✓ — Zod schema validates input, risk assessment mentions prompt injection mitigation
- Prompt injection: ✓ — Risk assessment identifies this and lists mitigations (sanitization, delimiters, output validation)
- API key protection: ✓ — Task 13 adds to `.env.example` (not committed)

### Performance Considerations

- LLM latency (5-15s): ✓ — Loading state with progressive feedback (AC7, Task 11)
- Retry adds latency: ✓ — Max 2 attempts, timeout of 30s is implicit
- Rate limiting prevents abuse: ✓ — 5 req/5 min caps resource usage

### Gate Status

Gate: **PASS** → `docs/qa/gates/2.3-geracao-perguntas.yml`
Quality Score: **88/100**

### Recommended Status

✓ Ready for Development — 2 MEDIUM findings are non-blocking (awareness notes for @dev)

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
