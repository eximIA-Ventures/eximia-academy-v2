# 01 — Diagnóstico: como o sistema funciona hoje de verdade

> Base: `integra/main-cory` em 2026-09-05. Verificado no código, não nas docs.
> Fatos de git checados nesta sessão:
> - `HEAD` é **byte-idêntico** a `origin/deploy/cory` (`git rev-list --left-right --count HEAD...origin/deploy/cory` → `0 0`).
> - `origin/main` é **ancestral estrito**: HEAD 52 à frente, 0 atrás. Fast-forward de `main` é possível hoje, sem merge.
> - `origin/deploy/vertice` tem 3 commits próprios; HEAD está 95 à frente dela.

---

## (a) Como o sistema funciona hoje — uma página

O produto é **um app Next.js 15** (`apps/web`) sobre **um único projeto Supabase** (`vaguswivhqnlbgqvnjch`), com **111 migrations** em `supabase/migrations/`. Dentro desse banco convivem hoje 4 empresas reais como linhas da tabela `tenants` (Cory Alimentos, exímIA Academy, Harven Finance, Vértice Indústria — nominadas em `supabase/migrations/20260803000000_onboarding_novidades.sql`).

Existem **dois eixos de "tenant" que não se falam**, e essa é a chave para entender tudo:

**Eixo 1 — DADOS (runtime, funciona, é a trava de segurança).**
`getAuthProfile()` (`apps/web/src/lib/auth.ts:26-40`) lê `users.tenant_id` com JOIN em `tenants(id,name,slug,branding,settings,whitelabel_enabled,whitelabel_config)` a cada request. O isolamento real é RLS no Postgres, via `auth_tenant_id()`, cuja definição **vigente** (`supabase/migrations/20260518100000_fix_leader_rls_recursion.sql:12-19`) é `SELECT tenant_id FROM users WHERE id = auth.uid()` — leitura de tabela, PL/pgSQL, `SECURITY DEFINER`. O super_admin (`tenant_id` NULL) atravessa tudo por `is_super_admin()` (`20260209000000_epic11_super_admin_whitelabel.sql:49`) e escolhe empresa ativa por cookie `x-sa-active-tenant` (`apps/web/src/app/api/admin/switch-tenant/route.ts:27-33`), resolvido em `resolveTenantId()` (`apps/web/src/lib/auth.ts`, ordem: tenant próprio → cookie → primeira empresa por `order(name).order(id)`).
**Este eixo já é multi-tenant de verdade e já roda N empresas num deploy só.**

**Eixo 2 — IDENTIDADE (build-time, é o que quebra o objetivo).**
Tudo que o usuário **vê** — nome, logo, favicon, cores, módulos habilitados, footer, e-mail de suporte, timeout de sessão — vem de `apps/web/tenant.config.ts`, que lê literalmente 15 variáveis `NEXT_PUBLIC_TENANT_*` (`tenant.config.ts:49-65`) e monta o objeto em `:122-146`. `apps/web/src/lib/tenant.ts:1` faz `import tenantConfig from "../../tenant.config"` — **import estático, resolvido em build**. `getTenantConfig()` (`tenant.ts:8-10`) só devolve esse objeto. Ele é consumido por 23 arquivos, incluindo os 3 shells de `(platform)/layout.tsx` (`:79`, `:216`, `:342` montam `BrandProvider`; `:83`, `:220`, `:348` injetam `:root{--tenant-primary;--tenant-secondary}` por `dangerouslySetInnerHTML`), `app/layout.tsx` (`generateMetadata` → title/favicon), `(auth)/layout.tsx`, `(studio)/layout.tsx`, `onboarding/layout.tsx`, `not-found.tsx`, `lib/email-template.ts`, `api/admin/notifications/route.ts` e `workspace/_components/workspace-picker.tsx` (este último é `"use client"`, e é a razão declarada de tudo ser `NEXT_PUBLIC_`).

**O middleware não tem nenhuma noção de empresa.** `apps/web/src/middleware.ts` tem 451 linhas e **zero ocorrências** de `host`, `Host`, `hostname` ou `subdomain`. Ele faz auth, rate limit, guards de "mundo" (Padrão/Estúdio/Admin/Super Admin) e cookies de UI (`x-user-role`, `x-active-workspace`, `x-active-context`). Não resolve tenant por requisição — isso existiu e foi **removido de propósito** no commit `f17b34f` (02/mai/2026), que apagou `getTenantBySubdomain()` com a mensagem "BREAKING: Remove multi-tenant path-based routing. Each client gets its own deployment".

**O deploy fecha o círculo.** O `Dockerfile` recebe os 15 `ARG`/`ENV` de marca (`:42-56`, `:72-86`) mais `MARCA_ESPERADA_SLUG` (`:59`, `:87`), e roda **dois gates fail-closed**: `RUN node apps/web/scripts/verificar-marca.mjs` antes do build (`:96`) e `RUN node apps/web/scripts/verificar-marca-no-artefato.mjs` depois (`:123`). Sem `MARCA_ESPERADA_SLUG` o build **reprova** (`verificar-marca.mjs:139`). O EasyPanel builda esse Dockerfile por serviço; o CI (`.github/workflows/ci.yml`) **não** builda Docker nem roda os gates.

**Resultado líquido:** o banco já sabe servir N empresas num deploy; a interface não. Para dar marca/módulos diferentes a duas empresas, hoje é obrigatório um **build separado** — e, portanto, um serviço separado no EasyPanel, um domínio separado, e (na prática histórica) uma branch `deploy/{client}`.

---

## (b) Causa-raiz e o inventário completo de dependências de build-time

### Causa-raiz, em uma frase

`apps/web/src/lib/tenant.ts:1` é um **import estático de módulo TypeScript**. Enquanto a identidade do cliente for um literal dentro do bundle, dar marca diferente exige dar **código diferente** — e o Next só inlina `process.env.NEXT_PUBLIC_X` escrito por extenso, o que empurra a decisão para **build time** e para o **navegador**. O gatilho concreto que travou isso é `apps/web/src/app/workspace/_components/workspace-picker.tsx`, um `"use client"` que importa `@/lib/tenant`: como a config viaja para o bundle do browser, ela **não pode** ser resolvida por request sem antes esse componente parar de chamar `getTenantConfig()` direto.

### Todas as dependências de build-time por tenant

| # | Onde | caminho:linha | O que amarra ao build |
|---|---|---|---|
| 1 | Import estático da config | `apps/web/src/lib/tenant.ts:1` | `import tenantConfig from "../../tenant.config"` |
| 2 | Leitura literal de env | `apps/web/tenant.config.ts:52-68` | 15 `process.env.NEXT_PUBLIC_TENANT_*` literais |
| 3 | Montagem do objeto | `apps/web/tenant.config.ts:131-160` | brand, modules, features.orgTree, settings |
| 4 | Client component | `apps/web/src/app/workspace/_components/workspace-picker.tsx` | `"use client"` + `getTenantConfig()` direto → obriga `NEXT_PUBLIC_` |
| 5 | ARGs de marca | `Dockerfile:42-59` | 15 ARGs + `MARCA_ESPERADA_SLUG` |
| 6 | ENVs de marca | `Dockerfile:72-87` | os mesmos, promovidos a ENV do estágio builder |
| 7 | Gate 1 (declaração) | `Dockerfile:96` → `apps/web/scripts/verificar-marca.mjs` | reprova build sem `MARCA_ESPERADA_SLUG` (`:139`), exige as `OBRIGATORIAS` (`:100`, `:174`) |
| 8 | Gate 2 (artefato) | `Dockerfile:123` → `apps/web/scripts/verificar-marca-no-artefato.mjs` | varre bytes da identidade dentro de `apps/web/.next` |
| 9 | Teste que trava os gates | `apps/web/src/lib/__tests__/dockerfile-roda-os-dois-gates.test.ts` | mede presença, ordem e "rabo" das duas instruções `RUN` |
| 10 | Teste do parsing de env | `apps/web/src/lib/__tests__/marca-por-env.test.ts` | checa o acesso literal no código-fonte |
| 11 | Módulos por env | `apps/web/tenant.config.ts` (`modulos()`, CSV de `NEXT_PUBLIC_TENANT_MODULES`) → `(platform)/layout.tsx:215,341` | `ModuleProvider modules={config.modules}` |
| 12 | Feature `orgTree` por env | `apps/web/tenant.config.ts:141` (`booleano(ENV.orgTree)`) | única fonte de `features.orgTree` |
| 13 | Host de imagem fixo | `apps/web/next.config.ts:13` | `hostname: "vaguswivhqnlbgqvnjch.supabase.co"` |
| 14 | Assets de marca no repo | `apps/web/public/brand/*`, `apps/web/public/logos/argos-*.png`, `harven-finance-*` | logo de cliente versionado em git |
| 15 | Processo documentado | `docs/DEPLOY-GUIDE.md:11-70` | "criar branch `deploy/{client-slug}`", "editar `tenant.config.ts`", "criar app no EasyPanel", domínio `{slug}.academy.eximiaventures.com.br` |
| 16 | Preview público lê o slug de build | `apps/web/src/app/gauntlet-preview/*/leitura-real.ts:83` | `getTenantConfig().brand.slug` + `createServiceClient()` |

### O que **não** é causa-raiz (para não gastar esforço no lugar errado)

- A tabela `tenants` já tem `branding` (jsonb), `settings` (jsonb), `plan`, `status`, `whitelabel_enabled`, `whitelabel_config` (`packages/database/src/schema/tenants.ts`; DDL em `20260207000000_initial_schema.sql:13-22` + `20260209000000`).
- Já existe `POST /api/admin/tenants` criando empresa (`apps/web/src/app/api/admin/tenants/route.ts:30-35`).
- Já existe leitura de config por tenant em runtime funcionando: `apps/web/src/lib/tenant-features.ts` (`isTenantFeatureEnabled` lê `tenants.settings->features`) e `apps/web/src/lib/feature-gate.ts` (lê `tenants.plan` × `plan_features`).
- Já existe seletor de empresa para super_admin dentro do mesmo deploy.

**Ou seja: falta ligar o eixo 2 no eixo 1, não construir o eixo 1.**

---

## (c) Inventário: fica / refatora / sai

### Por módulo

| Módulo | Veredito | Motivo |
|---|---|---|
| RLS + `tenant_id` + `auth_tenant_id()` | **FICA** | É a única autorização real. Não tocar. |
| `apps/web/src/lib/auth.ts` (`getAuthProfile`, `resolveTenantId`, `getDbClient`) | **FICA** | Base do multi-tenant de dados; já testado (`lib/__tests__/tenant-fallback.test.ts`). |
| `lib/tenant-features.ts` + `lib/feature-gate.ts` + `plan_features` | **FICA (com unificação)** | Já leem do banco em runtime; são o modelo a seguir. |
| CRUD de tenants (`api/admin/tenants/*`, `(platform)/admin/tenants/*`) | **REFATORA** | Existe e funciona, mas cria só `name+slug`. |
| `tenant.config.ts` + `lib/tenant.ts` | **REFATORA** | Vira fallback neutro; a fonte de verdade passa a ser o banco. |
| Gates de marca (`verificar-marca*.mjs` + `Dockerfile:96,123` + teste) | **SAI** | Pressupõem 1 build = 1 cliente. Deixam de fazer sentido. |
| `docs/DEPLOY-GUIDE.md` | **SAI / reescreve** | Descreve o processo que estamos eliminando; e já está **factualmente errado** (manda criar um projeto Supabase por cliente — a produção tem 1 projeto com 4 tenants). |
| `apps/central` | **SAI** (ou decisão explícita) | 8 arquivos versionáveis, página estática com KPIs `"—"`, Dockerfile ausente de `docker-compose.yml`. Refutado o "ausente do CI" — `apps/central/package.json` declara `build`/`lint`/`typecheck` e roda via `pnpm-workspace.yaml` + turbo a cada CI (ver `04-critica.md`); ele custa CI hoje mesmo sem servir a nada em produção. `00-decisoes.md` D7. |
| `gauntlet-preview/*` (9 rotas) | **REFATORA URGENTE** | Rotas públicas lendo produção com `service_role`. Ver (d). |
| Whitelabel DB (`admin/settings/*`, `admin/configuracoes/marca`, `whitelabel-actions.ts`) | **REFATORA (vira o caminho principal)** | O lado de escrita já existe e funciona; falta o lado de leitura. |
| Scripts de seed de cliente (`supabase/seed-cory-users.py`, `scripts/demo-tenant-vertice-*.mjs`) | **REFATORA para API** | Hoje é o único caminho que produz um tenant completo. |
| `apps/web/public/logos/*` (argos, harven) | **SAI** | Marca de cliente em git. Vai para Storage. |

### Por arquivo relevante

| Arquivo | Veredito | Observação |
|---|---|---|
| `apps/web/src/lib/tenant.ts` | REFATORA | vira `getTenantConfig(request)` assíncrono, ou um resolvedor por host cacheado |
| `apps/web/tenant.config.ts` | REFATORA | mantém o `NEUTRO` como fallback; deixa de ser fonte por cliente |
| `apps/web/src/middleware.ts` | REFATORA | recebe resolução por host + header `x-tenant-id`/`x-tenant-slug` |
| `apps/web/src/app/(platform)/layout.tsx` | REFATORA | `BrandProvider`/`ModuleProvider` passam a receber dado do banco |
| `apps/web/src/app/(studio)/layout.tsx`, `(auth)/layout.tsx`, `onboarding/layout.tsx`, `not-found.tsx`, `app/layout.tsx` | REFATORA | mesmos consumidores de `getTenantConfig()` |
| `apps/web/src/app/workspace/_components/workspace-picker.tsx` | REFATORA (bloqueante) | precisa receber `brand` por prop de Server Component |
| `apps/web/src/components/providers/tenant-provider.tsx` | REFATORA | **nunca é montado** hoje (só se auto-importa); vira o provider real |
| `apps/web/src/app/(platform)/admin/settings/loader.ts` | FICA | já lê `branding`/`whitelabel_config`; passa a alimentar o render |
| `apps/web/src/app/(platform)/admin/settings/whitelabel-actions.ts`, `actions.ts` | FICA | lado de escrita pronto |
| `apps/web/src/components/admin/logo-upload.tsx` | QUEBRADO → corrige | bucket `tenant-assets` não existe |
| `apps/web/src/components/onboarding/step-welcome.tsx` | QUEBRADO → corrige | mesmo bucket |
| `apps/web/src/app/api/admin/tenants/route.ts` | REFATORA | vira RPC de provisionamento completo |
| `apps/web/src/app/(platform)/admin/tenants/[id]/_components/tenant-management-client.tsx:26` | REFATORA | importa `UserPlus` e nunca usa — aba Usuários é só leitura |
| `apps/web/src/app/(auth)/login/page.tsx` + `apps/web/src/components/auth/login-form.tsx` | SAI (uma das duas) | duas telas de login coexistindo |
| `apps/web/src/app/api/auth/validate-tenant/route.ts` | **FICA / REFATORA** | Implementação pronta da regra host×usuário: `:36-38` deixa super_admin passar livre, `:45-50` devolve 403 quando `tenantSlug` recebido diverge do slug do tenant do usuário. Único chamador é o login legado (`login-form.tsx:148`), que recebe o slug via `(auth)/login/page.tsx:14` (`config.brand.slug`, hoje slug de build). Refatora para receber o slug resolvido por host em vez do slug de build — não sai (contradição com o §1 do plano apontada em `04-critica.md`; decisão em `00-decisoes.md` D9) |
| `apps/web/next.config.ts:13` | REFATORA | hostname de imagem fixo num projeto Supabase |
| `Dockerfile:42-59,72-87,96,123` | SAI | ARGs de marca + 2 gates |
| `apps/web/src/lib/__tests__/dockerfile-roda-os-dois-gates.test.ts` | SAI | trava exatamente o que precisa mudar |
| `apps/web/src/lib/__tests__/marca-por-env.test.ts` | REFATORA | vira teste do fallback neutro |
| `supabase/migrations/20260421000001_tenant_deployment_url.sql` | REFATORA | coluna `deployment_url` existe e **nenhum código a lê** (só aparece nos tipos gerados) |
| `supabase/migrations/20260421000000_jwt_tenant_claim_hook.sql` | [VERIFICAR] | O cabeçalho diz que `auth_tenant_id()` lê o JWT, mas a definição vigente (`20260518100000:12-19`) lê a **tabela**. O hook pode estar vestigial em produção. |
| `docs/features/multi-tenant.md` (untracked) | FICA | documento bom; precisará de revisão após a mudança |

---

## (d) O que está quebrado ou pela metade — por severidade

| # | Severidade | Defeito | Evidência |
|---|---|---|---|
| 1 | **BAIXA** (rebaixado de CRÍTICO — refutado em `04-critica.md`) | As 9 rotas `/gauntlet-preview/*` estão de fato fora de `protectedPaths` (`middleware.ts:336-345`) e, se alcançadas, leem produção com `createServiceClient()` (service_role, RLS contornada). Mas todas fazem `if (process.env.NODE_ENV === "production") notFound()` na primeira linha do handler, e o Dockerfile (`:128`)/`docker-compose.yml` fixam `NODE_ENV=production` — em produção as 9 rotas devolvem 404 antes de tocar `service_role`. Não há falha de segurança viva; o item que resta é defesa em profundidade (entrar em `protectedPaths` com guard de `super_admin`), sem urgência. `00-decisoes.md` D8. | `apps/web/src/app/gauntlet-preview/visao-geral/page.tsx:93`, `leitura-real.ts:36-37,82-94`; `middleware.ts:336-345`; `Dockerfile:128` |
| 2 | **BLOQUEANTE** | Marca/módulos só existem em build. Impossível servir 2 empresas com marcas diferentes de 1 imagem. | `lib/tenant.ts:1`; `tenant.config.ts:52-68` |
| 3 | **BLOQUEANTE** | O replay de migrations **do zero não roda**: `20260702222743_auth_direct_student_ids.sql:96-98` faz `REVOKE EXECUTE` em 3 funções que nenhuma migration cria (`subtree_student_ids`, `auth_subtree_user_ids`, `auth_reachable_student_ids`) → `42883` em banco virgem. Declarado, não resolvido, no cabeçalho de `20260905120000_equivalencia_git_producao_colunas_gatilhos_tabelas.sql`. Sem isso não há ambiente novo reprodutível. | as duas migrations citadas |
| 4 | **ALTA** | Bucket de Storage `tenant-assets` **não existe** e nenhuma migration o cria (a única `INSERT INTO storage.buckets` do repo é `20260210000003_epic12_multimodal_content.sql:13`). Logo: todo upload de logo de cliente e de foto de onboarding falha. Há teste que documenta `NoSuchBucket`. | `apps/web/src/components/admin/logo-upload.tsx:50`; `components/onboarding/step-welcome.tsx:52`; `components/admin/__tests__/upload-que-falha-nao-pode-calar.test.tsx:9-13` |
| 5 | **ALTA** | Branding gravado pelo admin **não renderiza nada**. `whitelabel-actions.ts`/`actions.ts` gravam em `tenants.branding`/`whitelabel_config`, `loadTenantSettings()` lê, mas o único consumo fora das próprias telas é `(platform)/layout.tsx:200-203`, e **só** para decidir o selo "PRO". `TenantProvider` (`components/providers/tenant-provider.tsx:37,47`) **nunca é montado**. O admin salva logo/cor/favicon, vê "sucesso", e nada muda. | arquivos citados |
| 6 | **ALTA** | Três mecanismos de feature-gate desalinhados: `modules[]` (env de build), `plan_features` × `tenants.plan` (banco, por plano global) e `tenants.settings.features` (banco, por tenant, usado só para `ai_detection`). Vocabulários de chave não batem (`course-designer` vs `course_designer`). | `registry.ts` (MODULE_IDS); `lib/feature-gate.ts`; `lib/tenant-features.ts` |
| 7 | **ALTA** | `isCapabilityEnabled` e `isApiRouteAllowed` (`packages/shared/src/modules/registry.ts`) não têm nenhum chamador — nenhuma rota de API é bloqueada por módulo desligado. | grep sem call-site fora do barrel |
| 8 | **ALTA** | O CI não builda a imagem nem roda os gates de marca. Falha de marca só aparece no deploy. | `.github/workflows/ci.yml` (lint/typecheck/test/build apenas) |
| 9 | **MÉDIA** | Drift de schema: DB tem `tenants.plan DEFAULT 'standard'` (`20260217000000:16`), Drizzle declara `.default("essencial")` (`packages/database/src/schema/tenants.ts`), e `feature-gate.ts` cai em `essencial` quando não acha linha. Três respostas para a mesma pergunta. | arquivos citados |
| 10 | **MÉDIA** | `tenants.deployment_url` existe desde 20260421 e **nenhum código a lê**. Placeholder de um plano abandonado. | `20260421000001_tenant_deployment_url.sql`; grep só bate em `packages/database/src/types/supabase.ts` |
| 11 | **MÉDIA** | Dois logins coexistem: `/entrar` (canônico, sem Google/SSO) e `/login` (legado, com Google/SSO/reset e a única chamada a `/api/auth/validate-tenant`). Feature-set diferente na mesma superfície. | `(auth)/entrar/_components/login-form.tsx` vs `components/auth/login-form.tsx:148` |
| 12 | **MÉDIA** | Convite usa `NEXT_PUBLIC_APP_URL` fixo como `redirectTo` — uma URL global para todas as empresas. | `apps/web/src/app/api/admin/users/invite-user.ts:44-51` |
| 13 | **MÉDIA** | `DELETE /api/admin/tenants/[tenantId]` só barra por contagem de usuários; não checa areas/courses/sessions. | `api/admin/tenants/[tenantId]/route.ts:47-73` |
| 14 | **MÉDIA** | `apps/central` órfão de produto: 8 arquivos versionáveis, KPIs `"—"`, Dockerfile não referenciado por `docker-compose.yml` (serviços: `web`, `docling`, `blueprint`). Refutado que seja "ausente do CI" — ele builda e tipa via `turbo` a cada CI (`04-critica.md`), então custa CI mesmo sem fazer nada. | `apps/central/src/app/page.tsx:4-9`; `apps/central/package.json:5-11` |
| 15 | **BAIXA** | `next.config.ts:13` fixa o hostname de imagem no projeto Supabase atual. | idem |
| 16 | **BAIXA** | `generateMetadata` engole erro de `getTenantConfig()` com fallback silencioso para a marca neutra. | `apps/web/src/app/layout.tsx:31-45` |

---

## (e) Cadastro de empresa: o que existe e o que falta

### Existe hoje

| Peça | Onde | Estado |
|---|---|---|
| API de criação | `api/admin/tenants/route.ts:16-44` | cria **só** `{name, slug}`; 403 se não for super_admin; 409 em slug duplicado |
| UI de criação | `(platform)/admin/tenants/_components/tenants-management-client.tsx:45-46,67` | formulário com **2 campos**: nome e slug (com auto-slug) |
| Editar/excluir | `api/admin/tenants/[tenantId]/route.ts` | PATCH nome/slug; DELETE bloqueado se houver usuário |
| Criar áreas do tenant | `api/admin/tenants/[tenantId]/areas/route.ts` | funciona |
| Detalhe do tenant | `(platform)/admin/tenants/[id]/page.tsx` | stats, users (read-only), areas, courses |
| Entrar num tenant | `api/admin/switch-tenant/route.ts` | valida existência e grava cookie `x-sa-active-tenant` httpOnly, 30 dias |
| Convidar usuário | `api/admin/users/route.ts` + `invite-user.ts` | usa `supabase.auth.admin.inviteUserByEmail`, tenant vindo do perfil do chamador **ou** do cookie |
| Config de marca no banco | `admin/configuracoes/organizacao` + `.../marca`, `whitelabel-actions.ts` | grava; **não renderiza** |
| Planos | `admin/plans/*` + `plan_features` | CRUD de features por plano |

### Falta

1. **Domínio.** Nenhuma coluna funcional de host/subdomínio. `deployment_url` existe e é órfã. Sem isso, "cadastrar empresa" não produz endereço.
2. **Branding no cadastro.** O formulário não pede logo, cor, favicon, footer nem e-mail de suporte — e mesmo se pedisse, hoje nada disso renderiza. **Correção:** o contrato Zod para isso já existe, morto — `createTenantSchema` (`packages/shared/src/validators/whitelabel.ts:28-58`) aceita `branding{logo_url,primary_color,secondary_color}`, `settings{ai_model,max_interactions_per_session}` e `plan`; zero chamadores fora do próprio arquivo (grep confirmado). `api/admin/tenants/route.ts:7-14` reimplementa um schema de 2 campos em vez de usá-lo. Ver `04-critica.md` e `00-decisoes.md` D10.
3. **Módulos e plano no cadastro.** `plan` fica no DEFAULT do banco (`standard`); `modules` nem existe como coluna.
4. **Primeiro admin.** Não há endpoint "tenant + admin" em uso. O caminho real hoje é manual em 3 passos: criar tenant → `POST /api/admin/switch-tenant` → convidar em `/admin/users`. O ícone `UserPlus` está importado e nunca usado em `tenant-management-client.tsx:26`. **Correção:** o mesmo `createTenantSchema` já modela `initial_manager{email,full_name,role}` — o contrato "tenant + primeiro gestor" existe em `packages/shared` e está morto, não precisa ser desenhado do zero (ver `04-critica.md` item 3 de "Refutado").
5. **Estrutura mínima.** Nada cria area/department/manager_group/roles padrão. Quem faz isso hoje é `scripts/demo-tenant-vertice-seed.mjs` (fetch cru ao PostgREST/GoTrue com `service_role` lida de `apps/web/.env.local`, IDs de cliente hardcoded) e `supabase/seed-cory-users.py` (URL de produção, senha fixa `Cory@2026`, ~34 nomes/e-mails no arquivo).
6. **Atomicidade.** Criação é um `insert` solto. Não há transação/RPC. `scripts/demo-tenant-vertice-phase5.mjs` existe **porque o processo travou no meio** e precisou de retomada manual.
7. **Bucket de assets.** Sem `tenant-assets`, não há onde colocar o logo da nova empresa.
8. **Rastreabilidade.** Só 1 dos 4 tenants de produção tem criação versionada (`20260311000000_cory_alimentos_tenant_update.sql`). Os outros 3 foram inseridos direto em produção.
