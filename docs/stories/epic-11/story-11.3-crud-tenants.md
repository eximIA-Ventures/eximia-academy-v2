# Story 11.3: Painel Super Admin — CRUD Tenants

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 8
**Priority:** P0 (Core functionality)
**Blocked By:** Story 11.2
**Blocks:** Stories 11.4, 11.5
**Assigned To:** @dev (Dex)

---

## User Story

**As a** super admin,
**I want** a dedicated panel to create, view, edit, and deactivate companies,
**so that** I can manage all organizations on the platform from one place.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3, Section 6.1, 10.1 |
| **PRD Ref** | prd.md — FR1, FR19 |
| **Stack** | Next.js 15 (App Router), Supabase, @eximia/ui, TanStack Query |
| **DB Tables** | `tenants` (CRUD), `users` (read + invite), `platform_audit_log` (write) |
| **API Routes** | `/api/super-admin/tenants/*` (NEW) |
| **RLS** | Uses `is_super_admin()` for cross-tenant access |
| **Storage** | Supabase Storage — logo upload during tenant creation |
| **Auth** | Supabase Auth — `inviteUserByEmail()` for initial manager |

---

## Acceptance Criteria

- [ ] **AC1:** Route group `(super-admin)` com layout dedicado: sidebar com links (Dashboard, Empresas, Auditoria), header com nome do super admin
- [ ] **AC2:** Pagina `/super-admin/tenants` exibe lista de empresas com colunas: Nome, Slug, Plan, Total Users, Status, Whitelabel (badge), Data Criacao
- [ ] **AC3:** Busca por nome ou slug (debounced, 300ms)
- [ ] **AC4:** Filtro por plan (free, pro, enterprise) e status (active, inactive)
- [ ] **AC5:** Paginacao cursor-based (20 items por pagina, consistente com Epic 5 pattern)
- [ ] **AC6:** Botao "Nova Empresa" abre wizard de 3 steps:
  - Step 1: Dados basicos — nome (required), slug (auto-generated do nome, editavel, validated), plan (select)
  - Step 2: Config inicial — logo upload, cor primaria (color picker), cor secundaria, AI model default (select), max interactions (slider 1-5)
  - Step 3: Manager inicial — email (required), nome completo (required), role (admin ou manager, radio) — envia convite automatico via Supabase Auth
- [ ] **AC7:** Pagina `/super-admin/tenants/[tenantId]` exibe detalhes da empresa com tabs: Geral, Usuarios, Metricas
- [ ] **AC8:** Tab Geral: edicao de nome, plan, AI model, max interactions, feature toggles. Botao salvar
- [ ] **AC9:** Tab Geral: toggle `whitelabel_enabled` com dialog de confirmacao ("Habilitar personalizacao whitelabel para esta empresa?")
- [ ] **AC10:** Tab Usuarios: lista users do tenant com nome, email, role, status. Botao "Convidar" para adicionar novos managers/admins
- [ ] **AC11:** Botao "Desativar Empresa" com confirmacao (soft delete — status = inactive, NAO deleta dados)
- [ ] **AC12:** Todas as acoes (create, update, toggle whitelabel, invite, deactivate) registradas em `platform_audit_log`
- [ ] **AC13:** Slug validation: unico no DB, lowercase, somente alphanumeric + hyphens, 3-50 caracteres, nao pode comecar/terminar com hyphen
- [ ] **AC14:** Todos os componentes de UI usam @eximia/ui (Card, Table, Button, Modal, Tabs, Badge, Input, Select, FormField)

---

## CodeRabbit Integration

> CodeRabbit will review: CRUD operations, RLS enforcement, audit logging, slug validation, input sanitization, Zod schemas.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Create super admin layout
  - [ ] Create `apps/web/src/app/(super-admin)/layout.tsx` with auth check (super_admin only)
  - [ ] Create `SuperAdminSidebar` component with navigation links
  - [ ] Create `SuperAdminHeader` component with user info
  - [ ] Apply design tokens from @eximia/ui (dark theme: bg-bg-app, text-text-primary)

- [ ] **Task 2** (AC: 2, 3, 4, 5) Create tenant list page
  - [ ] Create `apps/web/src/app/(super-admin)/tenants/page.tsx`
  - [ ] Create `TenantList` component with DataTable
  - [ ] Implement `GET /api/super-admin/tenants` with cursor-based pagination
  - [ ] Add search input (debounced 300ms) for name/slug
  - [ ] Add filter dropdowns for plan and status
  - [ ] Show whitelabel badge (Badge component) for enabled tenants
  - [ ] Add `requireSuperAdmin()` middleware wrapper on API route

- [ ] **Task 3** (AC: 6, 12, 13) Create tenant wizard
  - [ ] Create `apps/web/src/app/(super-admin)/tenants/new/page.tsx`
  - [ ] Create `CreateTenantWizard` component with 3 steps
  - [ ] Step 1: name input, auto-generate slug (slugify), plan select
  - [ ] Step 2: logo upload (Supabase Storage), color pickers, AI model select, interactions slider
  - [ ] Step 3: manager email, name, role (admin/manager) radio
  - [ ] Implement `POST /api/super-admin/tenants` — creates tenant + invites manager
  - [ ] Slug validation (Zod): unique, lowercase, alphanumeric+hyphens, 3-50 chars, no leading/trailing hyphens
  - [ ] Log `tenant_created` and `manager_assigned` in audit log
  - [ ] Redirect to tenant detail page after creation

- [ ] **Task 4** (AC: 7, 8, 9, 10, 11, 12) Create tenant detail page
  - [ ] Create `apps/web/src/app/(super-admin)/tenants/[tenantId]/page.tsx`
  - [ ] Create `TenantDetailTabs` component with 3 tabs
  - [ ] Tab Geral: edit form (name, plan, settings), whitelabel toggle with confirm dialog
  - [ ] Tab Usuarios: user list with invite button
  - [ ] Tab Metricas: basic stats (total users, total sessions, total courses)
  - [ ] Implement `GET /api/super-admin/tenants/[tenantId]` — full tenant details
  - [ ] Implement `PATCH /api/super-admin/tenants/[tenantId]` — update tenant
  - [ ] Implement `GET /api/super-admin/tenants/[tenantId]/users` — list tenant users
  - [ ] Implement `POST /api/super-admin/tenants/[tenantId]/users` — invite user to tenant
  - [ ] Soft delete: set `status = 'inactive'`, log `tenant_deactivated`
  - [ ] Log all mutations in `platform_audit_log`

- [ ] **Task 5** (AC: all) Regression and security validation
  - [ ] Verify all API routes check `is_super_admin()` via middleware
  - [ ] Verify slug uniqueness enforcement at DB level (UNIQUE constraint already exists)
  - [ ] Verify audit log records all actions with correct details
  - [ ] Verify non-super_admin gets 403 on all super-admin API routes
  - [ ] Verify existing tenant admin panel (`/admin/settings`) unaffected

---

## Dev Notes

### API Contracts

```typescript
// GET /api/super-admin/tenants?cursor=abc&limit=20&plan=pro&search=empresa&status=active
// [Source: Epic 11 architecture]
interface SuperAdminTenantsResponse {
  data: Array<{
    id: string
    name: string
    slug: string
    plan: TenantPlan
    whitelabel_enabled: boolean
    user_count: number
    status: 'active' | 'inactive'
    created_at: string
  }>
  nextCursor: string | null
}

// POST /api/super-admin/tenants
interface CreateTenantPayload {
  name: string
  slug: string
  plan: TenantPlan
  branding?: {
    logo_url?: string
    primary_color?: string
    secondary_color?: string
  }
  settings?: {
    ai_model?: string
    max_interactions_per_session?: number
  }
  initial_manager?: {
    email: string
    full_name: string
    role: 'admin' | 'manager'
  }
}

// PATCH /api/super-admin/tenants/[tenantId]
interface UpdateTenantPayload {
  name?: string
  plan?: TenantPlan
  whitelabel_enabled?: boolean
  settings?: Partial<TenantSettings>
  status?: 'active' | 'inactive'
}
```

### Audit Log Helper

```typescript
// apps/web/src/lib/audit.ts — NEW
export async function logSuperAdminAction(
  supabase: SupabaseClient,
  action: string,
  targetType: 'tenant' | 'user',
  targetId: string,
  details?: Record<string, unknown>
) {
  await supabase.from('platform_audit_log').insert({
    actor_id: (await supabase.auth.getUser()).data.user!.id,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || {},
  })
}
```

### Slug Generation

```typescript
// apps/web/src/lib/utils/slugify.ts — NEW
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}
```

### File Locations

```
apps/web/src/app/
├── (super-admin)/
│   ├── layout.tsx                        # NEW: super admin layout
│   ├── tenants/
│   │   ├── page.tsx                      # NEW: tenant list
│   │   ├── new/
│   │   │   └── page.tsx                  # NEW: create tenant wizard
│   │   └── [tenantId]/
│   │       └── page.tsx                  # NEW: tenant detail/edit

apps/web/src/components/super-admin/
├── super-admin-sidebar.tsx               # NEW
├── super-admin-header.tsx                # NEW
├── tenant-list.tsx                       # NEW
├── tenant-card.tsx                       # NEW
├── create-tenant-wizard.tsx              # NEW
├── tenant-detail-tabs.tsx                # NEW
├── tenant-users-tab.tsx                  # NEW
├── tenant-metrics-tab.tsx                # NEW
└── invite-manager-dialog.tsx             # NEW

apps/web/src/app/api/super-admin/
├── tenants/
│   ├── route.ts                          # NEW: GET + POST
│   └── [tenantId]/
│       ├── route.ts                      # NEW: GET + PATCH
│       └── users/
│           └── route.ts                  # NEW: GET + POST

apps/web/src/lib/
├── audit.ts                              # NEW: audit log helper
└── utils/
    └── slugify.ts                        # NEW: slug generation
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. All pages render without errors. | Yes |
| Pre-PR | Full CRUD lifecycle: create tenant with wizard → edit → toggle whitelabel → invite manager → deactivate. Audit log records all actions. Slug validation enforced. Pagination + search + filters work. 403 for non-super_admin. | Yes |

---

## Definition of Done

- [ ] Super admin layout renders with sidebar navigation
- [ ] Tenant list with pagination, search, and filters works
- [ ] Create tenant wizard completes all 3 steps and creates tenant + invites manager
- [ ] Tenant detail page loads with 3 tabs (Geral, Usuarios, Metricas)
- [ ] Edit/update tenant works with audit logging
- [ ] Whitelabel toggle works with confirmation dialog
- [ ] Soft delete (deactivate) works with audit logging
- [ ] All API routes protected by super_admin check
- [ ] Slug validation enforced (unique, format, length)
- [ ] All components use @eximia/ui
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Full implementation (UI, API, wizard, CRUD, audit logging) |
| **@ux-design-expert** | Wizard UX, tenant list layout, responsive design |
| **@qa (Quinn)** | CRUD operations, RLS enforcement, audit logging, slug validation |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Wizard step state lost on navigation | MEDIUM | Use React state (useState) with confirmation on navigate away |
| Invite email fails silently | MEDIUM | Return invite error to UI, show copyable invite link as fallback |
| Slug collision race condition | LOW | UNIQUE constraint at DB level prevents duplicate slugs |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
