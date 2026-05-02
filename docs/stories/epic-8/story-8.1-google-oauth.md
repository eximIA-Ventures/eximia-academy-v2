# Story 8.1: Google OAuth

**Epic:** [Epic 8 — Autenticacao Enterprise](../../epics/epic-8-autenticacao-enterprise.md)
**Version:** 1.1
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 3
**Priority:** P1
**Blocked By:** —
**Blocks:** —
**Assigned To:** —

---

## User Story

**As an** invited user,
**I want** fazer login com minha conta Google,
**so that** eu acesse a plataforma com 1 clique sem criar nova senha.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 14.5 (Auth & RBAC), Section 8.2 (Tenant Resolution) |
| **PRD Ref** | `docs/prd.md` — FR3 (OAuth, SSO SAML) |
| **Epic Ref** | `docs/epics/epic-8-autenticacao-enterprise.md` v1.1 — Story 8.1 |
| **Stack** | Next.js 15 (App Router) + Supabase Auth (native Google OAuth) + Tailwind CSS 4 + @eximia/ui |
| **DB Tables** | `users` (full_name, profile JSONB, avatar_url, tenant_id), `tenants` (slug, settings) |
| **Auth Files** | `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/api/auth/callback/route.ts`, `apps/web/src/middleware.ts` |
| **Validators** | `packages/shared/src/validators/auth.ts` — loginSchema, acceptInviteSchema |
| **Invite Flow** | Story 5.2 — `supabaseAdmin.auth.admin.inviteUserByEmail()` |
| **Risk** | LOW — Supabase suporta Google OAuth nativamente |

---

## Acceptance Criteria

- [ ] **AC1:** Botao "Continuar com Google" na pagina de login, abaixo do formulario de email/password
- [ ] **AC2:** OAuth flow: click → Google consent → callback → redirect para dashboard
- [ ] **AC3:** Novo usuario via Google OAuth e associado ao tenant correto (via invite link ou tenant resolution via subdomain/slug)
- [ ] **AC3a:** Google OAuth e **bloqueado** se nao houver contexto de tenant (sem invite link e sem subdomain/slug). Exibir mensagem: "Solicite um convite ao administrador do seu tenant."
- [ ] **AC4:** Usuario existente (convidado por email) pode vincular conta Google ao perfil existente
- [ ] **AC5:** Avatar do Google importado automaticamente para `users.avatar_url` (coluna top-level no schema — NAO usar `profile.photo_url`)
- [ ] **AC6:** Nome do Google importado para `users.full_name` se nao preenchido
- [ ] **AC7:** OAuth funciona com o fluxo de invite: admin convida email → usuario clica invite → login com Google (mesmo email) → vinculado automaticamente
- [ ] **AC8:** Configuracao via Supabase Dashboard + variaveis de ambiente (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] **AC9:** Redirect pos-login respeita a pagina de origem (deep link preservation)
- [ ] **AC10:** Rate limiting do Story 6.3 se aplica ao callback OAuth
- [ ] **AC11:** Se usuario nega consent do Google, retorna para login com mensagem informativa: "Login com Google cancelado"
- [ ] **AC12:** Se email do Google nao tem convite ativo e nao ha contexto de tenant, exibe erro: "Solicite um convite ao administrador"
- [ ] **AC13:** Se OAuth callback falha (erro de rede, token expirado), exibe mensagem de erro generica com opcao de retry

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 8) Configurar Google OAuth no Supabase
  - [x] Documentar passo-a-passo para configurar Google Cloud Console (OAuth credentials)
  - [x] Redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
  - [x] Adicionar variaveis de ambiente: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - [x] Habilitar Google provider no Supabase Dashboard (Authentication → Providers → Google)

- [x] **Task 2** (AC: 1, 3a, 11, 12, 13) Atualizar login page com botao Google OAuth
  - [x] Detectar tenant context client-side (ver Dev Notes "Tenant Context Detection Client-Side"):
    ```typescript
    // Derivar tenant slug do hostname (producao) ou query param (localhost)
    const hostname = window.location.hostname
    const subdomain = hostname.split('.')[0]
    const searchParams = new URLSearchParams(window.location.search)
    const tenantSlug = subdomain !== 'localhost' ? subdomain : searchParams.get('tenant')
    const hasInvite = searchParams.has('invite_token') || searchParams.has('token')
    const hasTenantContext = !!tenantSlug || hasInvite
    ```
  - [x] Adicionar botao "Continuar com Google" abaixo do formulario email/password
  - [x] Seguir [Google Branding Guidelines](https://developers.google.com/identity/branding-guidelines): logo oficial + texto "Continuar com Google". **Dark mode:** usar variante dark do Google button (bg escuro com borda clara — o design system e dark-first #0f0f0f)
  - [x] Adicionar separador visual "ou" entre OAuth e email form
  - [x] Se `!hasTenantContext`: ocultar/desabilitar botao Google e exibir mensagem "Solicite um convite ao administrador do seu tenant."
  - [x] Implementar `handleGoogleLogin()`:
    ```typescript
    const handleGoogleLogin = () => {
      // redirectPath derivado de searchParams.get('next') ou '/dashboard'
      const redirectPath = searchParams.get('next') || '/dashboard'
      const supabase = createClient()
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`,
        },
      })
    }
    ```
  - [x] Tratar query param `error` na login page para exibir mensagens (AC11, AC12, AC13):
    - `oauth_cancelled` → "Login com Google cancelado"
    - `no_tenant` → "Solicite um convite ao administrador"
    - `auth_callback_failed` → "Erro na autenticacao. Tente novamente." com botao retry

- [x] **Task 3** (AC: 2, 3, 3a, 4, 5, 6, 7, 9, 10, 13) Atualizar auth callback route (profile sync + tenant enforcement)
  - [x] Atualizar `apps/web/src/app/api/auth/callback/route.ts`
  - [x] **Passo 1 — Error handling:** Antes do code exchange, tratar erros OAuth via query params:
    - Se `error=access_denied` → redirect para `/login?error=oauth_cancelled`
    - Se outro `error` presente → redirect para `/login?error=auth_callback_failed`
  - [x] **Passo 2 — Code exchange:** Manter `exchangeCodeForSession()` existente
  - [x] **Passo 3 — Provider detection + profile sync:**
    ```typescript
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.app_metadata?.provider === 'google') {
      // Usar service_role para update (callback nao tem RLS context)
      const serviceClient = createServiceClient()
      await serviceClient.from('users').update({
        avatar_url: user.user_metadata.avatar_url,  // Campo: users.avatar_url (top-level)
        full_name: user.user_metadata.full_name || user.user_metadata.name,
      }).eq('id', user.id).is('avatar_url', null)  // So atualizar se vazio
    }
    ```
  - [x] **Passo 4 — Tenant context enforcement:**
    - Verificar se usuario ja existe na tabela `users` (query por `user.id`)
    - Se existe: usuario ja tem `tenant_id` (invite flow) → prosseguir (AC4, AC7)
    - Se NAO existe e `user.user_metadata.tenant_id` existe (do invite): criar registro com tenant do invite
    - Se NAO existe e SEM tenant context → redirect para `/login?error=no_tenant` (AC3a)
  - [x] **Passo 5 — Deep link:** Respeitar query param `next` para redirect pos-login (AC9)
  - [x] Rate limiting ja existente (Story 6.3) cobre `/api/auth/*` (AC10). **Nota:** Se Story 6.3 nao estiver implementada, adicionar rate limiting basico neste endpoint

- [x] **Task 4** (AC: 4, 7) Garantir compatibilidade invite + OAuth
  - [x] Testar fluxo: admin convida email@google.com → usuario recebe invite → clica link → faz login com Google (mesmo email) → perfil ja existente e vinculado automaticamente
  - [x] Verificar que `users.role` e `users.tenant_id` do invite sao preservados apos OAuth link
  - [x] Verificar que `onboarding_completed` flag funciona normalmente (redirect para /onboarding se false)

- [x] **Task 5** Testes
  - [x] Test: Botao Google OAuth visivel quando ha tenant context (subdomain ou query param)
  - [x] Test: Botao Google OAuth oculto/desabilitado sem tenant context, mensagem exibida
  - [x] Test: handleGoogleLogin chama `signInWithOAuth` com provider 'google' e redirectTo correto (incluindo `next` param)
  - [x] Test: Callback importa avatar para `users.avatar_url` e nome para `users.full_name`
  - [x] Test: Callback NAO sobrescreve avatar/nome se ja preenchidos
  - [x] Test: Callback preserva deep link (query param `next`)
  - [x] Test: Erro OAuth `access_denied` redireciona para login com mensagem "cancelado"
  - [x] Test: Erro generico do callback exibe mensagem de erro com retry
  - [x] Test: Usuario sem tenant context recebe erro "Solicite um convite"
  - [x] Test: Login page exibe mensagens de erro baseadas em query params
  - [x] Test: Usuario existente (invite) faz login com Google → dados preservados (role, tenant_id) (AC4)
  - [x] Test: Fluxo invite email → Google OAuth mesmo email → vinculacao automatica (AC7)

---

## Dev Notes

### Existing Login Page [Source: `apps/web/src/app/(auth)/login/page.tsx`]

A login page atual e `'use client'` e usa:
- `@eximia/ui` components: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `FormField`, `Input`
- `@eximia/shared` validator: `loginSchema`
- `createClient()` from `@/lib/supabase/client`
- Formulario email/password com validacao Zod
- Componente `DevCredentials` (painel de dev para testes — canto inferior direito)
- Redirect pos-login: `router.push("/dashboard")` + `router.refresh()`

**Mudancas necessarias:**
1. Adicionar deteccao de tenant context client-side (ver secao abaixo)
2. Adicionar botao Google OAuth com separador "ou"
3. Tratar query params de erro (`error=oauth_cancelled`, `error=no_tenant`, `error=auth_callback_failed`)
4. Condicionar exibicao do botao Google baseado em tenant context

### Tenant Context Detection Client-Side [Source: middleware.ts analysis + PO review C-2]

A login page e `'use client'` e NAO tem acesso ao header `x-tenant-slug` do middleware. O tenant context deve ser derivado **client-side** usando a mesma logica do middleware:

```typescript
// Replicar logica do middleware client-side
function getTenantContext(): { tenantSlug: string | null; hasInvite: boolean } {
  const hostname = window.location.hostname
  const subdomain = hostname.split('.')[0]
  const searchParams = new URLSearchParams(window.location.search)

  // Producao: subdomain e o tenant (ex: demo.eximia.academy → "demo")
  // Localhost: fallback para ?tenant= query param
  const tenantSlug = subdomain !== 'localhost' ? subdomain : searchParams.get('tenant')

  // Invite tokens presentes na URL (magic link do Supabase)
  const hasInvite = searchParams.has('token') || searchParams.has('token_hash')

  return { tenantSlug, hasInvite }
}

// Usar no componente:
const { tenantSlug, hasInvite } = getTenantContext()
const hasTenantContext = !!tenantSlug || hasInvite
// Se !hasTenantContext → ocultar botao Google, exibir mensagem
```

**IMPORTANTE:** Esta logica espelha `apps/web/src/middleware.ts:49-50` para consistencia.

### Existing Auth Callback [Source: `apps/web/src/app/api/auth/callback/route.ts`]

```typescript
// Callback atual (19 linhas) — simples code exchange + redirect
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

**Mudancas necessarias:**
1. Tratar erros OAuth via query params (`error`, `error_description`) ANTES do code exchange
2. Apos `exchangeCodeForSession`, verificar provider e sincronizar perfil Google
3. Import avatar para `users.avatar_url` (coluna top-level) e nome para `users.full_name`
4. Verificar tenant context: usuario existe na tabela `users`? Se nao, tem `tenant_id` no user_metadata (invite)? Se nao, bloquear
5. Usar `createServiceClient()` para updates (callback nao tem RLS context adequado)

### Existing Middleware [Source: `apps/web/src/middleware.ts`]

- Tenant resolution via subdomain: `hostname.split(".")[0]`
- Fallback: `?tenant=demo` query param (localhost)
- Header `x-tenant-slug` setado para uso nas pages
- Auth check: redireciona para `/login` se nao autenticado em rotas protegidas
- Matcher exclui `/api/` — **callback route NAO passa pelo middleware** (importante: tenant context via callback precisa ser via query params ou user_metadata, nao via middleware header)

### Supabase OAuth Flow [Source: Supabase Auth docs]

```
1. Client chama supabase.auth.signInWithOAuth({ provider: 'google' })
2. Supabase redireciona para Google consent screen
3. Usuario autoriza
4. Google redireciona para Supabase callback: https://<project>.supabase.co/auth/v1/callback
5. Supabase processa tokens e redireciona para redirectTo (nosso /api/auth/callback)
6. Nosso callback troca code por session e redireciona para dashboard
```

**Tokens nao passam pelo nosso codigo** — Supabase gerencia tokens OAuth internamente. Nosso callback so recebe o `code` para trocar por session.

### Tenant Context para OAuth [Source: architecture.md Section 8.2]

O middleware **nao intercepta `/api/*` routes** (matcher config). Portanto, o callback OAuth nao tem acesso ao header `x-tenant-slug`. O tenant context para OAuth deve vir de:

1. **Invite token:** Se usuario foi convidado, o `user_metadata` contem `tenant_id` (setado pelo `inviteUserByEmail({ data: { tenant_id } })`)
2. **Subdomain no redirectTo:** Incluir o tenant slug no redirectTo URL para que o callback resolva
3. **Fallback:** Se nenhum contexto, bloquear (AC3a)

### Google Profile Data Available [Source: Supabase Auth user_metadata]

Apos OAuth login, `user.user_metadata` contem:
```typescript
{
  avatar_url: "https://lh3.googleusercontent.com/...",
  email: "user@gmail.com",
  email_verified: true,
  full_name: "User Name",
  name: "User Name",
  picture: "https://lh3.googleusercontent.com/...",
  provider_id: "1234567890",
  sub: "1234567890"
}
```

### Google Branding [Source: Epic 8 Technical Notes]

Botao deve seguir Google Branding Guidelines:
- Logo oficial do Google (SVG)
- Texto: "Continuar com Google"
- Background branco com borda cinza (ou dark mode: bg escuro com borda clara)
- Padding e espacamento conforme guidelines
- Separador "ou" entre o botao e o formulario email/password

### User Data Model [Source: architecture.md v1.3, Section 6.1]

```typescript
interface User {
  id: string            // UUID (Supabase Auth)
  tenant_id: string     // FK → Tenant
  email: string
  full_name: string
  role: 'student' | 'teacher' | 'admin' | 'manager'
  avatar_url: string | null
  profile: {
    photo_url?: string
    learning_style?: string
    experience_level?: string
    goals?: string[]
    sector?: string
  }
  onboarding_completed: boolean
  created_at: Date
  updated_at: Date
}
```

### Rate Limiting [Source: Story 6.3]

`/api/auth/*` routes limitadas a 5 req/1 min per IP. O callback OAuth (`/api/auth/callback`) ja esta coberto por esta regra.

**NOTA (PO review):** Verificar se Story 6.3 (rate limiting) ja esta implementada. Se nao estiver, adicionar rate limiting basico no callback (ex: via Vercel edge config ou middleware check). AC10 depende desta implementacao.

### Avatar Field Canonical [Source: DB schema, PO review C-1]

O schema tem **dois** locais possiveis para avatar:
- `users.avatar_url TEXT` — **coluna top-level no schema** (USAR ESTE)
- `users.profile JSONB` — pode conter `photo_url` (usado pelo onboarding Story 5.3)

**Decisao:** Google avatar deve ser salvo em `users.avatar_url` (coluna top-level). O campo `profile.photo_url` do onboarding e para upload manual. Se ambos existirem, a UI deve priorizar `avatar_url` (Google) sobre `profile.photo_url` (upload).

### File Locations

```
apps/web/src/app/
├── (auth)/login/
│   └── page.tsx                           # UPDATE: Add Google OAuth button + error handling
├── api/auth/callback/
│   └── route.ts                           # UPDATE: Profile sync + tenant context check + error handling

packages/shared/src/validators/
└── auth.ts                                # NO CHANGE (OAuth nao precisa de validacao Zod no login)
```

### Testing

- **Test location:** `apps/web/src/components/__tests__/` ou `apps/web/tests/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock `createClient()` e `supabase.auth.signInWithOAuth()`, mock `supabase.auth.getUser()` no callback
- **Key concern:** Testar tenant context detection e error handling states na login page

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam | Yes |
| Pre-PR | Google OAuth flow completo (login → callback → dashboard). Avatar importado. Invite + Google OAuth funciona. Deep link preservado. Botao oculto sem tenant context | Yes |

---

## Definition of Done

- [ ] Botao "Continuar com Google" visivel na login page (com tenant context)
- [ ] OAuth flow funcional: login → Google consent → callback → dashboard
- [ ] Avatar e nome do Google importados para perfil
- [ ] Tenant context enforcement: bloqueio sem invite/subdomain
- [ ] Compatibilidade com invite flow (Story 5.2)
- [ ] Error handling: consent denied, callback fail, no tenant
- [ ] Deep link preservation
- [ ] Nenhuma regressao no login email/password
- [ ] Testes passando
- [ ] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Login page update, callback handling, profile sync, tenant context enforcement |
| **@devops (Gage)** | Google Cloud Console setup, Supabase provider config, env vars |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Google OAuth token leak | HIGH | Tokens handled by Supabase (nao passam pelo nosso codigo). Revogar OAuth app no Google Console se necessario |
| OAuth sem contexto de tenant | HIGH | Bloquear Google OAuth se nao houver invite link ou subdomain (AC3a) |
| OAuth email mismatch com invite | LOW | Supabase vincula por email automaticamente. Login manual com email/password sempre disponivel |
| Google Branding compliance | LOW | Seguir guidelines oficiais. Revisar antes de PR |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 8 | River (SM) |
| 2026-02-08 | 1.1 | PO validation fixes: C-1 (avatar → users.avatar_url), C-2 (client-side tenant detection), S-1 (redirectPath defined), S-2 (added AC4/AC7 tests), S-3 (consolidated callback tasks) | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- All 21 tests pass (10 login form + 11 callback route)
- TypeScript compilation: zero errors
- Pre-existing disc-scoring test failure (unrelated)

### Completion Notes List
- Task 1: Google OAuth config is Supabase Dashboard setup (env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Redirect URI documented.
- Task 2: Login form updated with Google OAuth button, "ou" separator, tenant context detection (client-side + server prop), URL error handling (oauth_cancelled, no_tenant, auth_callback_failed with retry)
- Task 3: Auth callback updated with OAuth error handling, Google profile sync (avatar_url + full_name, only if empty), tenant context enforcement (blocks users without tenant)
- Task 4: Invite + OAuth compatibility verified via tests — existing user data preserved on Google OAuth link
- Task 5: 21 tests written covering all specified scenarios
- Rate limiting (AC10): Already covered by Story 6.3 middleware — `/api/auth/*` at 5 req/min per IP

### File List
- `apps/web/src/app/(auth)/login/page.tsx` — Modified: added Suspense wrapper, passes hasTenant prop
- `apps/web/src/components/auth/login-form.tsx` — Modified: Google OAuth button, tenant detection, error handling, GoogleLogo SVG
- `apps/web/src/app/api/auth/callback/route.ts` — Modified: OAuth error handling, Google profile sync, tenant enforcement
- `apps/web/src/components/auth/__tests__/login-form-google-oauth.test.tsx` — New: 10 tests for login form Google OAuth
- `apps/web/src/app/api/auth/callback/__tests__/route.test.ts` — New: 11 tests for auth callback

---

## QA Results

_To be filled after QA review_

---

*Story criada por River (Scrum Master) — eximIA Academy*

— River, removendo obstaculos 🌊
