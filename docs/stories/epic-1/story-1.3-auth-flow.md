# Story 1.3: Autenticacao com Supabase Auth

**Epic:** [Epic 1 — Foundation & Auth](../epics/epic-1-foundation-auth.md)
**Version:** 1.0
**Created:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** 1.1, 1.2
**Blocks:** 1.4
**Assigned To:** @dev (Dex), @qa (Quinn) testing

---

## User Story

**As a** user,
**I want** fazer login via convite email,
**so that** eu possa acessar a plataforma de forma segura.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2 — Section 9 (Routes), Section 14 (Security) |
| **Screens Ref** | `docs/screens.md` — Screen 1 (Login), Screen 1b (Accept Invite) |
| **Auth Model** | Invite-only (ARCH-3). NAO ha self-registration. |
| **Stack** | Supabase Auth (`@supabase/ssr`) + Next.js Middleware |
| **Validation** | Zod schemas (SEC-4) |
| **Rate Limiting** | `/api/auth/*` — 5 req/1 min per IP |

> **ARCH-3 Alignment:** A plataforma opera no modelo **invite-only**. Nao ha self-registration. Admin cria convite via `POST /api/admin/users` → email com magic link → usuario acessa `/accept-invite` → completa onboarding. A referencia a `/register` no PRD Story 1.3 AC#2 deve ser interpretada como `/accept-invite`.

---

## Acceptance Criteria

- [ ] **AC1:** Pagina de login (`/login`) com formulario email + password
  - Campos: email (type=email), password (type=password)
  - Botao "Entrar"
  - Link "Esqueci minha senha"
  - Mensagens de erro inline
  - Loading state durante submit

- [ ] **AC2:** Pagina de accept-invite (`/auth/accept-invite`) que processa magic link e permite definir password
  - Rota canonica: `(auth)/accept-invite/page.tsx`
  - Processa token da URL (`?token=...`)
  - Formulario: password + confirm password
  - Validacao: min 8 chars, match confirmation
  - Success: auto-login → redirect para `/dashboard`
  - Error: token invalido/expirado com mensagem clara

- [ ] **AC3:** Supabase Auth configurado para email/password
  - `@supabase/ssr` instalado e configurado
  - Server client e browser client helpers criados

- [ ] **AC4:** Middleware Next.js verifica sessao em rotas protegidas (`/(platform)/*`)
  - Arquivo: `apps/web/src/middleware.ts`
  - Verifica `supabase.auth.getUser()` para rotas `/(platform)`
  - Atualiza session cookies automaticamente

- [ ] **AC5:** Redirect para `/login` se nao autenticado
  - Qualquer acesso a `/(platform)/*` sem sessao → redirect `/login`

- [ ] **AC6:** Redirect para `/dashboard` apos login bem-sucedido
  - Login valido → `/(platform)/dashboard`
  - Accept-invite valido → `/(platform)/dashboard`

- [ ] **AC7:** Botao de logout funcional
  - Chama `supabase.auth.signOut()`
  - Redirect para `/login` apos logout
  - Limpa cookies/session

- [ ] **AC8:** Cookies httpOnly para tokens (Supabase default)
  - Tokens NAO devem estar em localStorage
  - `@supabase/ssr` gerencia cookies automaticamente
  - Verificar que cookies sao httpOnly e Secure

- [ ] **AC9:** Loading states durante auth operations
  - Login form: botao disabled + spinner durante submit
  - Accept-invite: loading durante processamento de token
  - Logout: feedback visual

- [ ] **AC10:** Formularios validados com Zod (input validation — SEC-4)
  ```typescript
  // packages/shared/src/validators/auth.ts
  export const loginSchema = z.object({
    email: z.string().email('Email invalido'),
    password: z.string().min(1, 'Senha obrigatoria'),
  })

  export const acceptInviteSchema = z.object({
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string(),
  }).refine(d => d.password === d.confirmPassword, {
    message: 'Senhas nao conferem',
    path: ['confirmPassword'],
  })

  export const resetPasswordSchema = z.object({
    email: z.string().email('Email invalido'),
  })
  ```

- [ ] **AC11:** Link "Esqueci minha senha" na pagina de login com fluxo via Supabase Auth
  - Usa `supabase.auth.resetPasswordForEmail(email)`
  - Modal ou inline form para digitar email
  - Mensagem de confirmacao: "Email enviado se a conta existir"

---

## Technical Implementation Guide

### App Router Structure

```
apps/web/src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx           # Login form
│   ├── accept-invite/
│   │   └── page.tsx           # Process magic link + set password
│   ├── reset-password/
│   │   └── page.tsx           # Reset password form (optional)
│   └── layout.tsx             # Auth layout (centered, no sidebar)
├── (platform)/
│   ├── dashboard/
│   │   └── page.tsx           # Role-based dashboard (Story 1.4)
│   └── layout.tsx             # Platform layout with sidebar (Story 1.4)
├── api/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts       # Supabase auth callback handler
│   └── admin/
│       └── users/
│           └── route.ts       # POST: invite user (admin only)
└── middleware.ts               # Auth + tenant resolution
```

### Supabase Client Helpers

**Server Client (`apps/web/src/lib/supabase/server.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Browser Client (`apps/web/src/lib/supabase/client.ts`):**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Service Role Client (`apps/web/src/lib/supabase/service.ts`):**
> Usado APENAS em API routes server-side que precisam de `.auth.admin.*` (invite, delete user, etc.)

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### Middleware

```typescript
// apps/web/src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes — route groups (platform) are NOT in the URL path
  const protectedPaths = ['/dashboard', '/courses', '/admin', '/analytics']
  const isProtected = protectedPaths.some(p =>
    request.nextUrl.pathname.startsWith(p)
  )

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Auth routes: redirect to dashboard if already authenticated
  if (request.nextUrl.pathname.startsWith('/login') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

### Invite Flow (Admin API)

```typescript
// apps/web/src/app/api/admin/users/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // 1. Verify caller identity via anon client (reads session cookies)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  // Validate with Zod...

  // 2. Use SERVICE ROLE client for admin operations (.auth.admin.*)
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(body.email, {
    data: {
      tenant_id: profile.tenant_id,
      role: body.role,
      full_name: body.full_name,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
```

### H-3 Fix: Onboarding Dead-End

> `/onboarding` nao existe ate Epic 5. O `(platform)/layout.tsx` deve:
> - Se `onboarding_completed = false`: redirect para `/dashboard` com banner "Complete seu perfil"
> - NAO redirect para `/onboarding` (gera 404)

```typescript
// apps/web/src/app/(platform)/layout.tsx
// Check onboarding status
const { data: profile } = await supabase
  .from('users')
  .select('onboarding_completed')
  .eq('id', user.id)
  .single()

// H-3: Do NOT redirect to /onboarding (doesn't exist until Epic 5)
// Instead, show banner on dashboard
```

---

## Tasks

- [x] 1. Criar pagina `/login` com formulario (email + password + Zod validation)
- [x] 2. Criar pagina `/auth/accept-invite` com processamento de magic link
- [x] 3. Configurar Supabase Auth client (`@supabase/ssr`)
- [x] 4. Implementar `createServerClient()` helper (anon key, session cookies)
- [x] 5. Implementar `createBrowserClient()` helper (anon key, client-side)
- [x] 5b. Implementar `createServiceClient()` helper (service_role_key, server-only, para `.auth.admin.*`)
- [x] 6. Criar middleware Next.js para rotas protegidas
- [x] 7. Implementar redirect logic (login → dashboard, unauth → login)
- [x] 8. Implementar logout
- [x] 9. Adicionar loading states em todos os forms
- [x] 10. Validacao Zod nos formularios (`auth.ts` em `packages/shared/src/validators/`)
- [x] 11. Criar API route `POST /api/admin/users` (invite flow)
- [x] 12. Criar API route handler `/api/auth/callback/route.ts` (GET — processa redirect do magic link e troca code por session)
- [x] 13. Garantir accept-invite cria/atualiza profile na tabela `users`
- [x] 14. Implementar "Esqueci minha senha" (AC11)
- [x] 15. H-3 fix: middleware redirect para `/dashboard` (nao `/onboarding`) se onboarding_completed=false

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa |
| **@qa (Quinn)** | Testes: login valido/invalido, redirect, logout, token expiry, invite flow |

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, Zod validation nos forms | Yes |
| Pre-PR | Testar: login valido, login invalido, redirect, logout, token refresh, invite flow | Yes |
| Security | httpOnly cookies, no token em localStorage, CSP headers | Yes |
| Accessibility | Forms com labels, error messages acessiveis, focus management | No |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Login/logout funcional end-to-end
- [ ] Accept-invite processa token e cria profile
- [ ] Middleware protege rotas `/(platform)/*`
- [ ] Tokens em httpOnly cookies (nao localStorage)
- [ ] Zod validation em todos os forms
- [ ] Loading states em todas as operacoes
- [ ] PR aprovada

---

## Risk Assessment

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Supabase Auth breaking change | HIGH | Pin versao `@supabase/ssr`, testar localmente | Rollback package version |
| Token refresh edge case | MEDIUM | Usar middleware para auto-refresh (Supabase SSR default) | N/A |
| Invite email nao chega | MEDIUM | Configurar Supabase email settings, usar Resend em prod | Manual invite via dashboard |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
