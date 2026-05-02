# QA Fix Request: Epic 3 — Socratic Learning Engine

**Generated:** 2026-02-08T11:00:00Z
**QA Report Source:** docs/qa/epic-3-qa-review.md
**Reviewer:** Quinn (Test Architect)
**Stories:** 3.1, 3.2, 3.3, 3.4, 3.5

---

## Instructions for @dev

Fix ONLY the issues listed below. Do not add features or refactor unrelated code.

**Process:**

1. Read each issue carefully
2. Fix the specific problem described
3. Verify using the verification steps provided
4. Mark the issue as fixed in this document
5. Run all checks before marking complete

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| BLOCKER | 3 | Must fix before merge |
| HIGH | 4 | Must fix before merge |
| MEDIUM | 4 | Should fix before merge |

---

## Issues to Fix

### 1. [BLOCKER] Rate Limiting Ausente na API Route

**Issue ID:** FIX-E3-001
**Story:** 3.4 — AC14

**Location:** `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts`

**Problem:**
A API route POST nao tem nenhuma protecao contra abuso. Cada request dispara 4 chamadas LLM (Socrates + Editor + Tester + Analyst). Sem rate limiting, um usuario pode exaurir cota/creditos rapidamente.

```typescript
// Atual: NENHUM rate limiting
export async function POST(request: Request, { params }) {
  // ... vai direto para logica de negocio
}
```

**Expected:**
Implementar rate limiting no inicio do handler, ANTES de qualquer logica de negocio. A story especifica `@upstash/ratelimit` com sliding window de 10 req/min por user.

```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
})

export async function POST(request: Request, { params }) {
  // ... auth check primeiro
  const { success } = await ratelimit.limit(user.id)
  if (!success) {
    return new Response("Too Many Requests", { status: 429 })
  }
  // ... resto da logica
}
```

**Nota:** Se `@upstash/redis` nao estiver configurado no ambiente, implementar um fallback in-memory simples usando `Map<string, { count, timestamp }>` ate que Redis esteja disponivel. Nao deixar sem rate limiting.

**Verification:**

- [ ] Dependencia `@upstash/ratelimit` adicionada ao package.json (ou fallback in-memory)
- [ ] Rate limit check executado ANTES de qualquer logica de negocio
- [ ] Retorna 429 quando limite excedido
- [ ] User ID usado como chave de rate limiting
- [ ] Typecheck passa: `pnpm run typecheck`

**Status:** [ ] Fixed

---

### 2. [BLOCKER] Botao "Proximo Capitulo" Aponta para Rota Inexistente

**Issue ID:** FIX-E3-002
**Story:** 3.5 — AC5

**Location:** `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/session-complete-bar.tsx:93`

**Problem:**
O botao "Proximo Capitulo" linka para `/courses/${courseId}/chapters/${chapterId}/next` — essa rota NAO existe. Usuario clica → 404.

```typescript
// Atual: rota inexistente
href={`/courses/${courseId}/chapters/${chapterId}/next`}
```

Alem disso, o botao e sempre renderizado, sem verificar se existe proximo capitulo ou se ele tem perguntas ativas.

**Expected:**
O componente `SessionCompleteBar` deve receber props com informacao do proximo capitulo (pre-calculado no RSC pai). Se nao houver proximo capitulo com perguntas ativas, o botao nao deve ser renderizado.

Opcao A — Resolver no RSC (RECOMENDADO):
```typescript
// session/page.tsx (RSC) — calcular proximo capitulo
const { data: nextChapter } = await supabase
  .from("chapters")
  .select("id, title, questions!inner(id)")
  .eq("course_id", courseId)
  .eq("status", "published")
  .eq("questions.status", "active")
  .gt("order", currentChapter.order)
  .order("order", { ascending: true })
  .limit(1)
  .single()

// Passar como prop
<SessionCompleteBar
  nextChapterId={nextChapter?.id ?? null}
  courseId={courseId}
/>
```

```typescript
// session-complete-bar.tsx — render condicional
{nextChapterId && (
  <Link href={`/courses/${courseId}/chapters/${nextChapterId}`}>
    Proximo Capitulo
  </Link>
)}
```

**Verification:**

- [ ] Botao navega para URL valida de capitulo existente
- [ ] Botao NAO renderizado quando nao ha proximo capitulo
- [ ] Botao NAO renderizado quando proximo capitulo nao tem perguntas ativas
- [ ] Botao "Voltar ao Curso" continua funcionando
- [ ] Sem erros 404 ao clicar

**Status:** [ ] Fixed

---

### 3. [BLOCKER] Campo `observations` do Analyst Nao Persistido

**Issue ID:** FIX-E3-003
**Story:** 3.4 — AC9

**Location:**
- `supabase/migrations/20260208000000_epic3_rpc_functions.sql` (migration)
- `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts:128-134` (insert)

**Problem:**
O Analyst gera `observations: string[]` mas esse dado e descartado silenciosamente:

1. A tabela `analyses` NAO tem coluna `observations` (nem no initial_schema nem na migration Epic 3)
2. O insert em `analyses` na API route NAO inclui o campo

```typescript
// Analyst retorna observations (analyst.ts:70)
observations: object.observations  // string[]

// Mas o insert NAO inclui (route.ts:128-134)
serviceClient.from("analyses").insert({
  message_id: studentMsg.id,
  session_id: sessionId,
  ai_detection: analysisResult.aiDetection,
  metrics: analysisResult.metrics,
  flags: analysisResult.flags,
  tenant_id: session.tenant_id,
  // observations: MISSING!
})
```

**Expected:**

Passo 1 — Adicionar coluna na migration:
```sql
-- Em 20260208000000_epic3_rpc_functions.sql, apos linha 10:
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS observations JSONB DEFAULT '[]';
```

Passo 2 — Incluir no insert:
```typescript
serviceClient.from("analyses").insert({
  message_id: studentMsg.id,
  session_id: sessionId,
  ai_detection: analysisResult.aiDetection,
  metrics: analysisResult.metrics,
  flags: analysisResult.flags,
  observations: analysisResult.observations,  // ADD THIS
  tenant_id: session.tenant_id,
})
```

**Verification:**

- [ ] Coluna `observations JSONB DEFAULT '[]'` adicionada na migration
- [ ] Insert em `analyses` inclui `observations`
- [ ] Typecheck passa
- [ ] Sem erros de runtime ao inserir

**Status:** [ ] Fixed

---

### 4. [HIGH] 21 Lint Errors em @eximia/agents

**Issue ID:** FIX-E3-004
**Story:** 3.2

**Location:** `packages/agents/src/` (orchestrator.ts, analyst.ts, creator.ts, schemas/)

**Problem:**
21 lint errors bloqueiam pre-commit hook. Tipos:
- `noUnusedTemplateLiteral` — backticks sem interpolacao (ex: `` `Conteudo:` `` → `"Conteudo:"`)
- `organizeImports` — imports nao ordenados alfabeticamente
- `format` — formatacao inconsistente

**Expected:**
Rodar auto-fix do Biome:

```bash
cd packages/agents && npx biome check --fix --unsafe ./src
```

Depois verificar se nao quebrou nada:
```bash
pnpm run typecheck && pnpm run test
```

**Verification:**

- [ ] `cd packages/agents && pnpm run lint` retorna 0 errors
- [ ] Testes continuam passando: `pnpm run test`
- [ ] Typecheck passa: `pnpm run typecheck`

**Status:** [ ] Fixed

---

### 5. [HIGH] 6 Lint Errors em @eximia/shared

**Issue ID:** FIX-E3-005
**Story:** 3.4

**Location:** `packages/shared/src/utils/sanitize.ts:17`

**Problem:**
Biome flaggeia control characters em regex como suspicious. O regex e INTENCIONAL — faz sanitizacao de seguranca removendo control chars.

```typescript
// Linha 17 — flaggeada 6x por diferentes control chars no range
sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
```

**Expected:**
Adicionar biome-ignore comment na linha anterior:

```typescript
// Strip control characters (preserve newline \n and tab \t)
// biome-ignore lint/suspicious/noControlCharactersInRegex: Intentional security sanitization to strip dangerous control characters
sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
```

**Verification:**

- [ ] `cd packages/shared && pnpm run lint` retorna 0 errors
- [ ] Regex continua funcionando (sanitizacao nao quebrada)
- [ ] Typecheck passa

**Status:** [ ] Fixed

---

### 6. [HIGH] `response_time_seconds` Hardcoded como 0

**Issue ID:** FIX-E3-006
**Story:** 3.3 — AC13

**Location:** `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/socratic-chat.tsx:82`

**Problem:**
O tempo de resposta do aluno e sempre enviado como 0, independente de quanto tempo o aluno levou para responder.

```typescript
// Atual: hardcoded
body: JSON.stringify({ content: text, response_time_seconds: 0 })
```

**Expected:**
Medir o tempo entre o recebimento da ultima resposta do tutor e o envio da proxima mensagem do aluno.

```typescript
// Adicionar ref para tracking
const lastResponseTimeRef = useRef<number>(Date.now())

// Ao receber resposta completa (quando isLoading muda de true → false)
useEffect(() => {
  if (!isLoading && messages.length > 0) {
    lastResponseTimeRef.current = Date.now()
  }
}, [isLoading])

// No submit, calcular diff
const responseTime = (Date.now() - lastResponseTimeRef.current) / 1000
body: JSON.stringify({
  content: text,
  response_time_seconds: Math.round(responseTime),
})
```

**Verification:**

- [ ] `response_time_seconds` varia conforme tempo real do aluno
- [ ] Valor e > 0 em uso normal
- [ ] Primeira interacao pode ser 0 (aceitavel)
- [ ] Typecheck passa

**Status:** [ ] Fixed

---

### 7. [HIGH] Zero Testes no @eximia/web

**Issue ID:** FIX-E3-007
**Story:** 3.1, 3.4

**Location:** `apps/web/` (nenhum arquivo de teste existe)

**Problem:**
`vitest run` retorna "No test files found" para o package web. Logica complexa (server actions, API route com claim atomico, error recovery, streaming) sem nenhuma cobertura.

**Expected:**
Criar ao menos os seguintes testes prioritarios:

1. **`packages/shared/tests/sanitize.test.ts`** — sanitizeStudentMessage():
   - Remove HTML tags
   - Remove control characters
   - Remove prompt delimiters (`<system>`, `[INST]`, etc.)
   - Preserva Unicode (emojis, acentos)
   - Input vazio retorna vazio

2. **`apps/web/src/app/api/sessions/[sessionId]/messages/__tests__/route.test.ts`** (opcional, mas recomendado):
   - 401 sem auth
   - 400 com body invalido
   - 409 quando sessao nao disponivel

**Nota:** O teste de sanitizacao e o mais critico — dados de seguranca sem cobertura.

**Verification:**

- [ ] Ao menos `sanitize.test.ts` criado com 5+ test cases
- [ ] `pnpm run test` executa os novos testes
- [ ] Todos os testes passam

**Status:** [ ] Fixed

---

### 8. [MEDIUM] Formato de Tempo Usa "m/s" ao Inves de Portugues

**Issue ID:** FIX-E3-008
**Story:** 3.5 — AC4

**Location:** `apps/web/.../session/_components/session-complete-bar.tsx` funcao `formatDuration()`

**Problem:**
```typescript
// Atual
if (minutes === 0) return `${secs}s`
return `${minutes}m ${secs}s`
```

**Expected:**
```typescript
if (minutes === 0) return `${secs} seg`
return `${minutes} min ${secs} seg`
```

**Verification:**

- [ ] Tempo exibido em portugues: "12 min 45 seg"
- [ ] Typecheck passa

**Status:** [ ] Fixed

---

### 9. [MEDIUM] ChatMessage/ChatInput Locais Duplicam @eximia/ui

**Issue ID:** FIX-E3-009
**Story:** 3.3

**Location:**
- `apps/web/.../session/_components/chat-message.tsx` (local)
- `apps/web/.../session/_components/chat-input.tsx` (local)
- `packages/ui/src/components/chat-message.tsx` (biblioteca)
- `packages/ui/src/components/chat-input.tsx` (biblioteca)

**Problem:**
Componentes locais foram criados ao inves de usar os da biblioteca `@eximia/ui`, que ja exporta `ChatMessage` e `ChatInput`.

**Expected:**
Avaliar se os componentes da biblioteca atendem os requisitos do chat socratico. Se sim, migrar os imports em `socratic-chat.tsx`. Se nao, documentar o motivo da divergencia como comentario no componente local.

**Decisao necessaria do @dev:** Migrar ou documentar.

**Verification:**

- [ ] Imports migrados para @eximia/ui OU motivo documentado em comentario
- [ ] Funcionalidade do chat inalterada
- [ ] Typecheck passa

**Status:** [ ] Fixed

---

### 10. [MEDIUM] Vanilla Fetch ao Inves de useChat() Hook

**Issue ID:** FIX-E3-010
**Story:** 3.3

**Location:** `apps/web/.../session/_components/socratic-chat.tsx`

**Problem:**
A story Dev Notes mencionam `useChat()` hook do Vercel AI SDK para integracao com DataStream protocol. A implementacao usa `fetch()` manual com parsing proprio do protocolo. Isso aumenta surface area para bugs e requer manutencao manual do parser.

**Expected:**
Avaliar migracao para `useChat()` que ja faz:
- Parse automatico de DataStream protocol
- Estado de messages gerenciado
- `isLoading` automatico
- `onFinish`, `onError` callbacks

**Decisao necessaria do @dev:** Se `useChat()` atende todos os requisitos (data annotations para contador, streaming), migrar. Caso contrario, documentar limitacao.

**Verification:**

- [ ] Migrado para useChat() OU limitacao documentada
- [ ] Streaming continua funcionando word-by-word
- [ ] Contador de interacoes atualiza corretamente
- [ ] Error handling mantem toast + retry

**Status:** [ ] Fixed

---

### 11. [MEDIUM] 4 Lint Errors Pre-Existentes em @eximia/ui

**Issue ID:** FIX-E3-011
**Story:** Pre-existente (nao do Epic 3)

**Location:** `packages/ui/src/components/`
- `select-native.tsx` — SVG sem texto alternativo
- `progress-bar.tsx` — div com role interativo sem tabIndex

**Problem:**
4 errors + 19 warnings pre-existentes. Nao foram introduzidos pelo Epic 3 mas bloqueiam `pnpm run lint` no monorepo.

**Expected:**
- SVG: adicionar `aria-hidden="true"` (decorativo) ou `<title>` element
- ProgressBar: adicionar `tabIndex={0}` ao div com `role="progressbar"`

**Verification:**

- [ ] `cd packages/ui && pnpm run lint` retorna 0 errors
- [ ] Testes continuam passando (295 tests)

**Status:** [ ] Fixed

---

## Constraints

**CRITICAL: @dev deve seguir estas restricoes:**

- [ ] Fix ONLY the issues listed above
- [ ] Do NOT add new features
- [ ] Do NOT refactor unrelated code
- [ ] Run typecheck: `pnpm run typecheck` (deve passar — 0 errors)
- [ ] Run lint: `pnpm run lint` (deve passar — 0 errors em TODOS os packages)
- [ ] Run tests: `pnpm run test` (deve passar — 318+ tests, 0 failures)
- [ ] Update story file list if any new files created

---

## Prioridade de Execucao

Ordem recomendada para maxima eficiencia:

1. **FIX-E3-004** (lint agents) — rapido, auto-fix
2. **FIX-E3-005** (lint shared) — rapido, 1 linha
3. **FIX-E3-011** (lint UI) — rapido, 2 fixes
4. **FIX-E3-003** (observations) — migration + 1 linha no insert
5. **FIX-E3-008** (formato tempo) — 2 strings
6. **FIX-E3-002** (botao proximo capitulo) — logica RSC + render condicional
7. **FIX-E3-001** (rate limiting) — nova dependencia + handler
8. **FIX-E3-006** (response_time) — useRef + useEffect
9. **FIX-E3-007** (testes) — sanitize.test.ts
10. **FIX-E3-009** (chat components) — avaliar + decidir
11. **FIX-E3-010** (useChat hook) — avaliar + decidir

---

## After Fixing

1. Mark each issue as fixed in this document
2. Run full validation: `pnpm run lint && pnpm run typecheck && pnpm run test`
3. Request QA re-review: `@qa *review epic-3`

---

_Generated by Quinn (Test Architect) — AIOS QA System_
