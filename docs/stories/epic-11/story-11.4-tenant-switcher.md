# Story 11.4: Tenant Switcher + Contexto Cross-Tenant

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.1
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 5
**Priority:** P0 (Core UX for super admin workflow)
**Blocked By:** Story 11.3
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** super admin,
**I want** to switch into any company's context and see what their admin sees,
**so that** I can troubleshoot, review settings, and assist tenants.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3, Section 8.2 |
| **PRD Ref** | prd.md — FR1, FR19 |
| **Stack** | Next.js 15 (App Router), cookies API, middleware.ts |
| **DB Tables** | `tenants` (read), `platform_audit_log` (write) |
| **Cookie** | `x-sa-active-tenant` — httpOnly, secure, sameSite=strict, maxAge=4h |
| **Auth** | Super admin impersonating tenant admin context |

---

## Acceptance Criteria

- [ ] **AC1:** Botao "Gerenciar" em cada tenant da lista (Story 11.3) seta cookie e redireciona para `/super-admin/tenants/[tenantId]` com tabs de admin
- [ ] **AC2:** Ao entrar no contexto do tenant, header exibe badge persistente: "Gerenciando: [Tenant Name]" com cor de destaque e botao "Voltar ao Painel"
- [ ] **AC3:** Cookie `x-sa-active-tenant` configurado com: httpOnly=true, secure=true (production), sameSite=strict, maxAge=14400 (4h), path=/
- [ ] **AC4:** Super Admin no contexto do tenant pode navegar para paginas `(platform)` e ver dados daquele tenant: `/admin/settings`, `/admin/users`, `/dashboard`
- [ ] **AC5:** TenantProvider carrega dados do tenant selecionado via cookie quando super_admin esta no contexto (em vez de subdomain)
- [ ] **AC6:** Botao "Voltar ao Painel" limpa cookie `x-sa-active-tenant` e redireciona para `/super-admin/tenants`
- [ ] **AC7:** Se cookie expirar ou referenciar tenant inexistente/inativo, redireciona para `/super-admin/tenants` com mensagem informativa
- [ ] **AC8:** Middleware atualizado: super_admin com cookie ativo pode acessar rotas `(platform)/*`
- [ ] **AC9:** Toda acao de tenant switch registrada no audit log (action: `tenant_switched`)

---

## CodeRabbit Integration

> CodeRabbit will review: cookie security configuration, cross-tenant access pattern, middleware logic, data isolation.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 3, 6, 7) Create super admin context utilities
  - [ ] Create `apps/web/src/lib/super-admin-context.ts`
  - [ ] Implement `getActiveTenantForSuperAdmin()` — reads cookie
  - [ ] Implement `setActiveTenant(tenantId)` — sets cookie with security flags
  - [ ] Implement `clearActiveTenant()` — deletes cookie
  - [ ] Add validation: check tenant exists and is active before setting

- [ ] **Task 2** (AC: 1, 9) Add "Gerenciar" button to tenant list
  - [ ] Add Server Action to set cookie and redirect
  - [ ] Log `tenant_switched` in audit log
  - [ ] Add button to tenant list and tenant detail page

- [ ] **Task 3** (AC: 2, 6) Create tenant context badge
  - [ ] Create `apps/web/src/components/layout/tenant-context-badge.tsx`
  - [ ] Display badge in header when cookie is active: "Gerenciando: [Tenant Name]"
  - [ ] "Voltar ao Painel" button that calls `clearActiveTenant()` + redirect
  - [ ] Badge uses accent color for visibility (accent-blue-mid)

- [ ] **Task 4** (AC: 4, 5, 8) Update middleware, TenantProvider, and admin page role checks
  - [ ] Middleware: if super_admin + cookie present → allow `(platform)` route access
  - [ ] Middleware: if super_admin + no cookie → redirect away from `(platform)` to `/super-admin/tenants`
  - [ ] TenantProvider/layout: when super_admin with cookie, load tenant from cookie ID instead of subdomain
  - [ ] Create `getSuperAdminTenantContext(cookieTenantId)` in `super-admin-context.ts` — fetches full tenant data from DB by ID and returns it for TenantProvider injection [E11-H3 FIX]
  - [ ] Platform layout.tsx: if `role === 'super_admin'`, call `getSuperAdminTenantContext()` with cookie value to get tenant data, pass to TenantProvider [E11-H3 FIX]
  - [ ] Update admin page role checks in `/admin/settings/page.tsx` and `/admin/users/page.tsx`: change `role !== 'admin'` to `!['admin', 'super_admin'].includes(role)` [E11-H1 FIX]
  - [ ] Update admin API routes (`/api/admin/tenants`, `/api/admin/users`) to accept `super_admin` role [E11-H1 FIX]

- [ ] **Task 5** (AC: 7) Handle edge cases
  - [ ] Cookie references deleted tenant → clear cookie, redirect with toast
  - [ ] Cookie references inactive tenant → clear cookie, redirect with toast
  - [ ] Cookie expired → normal redirect to super admin panel
  - [ ] Cookie tampered (invalid UUID) → clear cookie, redirect

- [ ] **Task 6** (AC: all) Security and regression testing
  - [ ] Verify cookie is httpOnly (not accessible via document.cookie)
  - [ ] Verify cookie is secure in production
  - [ ] Verify sameSite=strict (CSRF protection)
  - [ ] Verify super_admin can ONLY see data from the tenant in the cookie (not mix tenants)
  - [ ] Verify regular admin/manager/teacher/student unaffected by cookie logic
  - [ ] Verify switching tenants updates all data (settings, users, dashboard)

---

## Dev Notes

### Cookie Management

```typescript
// apps/web/src/lib/super-admin-context.ts — NEW
// [Source: Architect (Aria) architecture proposal]

import { cookies } from 'next/headers'

const SA_TENANT_COOKIE = 'x-sa-active-tenant'
const COOKIE_MAX_AGE = 60 * 60 * 4  // 4 hours

export async function getActiveTenantForSuperAdmin(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SA_TENANT_COOKIE)?.value ?? null
}

export async function setActiveTenant(tenantId: string) {
  const cookieStore = await cookies()
  cookieStore.set(SA_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearActiveTenant() {
  const cookieStore = await cookies()
  cookieStore.delete(SA_TENANT_COOKIE)
}
```

### Middleware Flow

```typescript
// apps/web/src/middleware.ts — Update
// [Source: architecture.md Section 8.2]

// Super admin with active tenant cookie accessing platform routes:
if (role === 'super_admin' && pathname.startsWith('/admin') || pathname === '/dashboard') {
  const activeTenantId = request.cookies.get('x-sa-active-tenant')?.value
  if (!activeTenantId) {
    return NextResponse.redirect(new URL('/super-admin/tenants', request.url))
  }
  // Allow access — TenantProvider will load this tenant's data
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', activeTenantId)
  return response
}
```

### File Locations

```
apps/web/src/lib/
└── super-admin-context.ts                # NEW: cookie management

apps/web/src/components/
├── layout/
│   └── tenant-context-badge.tsx          # NEW: "Gerenciando: X" badge
├── super-admin/
│   └── tenant-list.tsx                   # UPDATED: "Gerenciar" button

apps/web/src/
├── middleware.ts                          # UPDATED: cookie-based platform access
└── app/
    └── (platform)/
        └── layout.tsx                    # UPDATED: load tenant from cookie for super_admin
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Context utilities compile. | Yes |
| Pre-PR | Super admin can switch between tenants. Badge shows correct name. Back button clears context. Cookie is httpOnly/secure. No cross-tenant data leakage (tenant A data not visible when in tenant B context). Expired/invalid cookie handled. Audit log records switches. Regular users completely unaffected. | Yes |

---

## Definition of Done

- [ ] Super admin can enter any tenant's context via "Gerenciar" button
- [ ] Badge "Gerenciando: [Name]" visible in header with back button
- [ ] Cookie properly configured (httpOnly, secure, sameSite, maxAge)
- [ ] Super admin sees tenant's admin panel when in context
- [ ] Back button clears cookie and returns to super admin panel
- [ ] Edge cases handled (expired, deleted, inactive tenant)
- [ ] Audit log records all tenant switches
- [ ] No data leakage between tenant contexts
- [ ] Regular users unaffected
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Cookie management, middleware update, badge UI, context loading |
| **@architect (Aria)** | Security review of cross-tenant access pattern |
| **@qa (Quinn)** | No data leakage, cookie security, edge cases, context isolation |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Cookie tampering allows access to unauthorized tenant | CRITICAL | Server-side validation: verify tenant exists and is active. Cookie is httpOnly (not JS-accessible). SameSite=strict prevents CSRF |
| Super admin sees mixed data from multiple tenants | HIGH | Single cookie value — only one tenant context at a time. All queries use tenant_id from cookie |
| Cookie persists after super admin logs out | MEDIUM | Clear all SA cookies on logout. 4-hour maxAge as safety net |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |
| 2026-02-08 | 1.1 | QA fixes: E11-H1 (admin page role checks include super_admin), E11-H3 (getSuperAdminTenantContext for TenantProvider loading) | River (SM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
