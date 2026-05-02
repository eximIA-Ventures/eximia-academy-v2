# Story 8.2: SAML SSO Enterprise

**Epic:** [Epic 8 — Autenticacao Enterprise](../../epics/epic-8-autenticacao-enterprise.md)
**Version:** 1.1
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P2
**Blocked By:** Supabase Pro plan ativo
**Blocks:** —
**Assigned To:** —

---

## User Story

**As an** enterprise tenant admin,
**I want** configurar SAML SSO para que meus colaboradores acessem via identity provider corporativo,
**so that** a autenticacao siga as politicas de seguranca da minha empresa.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.3 — Section 14.5 (Auth & RBAC), Section 8.2 (Tenant Resolution), Section 6.1 (User model) |
| **PRD Ref** | `docs/prd.md` — FR3 (SSO SAML para planos enterprise) |
| **Epic Ref** | `docs/epics/epic-8-autenticacao-enterprise.md` v1.1 — Story 8.2 |
| **Stack** | Next.js 15 (App Router) + Supabase Auth Pro (SAML SSO) + Tailwind CSS 4 + @eximia/ui |
| **DB Tables** | `users` (role, tenant_id, profile, onboarding_completed), `tenants` (settings JSONB — sso_provider_id, session_timeout_hours) |
| **Auth Files** | `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/api/auth/callback/route.ts`, `apps/web/src/middleware.ts` |
| **Admin Settings** | `apps/web/src/app/(platform)/admin/settings/page.tsx` — existing tenant settings page (needs new "Autenticacao" tab) |
| **Service Client** | `apps/web/src/lib/supabase/service.ts` — `createServiceClient()` (service_role for admin operations) |
| **Prerequisite** | Supabase Pro plan (~$25/mth) — SAML e feature do plano Pro+ |
| **Risk** | HIGH — depende de plano pago Supabase, configuracao especifica por IdP |

---

## Acceptance Criteria

- [ ] **AC1:** Tenant admin pode configurar SAML SSO via pagina `/admin/settings` (aba "Autenticacao")
- [ ] **AC2:** Configuracao aceita: Metadata URL (preferido) OU Metadata XML raw (fallback), e atributo de mapeamento de email
- [ ] **AC3:** Login page exibe botao "Login Corporativo (SSO)" quando tenant tem SAML configurado
- [ ] **AC4:** SSO flow: click → redirect para IdP → autenticacao → callback → dashboard
- [ ] **AC5:** Atributos SAML mapeados para campos do usuario: email, full_name. **Role do IdP e IGNORADO** — todos os usuarios auto-provisionados recebem role `student`. Admin atribui roles manualmente via painel de gerenciamento (Story 5.2)
- [ ] **AC6:** Provisioning automatico: se usuario SAML nao existe no tenant, criar automaticamente com role default (student)
- [ ] **AC7:** De-provisioning via session timeout: sessoes SSO expiram apos 8 horas (configuravel por tenant). _SAML Single Logout (SLO) nao e suportado pelo Supabase Auth atualmente — funcionalidade deferida._
- [ ] **AC8:** Configuracao SAML armazenada de forma segura (certificados nao expostos via API)
- [ ] **AC9:** Suporte a provedores comuns: Azure AD, Okta, Google Workspace
- [ ] **AC10:** Documentacao de setup por IdP (pelo menos Azure AD e Okta)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2, 8) Criar API route para configuracao SAML SSO
  - [x] Criar `apps/web/src/app/api/admin/sso/route.ts`
  - [x] Handler `POST` — Configurar novo SAML SSO provider para o tenant
  - [x] Handler `GET` — Retornar status da configuracao SSO (sem dados sensiveis)
  - [x] Handler `DELETE` — Remover configuracao SAML SSO
  - [x] Auth check: admin/super_admin only (403 for others)
  - [x] Zod validation with discriminatedUnion (metadata_url | metadata_xml)
  - [x] Supabase SSO Admin API via REST (avoids TS type issues with JS client)
  - [x] Certificates/metadata never returned in GET responses (AC8)

- [x] **Task 2** (AC: 1, 2) Criar componente `SSOConfigForm` e aba "Autenticacao" no admin settings
  - [x] Criar `apps/web/src/components/admin/sso-config-form.tsx`
  - [x] Two-mode form: Metadata URL (recommended) + Metadata XML (fallback)
  - [x] Email attribute + SSO Domain fields
  - [x] Badge "SSO Configurado" / "SSO Nao Configurado"
  - [x] Remove SSO button with confirmation
  - [x] "Autenticacao" tab added to SettingsTabsWrapper
  - [x] Admin settings page passes ssoConfigured + sessionTimeoutHours

- [x] **Task 3** (AC: 3, 4) Atualizar login page para exibir botao SSO condicional
  - [x] Login RSC passes ssoProviderId + ssoDomain to LoginForm
  - [x] SSO button "Login Corporativo (SSO)" at top of card with separator
  - [x] handleSSOLogin using signInWithSSO with domain/providerId
  - [x] Layout: [SSO] — ou — [Email/Password] — ou — [Google OAuth]

- [x] **Task 4** (AC: 5, 6) Implementar auto-provisioning para usuarios SAML
  - [x] Flexible SAML detection (sso:saml, startsWith sso:, app_metadata.sso)
  - [x] Tenant reverse lookup via settings.sso_provider_id
  - [x] Auto-create user with role='student' (IdP role ALWAYS ignored)
  - [x] Update full_name from SAML if empty for existing users
  - [x] Redirect to no_tenant if no matching tenant found

- [x] **Task 5** (AC: 7) Implementar session timeout configuravel
  - [x] SessionTimeoutProvider component (client-side)
  - [x] Checks user.last_sign_in_at every 60 seconds
  - [x] Signs out and redirects if elapsed >= timeoutHours
  - [x] Integrated in platform layout with tenant settings
  - [x] Session timeout input in SSO config form (1-24 hours, default 8)
  - [x] SLO not implemented (Supabase limitation, documented)

- [x] **Task 6** (AC: 9, 10) Criar documentacao de setup por IdP
  - [x] `docs/guides/sso-setup-azure-ad.md` — Full Azure AD setup guide
  - [x] `docs/guides/sso-setup-okta.md` — Full Okta setup guide + Google Workspace notes

- [x] **Task 7** Testes
  - [x] Test: SSOConfigForm shows "SSO Nao Configurado" badge
  - [x] Test: SSOConfigForm shows "SSO Configurado" badge
  - [x] Test: SSOConfigForm shows config form when not configured
  - [x] Test: SSOConfigForm shows remove button when configured
  - [x] Test: SSOConfigForm calls POST /api/admin/sso on submit
  - [x] Test: SSOConfigForm calls DELETE /api/admin/sso on remove
  - [x] Test: SSOConfigForm shows session timeout input
  - [x] Test: Non-admin receives error from API
  - [x] Test: Auto-provisioning creates user with role 'student'
  - [x] Test: Auto-provisioning uses 'student' even if IdP provides role (security)
  - [x] Test: Auto-provisioning does NOT create duplicate
  - [x] Test: SAML user without tenant redirects to no_tenant
  - [x] Test: Detects SAML provider with flexible check

---

## Dev Notes

### Existing Admin Settings Page [Source: `apps/web/src/app/(platform)/admin/settings/page.tsx`]

A pagina `/admin/settings` ja existe com:
- Auth check: `profile.role !== "admin"` → redirect `/dashboard`
- Carrega tenant completo: `id, name, slug, mode, branding, settings, plan`
- Renderiza `TenantSettingsForm` com props de branding, mode, features

**Mudancas necessarias:**
1. Adicionar sistema de Tabs (`Tabs` de `@eximia/ui`): "Geral" + "Autenticacao"
2. Tab "Geral" mantem o `TenantSettingsForm` existente
3. Tab "Autenticacao" renderiza novo `SSOConfigForm`
4. Passar `tenant.settings.sso_provider_id` para o SSOConfigForm

### Existing Auth Callback [Source: `apps/web/src/app/api/auth/callback/route.ts`]

O callback atual (19 linhas) faz apenas code exchange + redirect. Precisa ser expandido para:
1. Detectar provider SAML (`user.app_metadata.provider === 'sso:saml'`)
2. Auto-provisionar usuario se nao existe na tabela `users`
3. Mapear atributos SAML para campos do usuario
4. **NOTA:** Se Story 8.1 ja foi implementada, o callback ja tera logica de profile sync para Google. Adicionar logica SAML sem quebrar a existente

### Supabase SAML SSO API [Source: Supabase Auth docs]

```typescript
// Criar SSO provider (Admin API — requer service_role)
const { data } = await supabaseAdmin.auth.admin.createSSOProvider({
  type: 'saml',
  metadata_url: 'https://idp.example.com/metadata.xml',
  // OU manual config:
  metadata_xml: '<EntityDescriptor ...>...</EntityDescriptor>',
  attribute_mapping: {
    keys: {
      email: { name: 'email' },        // SAML attribute → Supabase field
      full_name: { name: 'displayName' },
    },
  },
})

// Login via SSO (Client-side)
const { data, error } = await supabase.auth.signInWithSSO({
  domain: 'company.com',        // Match by email domain
  // OU:
  providerId: 'sso-provider-id', // Direct provider ID
  options: {
    redirectTo: `${origin}/api/auth/callback`,
  },
})

// Listar SSO providers (Admin API)
const { data } = await supabaseAdmin.auth.admin.listSSOProviders()

// Deletar SSO provider (Admin API)
await supabaseAdmin.auth.admin.deleteSSOProvider(providerId)
```

**Requisito:** Supabase Pro plan. SAML SSO nao esta disponivel no plano gratuito.

### Tenant Settings JSONB Structure [Source: architecture.md, Epic 5 Implementation]

```typescript
interface TenantSettings {
  max_interactions_per_session: number
  ai_model: string
  features: {
    ai_detection: boolean
    learning_journal: boolean
    certificates: boolean
    analytics_dashboard: boolean
  }
  // NEW (Story 8.2):
  sso_provider_id?: string          // Supabase SSO provider ID
  session_timeout_hours?: number    // Default: 8 (for SSO sessions)
}
```

### Security: Role Escalation Prevention [Source: Epic 8 Technical Notes]

```
CRITICO: O atributo 'role' do IdP (Azure AD, Okta, etc.) e SEMPRE ignorado.
- Todos os usuarios auto-provisionados via SAML recebem role = 'student'
- Promocao de role e feita MANUALMENTE pelo admin via painel de gerenciamento (Story 5.2)
- Isso previne privilege escalation onde um IdP configurado incorretamente poderia criar admins
- Regra HARDCODED no callback — nao e configuravel
```

### SAML SSO Flow [Source: Supabase docs + Epic 8]

```
1. Admin configura SAML no /admin/settings → aba Autenticacao
   → POST /api/admin/sso com metadata do IdP
   → Supabase cria SSO provider
   → provider_id salvo no tenant.settings

2. Usuario acessa login page do tenant
   → Login page detecta sso_provider_id no tenant.settings
   → Exibe botao "Login Corporativo (SSO)"

3. Usuario clica SSO
   → supabase.auth.signInWithSSO({ providerId })
   → Redirect para IdP (Azure AD, Okta, etc.)
   → Usuario autentica no IdP
   → IdP redireciona para Supabase callback
   → Supabase processa SAML assertion
   → Redirect para nosso /api/auth/callback

4. Callback processa:
   → exchangeCodeForSession()
   → Detecta provider SAML
   → Auto-provisioning se usuario nao existe (role: student)
   → Redirect para /dashboard (ou /onboarding se primeiro acesso)
```

### Session Timeout [Source: Epic 8 Story 8.2 Technical Notes + PO review S-1]

- SAML SLO (Single Logout) **NAO** suportado pelo Supabase Auth
- Supabase JWT expiry e **project-level** — NAO pode ser configurado per-tenant via API
- **Workaround per-tenant:** Implementar via client-side timer (SessionTimeoutProvider) ou server-side no middleware
- Mecanismo: comparar `session.created_at + tenant.settings.session_timeout_hours` vs hora atual
- Se expirado → `supabase.auth.signOut()` + redirect para `/login?error=session_expired`
- Admin configura em Settings → aba Autenticacao (default: 8h, min: 1h, max: 24h)

### Metadata Input Approach [Source: PO review C-1]

A Supabase Admin API aceita dois formatos para criar SSO providers:
1. **`metadata_url`** (recomendado): URL do IdP metadata endpoint. Supabase faz download e parse automaticamente. Mais simples para admins enterprise.
2. **`metadata_xml`** (fallback): XML raw colado diretamente. Para IdPs que nao expoe metadata URL publica.

O admin form deve suportar AMBOS os modos via toggle. **NAO decompomos** o XML em campos individuais (Entity ID, SSO URL, certificado) — isso seria propenso a erros e inconsistente. O Supabase extrai esses dados automaticamente do metadata.

### SSO Provider ↔ Tenant Mapping [Source: PO review S-4]

Quando um usuario SAML faz login, o callback precisa saber a qual tenant ele pertence. O mapping e feito via:

1. `tenant.settings.sso_provider_id` — armazenado quando admin configura SSO
2. **Reverse lookup no callback:** Buscar tenant cujo `settings.sso_provider_id` corresponde ao provider do usuario
3. **Alternativa futura:** Armazenar mapping em tabela separada `tenant_sso_providers(tenant_id, provider_id)` para lookup O(1)

### SAML Provider Detection [Source: PO review S-3]

O valor exato de `user.app_metadata.provider` para usuarios SAML pode variar:
- `'sso:saml'` — valor documentado pelo Supabase
- Provider ID direto — em algumas versoes
- `user.app_metadata.sso` object — pode existir com dados do SSO

**Recomendacao:** Usar check flexivel (startsWith `'sso:'` || presenca de `app_metadata.sso`) e validar com testes reais contra Supabase Pro.

### Certificate Handling [Source: Epic 8 Risk Mitigation]

- Certificados X.509 armazenados no Supabase SSO Provider (nao na nossa DB)
- API GET `/api/admin/sso` retorna status sem certificado
- Certificado so e enviado no POST (criacao) e nunca retornado
- Se admin precisa atualizar: deletar e recriar configuracao

### User Data Model [Source: architecture.md v1.3, Section 6.1]

```typescript
interface User {
  id: string            // UUID (Supabase Auth)
  tenant_id: string     // FK → Tenant
  email: string
  full_name: string
  role: 'student' | 'teacher' | 'admin' | 'manager'
  avatar_url: string | null
  profile: Record<string, unknown>
  onboarding_completed: boolean
  status: 'active' | 'inactive'
  created_at: Date
  updated_at: Date
}
```

### RLS Policies [Source: architecture.md v1.3, Section 10.3]

- `users_select`: all users in tenant see each other (`tenant_id = auth_tenant_id()`)
- `users_admin_update`: admin/manager can update any user
- Auto-provisioning usa `service_role` client para bypass RLS (criar usuario sem session de admin)

### Design System Components [Source: `docs/design-system-guide.md`]

Componentes a usar:
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — para abas no admin settings
- `Card`, `CardContent`, `CardHeader`, `CardTitle` — container do form
- `Button` — submit, delete, SSO login
- `Input` — campos de texto (Entity ID, SSO URL, etc.)
- `FormField` — wrapper com label e error
- `Badge` — status "SSO Configurado" / "Nao Configurado"
- Todos importados de `@eximia/ui`

### File Locations

```
apps/web/src/app/
├── (auth)/login/
│   └── page.tsx                           # UPDATE: Add SSO login button (conditional)
├── (platform)/admin/settings/
│   └── page.tsx                           # UPDATE: Add Tabs + "Autenticacao" tab
├── api/admin/sso/
│   └── route.ts                           # NEW: POST/GET/DELETE SAML SSO config
├── api/auth/callback/
│   └── route.ts                           # UPDATE: SAML auto-provisioning

apps/web/src/components/admin/
├── sso-config-form.tsx                    # NEW: SAML SSO configuration form
├── tenant-settings-form.tsx               # REVIEW: May need updates for tabs layout

packages/shared/src/validators/
└── sso.ts                                 # NEW: Zod schemas for SSO config

docs/guides/
├── sso-setup-azure-ad.md                  # NEW: Azure AD setup guide
└── sso-setup-okta.md                      # NEW: Okta setup guide
```

### Testing

- **Test location:** `apps/web/src/components/admin/__tests__/` e `apps/web/tests/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock `supabaseAdmin.auth.admin.createSSOProvider()`, mock `signInWithSSO()`
- **Key concern:** Auto-provisioning role hardcoding, certificate non-exposure, tenant-scoped SSO config
- **IdP testing:** Use mock SAML responses ou Okta Developer account (free tier)

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam | Yes |
| Pre-PR | SAML flow completo com IdP de teste (mock ou Okta dev). Auto-provisioning funciona com role=student. Certificados nao expostos via API. Session timeout configuravel | Yes |

---

## Definition of Done

- [ ] Admin pode configurar SAML SSO via `/admin/settings` aba Autenticacao
- [ ] Login page exibe botao SSO condicional (baseado em tenant config)
- [ ] SSO flow funcional: login → IdP → callback → dashboard
- [ ] Auto-provisioning cria usuarios com role 'student' (IdP role ignorado)
- [ ] Session timeout configuravel por tenant (default 8h)
- [ ] Certificados X.509 nao expostos via API
- [ ] Documentacao de setup para Azure AD e Okta
- [ ] Nenhuma regressao no login email/password ou Google OAuth
- [ ] Testes passando
- [ ] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Admin UI para config SAML, login page SSO, auto-provisioning, session timeout |
| **@architect (Aria)** | Review de seguranca do fluxo SAML, certificate handling, role escalation prevention |
| **@devops (Gage)** | Supabase Pro plan setup, IdP test configurations (Okta dev account) |

---

## Risk Assessment

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Supabase Pro plan nao ativo | BLOCKER | Verificar plano antes de iniciar. $25/mth justificavel com primeiro cliente enterprise | Desabilitar SAML e manter email+OAuth |
| SAML misconfiguration | MEDIUM | Validacao de metadata XML. Documentacao de setup por IdP | Desabilitar SSO via admin panel, fallback para email |
| Auto-provisioning cria usuario sem controle | MEDIUM | Role default = student (IdP role IGNORADO). Admin promove manualmente | Desabilitar auto-provisioning via tenant setting |
| Certificado X.509 exposto | HIGH | API GET nunca retorna certificado. Armazenado no Supabase SSO Provider apenas | Revogar e recriar provider |
| SLO nao suportado | LOW | Session timeout como workaround. Documentar limitacao | N/A — funcionalidade deferida |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 8 | River (SM) |
| 2026-02-08 | 1.1 | PO validation fixes: C-1 (metadata_url + raw XML input), S-1 (session timeout → client-side timer), S-2 (login RSC wrapper), S-3 (provider value flexible check), S-4 (tenant reverse lookup) | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6) via @dev (Dex)

### Debug Log References
- **TypeScript error**: `Property 'createSSOProvider' does not exist on type 'GoTrueAdminApi'` — Supabase JS client types don't include SSO admin methods. **Fix:** Switched to direct REST API calls via `fetch()` to `${supabaseUrl}/auth/v1/admin/sso/providers` (see `supabaseSSO()` helper in route.ts)
- **TypeScript error**: Button mock type mismatch (`type` prop as string vs union) in sso-config-form.test.tsx. **Fix:** Filtered props safely before passing to `<button>`
- **Test hoisting**: `vi.mock` factory referencing variables before initialization in saml-provisioning.test.ts. **Fix:** Used `vi.hoisted()` to define mock variables
- **Supabase limitation**: JWT expiry is project-level, not per-tenant. **Workaround:** Client-side `SessionTimeoutProvider` using `user.last_sign_in_at`

### Completion Notes List
1. SAML SSO Admin API (`/api/admin/sso`) supports POST (create), GET (status), DELETE (remove) — all admin-only (403 for non-admin)
2. SSO config form with two-mode input (metadata_url recommended, metadata_xml fallback) + email attribute mapping + SSO domain
3. Login page conditionally shows "Login Corporativo (SSO)" button when tenant has `sso_provider_id` configured
4. Auth callback handles SAML auto-provisioning with flexible provider detection (`sso:saml`, `startsWith('sso:')`, `app_metadata.sso`)
5. Role escalation prevention: All auto-provisioned SAML users receive `role: 'student'` — IdP role attribute is ALWAYS ignored (hardcoded security rule)
6. Tenant reverse lookup via `tenants.settings.sso_provider_id` to map SAML users to correct tenant
7. Session timeout implemented client-side via `SessionTimeoutProvider` (checks every 60s, configurable 1-24h per tenant, default 8h)
8. SAML SLO (Single Logout) NOT implemented — Supabase Auth limitation, documented
9. Certificates never exposed via API GET — only sent during POST (creation), stored in Supabase SSO Provider
10. Setup documentation created for Azure AD and Okta (+ Google Workspace notes)
11. All 13 tests pass (8 SSOConfigForm + 5 SAML provisioning), zero regressions (202/202 total suite)

### File List
| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/app/api/admin/sso/route.ts` | NEW | SSO Admin API (POST/GET/DELETE) with Supabase REST API integration |
| `apps/web/src/components/admin/sso-config-form.tsx` | NEW | SAML SSO configuration form (two-mode, badges, session timeout) |
| `apps/web/src/components/providers/session-timeout-provider.tsx` | NEW | Client-side session timeout using last_sign_in_at |
| `apps/web/src/components/admin/settings-tabs-wrapper.tsx` | MODIFIED | Added "Autenticacao" tab with SSOConfigForm |
| `apps/web/src/app/(platform)/admin/settings/page.tsx` | MODIFIED | Passes ssoConfigured + sessionTimeoutHours props |
| `apps/web/src/app/(auth)/login/page.tsx` | MODIFIED | Passes ssoProviderId + ssoDomain to LoginForm |
| `apps/web/src/components/auth/login-form.tsx` | MODIFIED | Added SSO button, handleSSOLogin, sso_failed error |
| `apps/web/src/app/api/auth/callback/route.ts` | MODIFIED | SAML auto-provisioning, tenant reverse lookup, flexible detection |
| `apps/web/src/app/(platform)/layout.tsx` | MODIFIED | Added SessionTimeoutProvider wrapper |
| `docs/guides/sso-setup-azure-ad.md` | NEW | Azure AD SAML SSO setup guide |
| `docs/guides/sso-setup-okta.md` | NEW | Okta + Google Workspace SSO setup guide |
| `apps/web/src/components/admin/__tests__/sso-config-form.test.tsx` | NEW | 8 tests for SSOConfigForm |
| `apps/web/src/app/api/auth/callback/__tests__/saml-provisioning.test.ts` | NEW | 5 tests for SAML auto-provisioning |

---

## QA Results

_To be filled after QA review_

---

*Story criada por River (Scrum Master) — eximIA Academy*

— River, removendo obstaculos 🌊
