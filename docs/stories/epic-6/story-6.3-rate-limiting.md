# Story 6.3: Rate Limiting nas APIs

**Epic:** [Epic 6 — Simplificacao & Seguranca](../../epics/epic-6-simplificacao-seguranca.md)
**Version:** 1.1
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P0 (Blocker de producao)
**Blocked By:** —
**Blocks:** —
**Assigned To:** @dev (Dex)
**Risk:** LOW — implementacao isolada no middleware

---

## User Story

**As a** platform operator,
**I want** rate limiting em todas as APIs criticas,
**so that** a plataforma esteja protegida contra abuso, brute-force e custos excessivos de LLM.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 14.3 (Rate Limiting) |
| **PRD Ref** | `docs/prd.md` — NFR4 (seguranca) |
| **Stack** | Next.js 15 Edge Middleware + Upstash Redis + @upstash/ratelimit |
| **Current State** | In-memory rate limiting apenas em `/api/sessions/*/messages` (nao persiste entre deploys, nao funciona em edge) |
| **Dependencies** | Nenhuma (independente de Stories 6.1/6.2) |
| **Impact** | Middleware (`middleware.ts`), package.json (nova dependencia), env vars |

---

## Acceptance Criteria

- [x] **AC1:** Rate limiting ativo em `/api/sessions/*/messages` — 10 req/min por usuario autenticado
- [x] **AC2:** Rate limiting ativo em `/api/auth/*` — 5 req/min por IP
- [x] **AC3:** Rate limiting ativo em `/api/chapters/*/generate-questions` — 5 req/5min por usuario
- [x] **AC4:** Rate limiting ativo em `/api/courses` (POST) — 20 req/hora por usuario
- [x] **AC5:** Rate limiting catch-all em todos os outros endpoints — 100 req/min por IP
- [x] **AC6:** Rate limiting ativo em `/api/privacy/*` — 3 req/min por usuario
- [x] **AC7:** Resposta `429 Too Many Requests` com header `Retry-After` quando limite excedido
- [x] **AC8:** Rate limiting usa Upstash Redis (serverless, edge-compatible)
- [x] **AC9:** Configuracao via variaveis de ambiente (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- [x] **AC10:** Rate limiting funciona em Edge Runtime (middleware do Next.js)
- [x] **AC11:** Logs de rate limit events para auditoria

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 8, 9) Instalar dependencias e configurar env
  - [x]`pnpm add @upstash/ratelimit @upstash/redis` no workspace `apps/web`
  - [x]Adicionar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` ao `.env.local` (e `.env.example`)
  - [x]Documentar variaveis de ambiente necessarias

- [x] **Task 2** (AC: 1, 2, 3, 4, 5, 6, 8, 10) Implementar rate limiters no middleware
  - [x]Criar rate limiter configs em `apps/web/src/lib/rate-limit.ts` (ou inline no middleware):
    ```typescript
    import { Ratelimit } from "@upstash/ratelimit"
    import { Redis } from "@upstash/redis"

    const redis = Redis.fromEnv()

    export const chatLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "rl:chat",
      analytics: true,
    })

    export const authLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "rl:auth",
    })

    export const questionGenLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "5 m"),
      prefix: "rl:questions",
    })

    export const courseCreateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "rl:courses",
    })

    export const privacyLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 m"),
      prefix: "rl:privacy",
    })

    export const catchAllLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "rl:global",
    })
    ```
  - [x]Atualizar `apps/web/src/middleware.ts`:
    - **Sequencia correta no middleware (PO FIX 6.3-M-1):**
      1. IP-based rate limits (auth, catch-all) — ANTES da autenticacao
      2. `supabase.auth.getUser()` — obter identidade do usuario
      3. User-based rate limits (chat, courses, privacy, questions) — APOS autenticacao (requer userId)
    - Rotear para o limiter correto baseado no pathname
    - Identificar por userId (autenticado) ou IP (nao autenticado/fallback)

- [x] **Task 3** (AC: 7) Implementar resposta 429
  - [x]Retornar `NextResponse` com status 429
  - [x]Header `Retry-After` com valor em segundos ate o reset
  - [x]Body JSON: `{ error: "Too Many Requests", retryAfter: N }`

- [x] **Task 4** (AC: 10) Garantir compatibilidade Edge Runtime
  - [x]Middleware ja roda em Edge — verificar que `@upstash/ratelimit` e `@upstash/redis` sao edge-compatible (sao por design)
  - [x]Atualizar `config.matcher` no middleware para incluir rotas `/api/`
  - [x]**IMPORTANTE:** Matcher atual exclui `/api/` — deve ser atualizado:
    ```typescript
    export const config = {
      matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
    }
    ```

- [x] **Task 5** Implementar fail-open strategy
  - [x]Se Redis indisponivel, permitir request (fail-open)
  - [x]Log de warning quando Redis esta down
  - [x]Wrap rate limit check em try-catch

- [x] **Task 6** (AC: 11) Implementar logging de rate limit events
  - [x]Log quando rate limit e atingido: `console.warn("[rate-limit] User ${id} exceeded ${limiterName} limit")`
  - [x]Incluir: timestamp, user/IP, endpoint, limiter name, remaining requests

- [x] **Task 7** Remover rate limiting in-memory existente
  - [x]Remover `rateLimitStore`, `checkRateLimit()` e `RATE_LIMIT_*` consts de `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts`
  - [x]Rate limiting agora e centralizado no middleware

- [x] **Task 8** Validacao final
  - [x]`pnpm typecheck` — zero erros
  - [x]`pnpm lint` — zero erros
  - [x]Teste manual: enviar requests alem do limite e verificar 429

---

## Dev Notes

### Architecture Rate Limiting Table [Source: architecture.md v1.3, Section 14.3]

| Endpoint | Limite | Janela | Camada |
|----------|--------|--------|--------|
| `/api/sessions/*/messages` | 10 req | 1 min | Edge Middleware (por user) |
| `/api/auth/*` | 5 req | 1 min | Edge Middleware (por IP) |
| `/api/courses` (POST) | 20 req | 1 hora | Edge Middleware (por user) |
| `/api/generate-questions` | 5 req | 5 min | Edge Middleware (por user) |
| `/api/privacy/*` | 3 req | 1 min | Edge Middleware (por user) |
| Demais endpoints | 100 req | 1 min | Edge Middleware (por IP) |

### Current Middleware [Source: apps/web/src/middleware.ts]

```typescript
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { ... } })
  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes check
  const protectedPaths = ["/dashboard", "/courses", "/admin", "/analytics"]
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Tenant resolution via subdomain
  const hostname = request.headers.get("host") || ""
  const subdomain = hostname.split(".")[0]
  response.headers.set("x-tenant-slug", tenantSlug)
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
  //                                                    ^^^^
  //  PROBLEMA: /api/ esta excluido do matcher!
  //  Deve ser removido para rate limiting funcionar
}
```

**CRITICO:** O matcher atual EXCLUI rotas `/api/`. Para rate limiting funcionar no middleware, o matcher deve incluir `/api/` routes. Atualizar para:
```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

### Existing In-Memory Rate Limit [Source: apps/web/src/app/api/sessions/[sessionId]/messages/route.ts]

```typescript
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const rateLimitStore = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean { ... }
```

**Acao:** Remover completamente — sera substituido pelo rate limiting centralizado no middleware via Upstash.

### Upstash Redis [Source: epic-6 Technical Notes]

- **Package:** `@upstash/ratelimit` + `@upstash/redis`
- **Edge-compatible:** Sim — usa HTTP REST API, nao TCP connection
- **Free tier:** 10k req/dia (suficiente para MVP)
- **Algorithm:** Sliding window (`Ratelimit.slidingWindow()`)
- **Fail-open:** Se Redis indisponivel, request passa com log de warning

### IP Extraction in Edge Middleware

```typescript
// Para endpoints por IP (auth, catch-all)
const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ??
           request.headers.get("x-real-ip") ??
           "unknown"

// Para endpoints por user (chat, courses, privacy)
const userId = user?.id ?? ip // fallback to IP if not authenticated
```

### Routing Logic no Middleware

```typescript
const pathname = request.nextUrl.pathname

// Determinar limiter baseado no pathname
if (pathname.match(/^\/api\/sessions\/.*\/messages/)) {
  // chatLimiter — 10/min per user
} else if (pathname.startsWith("/api/auth")) {
  // authLimiter — 5/min per IP
} else if (pathname.match(/^\/api\/chapters\/.*\/generate-questions/)) {
  // questionGenLimiter — 5/5min per user
} else if (pathname === "/api/courses" && request.method === "POST") {
  // courseCreateLimiter — 20/hr per user
} else if (pathname.startsWith("/api/privacy")) {
  // privacyLimiter — 3/min per user
} else if (pathname.startsWith("/api/")) {
  // catchAllLimiter — 100/min per IP
}
```

### Source Tree

```
apps/web/
├── src/
│   ├── middleware.ts                    # UPDATED: Add rate limiting
│   ├── lib/
│   │   └── rate-limit.ts              # NEW: Rate limiter configs
│   └── app/api/sessions/[sessionId]/
│       └── messages/route.ts          # UPDATED: Remove in-memory rate limit
├── package.json                        # UPDATED: Add @upstash/ratelimit, @upstash/redis
├── .env.local                         # UPDATED: Add UPSTASH_REDIS_* vars
└── .env.example                       # UPDATED: Add UPSTASH_REDIS_* vars
```

### Testing

- **Framework:** Vitest
- **Key validacao:** Rate limit retorna 429 apos exceder threshold. Headers `Retry-After` presentes
- **Fail-open test:** Se Redis down, requests passam normalmente com warning log
- **Manual test:** Enviar N+1 requests e verificar 429 na resposta (N+1)
- **Edge compatibility:** Verificar que middleware executa sem erros em Edge Runtime

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass | Yes |
| Pre-PR | Rate limit retorna 429 apos exceder threshold. Headers `Retry-After` presentes. Fail-open funciona se Redis down | Yes |

---

## Definition of Done

- [x] Rate limiting ativo em 6 categorias de endpoints
- [x] Upstash Redis integrado via env vars
- [x] Resposta 429 com Retry-After header
- [x] Fail-open strategy implementada
- [x] Logging de rate limit events
- [x] In-memory rate limit removido
- [x] Middleware matcher atualizado para incluir /api/
- [x] typecheck + lint passam
- [x] Edge Runtime compativel

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao do middleware com rate limiting |
| **@architect (Aria)** | Review de pattern e fail-open strategy |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Rate limiting bloqueia usuarios legitimos | LOW | Limites generosos para MVP. Fail-open se Redis down |
| Upstash Redis indisponivel | LOW | Fail-open strategy — requests passam sem rate limit |
| Middleware matcher quebra rotas existentes | MEDIUM | Testar todas as rotas apos atualizar matcher |
| Middleware roda em TODAS as API routes apos mudanca do matcher | MEDIUM | `supabase.auth.getUser()` agora executa em cada request API (latencia extra ~50ms). Aceitavel para MVP. Otimizar depois se necessario: skip auth para rotas sem rate limit por user (PO FIX 6.3-M-2) |
| Custo Upstash excede free tier | LOW | Free tier: 10k req/dia. Monitorar uso |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 6 | River (SM) |
| 2026-02-08 | 1.1 | PO FIX: 6.3-M-1 clarify rate limit sequencing (IP before auth, user after), 6.3-M-2 document matcher side effects | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- rate-limit.ts verified: 6 limiters (chat, auth, questionGen, courseCreate, privacy, catchAll)
- middleware.ts verified: correct sequencing (IP-based before auth, user-based after)
- Fail-open confirmed: null Redis returns null limiters, middleware skips rate check
- Tests: `src/lib/__tests__/rate-limit.test.ts` — 3 tests passing

### Completion Notes List
- Fully implemented in commit `7ef869a` (Epics 6, 9, 11)
- Upstash packages added to apps/web/package.json
- Middleware matcher updated to include /api/ routes
- In-memory rate limit removed from messages/route.ts

### File List
- `apps/web/src/lib/rate-limit.ts` — NEW (6 Upstash rate limiters + fail-open)
- `apps/web/src/middleware.ts` — MODIFIED (rate limiting + updated matcher)
- `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts` — MODIFIED (in-memory RL removed)
- `apps/web/package.json` — MODIFIED (@upstash/ratelimit, @upstash/redis added)

---

## QA Results
_(to be filled by @qa)_

---

*Story criada por River (Scrum Master) — exímIA Academy*

— River, removendo obstaculos 🌊
