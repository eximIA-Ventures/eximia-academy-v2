# Epic 8: Autenticação Enterprise

**Version:** 1.1
**Created:** 2026-02-08
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Draft
**PRD Reference:** `docs/prd.md` — FR3 (OAuth, SSO SAML)
**Architecture Reference:** `docs/architecture.md` v1.3 — Section 14.5 (Auth)
**Roadmap Reference:** `docs/stories/roadmap-consolidacao.md` — Sprint 3

---

## Epic Goal

Expandir as opções de autenticação para além de email/password, habilitando Google OAuth para onboarding rápido e SAML SSO para clientes enterprise que exigem single sign-on corporativo. Ao final deste épico, novos tenants podem adotar a plataforma com fricção mínima de autenticação, removendo uma barreira crítica de go-to-market.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 + Supabase Auth |
| **Auth Atual** | Email/password + invite-only (Supabase Auth) |
| **OAuth Suporte** | Supabase Auth suporta nativamente Google, GitHub, Apple, etc. |
| **SAML Suporte** | Supabase Auth Pro/Enterprise — requer plano pago |
| **Middleware** | `apps/web/src/middleware.ts` — auth check + tenant resolution |
| **Login Page** | `apps/web/src/app/(auth)/login/page.tsx` |
| **Callback** | `apps/web/src/app/api/auth/callback/route.ts` |
| **Invite Flow** | Admin convida via `inviteUserByEmail()` — Story 5.2 |

---

## Existing System Context

### Auth Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Auth (email/password) | Implemented | Functional, invite-only |
| Auth middleware | Implemented | Protects `/(platform)/*` routes |
| Auth callback route | Implemented | Handles email confirmation |
| Role-based access | Implemented | 4 roles with RLS |
| Invite flow | Implemented | Admin invites via email (Story 5.2) |
| Google OAuth | Not configured | Supabase supports natively |
| SAML SSO | Not configured | Requires Supabase Pro plan |
| Magic links | Not configured | Supabase supports natively |

### Market Context

- **Enterprise clients** exigem SSO (SAML/OIDC) para compliance e governance
- **Google OAuth** reduz fricção de onboarding significativamente (1-click vs email+password)
- **Invite-only** permanece como modelo base — OAuth/SSO são métodos adicionais de auth, não substituem convites

---

## Stories

---

### Story 8.1: Google OAuth

**As a** invited user,
**I want** fazer login com minha conta Google,
**so that** eu acesse a plataforma com 1 clique sem criar nova senha.

**PRD Reference:** FR3
**Story Points:** 3
**Priority:** P1
**Risk:** LOW — Supabase suporta nativamente, integração padrão

#### Acceptance Criteria

- [ ] **AC1:** Botão "Continuar com Google" na página de login, abaixo do formulário de email/password
- [ ] **AC2:** OAuth flow: click → Google consent → callback → redirect para dashboard
- [ ] **AC3:** Novo usuário via Google OAuth é associado ao tenant correto (via invite link ou tenant resolution via subdomain/slug)
- [ ] **AC3a:** Google OAuth é **bloqueado** se não houver contexto de tenant (sem invite link e sem subdomain/slug). Exibir mensagem: "Solicite um convite ao administrador do seu tenant."
- [ ] **AC4:** Usuário existente (convidado por email) pode vincular conta Google ao perfil existente
- [ ] **AC5:** Avatar do Google importado automaticamente para `users.profile.photo_url`
- [ ] **AC6:** Nome do Google importado para `users.full_name` se não preenchido
- [ ] **AC7:** OAuth funciona com o fluxo de invite: admin convida email → usuário clica invite → login com Google (mesmo email) → vinculado automaticamente
- [ ] **AC8:** Configuração via Supabase Dashboard + variáveis de ambiente (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] **AC9:** Redirect pós-login respeita a página de origem (deep link preservation)
- [ ] **AC10:** Rate limiting do Story 6.3 se aplica ao callback OAuth
- [ ] **AC11:** Se usuário nega consent do Google, retorna para login com mensagem informativa: "Login com Google cancelado"
- [ ] **AC12:** Se email do Google não tem convite ativo e não há contexto de tenant, exibe erro: "Solicite um convite ao administrador"
- [ ] **AC13:** Se OAuth callback falha (erro de rede, token expirado), exibe mensagem de erro genérica com opção de retry

#### Technical Notes

- **Supabase config:** Habilitar Google provider no Supabase Dashboard (Authentication → Providers → Google)
- **Google Cloud Console:** Criar OAuth credentials com redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
- **Login page update:**
  ```typescript
  const handleGoogleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }
  ```
- **Tenant association:** Quando usuário faz OAuth via invite link, o tenant_id é resolvido pelo invite token. Quando faz OAuth diretamente, usar tenant resolution do middleware (subdomain/slug). **IMPORTANTE:** Se não houver contexto de tenant (sem invite, sem subdomain), o botão Google OAuth deve ser ocultado ou desabilitado e exibir mensagem orientando o usuário a solicitar convite.
- **Callback route — profile sync:** O callback existente (`/api/auth/callback`) precisa ser atualizado para importar avatar/nome do Google:
  ```typescript
  // In callback route, after code exchange:
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.app_metadata?.provider === 'google') {
    await updateProfile(user.id, {
      photo_url: user.user_metadata.avatar_url,
      full_name: user.user_metadata.full_name || user.user_metadata.name,
    })
  }
  ```
- **Error handling:** Tratar erros do OAuth callback via query params (`error`, `error_description`). Mapear para mensagens user-friendly na login page.
- **Design:** Botão Google seguindo o [Google Branding Guidelines](https://developers.google.com/identity/branding-guidelines) (logo oficial + "Continuar com Google" + cores e espaçamento corretos). Separador "ou" entre OAuth e email form.

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Login page update, callback handling, profile sync |
| **@devops (Gage)** | Google Cloud Console setup, Supabase provider config |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass | Yes |
| Pre-PR | Google OAuth flow completo (login → callback → dashboard). Avatar importado. Invite + Google OAuth funciona. Deep link preservado | Yes |

---

### Story 8.2: SAML SSO Enterprise

**As a** enterprise tenant admin,
**I want** configurar SAML SSO para que meus colaboradores acessem via identity provider corporativo,
**so that** a autenticação siga as políticas de segurança da minha empresa.

**PRD Reference:** FR3 (SSO SAML para planos enterprise)
**Story Points:** 8
**Priority:** P2
**Blocked By:** Supabase Pro plan ativo
**Risk:** HIGH — depende de plano pago Supabase, configuração específica por IdP

#### Acceptance Criteria

- [ ] **AC1:** Tenant admin pode configurar SAML SSO via página `/admin/settings` (aba "Autenticação")
- [ ] **AC2:** Configuração aceita: Entity ID, SSO URL, certificado X.509, e atributo de mapeamento de email
- [ ] **AC3:** Login page exibe botão "Login Corporativo (SSO)" quando tenant tem SAML configurado
- [ ] **AC4:** SSO flow: click → redirect para IdP → autenticação → callback → dashboard
- [ ] **AC5:** Atributos SAML mapeados para campos do usuário: email, full_name. **Role do IdP é IGNORADO** — todos os usuários auto-provisionados recebem role `student`. Admin atribui roles manualmente via painel de gerenciamento (Story 5.2)
- [ ] **AC6:** Provisioning automático: se usuário SAML não existe no tenant, criar automaticamente com role default (student)
- [ ] **AC7:** De-provisioning via session timeout: sessões SSO expiram após 8 horas (configurável por tenant). _SAML Single Logout (SLO) não é suportado pelo Supabase Auth atualmente — funcionalidade deferida para versão futura._
- [ ] **AC8:** Configuração SAML armazenada de forma segura (certificados não expostos via API)
- [ ] **AC9:** Suporte a provedores comuns: Azure AD, Okta, Google Workspace
- [ ] **AC10:** Documentação de setup por IdP (pelo menos Azure AD e Okta)

#### Technical Notes

- **Supabase SSO:** Requer plano Pro. Usar `supabase.auth.signInWithSSO({ domain: tenantDomain })` ou `providerId`
- **Supabase Admin API:** Configuração SAML via Admin API:
  ```typescript
  const { data } = await supabaseAdmin.auth.admin.createSSOProvider({
    type: 'saml',
    metadata_url: 'https://idp.example.com/metadata.xml',
    // OR manual config:
    metadata_xml: '...',
    attribute_mapping: {
      keys: {
        email: { name: 'email' },
        full_name: { name: 'displayName' },
      },
    },
  })
  ```
- **Tenant-level config:** Armazenar `sso_provider_id` no `tenant.settings` após configuração
- **Login page logic:**
  ```typescript
  // Se tenant tem SSO configurado, exibir botão SSO
  if (tenant.settings?.sso_provider_id) {
    // Exibir "Login Corporativo (SSO)"
    // + "ou continue com email/Google" abaixo
  }
  ```
- **Auto-provisioning:** Supabase cria o `auth.user` automaticamente. Hook `after_sign_in` deve criar entrada na tabela `users` com `tenant_id` e `role: 'student'`. **SEGURANÇA:** O atributo `role` do IdP é **sempre ignorado** para prevenir privilege escalation. Todos os usuários auto-provisionados recebem `role: 'student'`. Promoção de role é feita manualmente pelo admin via painel de gerenciamento de usuários.
- **Session timeout:** Como SAML SLO não é suportado pelo Supabase, usar `supabase.auth.setSession()` com `expires_in` configurável por tenant (padrão: 8h). Admin pode ajustar em Settings.
- **Custo:** Supabase Pro ~$25/mês por projeto. SAML é feature do plano Pro+.

**Predicted Agents:**
| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Admin UI para config SAML, login page SSO, auto-provisioning |
| **@architect (Aria)** | Review de segurança do fluxo SAML, certificate handling |
| **@devops (Gage)** | Supabase Pro plan setup, IdP test configurations |

**Quality Gates:**
| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass | Yes |
| Pre-PR | SAML flow completo com IdP de teste (mock ou Okta dev). Auto-provisioning funciona. Certificados não expostos | Yes |

---

## Dependency Graph

```
Story 8.1 (Google OAuth) ──────┐
[independente]                   │
                                 │  [independentes entre si]
Story 8.2 (SAML SSO)  ─────────┘
[blocked by: Supabase Pro plan]
```

**Execution Order:**
1. **Story 8.1** primeiro (LOW risk, alto valor imediato)
2. **Story 8.2** quando Supabase Pro ativo e primeiro cliente enterprise solicitar

---

## Compatibility Requirements

- [ ] Login existente (email/password) continua funcionando normalmente
- [ ] Invite flow (Story 5.2) compatível com Google OAuth
- [ ] Middleware de auth trata todos os métodos de autenticação igualmente
- [ ] RLS policies não precisam de mudança (baseadas em `auth.uid()`, não no método de auth)
- [ ] Onboarding wizard (Story 5.3) dispara normalmente para novos usuários OAuth/SSO
- [ ] Rate limiting (Story 6.3) se aplica aos callbacks

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|-------|---------|-----------|----------|
| Google OAuth token leak | HIGH | Tokens handled by Supabase (não passam pelo nosso código) | Revogar OAuth app no Google Console |
| SAML misconfiguration | MEDIUM | Validação de metadata XML. Documentação de setup por IdP | Desabilitar SSO via admin panel, fallback para email |
| Auto-provisioning cria usuário sem controle | MEDIUM | Role default = student (IdP role IGNORADO). Admin promove manualmente | Desabilitar auto-provisioning via tenant setting |
| OAuth sem contexto de tenant | HIGH | Bloquear Google OAuth se não houver invite link ou subdomain | N/A — fluxo bloqueado preventivamente |
| Supabase Pro cost | LOW | $25/mês — justificável com primeiro cliente enterprise | Downgrade e desabilitar SAML |
| OAuth email mismatch com invite | LOW | Supabase vincula por email automaticamente | Login manual com email/password sempre disponível |

---

## Definition of Done (Epic Level)

- [ ] Google OAuth funcional (1-click login)
- [ ] SAML SSO configurável por tenant (quando Supabase Pro ativo)
- [ ] Login page adaptativa (mostra opções disponíveis por tenant)
- [ ] Invite flow compatível com OAuth
- [ ] Auto-provisioning funcional para SSO
- [ ] Nenhuma regressão no auth existente
- [ ] Documentação de setup para Google OAuth e SAML (Azure AD + Okta)

---

## Total Story Points: 11

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 8.1 Google OAuth | 3 | P1 | Nenhuma |
| 8.2 SAML SSO | 8 | P2 | Supabase Pro plan |

---

## SM Handoff

"Please develop detailed user stories for this authentication epic. Key considerations:

- Story 8.1 (Google OAuth) é low-hanging fruit — Supabase suporta nativamente
- Story 8.2 (SAML SSO) depende de plano pago e é P2 — pode ser adiada
- O modelo invite-only permanece — OAuth/SSO são métodos adicionais de auth
- Tenant association é o principal desafio técnico: como vincular OAuth user ao tenant correto
- Auto-provisioning deve criar usuário com role default (student), não admin
- Login page deve ser adaptativa: mostra opções disponíveis baseado no tenant config
- Documentação de setup por IdP é essencial para enterprise (self-service)
- Rate limiting (Story 6.3) deve cobrir os callbacks de OAuth"

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Epic criado para autenticação enterprise | Morgan (PM) |
| 2026-02-08 | 1.1 | QA fixes: H-1 (OAuth tenant context enforcement), H-2 (SAML role escalation prevention), M-1 (OAuth error states AC11-AC13), M-2 (SAML SLO → session timeout), M-3 (callback profile sync code), L-1 (Google branding link) | Morgan (PM) |

---

*Epic criado por Morgan (PM Agent) — exímIA Academy v1.0*

— Morgan, planejando o futuro 📊
