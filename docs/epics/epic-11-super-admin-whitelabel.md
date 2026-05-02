# Epic 11: Super Admin, Gestao de Empresas & Whitelabel Pago

**Version:** 1.1
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent) com arquitetura de Aria (Architect Agent)
**Status:** Draft — QA fixes applied (Quinn review v1.0)
**PRD Reference:** `docs/prd.md` — FR1, FR2, FR19
**Architecture Reference:** `docs/architecture.md` v1.3 — Sections 6.1, 8.2, 10.1, 10.3, 14.5
**Screens Reference:** `docs/screens.md` — Telas 11, 12 (referencia base — telas novas serao criadas)

---

## Epic Goal

Introduzir o role de **Super Admin** como administrador global da plataforma, capaz de criar e gerenciar multiplas empresas (tenants), designar managers/admins para cada empresa, e controlar a feature de **personalizacao whitelabel como recurso pago**. O Super Admin opera cross-tenant, com painel dedicado, audit trail completo e dashboard de metricas globais. A personalizacao whitelabel (textos custom, favicon, dominio custom, templates de email, footer) so e liberada para tenants cujo Super Admin habilitou a feature, permitindo monetizacao futura como feature premium.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui (@eximia/ui) |
| **DB Tables** | `tenants` (alterada: +whitelabel_enabled, +whitelabel_config), `users` (alterada: tenant_id nullable, +super_admin role), `platform_audit_log` (NOVA) |
| **Auth** | Supabase Auth — login unificado, redirect baseado em role. Super Admin sem tenant_id |
| **Layout** | Route group `(super-admin)` NOVO com sidebar dedicada. Route group `(platform)` EXISTENTE expandido com tab Whitelabel condicional |
| **Super Admin Routes** | `/super-admin/tenants`, `/super-admin/tenants/new`, `/super-admin/tenants/[tenantId]`, `/super-admin/audit`, `/super-admin/dashboard` |
| **Admin Routes** | `/admin/settings` EXISTENTE — expandido com tab "Whitelabel" condicional |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Feature Gate** | `tenant.whitelabel_enabled` — boolean controlado EXCLUSIVAMENTE pelo Super Admin |
| **Roles** | Expansao de 4 para 5 roles: student, teacher, admin, manager, **super_admin** |
| **Audit** | Toda acao do Super Admin e logada em `platform_audit_log` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Architecture Reference |
|-----------|--------|----------------------|
| Multi-tenant RLS (all 10 tables) | Implemented | architecture.md v1.3, Section 10.3 |
| Tenant data model (`tenants` table with branding, settings, plan) | Implemented | architecture.md Section 6.1 |
| Tenant resolution middleware (subdomain strategy) | Implemented | architecture.md Section 8.2 |
| Admin API routes (`/api/admin/*`) | Implemented | architecture.md Section 10.1 |
| User management (invite, role change, deactivate) | Implemented | Epic 5, Story 5.2 |
| Tenant settings (branding, AI, features) | Implemented | Epic 5, Story 5.1 |
| Auth with RBAC (4 roles) | Implemented | architecture.md Section 14.5 |
| `auth_tenant_id()` + `auth_user_role()` helpers | Implemented | architecture.md Section 10.3 |
| Supabase Storage (tenant logos, avatars) | Implemented | Epic 5 |
| TenantProvider (React Context) | Implemented | Epic 1, layout.tsx |
| CSS variables for tenant branding | Implemented | Epic 5, Story 5.1 |

### Current Relevant Functionality

- **Epic 1** delivered: monorepo, Supabase schema with RLS, auth flow, layout with sidebar + tenant branding, CI/CD
- **Epic 2** delivered: course/chapter CRUD, Creator Agent question generation, review workflow
- **Epic 3** delivered: Socratic chat engine, agent orchestrator, streaming pipeline
- **Epic 4** delivered: dashboards for student, teacher, manager roles with analytics
- **Epic 5** delivered: tenant admin panel, user management, student onboarding, dual-mode

### Integration Points

- **Auth flow** → Login page redirect baseado em role (super_admin → /super-admin/tenants)
- **Middleware** → Novas rotas `(super-admin)/*` protegidas por role check
- **Tenant settings** → Tab Whitelabel condicional em `/admin/settings` existente
- **TenantProvider** → Expandido para incluir `whitelabel_enabled` e `whitelabel_config`
- **RLS policies** → Novas policies para `is_super_admin()` cross-tenant access
- **Users table** → `tenant_id` torna-se nullable (constraint garante consistencia)

---

## Enhancement Details

### What's Being Added/Changed

Epic 11 introduz **gestao global da plataforma** como camada acima do modelo multi-tenant existente:

1. **Role Super Admin** — Novo role `super_admin` com `tenant_id = NULL`, acesso cross-tenant via `is_super_admin()` helper function, login unificado com redirect inteligente
2. **Painel Super Admin (CRUD Tenants)** — Interface dedicada para criar, editar, visualizar e desativar empresas. Wizard de criacao em 3 steps com convite automatico de manager
3. **Tenant Switcher** — Super Admin pode "entrar" no contexto de qualquer tenant para ver o que o admin local ve, com badge visual e botao de retorno
4. **Feature Gate Whitelabel** — Toggle `whitelabel_enabled` controlado exclusivamente pelo Super Admin. Quando ativado, libera tab "Whitelabel" no admin panel do tenant com opcoes avancadas de personalizacao
5. **Whitelabel Config Expandida** — Textos custom (app name, tagline, login texts), favicon upload, footer text, support email, custom CSS overrides
6. **Audit Trail** — Tabela `platform_audit_log` registrando toda acao do Super Admin (tenant_created, tenant_updated, whitelabel_toggled, manager_assigned, etc.)
7. **Dashboard Global** — Metricas agregadas cross-tenant (total tenants, total users, total sessions, crescimento)

### How It Integrates

- **Auth** permanece unificado — mesma tela de login. Apos autenticacao, `getAuthProfile()` retorna `role = 'super_admin'` e middleware redireciona para `/super-admin/tenants`
- **RLS** expandido com `is_super_admin()` function que bypassa tenant isolation para leitura
- **Tenant admin panel** existente ganha tab condicional via check `tenant.whitelabel_enabled`
- **TenantProvider** expandido para incluir novos campos no contexto
- **Middleware** atualizado para proteger rotas `(super-admin)/*` e verificar role

### Success Criteria

- [ ] Super Admin pode criar nova empresa com nome, slug, plan, branding inicial e manager designado
- [ ] Super Admin pode listar, buscar e filtrar todas as empresas da plataforma
- [ ] Super Admin pode alternar entre contextos de empresa para visualizar como admin local
- [ ] Super Admin pode habilitar/desabilitar whitelabel para qualquer empresa
- [ ] Admin de empresa com whitelabel habilitado ve tab "Whitelabel" em settings
- [ ] Admin de empresa sem whitelabel habilitado NAO ve tab "Whitelabel"
- [ ] Whitelabel config (textos, favicon, footer) reflete na plataforma do tenant
- [ ] Toda acao do Super Admin e registrada no audit log
- [ ] Dashboard global mostra metricas cross-tenant
- [ ] Nenhuma regressao nas funcionalidades existentes (Epics 1-5)
- [ ] RLS mantido — Super Admin acessa cross-tenant via function, nao por falha de isolamento

---

## Stories

---

### Story 11.1: Schema Super Admin + RLS Policies

**As a** platform owner,
**I want** a database structure that supports a super admin role with cross-tenant access,
**so that** I can manage all companies from a single account without breaking tenant isolation.

**PRD Reference:** FR1, FR2
**Architecture Reference:** architecture.md v1.3, Section 6.1, 10.3

**Story Points:** 5
**Priority:** P0 (Blocker — all other stories depend on this schema)
**Risk:** HIGH — alters core user model (nullable tenant_id, new role enum value)

#### Acceptance Criteria

- [ ] **AC1:** Enum `user_role` expandido com valor `super_admin`
- [ ] **AC2:** Coluna `users.tenant_id` torna-se nullable com CHECK constraint: `super_admin` DEVE ter `tenant_id IS NULL`, demais roles DEVEM ter `tenant_id IS NOT NULL`
- [ ] **AC3:** Colunas `whitelabel_enabled` (BOOLEAN DEFAULT FALSE) e `whitelabel_config` (JSONB DEFAULT '{}') adicionadas a tabela `tenants`
- [ ] **AC4:** Tabela `platform_audit_log` criada com campos: id, actor_id, action, target_type, target_id, details, created_at
- [ ] **AC5:** Function `is_super_admin()` retorna true se `auth.uid()` tem role `super_admin`
- [ ] **AC6:** RLS policy `super_admin_all_tenants` permite ALL em `tenants` para super_admin
- [ ] **AC7:** RLS policy `super_admin_all_users` permite ALL em `users` para super_admin
- [ ] **AC8:** RLS em `platform_audit_log` restringe acesso apenas a super_admin
- [ ] **AC9:** Indexes criados em `platform_audit_log` (actor_id, target_type+target_id, created_at DESC)
- [ ] **AC10:** Tipo `UserRole` atualizado em `packages/shared` para incluir `super_admin`
- [ ] **AC11:** Tipo `WhitelabelConfig` criado em `packages/shared` com campos: custom_texts, favicon_url, footer_text, support_email, custom_css
- [ ] **AC12:** Tipo `Tenant` atualizado com `whitelabel_enabled` e `whitelabel_config`
- [ ] **AC13:** Seed script inclui pelo menos 1 super_admin user para desenvolvimento

#### Technical Notes

```sql
-- Migration: 20260209000000_epic11_super_admin_whitelabel.sql

-- 1. Expand role enum
ALTER TYPE user_role ADD VALUE 'super_admin';

-- 2. Make tenant_id nullable
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Consistency constraint
ALTER TABLE users ADD CONSTRAINT users_super_admin_tenant_check
  CHECK (
    (role = 'super_admin' AND tenant_id IS NULL) OR
    (role != 'super_admin' AND tenant_id IS NOT NULL)
  );

-- 4. Whitelabel columns on tenants
ALTER TABLE tenants ADD COLUMN whitelabel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN whitelabel_config JSONB DEFAULT '{}'::jsonb;

-- 5. Audit log table
CREATE TABLE platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_platform_audit_actor ON platform_audit_log(actor_id);
CREATE INDEX idx_platform_audit_target ON platform_audit_log(target_type, target_id);
CREATE INDEX idx_platform_audit_created ON platform_audit_log(created_at DESC);

-- 6. Helper function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. RLS policies
CREATE POLICY "super_admin_all_tenants"
  ON tenants FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admin_all_users"
  ON users FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_audit_access"
  ON platform_audit_log FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
```

```typescript
// packages/shared/src/types/models.ts — Updates
export type UserRole = 'student' | 'teacher' | 'admin' | 'manager' | 'super_admin'

export interface WhitelabelConfig {
  custom_texts?: {
    app_name?: string
    tagline?: string
    login_title?: string
    login_subtitle?: string
  }
  favicon_url?: string | null
  footer_text?: string
  support_email?: string
  custom_css?: string
}

// Expand existing Tenant interface
export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  branding: TenantBranding
  settings: TenantSettings
  whitelabel_enabled: boolean
  whitelabel_config: WhitelabelConfig
}
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migration SQL, shared types update, seed script |
| **@data-engineer** | Review RLS policies, validate constraint logic, index strategy |
| **@qa (Quinn)** | Validate RLS isolation maintained, constraint enforcement, super_admin access |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Migration applies without errors. Types compile. Seed runs. | Yes |
| Pre-PR | RLS policies verified: super_admin sees all tenants, regular admin sees only own tenant. Constraint prevents super_admin with tenant_id. Audit log accessible only to super_admin. | Yes |

---

### Story 11.2: Auth Flow + Middleware Super Admin

**As a** super admin,
**I want** to log in through the same login page and be automatically redirected to my admin panel,
**so that** I have a seamless authentication experience.

**PRD Reference:** FR2, FR3
**Architecture Reference:** architecture.md v1.3, Section 8.2, 14.5

**Story Points:** 3
**Priority:** P0 (Blocker — routes inaccessible without middleware)
**Risk:** MEDIUM — alters auth redirect logic that affects all users

#### Acceptance Criteria

- [ ] **AC1:** Login page aceita super_admin credentials (email/password) sem alteracoes na UI
- [ ] **AC2:** Apos login, `getAuthProfile()` retorna `role = 'super_admin'` com `tenant_id = null`
- [ ] **AC3:** Middleware redireciona `super_admin` para `/super-admin/tenants` apos login
- [ ] **AC4:** Rotas `(super-admin)/*` protegidas — retorna 403 para qualquer role que nao seja `super_admin`
- [ ] **AC5:** Super Admin NAO passa pelo tenant resolution (nao tem subdomain requirement)
- [ ] **AC6:** `getAuthProfile()` atualizado para handle `tenant_id = null` sem erro
- [ ] **AC7:** Navegacao do sidebar existente (platform) nao exibe itens de super admin
- [ ] **AC8:** Login de super_admin funciona com qualquer subdomain/URL (nao depende de tenant context)

#### Technical Notes

```typescript
// apps/web/src/lib/auth.ts — Update getAuthProfile()
// Handle super_admin with null tenant_id
export async function getAuthProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('*, tenants(id, name, slug, branding, settings, whitelabel_enabled, whitelabel_config)')
    .eq('id', user.id)
    .single()

  // super_admin has no tenant — tenants join returns null
  return { user, profile, error: null, supabase }
}

// apps/web/src/middleware.ts — Update redirect logic
// After auth verification:
if (profile.role === 'super_admin') {
  // Redirect to super admin panel
  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL('/super-admin/tenants', request.url))
  }
}

// Protect super-admin routes
if (pathname.startsWith('/super-admin')) {
  if (profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Auth flow update, middleware changes, profile handling |
| **@qa (Quinn)** | Verify redirect logic for all 5 roles, 403 enforcement, tenant resolution bypass |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Auth compiles without errors. | Yes |
| Pre-PR | Super admin login redirects to /super-admin/tenants. Regular users unaffected. 403 on unauthorized access to super-admin routes. No tenant resolution errors for super_admin. | Yes |

---

### Story 11.3: Painel Super Admin — CRUD Tenants

**As a** super admin,
**I want** a dedicated panel to create, view, edit, and deactivate companies,
**so that** I can manage all organizations on the platform from one place.

**PRD Reference:** FR1, FR19
**Architecture Reference:** architecture.md v1.3, Section 6.1, 10.1

**Story Points:** 8
**Priority:** P0 (Core functionality)
**Risk:** MEDIUM — new route group and API endpoints

#### Acceptance Criteria

- [ ] **AC1:** Route group `(super-admin)` com layout dedicado (sidebar com links: Dashboard, Empresas, Auditoria)
- [ ] **AC2:** Pagina `/super-admin/tenants` exibe lista de todas as empresas com: nome, slug, plan, total users, status, whitelabel badge
- [ ] **AC3:** Busca por nome ou slug
- [ ] **AC4:** Filtro por plan (free, pro, enterprise) e status (active, inactive)
- [ ] **AC5:** Paginacao cursor-based (consistente com pattern do Epic 5)
- [ ] **AC6:** Botao "Nova Empresa" abre wizard de 3 steps:
  - Step 1: Dados basicos (nome, slug auto-generated, plan)
  - Step 2: Config inicial (logo upload, cor primaria, cor secundaria, AI model default)
  - Step 3: Manager inicial (email, nome, role admin/manager) — envia convite automatico
- [ ] **AC7:** Pagina `/super-admin/tenants/[tenantId]` exibe detalhes da empresa com tabs: Geral, Usuarios, Metricas
- [ ] **AC8:** Edicao inline de nome, plan, settings na tab Geral
- [ ] **AC9:** Toggle `whitelabel_enabled` na tab Geral (com confirmacao)
- [ ] **AC10:** Tab Usuarios lista users do tenant com opcao de convidar novos managers/admins
- [ ] **AC11:** Soft delete de tenant (desativar — nao deletar dados)
- [ ] **AC12:** Todas as acoes (create, update, toggle whitelabel, invite) logadas em `platform_audit_log`
- [ ] **AC13:** Slug validation: unico, lowercase, alphanumeric + hyphens, 3-50 chars
- [ ] **AC14:** Componentes usam @eximia/ui (Card, Table, Button, Modal, Tabs, Badge, Input, Select)

#### Technical Notes

```typescript
// API Routes
// GET /api/super-admin/tenants?cursor=abc&limit=20&plan=pro&search=empresa&status=active
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

// POST /api/super-admin/tenants — Create tenant + invite manager
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

// GET /api/super-admin/tenants/[tenantId] — Full tenant details
// GET /api/super-admin/tenants/[tenantId]/users — List tenant users
// POST /api/super-admin/tenants/[tenantId]/users — Invite user to tenant
```

```
apps/web/src/app/
├── (super-admin)/
│   ├── layout.tsx                        # NEW: Super admin layout with sidebar
│   ├── tenants/
│   │   ├── page.tsx                      # NEW: Tenant list (grid/table)
│   │   ├── new/
│   │   │   └── page.tsx                  # NEW: Create tenant wizard
│   │   └── [tenantId]/
│   │       └── page.tsx                  # NEW: Tenant detail/edit
│   ├── audit/
│   │   └── page.tsx                      # NEW: Story 11.6
│   └── dashboard/
│       └── page.tsx                      # NEW: Story 11.7

apps/web/src/components/
├── super-admin/
│   ├── super-admin-sidebar.tsx           # NEW
│   ├── tenant-list.tsx                   # NEW
│   ├── tenant-card.tsx                   # NEW
│   ├── create-tenant-wizard.tsx          # NEW
│   ├── tenant-detail-tabs.tsx            # NEW
│   ├── tenant-users-tab.tsx             # NEW
│   └── invite-manager-dialog.tsx         # NEW

apps/web/src/app/api/super-admin/
├── tenants/
│   ├── route.ts                          # NEW: GET (list) + POST (create)
│   └── [tenantId]/
│       ├── route.ts                      # NEW: GET (detail) + PATCH (update)
│       └── users/
│           └── route.ts                  # NEW: GET (list) + POST (invite)
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (UI, API, wizard, CRUD) |
| **@ux-design-expert** | Wizard UX, tenant list layout, responsive design |
| **@qa (Quinn)** | CRUD operations, RLS enforcement, audit logging, slug validation |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. All pages render. | Yes |
| Pre-PR | Full CRUD lifecycle works. Wizard creates tenant + invites manager. Audit log records all actions. Slug validation enforced. Pagination works. Search and filters functional. Only super_admin can access. | Yes |

---

### Story 11.4: Tenant Switcher + Contexto Cross-Tenant

**As a** super admin,
**I want** to switch into any company's context and see what their admin sees,
**so that** I can troubleshoot, review settings, and assist tenants.

**PRD Reference:** FR1, FR19
**Architecture Reference:** architecture.md v1.3, Section 8.2

**Story Points:** 5
**Priority:** P0 (Core UX for super admin workflow)
**Risk:** HIGH — cross-tenant context switching must not leak data between tenants

#### Acceptance Criteria

- [ ] **AC1:** Botao "Gerenciar" em cada tenant da lista redireciona para `/super-admin/tenants/[tenantId]` com contexto do tenant ativo
- [ ] **AC2:** Ao entrar no contexto do tenant, header exibe badge: "Gerenciando: [Tenant Name]" com botao "Voltar ao Painel"
- [ ] **AC3:** Cookie `x-sa-active-tenant` armazena tenant_id selecionado (httpOnly, secure, sameSite=strict)
- [ ] **AC4:** Super Admin no contexto do tenant ve as mesmas paginas que o admin local veria (settings, users, dashboard)
- [ ] **AC5:** Super Admin pode navegar para `/admin/settings` e `/admin/users` do tenant selecionado
- [ ] **AC6:** Botao "Voltar ao Painel" limpa cookie e redireciona para `/super-admin/tenants`
- [ ] **AC7:** Se cookie expirar ou tenant nao existir, redireciona gracefully para `/super-admin/tenants`
- [ ] **AC8:** TenantProvider carrega dados do tenant do cookie quando super_admin esta no contexto
- [ ] **AC9:** Acao de tenant switch registrada no audit log

#### Technical Notes

```typescript
// Cookie-based tenant context for super admin
// apps/web/src/lib/super-admin-context.ts — NEW

import { cookies } from 'next/headers'

const SA_TENANT_COOKIE = 'x-sa-active-tenant'

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
    maxAge: 60 * 60 * 4, // 4 hours
    path: '/',
  })
}

export async function clearActiveTenant() {
  const cookieStore = await cookies()
  cookieStore.delete(SA_TENANT_COOKIE)
}

// apps/web/src/middleware.ts — Update
// When super_admin accesses (platform) routes:
// 1. Check for x-sa-active-tenant cookie
// 2. If present, inject tenant context as if super_admin is that tenant's admin
// 3. If not present, redirect to /super-admin/tenants
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Cookie management, context switching, middleware update, badge UI |
| **@architect (Aria)** | Security review of cross-tenant access pattern |
| **@qa (Quinn)** | Verify no data leakage, cookie expiry handling, context isolation |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Context switch compiles. | Yes |
| Pre-PR | Super admin can switch between tenant contexts. Badge shows correct tenant name. Back button clears context. Cookie is httpOnly/secure. No cross-tenant data leakage. Expired/invalid cookie handled gracefully. Audit log records switches. | Yes |

---

### Story 11.5: Feature Gate Whitelabel + Tab no Admin

**As a** tenant admin,
**I want** to see a "Whitelabel" tab in my settings only when the feature is enabled by the platform owner,
**so that** I can customize my platform's branding when I have access to the premium feature.

**PRD Reference:** FR1
**Architecture Reference:** architecture.md v1.3, Section 6.1

**Story Points:** 5
**Priority:** P1 (Depends on Stories 11.1, 11.3)
**Risk:** MEDIUM — feature gate must be enforced both frontend and backend

#### Acceptance Criteria

- [ ] **AC1:** Tab "Whitelabel" com Badge "PRO" aparece em `/admin/settings` SOMENTE se `tenant.whitelabel_enabled === true`
- [ ] **AC2:** Se `whitelabel_enabled === false`, tab nao aparece e rota direta retorna redirect para settings
- [ ] **AC3:** API `PATCH /api/admin/tenants` aceita campos de `whitelabel_config` SOMENTE se `whitelabel_enabled === true` (validacao server-side)
- [ ] **AC4:** Tab Whitelabel contem formulario com campos:
  - Nome do app (custom_texts.app_name)
  - Tagline (custom_texts.tagline)
  - Titulo da tela de login (custom_texts.login_title)
  - Subtitulo da tela de login (custom_texts.login_subtitle)
  - Upload de favicon
  - Texto do footer (footer_text)
  - Email de suporte (support_email)
- [ ] **AC5:** Preview em tempo real das customizacoes whitelabel
- [ ] **AC6:** Salvamento via Server Action com validacao Zod
- [ ] **AC7:** Textos custom refletem na login page do tenant
- [ ] **AC8:** Favicon custom reflete no `<head>` do tenant
- [ ] **AC9:** Footer text reflete no layout do tenant
- [ ] **AC10:** Valores default aplicados quando whitelabel_config esta vazio (fallback para branding padrao)

#### Technical Notes

```typescript
// apps/web/src/app/(platform)/admin/settings/page.tsx — Update
// Conditional Whitelabel tab based on tenant.whitelabel_enabled

<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">Geral</TabsTrigger>
    <TabsTrigger value="branding">Marca</TabsTrigger>
    <TabsTrigger value="ai">Inteligencia Artificial</TabsTrigger>
    <TabsTrigger value="features">Funcionalidades</TabsTrigger>
    {tenant.whitelabel_enabled && (
      <TabsTrigger value="whitelabel">
        Whitelabel <Badge variant="outline">PRO</Badge>
      </TabsTrigger>
    )}
  </TabsList>
  {tenant.whitelabel_enabled && (
    <TabsContent value="whitelabel">
      <WhitelabelSettingsForm tenant={tenant} />
    </TabsContent>
  )}
</Tabs>

// Backend validation in API route
// apps/web/src/app/api/admin/tenants/route.ts — Update PATCH handler
if (body.whitelabel_config) {
  // Fetch current tenant to check gate
  const { data: tenant } = await supabase.from('tenants').select('whitelabel_enabled').single()
  if (!tenant?.whitelabel_enabled) {
    return NextResponse.json({ error: 'Whitelabel not enabled for this tenant' }, { status: 403 })
  }
}
```

```
apps/web/src/components/admin/
├── whitelabel-settings-form.tsx          # NEW: Whitelabel config form
├── whitelabel-preview.tsx                # NEW: Live preview panel
├── favicon-uploader.tsx                  # NEW: Favicon upload component

apps/web/src/app/(platform)/
├── layout.tsx                            # UPDATED: inject whitelabel CSS/meta
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (form, preview, API gate, layout injection) |
| **@ux-design-expert** | Preview UX, form layout, accessible color contrast |
| **@qa (Quinn)** | Feature gate enforcement (frontend + backend), fallback values, preview accuracy |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Form renders when enabled. Tab hidden when disabled. | Yes |
| Pre-PR | Feature gate works: tab visible only when enabled. API rejects whitelabel updates when disabled. Custom texts appear on login page. Favicon renders. Footer text shows. Preview matches actual rendering. Fallback values work for empty config. | Yes |

---

### Story 11.6: Whitelabel Config Avancada (Textos, Favicon, Footer)

**As a** tenant admin with whitelabel enabled,
**I want** my platform customizations to be visible to all my users,
**so that** the platform feels like our own product.

**PRD Reference:** FR1
**Architecture Reference:** architecture.md v1.3, Section 6.1

**Story Points:** 5
**Priority:** P1 (Depends on Story 11.5)
**Risk:** MEDIUM — touches login page, layout, and head metadata across the platform

#### Acceptance Criteria

- [ ] **AC1:** Login page exibe `custom_texts.app_name` como titulo principal (fallback: "eximIA Academy")
- [ ] **AC2:** Login page exibe `custom_texts.tagline` abaixo do titulo (fallback: vazio)
- [ ] **AC3:** Login page exibe `custom_texts.login_title` no formulario (fallback: "Entrar")
- [ ] **AC4:** Login page exibe `custom_texts.login_subtitle` abaixo do titulo do form (fallback: vazio)
- [ ] **AC5:** Favicon do tenant renderizado via `<link rel="icon">` no `<head>` (fallback: favicon padrao)
- [ ] **AC6:** Footer text exibido no layout da plataforma (fallback: "© 2026 eximIA Academy")
- [ ] **AC7:** Email de suporte exibido em links de ajuda/contato
- [ ] **AC8:** Custom CSS aplicado como `<style>` tag adicional (sanitizado para prevenir XSS)
- [ ] **AC9:** Todas as customizacoes sao tenant-scoped (nao afetam outros tenants)
- [ ] **AC10:** Performance: customizacoes aplicadas server-side (RSC), nao causam layout shift

#### Technical Notes

```typescript
// Login page — must resolve tenant from subdomain BEFORE auth
// apps/web/src/app/(auth)/login/page.tsx — Update
// Fetch tenant branding + whitelabel_config based on subdomain
export default async function LoginPage() {
  const tenant = await getTenantBySubdomain()
  const wl = tenant?.whitelabel_enabled ? tenant.whitelabel_config : {}

  return (
    <div>
      <h1>{wl?.custom_texts?.app_name || 'eximIA Academy'}</h1>
      {wl?.custom_texts?.tagline && <p>{wl.custom_texts.tagline}</p>}
      <LoginForm
        title={wl?.custom_texts?.login_title || 'Entrar'}
        subtitle={wl?.custom_texts?.login_subtitle}
      />
    </div>
  )
}

// Favicon in root layout
// apps/web/src/app/layout.tsx — Update metadata
export async function generateMetadata() {
  const tenant = await getTenantBySubdomain()
  const wl = tenant?.whitelabel_enabled ? tenant.whitelabel_config : {}
  return {
    icons: {
      icon: wl?.favicon_url || '/favicon.ico',
    },
    title: wl?.custom_texts?.app_name || 'eximIA Academy',
  }
}

// Custom CSS sanitization — CRITICAL for XSS prevention
// Only allow safe CSS properties, strip any JS/expressions
import DOMPurify from 'isomorphic-dompurify'
const sanitizedCSS = DOMPurify.sanitize(wl?.custom_css || '', {
  ALLOWED_TAGS: [],  // No HTML tags
  ALLOWED_ATTR: [],  // No attributes
})
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Login page updates, layout metadata, footer component, CSS sanitization |
| **@architect (Aria)** | Security review: CSS injection prevention, XSS sanitization strategy |
| **@qa (Quinn)** | Verify all customizations render correctly, XSS prevention, fallback values, performance (no layout shift) |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Login page renders with and without whitelabel. | Yes |
| Pre-PR | All custom texts appear correctly. Favicon loads. Footer text shows. Custom CSS sanitized (no XSS). Fallback values work. No layout shift. Tenant isolation maintained. Performance: RSC rendering only. | Yes |

---

### Story 11.7: Audit Log + Dashboard Global

**As a** super admin,
**I want** an audit trail of all my actions and a global dashboard with platform metrics,
**so that** I have full visibility and accountability over platform operations.

**PRD Reference:** FR19
**Architecture Reference:** architecture.md v1.3

**Story Points:** 3
**Priority:** P2 (Nice-to-have, can be deferred)
**Risk:** LOW — read-only views, no mutations on existing data

#### Acceptance Criteria

- [ ] **AC1:** Pagina `/super-admin/audit` exibe lista de audit entries com colunas: Data, Acao, Tipo Alvo, Alvo, Detalhes
- [ ] **AC2:** Filtros: por acao (tenant_created, tenant_updated, whitelabel_toggled, manager_assigned), por data range, por target_type
- [ ] **AC3:** Paginacao cursor-based
- [ ] **AC4:** Pagina `/super-admin/dashboard` exibe metricas globais:
  - Total de empresas (ativas vs inativas)
  - Total de usuarios (por role)
  - Total de sessoes socraticas (ultimos 30 dias)
  - Empresas com whitelabel ativado
  - Grafico de crescimento de users (ultimos 6 meses)
- [ ] **AC5:** Dashboard carrega dados via API com cache (TanStack Query, staleTime: 5min)
- [ ] **AC6:** Componentes usam @eximia/ui (Table, Card, StatCard, Badge)

#### Technical Notes

```typescript
// API Routes
// GET /api/super-admin/audit?cursor=abc&limit=50&action=tenant_created&from=2026-01-01&to=2026-02-28
interface AuditLogResponse {
  data: Array<{
    id: string
    actor_id: string
    actor_name: string  // JOIN with users
    action: string
    target_type: string
    target_id: string
    target_name: string  // JOIN with tenants/users
    details: Record<string, unknown>
    created_at: string
  }>
  nextCursor: string | null
}

// GET /api/super-admin/dashboard
interface GlobalDashboardResponse {
  tenants: {
    total: number
    active: number
    inactive: number
    whitelabel_enabled: number
  }
  users: {
    total: number
    by_role: Record<UserRole, number>
  }
  sessions: {
    last_30_days: number
    completed: number
  }
  growth: Array<{
    month: string
    users: number
    tenants: number
  }>
}
```

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (audit list, dashboard, API routes, charts) |
| **@qa (Quinn)** | Data accuracy, pagination, filter logic |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Pages render. | Yes |
| Pre-PR | Audit log shows all super admin actions correctly. Dashboard metrics accurate (verified against DB). Filters work. Pagination works. Charts render. | No (P2) |

---

## Dependency Graph

```
Story 11.1 (Schema + RLS)  ──────────────────────────────────┐
       │                                                       │
       ├──→ Story 11.2 (Auth + Middleware)                     │
       │         │                                             │
       │         ├──→ Story 11.3 (CRUD Tenants)                │
       │         │         │                                   │
       │         │         ├──→ Story 11.4 (Tenant Switcher)   │
       │         │         │                                   │
       │         │         └──→ Story 11.5 (Feature Gate)      │
       │         │                    │                         │
       │         │                    └──→ Story 11.6 (WL Config)
       │         │                                             │
       │         └──→ Story 11.7 (Audit + Dashboard) ─────────┘
       │
       └── [All stories depend on 11.1]
```

**Execution Order:**
1. **Story 11.1** first (P0 — schema foundation for all other stories)
2. **Story 11.2** second (P0 — auth/middleware enables access to super admin routes)
3. **Story 11.3** third (P0 — core CRUD, main functionality)
4. **Stories 11.4 + 11.5** in parallel (both depend on 11.3 but are independent of each other)
5. **Story 11.6** after 11.5 (extends whitelabel config to render across platform)
6. **Story 11.7** last (P2 — read-only, can run anytime after 11.1+11.2)

---

## Compatibility Requirements

- [ ] Existing APIs remain unchanged (Epics 1-5 endpoints)
- [ ] Database schema changes are backward compatible (only additions, no column drops)
- [ ] UI changes follow existing @eximia/ui + Tailwind patterns
- [ ] Existing 4 roles continue to function exactly as before
- [ ] RLS policies for existing roles remain intact — new policies are additive
- [ ] Performance impact is minimal (super admin queries are cross-tenant but indexed)
- [ ] Login flow for existing users (student, teacher, admin, manager) is unchanged
- [ ] Tenant branding (Epic 5) continues to work without whitelabel enabled
- [ ] Socratic chat (Epic 3) unaffected
- [ ] Dashboards (Epic 4) unaffected
- [ ] Onboarding (Epic 5.3) unaffected

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| **Nullable tenant_id quebra queries existentes** | HIGH | CHECK constraint garante que somente super_admin tem NULL. Todas as queries existentes ja filtram por `auth_tenant_id()` que retorna non-null para roles existentes | Reverter migration: add NOT NULL back, remove super_admin role |
| **Cross-tenant data leakage via tenant switcher** | CRITICAL | Cookie httpOnly+secure+sameSite. TenantProvider valida cookie vs DB. Super Admin access logged in audit. 4-hour cookie expiry | Desabilitar tenant switcher via feature flag |
| **Whitelabel custom CSS permite XSS** | HIGH | Sanitizacao via DOMPurify. Somente propriedades CSS permitidas. Nenhum JS/expression. Content Security Policy headers | Desabilitar custom_css field, usar somente campos estruturados |
| **Super Admin role escalation** | CRITICAL | `is_super_admin()` function usa SECURITY DEFINER. Super admin criado somente via seed/migration, nao via UI. Nenhuma API permite criar super_admin | Revogar via DB diretamente |
| **Performance de queries cross-tenant** | MEDIUM | Indexes em todas as colunas de filtro. TanStack Query cache (5min stale). Cursor-based pagination | Adicionar materialized views se necessario |
| **Login redirect loop para super_admin** | LOW | Middleware verifica role ANTES de tenant resolution. Super admin bypass de subdomain check | Fallback redirect para /login com error param |

---

## Quality Assurance Strategy

### CodeRabbit Validation
All stories include pre-commit and pre-PR reviews focused on:
- **Security:** RLS policies, cross-tenant access, XSS prevention, cookie security
- **Architecture:** Role model consistency, feature gate enforcement, audit trail completeness
- **Performance:** Index usage, query efficiency, cache strategy

### Specialized Expertise

| Domain | Agent | Focus |
|--------|-------|-------|
| Database (schema, RLS, constraints) | @data-engineer | Migration safety, RLS policy correctness, constraint logic |
| Auth (role expansion, middleware) | @dev | Login flow, redirect logic, cookie management |
| Security (cross-tenant, XSS) | @architect | Tenant switcher security, CSS sanitization, role escalation prevention |
| UI (admin panel, wizard, preview) | @ux-design-expert | Wizard UX, responsive design, preview accuracy |
| Audit (logging, dashboard) | @dev | Audit trail completeness, dashboard metrics accuracy |

### Quality Gates Aligned with Risk

- **Story 11.1 (HIGH risk):** Pre-Commit + Pre-PR + Security Review
- **Story 11.2 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 11.3 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 11.4 (HIGH risk):** Pre-Commit + Pre-PR + Security Review
- **Story 11.5 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 11.6 (MEDIUM risk):** Pre-Commit + Pre-PR + XSS Review
- **Story 11.7 (LOW risk):** Pre-Commit + Pre-PR validation

### Regression Prevention

- Each story includes verification that existing role-based functionality remains intact
- Integration tests validate compatibility with Epics 1-5
- Auth flow tested for all 5 roles after changes
- Performance testing ensures cross-tenant queries don't degrade response times
- RLS isolation validated via automated tests (user A cannot see tenant B data)

---

## API Contracts

### Super Admin — Tenant Management

```typescript
// GET /api/super-admin/tenants?cursor=abc&limit=20&plan=pro&search=empresa&status=active
interface SuperAdminTenantsResponse {
  data: Array<{
    id: string
    name: string
    slug: string
    plan: TenantPlan
    whitelabel_enabled: boolean
    user_count: number          // COUNT from users table
    status: 'active' | 'inactive'
    created_at: string
  }>
  nextCursor: string | null
}

// POST /api/super-admin/tenants
interface CreateTenantPayload {
  name: string
  slug: string                  // Validated: unique, lowercase, alphanumeric+hyphens, 3-50 chars
  plan: TenantPlan
  branding?: {
    logo_url?: string
    primary_color?: string      // Hex format: #RRGGBB
    secondary_color?: string
  }
  settings?: {
    ai_model?: string
    max_interactions_per_session?: number  // 1-5
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

// GET /api/super-admin/tenants/[tenantId]
interface TenantDetailResponse {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  branding: TenantBranding
  settings: TenantSettings
  whitelabel_enabled: boolean
  whitelabel_config: WhitelabelConfig
  user_count: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}
```

### Super Admin — Audit & Dashboard

```typescript
// GET /api/super-admin/audit?cursor=abc&limit=50&action=tenant_created&from=2026-01-01&to=2026-02-28
interface AuditLogResponse {
  data: Array<{
    id: string
    actor_id: string
    actor_name: string
    action: 'tenant_created' | 'tenant_updated' | 'tenant_deactivated' | 'whitelabel_toggled' | 'manager_assigned' | 'tenant_switched'
    target_type: 'tenant' | 'user'
    target_id: string
    target_name: string
    details: Record<string, unknown>
    created_at: string
  }>
  nextCursor: string | null
}

// GET /api/super-admin/dashboard
interface GlobalDashboardResponse {
  tenants: {
    total: number
    active: number
    inactive: number
    whitelabel_enabled: number
  }
  users: {
    total: number
    by_role: Record<UserRole, number>
  }
  sessions: {
    last_30_days: number
    completed: number
  }
  growth: Array<{
    month: string   // "2026-01", "2026-02", etc.
    users: number
    tenants: number
  }>
}
```

### Tenant Admin — Whitelabel Config (Gated)

```typescript
// PATCH /api/admin/tenants — Extended payload (only when whitelabel_enabled)
interface WhitelabelUpdatePayload {
  whitelabel_config: {
    custom_texts?: {
      app_name?: string         // Max 100 chars
      tagline?: string          // Max 200 chars
      login_title?: string      // Max 50 chars
      login_subtitle?: string   // Max 200 chars
    }
    favicon_url?: string        // Supabase Storage URL
    footer_text?: string        // Max 200 chars
    support_email?: string      // Valid email format
    custom_css?: string         // Max 5000 chars, sanitized
  }
}
```

---

## Technical Notes

### Super Admin Role — No UI-Based Creation

```typescript
// SECURITY: Super admin users are NEVER created via UI or API
// They are provisioned exclusively via:
// 1. Seed script (development)
// 2. Direct database INSERT (production, by platform owner)
// 3. Migration script (controlled deployment)

// Seed example:
// supabase/seed.sql
INSERT INTO auth.users (id, email) VALUES ('sa-uuid', 'superadmin@eximia.com');
INSERT INTO users (id, email, full_name, role, tenant_id, status)
VALUES ('sa-uuid', 'superadmin@eximia.com', 'Super Admin', 'super_admin', NULL, 'active');
```

### Cookie-Based Tenant Switching

```typescript
// apps/web/src/lib/super-admin-context.ts
// Cookie: x-sa-active-tenant
// - httpOnly: true (not accessible via JS)
// - secure: true (HTTPS only in production)
// - sameSite: 'strict' (CSRF protection)
// - maxAge: 14400 (4 hours)
// - path: '/' (accessible across all routes)

// Middleware checks:
// 1. If super_admin accessing (platform) routes → read cookie for tenant context
// 2. If cookie present → load tenant data and inject into TenantProvider
// 3. If cookie absent and on (platform) routes → redirect to /super-admin/tenants
// 4. If cookie references deleted/inactive tenant → clear cookie, redirect
```

### Whitelabel CSS Sanitization — XSS Prevention

```typescript
// CRITICAL SECURITY: Custom CSS must be sanitized before injection
// Strategy: Allowlist of CSS properties, block all JS/expressions

// Allowed CSS properties:
const ALLOWED_CSS_PROPERTIES = [
  'color', 'background-color', 'font-family', 'font-size',
  'border-color', 'border-radius', 'padding', 'margin',
  'text-align', 'line-height', 'letter-spacing',
]

// Blocked patterns:
// - expression()
// - url() with non-https sources
// - javascript:
// - @import
// - behavior:
// - -moz-binding
// - Any HTML tags
```

### RLS Policy Summary — Additive Changes Only

```
EXISTING (unchanged):
- tenants_select_own        → admin sees own tenant
- users_select_tenant       → user sees users in own tenant
- users_admin_update        → admin updates users in tenant
- users_update_self         → user updates own profile
- (all 28 existing policies)

NEW (additive — 11 policies total):
- super_admin_all_tenants      → super_admin ALL on tenants
- super_admin_all_users        → super_admin ALL on users
- super_admin_audit_access     → super_admin ALL on platform_audit_log
- super_admin_all_courses      → super_admin ALL on courses [E11-H2 FIX]
- super_admin_all_chapters     → super_admin ALL on chapters [E11-H2 FIX]
- super_admin_all_questions    → super_admin ALL on questions [E11-H2 FIX]
- super_admin_all_enrollments  → super_admin ALL on enrollments [E11-H2 FIX]
- super_admin_all_sessions     → super_admin ALL on sessions [E11-H2 FIX]
- super_admin_all_messages     → super_admin ALL on messages [E11-H2 FIX]
- super_admin_all_analyses     → super_admin ALL on analyses [E11-H2 FIX]
- super_admin_all_qa_reports   → super_admin ALL on qa_reports [E11-H2 FIX]
```

### File Locations

```
apps/web/src/app/
├── (auth)/
│   └── login/
│       └── page.tsx                      # UPDATED: whitelabel texts (Story 11.6)
├── (super-admin)/                         # NEW: entire route group
│   ├── layout.tsx                        # NEW: super admin layout
│   ├── tenants/
│   │   ├── page.tsx                      # NEW: tenant list
│   │   ├── new/
│   │   │   └── page.tsx                  # NEW: create tenant wizard
│   │   └── [tenantId]/
│   │       └── page.tsx                  # NEW: tenant detail/edit
│   ├── audit/
│   │   └── page.tsx                      # NEW: audit log
│   └── dashboard/
│       └── page.tsx                      # NEW: global dashboard
├── (platform)/
│   ├── admin/
│   │   └── settings/
│   │       └── page.tsx                  # UPDATED: conditional whitelabel tab
│   └── layout.tsx                        # UPDATED: whitelabel CSS/meta injection
└── layout.tsx                            # UPDATED: dynamic favicon

apps/web/src/components/
├── super-admin/                          # NEW: entire directory
│   ├── super-admin-sidebar.tsx
│   ├── super-admin-header.tsx
│   ├── tenant-list.tsx
│   ├── tenant-card.tsx
│   ├── create-tenant-wizard.tsx
│   ├── tenant-detail-tabs.tsx
│   ├── tenant-users-tab.tsx
│   ├── tenant-metrics-tab.tsx
│   ├── invite-manager-dialog.tsx
│   ├── audit-log-table.tsx
│   └── global-dashboard.tsx
├── admin/
│   ├── whitelabel-settings-form.tsx      # NEW
│   ├── whitelabel-preview.tsx            # NEW
│   └── favicon-uploader.tsx              # NEW
└── layout/
    └── tenant-context-badge.tsx          # NEW: "Gerenciando: X" badge

apps/web/src/lib/
├── super-admin-context.ts               # NEW: cookie management
└── auth.ts                              # UPDATED: handle null tenant_id

apps/web/src/app/api/super-admin/        # NEW: entire directory
├── tenants/
│   ├── route.ts                         # NEW: GET + POST
│   └── [tenantId]/
│       ├── route.ts                     # NEW: GET + PATCH
│       └── users/
│           └── route.ts                 # NEW: GET + POST
├── audit/
│   └── route.ts                         # NEW: GET
└── dashboard/
    └── route.ts                         # NEW: GET

packages/shared/src/
├── types/
│   └── models.ts                        # UPDATED: UserRole, WhitelabelConfig, Tenant
└── validators/                          # UPDATED: new Zod schemas

supabase/
├── migrations/
│   └── 20260209000000_epic11_super_admin_whitelabel.sql  # NEW
├── seed.sql                             # UPDATED: super_admin user
└── seed-remote.ts                       # UPDATED: super_admin user
```

---

## Definition of Done

- [ ] All 7 stories completed with acceptance criteria met
- [ ] Super Admin can create, edit, and deactivate tenants
- [ ] Super Admin can switch into tenant context and view as local admin
- [ ] Super Admin can toggle whitelabel feature per tenant
- [ ] Tenant admin with whitelabel sees customization options
- [ ] Whitelabel customizations render correctly across the tenant's platform
- [ ] All Super Admin actions logged in audit trail
- [ ] Global dashboard shows accurate cross-tenant metrics
- [ ] Existing functionality (Epics 1-5) verified through regression testing
- [ ] No cross-tenant data leakage (RLS integrity maintained)
- [ ] Super Admin role cannot be created via UI (seed/migration only)
- [ ] Custom CSS sanitized — no XSS vulnerabilities
- [ ] Performance: all pages load in < 2s (LCP)
- [ ] All 5 roles function correctly after changes
- [ ] Documentation updated (architecture.md Section for Super Admin)

---

## SM Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is a major enhancement to an existing multi-tenant system running Next.js 15 + Supabase + Tailwind/shadcn
- **Story 11.1 is CRITICAL** — alters core user model (nullable tenant_id, new role). Must be implemented first with extensive testing
- **Security is paramount:** cross-tenant access via tenant switcher must be bulletproof. Cookie-based context with httpOnly/secure/sameSite
- **Feature gate must be enforced server-side** — frontend-only checks are insufficient
- **Custom CSS sanitization is SECURITY-CRITICAL** — XSS prevention via allowlist approach
- **Super Admin role provisioning** — NEVER via UI, only via seed/migration/direct DB
- Stories 11.4 and 11.5 can be implemented in parallel after 11.3
- Story 11.6 depends on 11.5 (extends whitelabel rendering to platform)
- Story 11.7 is P2 and can be deferred without blocking the epic
- Existing patterns to follow: RSC data loading, Server Actions for mutations, cursor-based pagination, @eximia/ui components
- **Audit trail must capture ALL super admin mutations** — this is compliance-critical
- Each story must include verification that existing functionality remains intact

The epic should maintain system integrity while delivering global platform management, multi-company support, and premium whitelabel capabilities."

---

## Total Story Points: 34

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 11.1 Schema Super Admin + RLS | 5 | P0 | Epic 5 (existing schema) |
| 11.2 Auth Flow + Middleware | 3 | P0 | Story 11.1 |
| 11.3 CRUD Tenants | 8 | P0 | Story 11.2 |
| 11.4 Tenant Switcher | 5 | P0 | Story 11.3 |
| 11.5 Feature Gate Whitelabel | 5 | P1 | Stories 11.1, 11.3 |
| 11.6 Whitelabel Config | 5 | P1 | Story 11.5 |
| 11.7 Audit + Dashboard | 3 | P2 | Stories 11.1, 11.2 |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Epic created from Architect (Aria) architecture proposal — Super Admin, Multi-Company, Whitelabel Pago | Morgan (PM) |
| 2026-02-08 | 1.1 | QA fixes (Quinn review): E11-H1 admin role checks, E11-H2 super_admin RLS on ALL 10 tables, E11-H3 getSuperAdminTenantContext for layout, E11-H4 tenants.status column, E11-M5 seed UUID coordination | River (SM) |

---

*Epic criado por Morgan (PM Agent) com arquitetura de Aria (Architect Agent) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊
