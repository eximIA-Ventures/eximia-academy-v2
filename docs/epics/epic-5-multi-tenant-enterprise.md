# Epic 5: Multi-tenant & Enterprise

**Version:** 1.1
**Created:** 2026-02-07
**Updated:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Draft — QA fixes applied (Quinn review v1.0)
**PRD Reference:** `docs/prd.md` — Epic 5
**Architecture Reference:** `docs/architecture.md` v1.3
**Screens Reference:** `docs/screens.md` — Telas 3, 11, 12

---

## Epic Goal

A plataforma opera com multiplos tenants completamente isolados, cada um com branding, configuracoes e modos (universidade/corporativo) proprios. Admin pode gerenciar usuarios e configuracoes do tenant. Novo aluno passa por onboarding personalizado que captura perfil e objetivos de aprendizagem.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui + Vercel AI SDK |
| **DB Tables** | `tenants`, `users` — ambas criadas no Epic 1 com RLS. Nenhuma tabela nova necessaria |
| **Auth** | Supabase Auth invite-only, middleware protege `/(platform)/*` (Story 1.3) |
| **Layout** | Sidebar 200px + header + content area com tenant branding placeholder (Story 1.4) |
| **Admin Routes** | `/admin/settings`, `/admin/users` — contratos definidos em architecture.md Section 10.1 |
| **Onboarding Route** | `/onboarding` — FORA do grupo `(platform)`, conforme screens.md |
| **Screens** | Tela 3 (Onboarding Wizard), Tela 11 (Tenant Settings), Tela 12 (User Management) — screens.md |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Dual-Mode** | Labels adaptam via `tenant.mode`: university ("Disciplinas", "Notas") vs corporate ("Trilhas", "ROI") |
| **Feature Flags** | `tenant.settings.features`: ai_detection, learning_journal, certificates, analytics_dashboard |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Architecture Reference |
|-----------|--------|----------------------|
| Multi-tenant RLS (all 9 tables) | Implemented | architecture.md v1.3, Section 10.3 |
| Tenant data model (`tenants` table with branding, settings, plan) | Implemented | architecture.md Section 6.1 |
| Tenant resolution middleware (subdomain strategy) | Implemented | architecture.md Section 8.2 |
| Dual-mode config table (university/corporate) | Defined | architecture.md Section 8.3 |
| Admin API routes (`/api/admin/*`) | Contracted | architecture.md Section 10.1 |
| User profile JSONB field (`users.profile`) | Schema exists | architecture.md Section 6.1, 10.3 |
| `onboarding_completed` boolean on users | Schema exists | architecture.md Section 6.1 |
| Feature flags per tenant (`tenant.settings.features`) | Schema exists | architecture.md Section 6.1 |
| LGPD privacy endpoints | Contracted | architecture.md Section 14.6 |
| Auth with RBAC (4 roles) | Implemented | architecture.md Section 14.5 |
| `auth_tenant_id()` + `auth_user_role()` helpers | Implemented | architecture.md Section 10.3 |

### Current Relevant Functionality

- **Epic 1** delivered: monorepo, Supabase schema with RLS, auth flow, layout with sidebar + tenant branding placeholder, CI/CD
- **Epic 2** delivered: course/chapter CRUD, Creator Agent question generation, review workflow
- **Epic 3** delivered: Socratic chat engine, agent orchestrator, streaming pipeline
- **Epic 4** delivered: dashboards for student, teacher, manager roles with analytics

### Integration Points

- **Tenant settings** → affects all dashboards (Epic 4), session config (Epic 3), course modes (Epic 2)
- **User management** → Supabase Auth (invite flow), RLS policies on `users` table
- **Onboarding** → `users.profile` JSONB, `onboarding_completed` flag, redirect logic in platform layout
- **Dual-mode** → sidebar labels, dashboard metrics, course filtering — touches components from Epics 2, 3, 4

---

## Enhancement Details

### What's Being Added/Changed

Epic 5 builds the **admin-facing UI**, **onboarding flow**, and **dual-mode rendering** on top of existing multi-tenant infrastructure:

1. **Admin Panel (Tenant Settings)** — UI for configuring branding, colors, logo, AI model, session limits, feature toggles. Real-time preview.
2. **Admin Panel (User Management)** — UI for inviting users, changing roles, deactivating accounts. Cursor-based paginated list with search/filter.
3. **Student Onboarding Wizard** — 5-step guided wizard that captures learning style, experience level, goals, and sector/course info. Data persisted to `users.profile` JSONB via Server Action.
4. **Dual-Mode Rendering** — Dynamic labels, terminology, and metric adaptations based on `tenant.mode` (university vs corporate). No code branches — config-driven.

### How It Integrates

- **Tenant settings** are read by the existing `TenantProvider` (Epic 1 layout) and propagated via React Context
- **User management** uses existing Supabase Auth invite mechanism + `users` table with RLS
- **Onboarding** page lives OUTSIDE `(platform)` group (at `app/onboarding/page.tsx`, per screens.md). Platform layout redirects: `if (!profile.onboarding_completed) redirect('/onboarding')`. Onboarding page handles its own auth check independently to avoid redirect loop.
- **Dual-mode** uses a mode config object that maps labels/metrics per `tenant.mode`, consumed by existing dashboard components

### Success Criteria

- [ ] Admin can change tenant branding and see it reflected across the platform in real-time
- [ ] Admin can invite users, change roles, and deactivate accounts
- [ ] New student completes onboarding wizard and sees data reflected in their profile
- [ ] Platform renders correct labels and metrics for both university and corporate modes
- [ ] Existing functionality (Epics 1-4) remains fully operational after Epic 5 changes
- [ ] No cross-tenant data leakage (RLS integrity maintained)

---

## Stories

---

### Story 5.1: Gestao de Tenant (Admin Panel)

**As an** admin,
**I want** configurar meu tenant (branding, settings),
**so that** a plataforma reflita minha instituicao.

**PRD Reference:** FR1, FR19
**Screens Reference:** screens.md — Tela 11

**Story Points:** 5
**Priority:** P0 (Blocker — other stories depend on settings being configurable)
**Risk:** MEDIUM — branding propagation touches multiple components from Epics 1-4

#### Acceptance Criteria

- [ ] **AC1:** Pagina `/admin/settings` com formulario de configuracoes do tenant
- [ ] **AC2:** Upload de logo via Supabase Storage (bucket `tenant-assets/{tenantId}/logo.png`)
- [ ] **AC3:** Selecao de cor primaria e secundaria (color picker)
- [ ] **AC4:** Configuracao de modo: universidade ou corporativo
- [ ] **AC5:** Configuracao de max interactions per session (default: 3, slider 1-5)
- [ ] **AC6:** Selecao de modelo IA (default: claude-sonnet-4-5) conforme `TenantSettings.ai_model`
- [ ] **AC7:** Toggle de features: AI detection, learning journal (futuro), certificates (futuro)
- [ ] **AC8:** Preview em tempo real do branding aplicado
- [ ] **AC9:** Salvamento via Server Action

#### Technical Notes

- Branding aplicado via `<style>` tag server-rendered no root layout (RSC-compatible, nao `document.documentElement`). TenantProvider ja tem dados do tenant server-side.
- Logo upload: bucket `tenant-assets`, path `{tenantId}/logo.png`, upsert true, cacheControl 3600
- API: `GET /api/admin/tenants` + `PATCH /api/admin/tenants` conforme architecture.md Section 10.1

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (UI, API, storage integration) |
| **@ux-design-expert** | Color picker UX, branding preview design, WCAG AA contrast validation |
| **@qa (Quinn)** | Validation: branding propagation, storage upload, feature flag effects |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Form renders without errors. | Yes |
| Pre-PR | Branding changes reflect across platform (server-rendered). Logo uploads. Color picker works. Feature toggles respected by dashboards. AI model persists. | Yes |

---

### Story 5.2: Gestao de Usuarios

**As an** admin,
**I want** gerenciar os usuarios do meu tenant,
**so that** eu controle quem acessa a plataforma.

**PRD Reference:** FR2, FR19
**Screens Reference:** screens.md — Tela 12

**Story Points:** 5
**Priority:** P1
**Risk:** MEDIUM — invite flow involves Supabase Auth + email delivery

#### Acceptance Criteria

- [ ] **AC1:** Pagina `/admin/users` com lista de usuarios do tenant (cursor-based pagination)
- [ ] **AC2:** Convidar novo usuario por email (Supabase Auth `inviteUserByEmail()`)
- [ ] **AC3:** Alterar role de usuario entre student, teacher, manager. Admin role so pode ser atribuido por outro admin. Self-demotion de admin nao permitida.
- [ ] **AC4:** Desativar/reativar usuario (soft delete)
- [ ] **AC5:** Busca por nome ou email
- [ ] **AC6:** Filtro por role
- [ ] **AC7:** Apenas admin pode acessar esta pagina (middleware check — 403 para nao-admin)

#### Technical Notes

- **Paginacao cursor-based** conforme screens.md Tela 12: `GET /api/admin/users?cursor=abc&limit=20&role=student&search=john`. Response: `{ data: User[], nextCursor: string | null }`
- **Ultimo login** derivado de Supabase Auth metadata: `auth.users.last_sign_in_at`. Requer `service_role` client para acessar `auth.users` table
- **Role transitions:** Admin pode mudar roles entre student, teacher, manager. Para atribuir role admin, o operador deve ser admin. Self-demotion de admin bloqueada na API (Zod validation)
- API: conforme architecture.md Section 10.1 (`/api/admin/users/*`)

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (user list, invite flow, role management) |
| **@qa (Quinn)** | Validation: RLS enforcement, invite flow, role transitions, admin-only access |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. User list renders. | Yes |
| Pre-PR | Invite sends email, role change persists, deactivation prevents login, non-admin gets 403. Search, filter, cursor pagination work. Ultimo login exibido. | Yes |

---

### Story 5.3: Onboarding do Aluno

**As a** new student,
**I want** um onboarding que capture meu perfil e objetivos,
**so that** a experiencia seja personalizada para mim.

**PRD Reference:** FR20
**Screens Reference:** screens.md — Tela 3

**Story Points:** 5
**Priority:** P1
**Risk:** LOW — self-contained wizard, minimal integration with existing features

#### Acceptance Criteria

- [ ] **AC1:** Wizard de onboarding exibido no primeiro login do aluno (se `onboarding_completed = false`)
- [ ] **AC2:** Step 1: Boas-vindas + avatar upload (opcional, via Supabase Storage)
- [ ] **AC3:** Step 2: Estilo de aprendizagem (visual, auditivo, leitura, cinestesico) — 4 cards selecionaveis
- [ ] **AC4:** Step 3: Nivel de experiencia (iniciante, intermediario, avancado)
- [ ] **AC5:** Step 4: Objetivos de aprendizagem (texto livre ou chips selecionaveis)
- [ ] **AC6:** Step 5: Setor/area (modo corporativo) OU curso/periodo (modo universidade) — condicional ao `tenant.mode`
- [ ] **AC7:** Dados salvos em `users.profile` (JSONB) via Server Action
- [ ] **AC8:** `onboarding_completed` marcado como true
- [ ] **AC9:** Skip option (pode pular e completar depois)
- [ ] **AC10:** Redirect para dashboard apos completar

#### Technical Notes

- **Rota FORA do grupo (platform):** `apps/web/src/app/onboarding/page.tsx` — NAO dentro de `(platform)/`. Isso evita redirect loop com o layout check `if (!profile.onboarding_completed) redirect('/onboarding')`. Onboarding page faz seu proprio auth check.
- **Server Action (nao API route):** Onboarding usa Server Action para salvar profile, consistente com padrao de mutations do Epic 2. Nenhuma API route necessaria. architecture.md Section 10.1 nao define endpoint de onboarding — Server Action e a abordagem correta.
- **Zod validation obrigatoria:** Server Action deve restringir campos atualizaveis via Zod para `profile` e `onboarding_completed` APENAS. A policy `users_update_self` permite UPDATE em todas as colunas — sem Zod, um student poderia modificar seu proprio `role`.
- **Avatar storage:** Bucket `tenant-assets`, path `{tenantId}/avatars/{userId}.png`. Storage policy: usuario so pode upload no proprio path.
- Layout stepper horizontal, progress bar, botoes "Voltar"/"Proximo", link "Pular" discreto (conforme screens.md Tela 3)

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (wizard UI, state management, profile save) |
| **@ux-design-expert** | Wizard UX flow, step transitions, mobile responsiveness |
| **@qa (Quinn)** | Validation: step navigation, data persistence, skip flow, mode-aware step 5, Zod field restriction |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Wizard renders all 5 steps. | Yes |
| Pre-PR | Complete flow saves profile, skip works, redirect after completion, mode-aware step 5 correct. Zod rejects non-profile fields. No redirect loop. | Yes |

---

### Story 5.4: Dual-Mode (Universidade vs Corporativo)

**As a** tenant admin,
**I want** que a plataforma opere no modo adequado a minha instituicao,
**so that** a experiencia e as metricas facam sentido para meu contexto.

**PRD Reference:** FR1
**Screens Reference:** screens.md — Tela 4 (variantes 4A-4D, dual-mode notes)

**Story Points:** 5
**Priority:** P2
**Risk:** MEDIUM — touches components across Epics 1-4 (sidebar, dashboards, courses)

#### Acceptance Criteria

- [ ] **AC1:** Modo definido em `tenant.mode` (university | corporate)
- [ ] **AC2:** Modo universidade: sidebar exibe "Disciplinas" ao inves de "Trilhas", dashboard mostra "Notas" e "Frequencia"
- [ ] **AC3:** Modo corporativo: sidebar exibe "Trilhas", dashboard mostra "Competencias" e "ROI"
- [ ] **AC4:** Labels e terminologia adaptam dinamicamente via config por modo (nenhuma string hardcoded)
- [ ] **AC5:** Dashboard do gestor adapta metricas ao modo selecionado
- [ ] **AC6:** Testes verificam renderizacao correta em ambos os modos

#### Technical Notes

- Mode config object em `packages/shared/src/constants/mode-config.ts` com type safety
- Consumido pelo TenantProvider que ja possui `tenant.mode` no contexto server-side
- Nenhum branch de codigo — apenas config-driven label swapping
- Sidebar, dashboards, e course labels consomem MODE_LABELS[tenant.mode]

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Full implementation (mode config, label mapping, conditional rendering) |
| **@architect (Aria)** | Mode config pattern review, ensure no code branches |
| **@qa (Quinn)** | Validation: both modes render correctly, label mapping complete, no hardcoded strings |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Mode config object exists with all label mappings. | Yes |
| Pre-PR | Both modes render correctly end-to-end. No hardcoded mode-specific strings. Manager dashboard adapts metrics. Tests cover both modes. | Yes |

---

## Dependency Graph

```
Story 5.1 (Tenant Settings)  ──┐
                                ├──→ Story 5.4 (Dual-Mode) [depends on mode being configurable]
Story 5.2 (User Management)    │
                                │
Story 5.3 (Onboarding)  ───────┘    [depends on mode for step 5 content]
```

**Execution Order:**
1. **Story 5.1** first (P0 — configures tenant settings that other stories consume)
2. **Stories 5.2 + 5.3** in parallel (independent of each other, only need tenant settings)
3. **Story 5.4** last (touches existing components, needs tenant mode to be configurable)

---

## Compatibility Requirements

- [ ] Existing APIs remain unchanged (Epics 1-4 endpoints)
- [ ] Database schema changes are backward compatible (no column drops, only additions)
- [ ] UI changes follow existing shadcn/ui + Tailwind patterns
- [ ] Performance impact is minimal (no additional queries on critical paths)
- [ ] RLS policies remain intact — Epic 5 uses existing policies, adds none
- [ ] Dashboards (Epic 4) continue to function with default tenant settings
- [ ] Socratic chat (Epic 3) respects `max_interactions_per_session` from tenant settings
- [ ] Course listing (Epic 2) respects `tenant.mode` filter if applicable

---

## Risk Mitigation

### Primary Risk: Branding Propagation Breaks Existing UI

- **Impact:** HIGH — branding CSS variables affect all components
- **Mitigation:** Use CSS variable fallbacks with existing default theme. Branding applied via server-rendered `<style>` tag (RSC-compatible). Test with and without custom branding.
- **Rollback Plan:** CSS variables have fallback defaults (`--tenant-primary` defaults to `#2a6ab0`). If branding causes issues, admin resets colors in `/admin/settings`. No feature flag needed — fallback values ensure safe rendering.

### Secondary Risk: Invite Flow Email Delivery

- **Impact:** MEDIUM — Supabase Auth invite emails may have delivery issues
- **Mitigation:** Use Supabase's built-in email templates. Add success/error feedback in UI. Support manual link sharing as fallback.
- **Rollback Plan:** Admin can share invite link manually. UI shows copyable link after invite creation.

### Tertiary Risk: Dual-Mode Label Mapping Incomplete

- **Impact:** LOW — some labels may appear in default mode if mapping is incomplete
- **Mitigation:** Create exhaustive mode config with test coverage. Default fallback labels for unmapped strings.
- **Rollback Plan:** Default to university mode labels if corporate mapping is incomplete.

---

## Quality Assurance Strategy

### CodeRabbit Validation
All stories include pre-commit reviews:
- **UI stories (5.1, 5.2, 5.3):** @ux-design-expert validates accessibility, responsive design
- **Config story (5.4):** @architect validates no code branches, config pattern
- **All stories:** @dev validates type safety, RLS compliance

### Specialized Expertise
| Domain | Agent | Focus |
|--------|-------|-------|
| Storage (logo + avatar upload) | @dev | Supabase Storage policies, file size limits, path strategy |
| Auth (invites) | @dev | Supabase Auth invite flow, magic links |
| Branding (CSS vars) | @ux-design-expert | Server-rendered theme, contrast ratios, WCAG AA |
| Mode config | @architect | No code branches, exhaustive label mapping |
| Security (onboarding) | @architect | Zod field restriction to prevent role escalation via `users_update_self` |

### Quality Gates Aligned with Risk
- **Story 5.1 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 5.2 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 5.3 (LOW risk):** Pre-Commit + Pre-PR validation
- **Story 5.4 (MEDIUM risk):** Pre-Commit + Pre-PR validation

### Regression Prevention
- Each story includes tasks to verify existing functionality remains intact
- Integration tests validate compatibility with Epics 1-4
- Performance testing prevents degradation (LCP < 2s target)
- CSS variable fallbacks ensure safe branding rollout

---

## API Contracts [Source: architecture.md v1.3, Section 10.1]

### Admin Tenant Settings

```typescript
// GET /api/admin/tenants → current tenant settings
// PATCH /api/admin/tenants → update settings/branding
interface TenantSettingsPayload {
  name?: string
  mode?: 'university' | 'corporate'
  branding?: {
    logo_url?: string
    primary_color?: string
    secondary_color?: string
  }
  settings?: {
    max_interactions_per_session?: number
    ai_model?: string             // H-1/M-2 FIX: aligned with TenantSettings.ai_model
    features?: {
      ai_detection?: boolean
      learning_journal?: boolean
      certificates?: boolean
      analytics_dashboard?: boolean
    }
  }
}
```

### Admin User Management

```typescript
// H-2 FIX: Cursor-based pagination per screens.md Tela 12
// GET /api/admin/users?cursor=abc&limit=20&role=student&search=john
interface AdminUsersResponse {
  data: Array<{
    id: string
    email: string
    full_name: string
    role: 'student' | 'teacher' | 'admin' | 'manager'
    status: 'active' | 'inactive'
    last_sign_in_at: string | null    // M-3 FIX: from auth.users.last_sign_in_at
    created_at: string
  }>
  nextCursor: string | null           // null = no more pages
}

// POST /api/admin/users → invite user { email, role, full_name }
// PATCH /api/admin/users/[userId] → update { role, status }
// DELETE /api/admin/users/[userId] → deactivate (soft delete)
```

### Onboarding (Server Action — not API route)

```typescript
// H-1 FIX: Server Action instead of API route
// Consistent with mutation pattern from Epic 2 (Server Actions for CRUD)
// architecture.md Section 10.1 does not define onboarding endpoint

// Server Action: saveOnboardingProfile()
interface OnboardingPayload {
  profile: {
    learning_style: 'visual' | 'auditory' | 'reading' | 'kinesthetic'
    experience_level: 'beginner' | 'intermediate' | 'advanced'
    goals: string[]
    sector?: string          // corporate mode
    course_period?: string   // university mode
    photo_url?: string       // optional
  }
}

// M-1 FIX: Zod schema MUST restrict updatable fields
// Only `profile` and `onboarding_completed` can be set
// Prevents role escalation via users_update_self RLS policy
```

---

## Technical Notes

### Branding CSS Variables [M-8 FIX: Server-rendered, RSC-compatible]

```typescript
// apps/web/src/app/(platform)/layout.tsx (Server Component)
// Branding applied via inline <style> tag — NO client-side document.documentElement
export default async function PlatformLayout({ children }) {
  const tenant = await getTenant()
  const primary = tenant.branding?.primary_color || '#2a6ab0'
  const secondary = tenant.branding?.secondary_color || '#1e1e1e'

  return (
    <>
      <style>{`
        :root {
          --tenant-primary: ${primary};
          --tenant-secondary: ${secondary};
        }
      `}</style>
      <TenantProvider tenant={tenant}>
        {/* layout content */}
      </TenantProvider>
    </>
  )
}
```

### Mode Config Pattern [Source: architecture.md Section 8.3]

```typescript
// packages/shared/src/constants/mode-config.ts
export const MODE_LABELS = {
  university: {
    courses: 'Disciplinas',
    dashboard_metrics: ['Notas', 'Frequencia'],
    hierarchy: ['Coordenador', 'Professor', 'Aluno'],
    onboarding_step5: { label: 'Curso/Periodo', type: 'text' },
  },
  corporate: {
    courses: 'Trilhas',
    dashboard_metrics: ['Competencias', 'ROI'],
    hierarchy: ['Gestor T&D', 'Lider', 'Colaborador'],
    onboarding_step5: { label: 'Setor/Area', type: 'text' },
  },
} as const
```

### Supabase Storage Strategy

```typescript
// Tenant logos: bucket tenant-assets
supabase.storage.from('tenant-assets').upload(`${tenantId}/logo.png`, file, {
  cacheControl: '3600', upsert: true,
})

// M-4 FIX: User avatars — same bucket, different path
supabase.storage.from('tenant-assets').upload(`${tenantId}/avatars/${userId}.png`, file, {
  cacheControl: '3600', upsert: true,
})
// Storage policy: user can only upload to their own avatar path
```

### Last Sign In Derivation [M-3 FIX]

```typescript
// Story 5.2: "ultimo login" column in user management table
// Derived from Supabase Auth metadata — requires service_role client
const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
// Map auth.users.last_sign_in_at to user list
```

### RLS Policies — No Changes Needed (with caveats)

Existing policies in architecture.md v1.3 Section 10.3 already cover:
- `users_admin_update`: admin can update any user in tenant
- `users_admin_delete`: admin can delete users in tenant
- `users_update_self`: user can update own profile (onboarding)
- Tenant isolation on all tables via `auth_tenant_id()`

> **M-1 SECURITY NOTE:** `users_update_self` allows UPDATE on ALL columns. Onboarding Server Action MUST use Zod to restrict fields to `profile` and `onboarding_completed` only. @architect should consider adding column-level RLS restriction or SECURITY DEFINER function in future.

### File Locations [H-5 FIX: Onboarding outside (platform)]

```
apps/web/src/app/
├── onboarding/
│   └── page.tsx                      # Story 5.3: Onboarding wizard (OUTSIDE platform group)
├── (platform)/
│   ├── admin/
│   │   ├── settings/
│   │   │   └── page.tsx              # Story 5.1: Tenant settings
│   │   └── users/
│   │       └── page.tsx              # Story 5.2: User management
│   └── layout.tsx                    # Updated: onboarding redirect check
└── ...

apps/web/src/components/
├── admin/
│   ├── tenant-settings-form.tsx     # Story 5.1
│   ├── branding-preview.tsx         # Story 5.1
│   ├── color-picker.tsx             # Story 5.1
│   ├── user-list.tsx                # Story 5.2
│   ├── invite-user-dialog.tsx       # Story 5.2
│   └── role-selector.tsx            # Story 5.2
├── onboarding/
│   ├── onboarding-wizard.tsx        # Story 5.3
│   ├── step-welcome.tsx
│   ├── step-learning-style.tsx
│   ├── step-experience.tsx
│   ├── step-goals.tsx
│   └── step-sector.tsx
└── layout/
    └── sidebar.tsx                  # Updated: Story 5.4 mode-aware labels

packages/shared/src/
├── constants/
│   └── mode-config.ts              # Story 5.4: label mapping per mode
└── types/
    └── models.ts                   # Already has all needed interfaces
```

---

## Definition of Done

- [ ] All 4 stories completed with acceptance criteria met
- [ ] Admin can configure branding, settings, AI model, and feature toggles
- [ ] Admin can invite, manage roles, and deactivate users
- [ ] New students complete onboarding wizard (or skip it)
- [ ] Platform renders correctly in both university and corporate modes
- [ ] Existing functionality (Epics 1-4) verified through regression testing
- [ ] Integration points working correctly (branding propagation, mode-aware rendering)
- [ ] No regression in existing features (dashboards, chat, courses)
- [ ] All RLS policies intact — no cross-tenant data access
- [ ] Performance: all pages load in < 2s (LCP)
- [ ] Documentation updated (architecture.md if needed)

---

## SM Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running Next.js 15 + Supabase + Drizzle + Tailwind/shadcn
- Integration points: TenantProvider (layout), sidebar labels, dashboard metrics, onboarding redirect
- Existing patterns to follow: RSC data loading (Epic 4), Server Actions for mutations (Epic 2), Supabase Storage (defined in architecture)
- Critical compatibility requirements: RLS integrity, existing Epic 1-4 functionality must remain operational
- Each story must include verification that existing functionality remains intact
- Story 5.1 should be implemented first (P0) as other stories depend on configurable tenant settings
- Stories 5.2 and 5.3 can be implemented in parallel after 5.1
- Story 5.4 should be last as it touches components across all epics
- **Onboarding route MUST be outside (platform) group** to avoid redirect loop
- **Onboarding uses Server Action, not API route** — consistent with mutation pattern
- **User management uses cursor-based pagination** per screens.md
- **Zod validation on onboarding is SECURITY-CRITICAL** — restricts updatable fields

The epic should maintain system integrity while delivering admin-facing tenant management, student onboarding, and dual-mode operation."

---

## Total Story Points: 20

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 5.1 Gestao de Tenant | 5 | P0 | Epic 1 |
| 5.2 Gestao de Usuarios | 5 | P1 | Story 5.1 |
| 5.3 Onboarding do Aluno | 5 | P1 | Story 5.1 (mode config) |
| 5.4 Dual-Mode | 5 | P2 | Story 5.1 |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-07 | 1.0 | Epic created from PRD Section 6, Epic 5 | Morgan (PM) |
| 2026-02-07 | 1.1 | QA fixes: H-1 onboarding→Server Action, H-2 cursor-based pagination, H-3 moved to docs/epics/, H-4 rollback via CSS fallbacks (no feature flag), H-5 onboarding outside (platform) group, M-1 Zod security note, M-2 AI model selection added, M-3 ultimo login derivation, M-4 avatar storage strategy, M-5 inline ACs added, M-6 header fields, M-7 role transitions clarified, M-8 RSC-compatible branding, L-1 Epic Context table, L-2 Story 5.4 FR4→FR1 | Morgan (PM) |

---

*Epic criado por Morgan (PM Agent) — eximIA Academy v1.1*

— Morgan, planejando o futuro
