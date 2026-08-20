# Epic 8: Autenticação Enterprise

**Version:** 1.2
**Created:** 2026-02-08
**Updated:** 2026-08-13
**Author:** Morgan (PM Agent)
**Status:** InReview (medido em 2026-08-13, stories 8.1 e 8.2 em Ready for Review)
**PRD Reference:** `docs/prd.md` — FR3 (OAuth, SSO SAML)
**Architecture Reference:** `docs/architecture.md` v1.3 — Section 14.5 (Auth)
**Roadmap Reference:** `docs/stories/roadmap-consolidacao.md` — Sprint 3

### Snapshot de estado, validade e dono

Os blocos **Epic Context** e **Existing System Context** deste documento são **snapshot não-autoritativo**: eles descrevem o estado do código em uma data de medição, não uma decisão de projeto, e envelhecem sozinhos quando o código anda. A fonte autoritativa é sempre o fonte em `apps/web/src`, e o detector versionado que o confronta com este texto.

| Campo | Valor |
|------|-------|
| **Data da medição** | 2026-08-13 |
| **Validade declarada** | 2026-11-12. Depois desta data, os blocos marcados como snapshot valem como **vencidos** até novo re-snapshot, e não devem ser citados como estado atual |
| **Dono do re-snapshot** | Hugo Capitelli, risco R1 de `POP-FIX-001/2026-08-12-epic8-oauth-e-saml-nao-documentados/04-plano-de-contramedidas.md`, revisão marcada para 2026-11-12 |
| **Detector que reprova o drift** | `apps/web/tests/epic-8-auth-surface-drift.test.ts`, coletado pelo job Unit Tests do CI |

> Este cabeçalho difere da convenção dos demais épicos de propósito. A ausência de data de validade é o que permitia a este documento parecer atual em 2026-08 descrevendo o mundo de 2026-02.

---

## Epic Goal

Expandir as opções de autenticação para além de email/password, habilitando Google OAuth para onboarding rápido e SAML SSO para clientes enterprise que exigem single sign-on corporativo. Ao final deste épico, novos tenants podem adotar a plataforma com fricção mínima de autenticação, removendo uma barreira crítica de go-to-market.

## Epic Context

> **Snapshot não-autoritativo**, medido em 2026-08-13. Validade e dono do re-snapshot no cabeçalho.

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 + Supabase Auth |
| **Auth Atual** | **6 vias de credencial vivas no fonte**, medidas em 2026-08-13 pelo detector `apps/web/tests/epic-8-auth-surface-drift.test.ts` (constante `VIAS`). Paths relativos a `apps/web/src`.<br>**1. Email/password**, `auth.signInWithPassword(` em `app/(auth)/entrar/actions.ts:17` e `components/auth/login-form.tsx:135`<br>**2. Convite por e-mail**, `auth.admin.inviteUserByEmail(` em `app/api/admin/users/invite-user.ts:45` e `auth.verifyOtp(` em `app/(auth)/accept-invite/page.tsx:59`<br>**3. Google OAuth**, `auth.signInWithOAuth(` em `components/auth/login-form.tsx:90` e o ramo `app_metadata?.provider === "google"` em `app/api/auth/callback/route.ts:35`<br>**4. SAML SSO**, `auth.signInWithSSO(` em `components/auth/login-form.tsx:111`, a API de provider em `app/api/admin/sso/route.ts` e o ramo `isSaml` em `app/api/auth/callback/route.ts:107`<br>**5. Redefinição de senha self-service**, `auth.resetPasswordForEmail(` em `components/auth/login-form.tsx:187` e `auth.updateUser({ password })` em `app/(auth)/reset-password/page.tsx:39`<br>**6. Link de recuperação emitido por admin**, `auth.admin.generateLink({ type: "recovery" })` em `app/api/admin/users/[userId]/reset-password/route.ts:51`<br>Detalhe de alcance, escrita privilegiada e dono de cada via na seção *Superfície de Credencial* abaixo. |
| **OAuth Suporte** | Supabase Auth suporta nativamente Google, GitHub, Apple, etc. |
| **SAML Suporte** | Supabase Auth Pro/Enterprise — requer plano pago |
| **Middleware** | `apps/web/src/middleware.ts` — auth check + tenant resolution |
| **Login Page** | `apps/web/src/app/(auth)/login/page.tsx` |
| **Callback** | `apps/web/src/app/api/auth/callback/route.ts` |
| **Invite Flow** | Admin convida via `inviteUserByEmail()` — Story 5.2 |

---

## Existing System Context

### Auth Infrastructure

> **Snapshot não-autoritativo**, medido em 2026-08-13. Validade e dono do re-snapshot no cabeçalho. A coluna `Status` descreve **o que existe no fonte**, que é o que este repositório pode provar. Configuração de provider vive no painel do Supabase, fora deste repositório, e por isso aparece como ressalva na coluna `Notes`, nunca como negação da via.

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Auth (email/password) | Implemented | Functional, invite-only |
| Auth middleware | Implemented | Protects `/(platform)/*` routes |
| Auth callback route | Implemented | Handles email confirmation |
| Role-based access | Implemented | 4 roles with RLS |
| Invite flow | Implemented | Admin invites via email (Story 5.2) |
| Google OAuth | Implemented, provider not configured | Código na árvore: `auth.signInWithOAuth(` em `components/auth/login-form.tsx:90` e provisionamento no ramo `provider === "google"` de `app/api/auth/callback/route.ts:35-104`. Alcance hoje: **zero usuários** (`docs/stories/epic-configuracoes/CFG-6.1`, verificado). O botão **não renderiza**: `handleGoogleLogin` é definido em `login-form.tsx:85` e nenhum JSX o referencia (comentário `Google OAuth — disabled until provider is configured`). O callback, porém, é rota pública e alcançável sem passar pela tela de login |
| SAML SSO | Implemented, no provider registered | Código na árvore: `auth.signInWithSSO(` em `components/auth/login-form.tsx:111`, API de provider em `app/api/admin/sso/route.ts` (fala com `/auth/v1/admin/sso` do Supabase) e auto-provisioning no ramo `isSaml` de `app/api/auth/callback/route.ts:107-170`. O botão **não renderiza**: `app/(auth)/login/page.tsx:15` passa `ssoProviderId={null}` literal, e o bloco de `login-form.tsx:258` depende desse valor. Plano Supabase Pro continua sendo pré-requisito para o provider funcionar de ponta a ponta |
| Magic links | Not configured | Supabase supports natively. Confirmado por controle negativo: `signInWithOtp` devolve 0 arquivos em `apps/web/src` |

### Market Context

- **Enterprise clients** exigem SSO (SAML/OIDC) para compliance e governance
- **Google OAuth** reduz fricção de onboarding significativamente (1-click vs email+password)
- **Invite-only** permanece como modelo base — OAuth/SSO são métodos adicionais de auth, não substituem convites

---

## Superfície de Credencial, escopo próprio deste épico

**Declaração de escopo.** Este épico é dono da **superfície de credencial da plataforma inteira**, não apenas da lista de stories numeradas 8.x que estão sob ele. Quem precisa enumerar por onde uma identidade entra no sistema (revisão de segurança, modelagem de ameaça, agente de IA recebendo o épico como contexto) deve conseguir fazê-lo lendo esta seção, sem descobrir por conta própria que existem vias sob outros pais.

**O que esta declaração não faz.** Ela é **descritiva, não possessiva**. Nomear aqui uma via cuja story vive sob outro épico **não transfere a posse daquela story**, não move backlog, não altera prioridade e não cria dependência de execução. O dono do trabalho continua sendo o épico onde a story está. O que este épico assume é a obrigação de **manter a lista completa**, e é isso que o detector reprova quando a lista encolhe.

### As 6 vias, alcance e escrita privilegiada

| # | Via | Story e épico dono | Alcance hoje | Escreve com `service_role`? |
|:---|:---|:---|:---|:---|
| 1 | Email/password | `docs/stories/epic-1/story-1.3-auth-flow.md:41` (AC1) | Ativa, é a via padrão | Não |
| 2 | Convite por e-mail | `docs/stories/epic-5/story-5.2-gestao-usuarios.md`, aceite em `(auth)/accept-invite` | Ativa | Sim, `invite-user.ts:45` usa `serviceClient.auth.admin` |
| 3 | Google OAuth | `docs/stories/epic-8/story-8.1-google-oauth.md` | **Zero usuários**, botão não renderiza, callback público alcançável | **Sim**, `api/auth/callback/route.ts:86` |
| 4 | SAML SSO | `docs/stories/epic-8/story-8.2-saml-sso-enterprise.md` | **Zero usuários**, botão não renderiza, callback público alcançável | **Sim**, `api/auth/callback/route.ts:156` |
| 5 | Redefinição de senha self-service | `docs/stories/epic-1/story-1.3-auth-flow.md:109` (AC11) | Ativa | Não |
| 6 | Link de recuperação emitido por admin | `docs/stories/epic-configuracoes/CFG-0.1.story.md`, bloco `A3.1 Redefinir senha` | Ativa | Sim, `admin/users/[userId]/reset-password/route.ts:51` |

### Escrita privilegiada no caminho de autenticação

O caminho de autenticação contém **2 escritas em `public.users` com `service_role`**, que **ignoram RLS**, ambas na mesma rota pública de callback:

| # | Local exato | Ramo | O que faz |
|:---|:---|:---|:---|
| 1 | `apps/web/src/app/api/auth/callback/route.ts:86` | Google (`app_metadata?.provider === "google"`) | `serviceClient.from("users").insert({...})`, provisiona o usuário sem passar por RLS |
| 2 | `apps/web/src/app/api/auth/callback/route.ts:156` | SAML (`isSaml`) | `serviceClient.from("users").insert({...})`. O `tenant_id` é resolvido por **reverse lookup** de `settings.sso_provider_id` sobre **todos os tenants** (linhas 137-149) |

O cliente privilegiado é obtido em `route.ts:37` e `route.ts:114` via `createServiceClient()`, importado de `@/lib/supabase/service`. Esta é a razão pela qual as vias 3 e 4 não podem ser tratadas como "não configuradas" para efeito de revisão de segurança: a tela está desligada, o caminho de escrita privilegiada não está.

### Dispersão das vias sob 3 pais distintos

As 4 vias que este documento omitia até 2026-08-13 não estão todas sob o epic-8. Elas se dispersam por **3 épicos-pai diferentes**, e é por isso que nenhuma atualização automática do tipo "avise o épico-pai da story" alcançaria as 4:

| Via omitida | Pai real da story | Ponteiro verificado |
|:---|:---|:---|
| 3. Google OAuth | **epic-8** (este) | `docs/stories/epic-8/story-8.1-google-oauth.md` |
| 4. SAML SSO | **epic-8** (este) | `docs/stories/epic-8/story-8.2-saml-sso-enterprise.md` |
| 5. Redefinição self-service | **epic-1** | `docs/stories/epic-1/story-1.3-auth-flow.md:109`, AC11, cita `resetPasswordForEmail` |
| 6. Link de recuperação por admin | **epic-configuracoes** | `docs/stories/epic-configuracoes/CFG-0.1.story.md:16`, bloco `A3.1 Redefinir senha` |

Um write-back pai-filho alcançaria **2 das 4** e mandaria as outras 2 para o pai errado. Os ponteiros acima envelhecem, como qualquer referência cruzada que ninguém mantém, e ficam registrados assim de propósito: um ponteiro datado é melhor que a omissão anterior, que fazia este documento parecer completo.

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
| 2026-08-13 | 1.2 | Correção de drift doc-vs-código, POP-FIX-001 run `2026-08-12-epic8-oauth-e-saml-nao-documentados`, ações A1 a A7. `Auth Atual` passa de 2 para 6 vias enumeradas com path e símbolo detector (A1). Google OAuth e SAML SSO deixam de ser declarados `Not configured` e passam ao estado medido (A2). As 2 escritas com `service_role` em `api/auth/callback/route.ts:86` e `:156` passam a constar (A3). `Status` do épico corrigido de `Draft` para `InReview`, coerente com as filhas (A4). Mapa de dispersão das 4 vias sob 3 pais distintos registrado (A5). Superfície de credencial declarada como escopo próprio do épico, de forma descritiva (A6). Cabeçalho ganha data de medição, validade 2026-11-12 e dono de re-snapshot, e os blocos de estado passam a ser marcados como snapshot não-autoritativo (A7) | Dex (@dev) |

---

*Epic criado por Morgan (PM Agent) — exímIA Academy v1.0*

— Morgan, planejando o futuro 📊
