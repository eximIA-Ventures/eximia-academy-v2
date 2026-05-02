# Story 11.2: Auth Flow + Middleware Super Admin

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 3
**Priority:** P0 (Blocker — routes inaccessible without middleware)
**Blocked By:** Story 11.1
**Blocks:** Stories 11.3, 11.4, 11.5, 11.6, 11.7
**Assigned To:** @dev (Dex)

---

## User Story

**As a** super admin,
**I want** to log in through the same login page and be automatically redirected to my admin panel,
**so that** I have a seamless authentication experience.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3, Section 8.2 (Middleware), 14.5 (Auth) |
| **PRD Ref** | prd.md — FR2, FR3 |
| **Stack** | Next.js 15 (App Router), Supabase Auth, middleware.ts |
| **DB Tables** | `users` (read), `tenants` (read) |
| **Auth** | Supabase Auth — unified login, role-based redirect |
| **Files** | `middleware.ts`, `lib/auth.ts`, `(auth)/login/page.tsx` |

---

## Acceptance Criteria

- [ ] **AC1:** Login page aceita super_admin credentials (email/password) sem alteracoes na UI
- [ ] **AC2:** Apos login, `getAuthProfile()` retorna `role = 'super_admin'` com `tenant_id = null` e `tenants = null`
- [ ] **AC3:** Middleware redireciona `super_admin` para `/super-admin/tenants` apos login (quando acessa `/login` ou `/`)
- [ ] **AC4:** Rotas `(super-admin)/*` protegidas — retorna 403 para qualquer role que nao seja `super_admin`
- [ ] **AC5:** Super Admin NAO passa pelo tenant resolution (nao requer subdomain para funcionar)
- [ ] **AC6:** `getAuthProfile()` handle `tenant_id = null` sem erro — tenants join retorna null gracefully
- [ ] **AC7:** Navegacao do sidebar existente `(platform)` nao exibe itens de super admin e nao quebra com role desconhecido
- [ ] **AC8:** Login de super_admin funciona independente de subdomain/URL (qualquer origin)

---

## CodeRabbit Integration

> CodeRabbit will review: auth flow changes, middleware redirect logic, error handling for null tenant_id.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 2, 6) Update `getAuthProfile()` in `lib/auth.ts`
  - [ ] Handle `tenant_id = null` in Supabase query (LEFT JOIN tenants)
  - [ ] Return `tenant: null` for super_admin without error
  - [ ] Ensure existing roles still get full tenant data
  - [ ] Update return type to reflect optional tenant

- [ ] **Task 2** (AC: 3, 4, 5, 8) Update middleware
  - [ ] Add super_admin redirect logic: `/login` or `/` → `/super-admin/tenants`
  - [ ] Add route protection: `/super-admin/*` → require `super_admin` role, else 403
  - [ ] Skip tenant resolution for super_admin (no subdomain requirement)
  - [ ] Handle edge case: super_admin accessing `(platform)` routes without active tenant context
  - [ ] Ensure existing redirect logic for other 4 roles unchanged

- [ ] **Task 3** (AC: 1, 7) Verify existing UI compatibility
  - [ ] Login page works without changes for super_admin
  - [ ] Sidebar navigation handles `super_admin` role gracefully (empty nav or redirect)
  - [ ] Platform layout handles null tenant without crash

- [ ] **Task 4** (AC: all) Regression testing
  - [ ] Test login + redirect for all 5 roles: student → /dashboard, teacher → /dashboard, manager → /dashboard, admin → /dashboard, super_admin → /super-admin/tenants
  - [ ] Test 403 enforcement on `/super-admin/*` for non-super_admin roles
  - [ ] Test existing protected routes still work for existing roles
  - [ ] Test tenant resolution still works for subdomain-based access

---

## Dev Notes

### Auth Profile Update

```typescript
// apps/web/src/lib/auth.ts — Update
// [Source: Epic 5 Story 5.1, architecture.md Section 14.5]

export async function getAuthProfile() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, profile: null, error: 'Not authenticated', supabase }
  }

  // LEFT JOIN: super_admin has no tenant, join returns null
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*, tenants(id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config)')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { user, profile: null, error: 'Profile not found', supabase }
  }

  // profile.tenants will be null for super_admin (tenant_id IS NULL)
  return { user, profile, error: null, supabase }
}
```

### Middleware Update

```typescript
// apps/web/src/middleware.ts — Update
// [Source: architecture.md Section 8.2]

// After auth verification:
const role = profile?.role

// Super Admin routing
if (role === 'super_admin') {
  // Skip tenant resolution entirely
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL('/super-admin/tenants', request.url))
  }
  // Allow access to super-admin routes
  if (pathname.startsWith('/super-admin')) {
    return NextResponse.next()
  }
  // Super admin accessing platform routes requires active tenant cookie (Story 11.4)
}

// Protect super-admin routes from non-super_admin
if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
  return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### File Locations

```
apps/web/src/
├── middleware.ts                          # UPDATED: super admin routing + protection
├── lib/
│   └── auth.ts                          # UPDATED: handle null tenant_id
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                  # VERIFIED: no changes needed
│   └── (platform)/
│       └── layout.tsx                    # VERIFIED: handles null tenant gracefully
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Auth compiles. Middleware compiles. | Yes |
| Pre-PR | Super admin login → /super-admin/tenants. Regular users unaffected. 403 on unauthorized super-admin access. No tenant resolution errors. All 5 roles redirect correctly. | Yes |

---

## Definition of Done

- [ ] `getAuthProfile()` handles null tenant_id without errors
- [ ] Middleware redirects super_admin to correct panel
- [ ] Super admin routes protected (403 for unauthorized)
- [ ] Existing login flow unaffected for all 4 original roles
- [ ] Tenant resolution still works for subdomain-based access
- [ ] No crashes or errors when super_admin accesses any route
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Auth flow update, middleware changes, regression testing |
| **@qa (Quinn)** | Verify redirect logic for all 5 roles, 403 enforcement, edge cases |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Redirect loop for super_admin | MEDIUM | Middleware checks role BEFORE tenant resolution. Explicit path matching |
| Null tenant breaks platform layout | MEDIUM | Layout handles null tenant gracefully (conditional rendering) |
| Existing users affected by middleware changes | HIGH | Role-based branching is additive — existing logic untouched |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
