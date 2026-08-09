# Configurações da Plataforma, Estado Atual (Mapa Honesto)

> **Autor:** PLANEJADOR (arquiteto técnico, linha Maestri)
> **Data:** 2026-07-22 · **Branch:** deploy/cory
> **Propósito:** inventário verificado de tudo que JÁ existe de administração/configuração no eximIA Academy v2, para que o plano da "Aba de Configurações" (inspiração Stratws One) nasça de gap real, não de suposição.
> **Método:** 4 varreduras read-only paralelas (UI, APIs, schema, convites) + verificação do MCP eximia-academy. Todos os paths são verificáveis no repo.

---

## Sumário executivo

O produto está MUITO mais maduro em administração do que o senso comum da casa assume. Já existe um mini painel de configurações real em `/admin/*`: settings de tenant (branding, whitelabel, SSO, features, IA, session timeout), gestão de usuários com convite, áreas (unidades), grupos de gestor, cargos (job roles), API keys com scopes e rotação, webhooks com delivery log, integrações outbound, planos com quotas, e um console super_admin multi-tenant. O modelo de dados de governança é sofisticado: 6 roles, sistema multi-chapéu (`user_roles`), permissões granulares de instrutor, membership multi-tenant, plan_features. Os gaps reais estão em: auditoria (tabela existe, quase não é escrita e não tem UI), preferências de usuário sem persistência, ausência de bulk import, áreas sem hierarquia, e o MCP operando em produção por fora de todo esse aparato.

---

## 1. Superfícies de UI existentes

### 1.1 Rotas admin, `apps/web/src/app/(platform)/admin/*`

| Rota | O que faz | Quem acessa | Estado |
|:---|:---|:---|:---|
| `/admin/settings` | Configuração do tenant: branding, whitelabel, SSO, features, modelo de IA, session timeout, max interações | admin, super_admin | Completa |
| `/admin/users` | Lista paginada com filtros, stats, convite de usuário, edição de role/status | admin, super_admin | Completa |
| `/admin/areas` + `/admin/areas/[areaId]` | CRUD de áreas (unidades), atribuição de usuários e cursos por área; gate pelo módulo "units" | admin, super_admin, manager | Completa |
| `/admin/manager-groups` + `[groupId]` | Grupos de gestor (times de alunos por manager, locais ou corporativos), membros e unidades vinculadas | admin, super_admin, manager (com checagem de ownership) | Completa |
| `/admin/job-roles` | CRUD de cargos organizacionais + vínculo a trilhas | manager, admin, instructor, super_admin | Completa |
| `/admin/api-keys` | CRUD de API keys públicas: scopes, rate limits, CORS, expiração, rotação, uso | admin, super_admin | Completa |
| `/admin/webhooks` | CRUD de webhooks, teste de entrega, histórico de deliveries | admin, super_admin | Completa |
| `/admin/integrations` | Integration keys, conexões outbound, sync logs | admin, super_admin | Completa |
| `/admin/plans` | super_admin: matriz de features × plano + uso de quotas; admin: vê o próprio plano | admin, super_admin (visões distintas) | Completa |
| `/admin/tenants` + `[id]` | Console cross-tenant: lista de empresas, contagens, detalhe por tenant | super_admin apenas | Completa |
| `/admin/notifications` | Engagement Center: campanhas, nudges sugeridos por IA, templates, histórico | admin, manager, instructor (escopo por papel) | Completa |
| `/admin/biblioteca` + editor de conteúdo | Gestão de livros/capítulos da biblioteca | admin, super_admin | Completa |

Fonte: `apps/web/src/app/(platform)/admin/*/page.tsx` (16 páginas).

### 1.2 Outras superfícies de gestão

| Rota | O que faz | Quem acessa | Estado |
|:---|:---|:---|:---|
| `/analytics` (+ detalhe sessão/aluno) | Analytics org completo, lente de manager (subárvore E9), gate LGPD de reflexões | leader, manager, admin, instructor, super_admin | Completa (detalhes são sub-rotas finas) |
| `/instructor` (grupo `(studio)`) | Home do instrutor: cursos, alunos por área, plano de ensino, exports | instructor (chapéu real via `user_roles`) | Completa |
| `/leader` | Dashboard do líder: progresso do time por áreas compartilhadas | leader | Completa |
| `/team/profiles` | Visão comportamental do time (DISC, Big Five) | manager, admin | Completa |
| `/perfil` | Perfil pessoal (nome, email, avatar) | todos autenticados | Completa |
| `/configuracoes` | Preferências: aparência, idioma, notificações | todos autenticados | **PARCIAL, UI sem persistência** (opções hardcoded, tema/idioma travados) |
| `/workspace` | Picker multi-tenant para usuários com múltiplos acessos | todos com 2+ memberships | Completa |

### 1.3 Componentes de gestão, `apps/web/src/components/admin/`

13 componentes maduros: `invite-user-dialog.tsx`, `enrollment-dialog.tsx`, `settings-tabs-wrapper.tsx`, `whitelabel-settings-form.tsx` + `whitelabel-preview.tsx`, `sso-config-form.tsx`, `logo-upload.tsx`, `branding-preview.tsx`, `color-picker.tsx`, `role-selector.tsx`, `area-assignment.tsx`, `instructor-permissions-form.tsx`, `user-list.tsx`. Todos completos.

### 1.4 Proteção de rota

`apps/web/src/middleware.ts`: paths protegidos (`/dashboard`, `/courses`, `/admin`, `/analytics`, `/instructor`); `/instructor` exige chapéu real de instructor via union de `user_roles` (linhas ~338-340); instrutores bloqueados de `/admin/users`, `/admin/settings`, `/admin/api-keys`, `/admin/webhooks` (linhas ~362-372). Cada page.tsx admin repete guard SSR via `getAuthProfile()`.

---

## 2. APIs de administração

### 2.1 Admin interno, `apps/web/src/app/api/admin/*` (sessão + role)

| Grupo | Endpoints | CRUD de quê | Guard |
|:---|:---|:---|:---|
| users | `users` (GET/POST), `users/[id]` (PATCH/DELETE), `users/[id]/instructor-permissions` | listar/convidar, editar role/status, soft-delete, permissões de instrutor | admin, super_admin (permissões: +manager) |
| areas | `areas`, `areas/[id]`, `areas/[id]/users`, `areas/[id]/courses` | CRUD de área, membros, cursos por área | requireAdmin / requireAdminOrManager |
| tenants | `tenants` (POST), `tenants/[id]` (PATCH/DELETE), `tenants/[id]/areas*`, `switch-tenant` | criar/editar/apagar tenant, troca de tenant ativo via cookie | requireSuperAdmin |
| api-keys | CRUD + `rotate` + `usage` | chaves, rotação, log de uso | requireAdmin |
| webhooks | CRUD + `test` + `deliveries` | hooks, teste, histórico | requireAdmin |
| sso | `sso` (GET/POST/DELETE) | configurar/remover provedor SAML (valida Origin em mutações) | admin, super_admin |
| engagement | `campaign`, `history`, `templates`, `suggestions*` | campanhas, templates, nudges IA | admin/manager/instructor com scope check |
| notifications | `notifications` (GET/POST) | envio de emails a alunos no escopo | admin/manager/instructor/super_admin |
| books | 9 endpoints | biblioteca (livros, capítulos, PDF) | admin, super_admin |

Também: `api/privacy/export` e `api/privacy/delete` (LGPD, export e soft-delete com ban), `api/integrations/keys*` e `api/integrations/connections`, `api/auth/validate-tenant`, `api/leader/comments`.

Guards centralizados em `apps/web/src/lib/api-auth/require-admin.ts`, `lib/super-admin-auth.ts`, `lib/auth.ts`, `lib/role-helpers.ts`, `lib/area-context.ts` (resolveCallerStudentScope, fecha vazamento de escopo de manager/instructor).

### 2.2 API pública, `apps/web/src/app/api/v1/*` (API key + scopes)

Autenticação Bearer via middleware (`extractApiKeyContext`), contexto injetado em headers reescritos. Endpoints: courses (list/get/chapters/enrollments), enrollments (GET, POST com scope `enrollments:write`), blueprints, analytics de curso, `docs` (OpenAPI público), proxy `integration/[...path]`. Leitura majoritária, única escrita é enrollment.

---

## 3. Modelo de dados de governança

Schema em `packages/database/src/schema/`, migrations em `supabase/migrations/`.

### 3.1 Roles: 6 valores, sistema de dois níveis

Enum real (users.role e user_roles.role): **`student`, `leader`, `manager`, `admin`, `super_admin`, `instructor`**. Não existe outro.

- **Nível 1:** `users.role`, papel primário (compat/JWT).
- **Nível 2 (multi-chapéu):** tabela `user_roles` (migration `20260701030000_epic30_user_roles.sql`), UNIQUE(user_id, role), permite acumular papéis. Os guards modernos checam a union, não o role singular.
- **Por tenant:** `user_tenant_memberships` (userId, tenantId, role, UNIQUE por par), permite role diferente por tenant + workspace picker.
- **Granular:** `instructor_permissions` (canCreateCourses, canCreateQuizzes, canManageTrails, canViewAnalytics, canManageEnrollments, `assignedAreaIds[]`), UNIQUE(userId, tenantId). UI e API existem.

### 3.2 Tenant

`tenants`: name, slug, `branding` (jsonb), `settings` (jsonb, forma livre; inclui sso_provider_id, sessionTimeout etc.), `plan` (essencial/standard/premium), status, `whitelabelEnabled` + `whitelabelConfig` (jsonb), deployment_url. Billing = só o enum de plano + `plan_features` (feature × plano × quota); não há tabela de assinatura/pagamento.

### 3.3 Estrutura organizacional real

```
tenant ──< areas (UNIDADES, flat, SEM parent_id) ──< user_areas >── users
      ──< manager_groups (times de gestor, is_corporate)
             ├──< manager_group_units >── areas
             └──< manager_group_members >── users (alunos)
      ──< job_roles (cargos, seniority, opcionalmente por área)
users.reports_to (hierarquia de gestão direta, self-FK)
```

Ou seja: "unidade" HOJE = `areas` (nomes de exemplo nas migrations são cidades/sites). Não há nesting de unidades. A hierarquia gerencial vem de `users.reports_to` + grupos de gestor (migration `20260530130000_area_gestor.sql`), não da árvore de unidades.

### 3.4 Auditoria e infra de plataforma

- `platform_audit_log` (actorId, action, targetType, targetId, details, índices prontos). **Escrita quase inexistente:** só `lib/audit.ts` (`logSuperAdminAction`) em operações super_admin e leitura no export LGPD. Ações de admin comum (mudar role, apagar área, girar chave) NÃO são auditadas. Sem UI.
- `api_keys` + `api_key_usage_log`: completos e usados.
- `webhooks` + `webhook_deliveries`: completos, com retry state machine.
- `email_notifications`: campanhas via Resend (batch id), usado pelo Engagement Center.
- `plan_features`: entitlements + quotas por plano, com UI em `/admin/plans`.
- **Não existe tabela de convite** própria: convite vive no Supabase Auth (invite por email), o perfil em `public.users` é criado no ato do convite.

---

## 4. Gestão que existe só via MCP / fora do produto

MCP `eximia-academy` (`JARVIS/apps/eximia-academy/mcp/academy-mcp.js`), 18 tools: tenant_create/update/delete/list, area_create/update/delete/list, user_list/update/assign_area/remove_area, course_list/update/publish, session_list, stats, **academy_sql** (query arbitrária).

**Correção importante ao briefing:** a premissa "MCP faz o que a UI não faz" está em grande parte DESATUALIZADA. Tenant CRUD (super_admin), area CRUD, user update/assign-area e stats já têm UI. O gap real inverteu de natureza:

| Capacidade MCP | Equivalente na UI hoje | Gap real |
|:---|:---|:---|
| tenant_create/update/delete | `/admin/tenants` (super_admin) | Nenhum funcional; o gap é o MCP não passar pelos guards |
| area_* / user_assign_area | `/admin/areas`, `/admin/areas/[id]` | Nenhum |
| course_publish / course_update | fluxo instructor/studio | Publicação administrativa em massa só via MCP |
| **academy_sql** | inexistente (por design) | Escape hatch total |
| stats / session_list | `/admin/tenants/[id]`, `/analytics` | Nenhum |

**O problema arquitetural:** o MCP usa **service role key no MESMO projeto Supabase de produção** (`vaguswivhqnlbgqvnjch`, idêntico ao `.env.local` do app). Toda operação via MCP bypassa RLS, guards de role, scope checks e o (já raro) audit log. É um segundo plano de controle invisível ao produto. Qualquer plano de Configurações deve tratar isso: ou o MCP passa a consumir a API v1/admin com chave auditável, ou é rebaixado a read-only.

---

## 5. Convites e onboarding de usuário

Fluxo completo e endurecido (invite-only, sem self-signup):

1. **Convite:** `/admin/users` → `invite-user-dialog.tsx` (email, nome, role student/instructor/manager/admin) → `POST /api/admin/users` → `auth.admin.inviteUserByEmail` (email nativo Supabase, template não customizado) + insert em `public.users` com role/tenant fixados.
2. **Aceite:** `(auth)/accept-invite/page.tsx` (3 métodos: hash implícito, PKCE, OTP) → define senha → `accept-invite/actions.ts` `provisionInvitedUser()` com service client, **preserva role/tenant do momento do convite, nunca confia em metadata do cliente (AUTH-04)**.
3. **OAuth/SSO:** callback (`api/auth/callback/route.ts`) auto-provisiona com role forçado `student`, tenant via metadata do convite ou lookup de `settings.sso_provider_id`; sem tenant → erro `no_tenant`.
4. **Onboarding:** wizard 2 passos (`components/onboarding/onboarding-wizard.tsx`): status de colaborador + foto; se "novo, precisa de onboarding", auto-matrícula no curso type=onboarding publicado.
5. **Multi-tenant:** `/workspace` picker quando há 2+ memberships.

**Faltas objetivas:** bulk/CSV import (nenhum endpoint ou UI), template de email de convite customizado por tenant (Resend existe mas não é usado para convite), reenvio/expiração/lista de convites pendentes (não há tabela de convite, então não há tela "convites pendentes").

---

## 6. Matriz capability × onde existe

Legenda: **UI ✔** = UI completa · **UI ~** = parcial · **API** = só endpoint · **MCP** = só via MCP/ops · **✗** = não existe.

| Capability clássica de Configurações SaaS B2B | Estado | Onde |
|:---|:---|:---|
| Usuários: listar/filtrar | **UI ✔** | `/admin/users` |
| Usuários: convidar (individual) | **UI ✔** | invite-user-dialog + `POST /api/admin/users` |
| Usuários: convidar em massa (CSV/bulk) | **✗** | nada |
| Usuários: convites pendentes (reenviar/revogar) | **✗** | sem tabela nem tela |
| Usuários: editar role/status/desativar | **UI ✔** | `/admin/users` + PATCH/DELETE |
| Papéis: multi-chapéu (user_roles) na UI | **UI ~** | schema+guards prontos; UI de users edita o role primário, gestão dos chapéus é incompleta |
| Papéis: permissões granulares | **UI ~** | só para instructor (`instructor-permissions-form`); admin/manager/leader são fixos em código |
| Papéis customizados (criar papel novo) | **✗** | enum fechado de 6 |
| Organização: dados da empresa | **UI ~** | name/slug em `/admin/tenants` (só super_admin); admin do tenant não edita os próprios dados cadastrais |
| Organização: branding/whitelabel | **UI ✔** | `/admin/settings` (logo, cores, preview, whitelabel) |
| Organização: domínio custom | **UI ~** | `deployment_url`/whitelabelConfig no schema, form de whitelabel toca domínio, provisionamento real é manual (EasyPanel) |
| Unidades/áreas: CRUD | **UI ✔** | `/admin/areas` |
| Unidades/áreas: hierarquia (árvore) | **✗** | areas é flat, sem parent_id |
| Grupos/times de gestor | **UI ✔** | `/admin/manager-groups` |
| Cargos (job roles) | **UI ✔** | `/admin/job-roles` |
| Auditoria: trilha de ações admin | **UI ~✗** | tabela `platform_audit_log` existe; escrita só em ações super_admin; **sem UI nenhuma** |
| Integrações: API keys públicas | **UI ✔** | `/admin/api-keys` (scopes, rotação, uso) |
| Integrações: webhooks | **UI ✔** | `/admin/webhooks` |
| Integrações: conexões outbound | **UI ✔** | `/admin/integrations` |
| SSO/SAML | **UI ✔** | `/admin/settings` (sso-config-form) |
| Billing: plano e features/quotas | **UI ~** | `/admin/plans` mostra; mudança de plano só super_admin/banco; sem pagamento/fatura |
| Preferências de usuário (tema, idioma, notificações) | **UI ~** | `/configuracoes` renderiza mas NÃO persiste nada |
| Preferências de plataforma (session timeout, IA, features) | **UI ✔** | `/admin/settings` |
| Notificações/engajamento (campanhas, templates) | **UI ✔** | `/admin/notifications` |
| Templates de email transacional (convite) por tenant | **✗** | Supabase default |
| LGPD: export/delete de dados | **API** | `/api/privacy/*`, sem superfície de UI dedicada |
| Console cross-tenant | **UI ✔** | `/admin/tenants` (super_admin) |

---

## 7. Top 10 gaps, em ordem de criticidade (leitura de arquiteto)

1. **Auditoria fantasma.** `platform_audit_log` existe mas quase nada escreve nela e não há UI. Num B2B multi-tenant com admins de cliente mexendo em roles e chaves, trilha de auditoria consultável é a capability nº 1 de uma aba de Configurações séria, e o custo é baixo (tabela e índices já prontos, falta instrumentar os handlers admin + 1 tela).
2. **MCP com service role em produção.** Segundo plano de controle fora de RLS/guards/auditoria, incluindo `academy_sql` arbitrário, no mesmo banco do cliente pagante. Decisão de arquitetura pendente: rebaixar a read-only ou fazê-lo consumir API auditável.
3. **Convites sem ciclo de vida.** Não há lista de convites pendentes, reenvio, revogação ou expiração visível. Primeiro atrito real de um admin de cliente no dia a dia.
4. **Bulk import de usuários.** Onboarding de um tenant B2B com 200 colaboradores hoje é 200 cliques no dialog. CSV import + preview + relatório de erros é aposta óbvia da aba.
5. **Preferências de usuário sem persistência.** `/configuracoes` é fachada: tema, idioma e notificações não gravam. Ou persiste (coluna/JSONB + respeito real) ou a página engana.
6. **Admin do tenant não gere a própria organização.** Dados cadastrais da empresa (nome, slug) só via super_admin em `/admin/tenants`. Uma aba "Organização" para o admin do cliente (dados, branding, domínio num só lugar) é o coração do modelo Stratws One e hoje está espalhado/faltando.
7. **Gestão de multi-chapéu incompleta na UI.** O backend já é multi-role (`user_roles`), mas a tela de usuários edita o role primário; conceder/revogar chapéus (ex.: manager que também é instructor) não tem superfície clara.
8. **Sem hierarquia de unidades.** `areas` flat + `reports_to` + manager_groups cobrem hoje, mas cliente enterprise (o alvo do Stratws One) espera árvore org (unidade > sub-unidade). Decidir cedo se a aba assume flat ou introduz parent_id, pois mexe em todo o scoping de analytics.
9. **Permissões granulares só para instructor.** Não há papel customizado nem matriz de permissões para admin/manager/leader; `instructor_permissions` prova o padrão, falta generalizar (ou decidir explicitamente não generalizar).
10. **Billing é vitrine.** Plano/quotas visíveis, mas sem upgrade self-service, fatura ou histórico. Aceitável enquanto vendas é manual; a aba deve ao menos reservar o lugar ("Plano e cobrança") para não redesenhar depois.

---

## 8. Nota final para o plano

A "Aba de Configurações" NÃO parte do zero: 80% das capabilities clássicas já existem como páginas soltas sob `/admin/*`. O trabalho dominante é (a) **arquitetura de informação**, unificar as 16 páginas numa navegação de Configurações coerente estilo Stratws One (Organização / Usuários e Permissões / Estrutura / Integrações / Plano / Auditoria / Preferências); (b) fechar os gaps 1-5, que são funcionais e pequenos-médios; (c) tomar as 3 decisões de arquitetura (MCP, hierarquia de unidades, generalização de permissões) ANTES de desenhar telas, porque cada uma muda o modelo de dados da aba.
