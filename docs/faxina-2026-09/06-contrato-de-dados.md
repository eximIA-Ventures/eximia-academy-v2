# 06 — Contrato de dados (onda A → onda B)

> **O que é este documento.** A onda A (banco) já está escrita: 7 migrations novas,
> os tipos gerados atualizados à mão e o schema Drizzle alinhado. Este arquivo é o
> **contrato** que a onda B (TypeScript) deve consumir: nomes exatos de tabela,
> coluna, função, RPC e policy, com assinatura. Se algo aqui divergir do código,
> **o banco está certo e o código está errado** — a fonte da verdade é
> `supabase/migrations/`.
>
> Leitura prévia: `00-decisoes.md` (D1, D4, D5, D6, D10, D11, D12, D13, D14),
> `02-plano-app-novo.md` §2 e §3.
>
> **Nada aqui foi executado contra um banco.** Não há Docker nem psql na máquina
> onde estas migrations foram escritas; `supabase db reset` não pôde ser rodado.
> O que se garante é revisão de SQL, não execução. Ver §8.

---

## 1. As migrations, em ordem

| Arquivo | O que entrega | Decisão |
|---|---|---|
| `20260702222742_funcoes_de_alcance_do_gestor.sql` | define `subtree_student_ids`, `auth_subtree_user_ids`, `auth_reachable_student_ids` **antes** do `REVOKE` de `20260702222743` | M0 / D14 |
| `20260906000000_tenant_domains.sql` | tabela `tenant_domains` + RLS + backfill de 1 host | M1 / D1 |
| `20260906001000_tenants_brand_modules.sql` | `tenants.brand jsonb` + `tenants.modules text[]` + migração de dados | M2 / D4 |
| `20260906002000_bucket_tenant_assets.sql` | bucket `tenant-assets` + 10 policies | M3 / D12 |
| `20260906003000_provisionamento_de_tenant.sql` | `seed_tenant_defaults`, gatilho em `tenants`, RPC `provisionar_tenant` | M5 / D10 |
| `20260906004000_tenants_de_producao_versionados.sql` | 3 tenants de produção + identidade da Vértice | M4 |
| `20260906005000_bootstrap_super_admin.sql` | `bootstrap_super_admins`, `promover_super_admin`, gatilho em `auth.users` | D13 |

Fora de `supabase/migrations/`: `supabase/config.toml` (D11),
`supabase/seed.sql`, `packages/database/src/schema/{tenants,tenant-domains,bootstrap-super-admins}.ts`,
`packages/database/src/types/supabase.ts`.

---

## 2. Tabelas

### 2.1 `public.tenant_domains` — domínios **próprios**

```
id          uuid  PK  default gen_random_uuid()
tenant_id   uuid  NOT NULL  REFERENCES tenants(id) ON DELETE CASCADE
host        text  NOT NULL     -- minúsculas, sem porta, sem esquema
is_primary  boolean NOT NULL default false
verified_at timestamptz NULL
created_at  timestamptz NOT NULL default now()
```

Constraints e índices:

| Nome | O que garante |
|---|---|
| `tenant_domains_host_normalizado` | `host = lower(host)` |
| `tenant_domains_host_sem_porta` | `position(':' in host) = 0` |
| `tenant_domains_host_formato` | rótulos DNS válidos, ao menos um ponto |
| `tenant_domains_host_key` (UNIQUE) | `lower(host)` único **na plataforma inteira** |
| `tenant_domains_one_primary` (UNIQUE parcial) | no máximo 1 `is_primary` por tenant |
| `idx_tenant_domains_tenant` | leitura por tenant |

**O host canônico `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}` NÃO mora aqui.** Ele é
derivado por string, no app, sem tocar o banco (D1). Esta tabela só existe para o
endereço que **não** é derivável do slug.

Ordem de resolução que o middleware deve implementar (D2):

1. `tenant_domains.host` — **única** leitura de banco;
2. subdomínio de `{base}` → slug por string;
3. env `NEXT_PUBLIC_TENANT_SLUG` (modo legado, um serviço por cliente);
4. NEUTRO → `tenantId = null`, **nunca** uma linha de `tenants`.

RLS (`is_super_admin()` é `public.is_super_admin()`):

| Policy | Comando | Papel | Predicado |
|---|---|---|---|
| `tenant_domains_service_read` | SELECT | `service_role` | `true` |
| `tenant_domains_super_admin_read` | SELECT | `authenticated` | `is_super_admin()` |
| `tenant_domains_super_admin_write` | ALL | `authenticated` | `is_super_admin()` |

Admin de cliente **não** escreve aqui: apontar o host de outra empresa para o
próprio tenant seria sequestro de marca.

Backfill aplicado: **uma** linha — o host `argos.eximiaacademy.com.br` apontando
para o tenant de slug `cory-alimentos`, com `is_primary = true`. O INSERT é dirigido por slug (`WHERE
t.slug = 'cory-alimentos'`), então num banco onde essa empresa não existe ele
casa zero linhas. Nenhum outro host foi inventado.

### 2.2 `public.tenants` — colunas novas

```
brand    jsonb   NOT NULL default '{}'::jsonb   CHECK (jsonb_typeof(brand) = 'object')
modules  text[]  NOT NULL default '{}'::text[]
```

Shape de `brand` — é `TenantConfig.brand`
(`packages/shared/src/modules/tenant-config.ts:7-38`) **inteiro e nada além dele**:

```jsonc
{
  "name":         "string",   // obrigatório
  "slug":         "string",   // obrigatório, == tenants.slug
  "logo":         "string",   // obrigatório
  "logoLight":    "string?",  // ausente => o app cai em "logo"
  "favicon":      "string?",
  "primaryColor": "#rrggbb",
  "accentColor":  "#rrggbb",
  "partnerName":  "string?",
  "partnerLogo":  "string?"
}
```

**`brand` pode ser PARCIAL, e isso é legal.** A RPC garante apenas `name` e
`slug`; os demais campos podem faltar (empresa cadastrada sem logo, por exemplo).
O resolvedor de `TenantConfig` deve **mesclar `brand` sobre o NEUTRO campo a
campo** — que é exatamente a ordem `banco → env → NEUTRO` da D4 — e nunca assumir
que a coluna traz o objeto completo.

**`customCSS` não existe nesta coluna, e isso é a decisão D4, não um esquecimento.**
`provisionar_tenant` remove `customCSS` e `custom_css` do jsonb recebido antes de
gravar. O resolvedor de `TenantConfig` **não deve** ler
`whitelabel_config->>'custom_css'`: ele desemboca em `dangerouslySetInnerHTML`
em 4 pontos e é gravável por qualquer chapéu `admin` de cliente.

De onde sai cada pedaço de `TenantConfig`, no código novo:

| Campo de `TenantConfig` | Fonte no banco |
|---|---|
| `brand.*` | `tenants.brand` |
| `modules` | `tenants.modules` (vazio = não declarado → cai em env → NEUTRO) |
| `settings.maxInteractionsPerSession` | `tenants.settings->>'max_interactions_per_session'` |
| `settings.aiModel` | `tenants.settings->>'ai_model'` |
| `settings.footerText` | `tenants.whitelabel_config->>'footer_text'` |
| `settings.supportEmail` | `tenants.whitelabel_config->>'support_email'` |
| `settings.sessionTimeoutHours` | **não existe no banco** — env ou default 24 |
| `settings.customCSS` | **nunca** |
| `features.orgTree` | `tenants.settings->'features'->>'org_tree'` quando existir; hoje ainda é env |

Migração de dados já aplicada (só em linhas com `brand = '{}'`):

```
brand.name         <- whitelabel_config->'custom_texts'->>'app_name'  senão tenants.name
brand.slug         <- tenants.slug
brand.logo         <- branding->>'logo_url'                senão '/brand/logo.png'
brand.logoLight    <- branding->>'logo_light_url'          senão OMITIDO
brand.favicon      <- whitelabel_config->>'favicon_url'    senão '/brand/favicon.ico'
brand.primaryColor <- branding->>'primary_color'   (só se ~ ^#[0-9a-fA-F]{6}$)  senão '#2a6ab0'
brand.accentColor  <- branding->>'secondary_color' (idem)                       senão '#C4A882'
brand.partnerName / partnerLogo  <- OMITIDOS (não existem no banco hoje)
```

`modules` **não** foi backfillada: não há no banco nenhum registro do que cada
empresa contratou (isso só existe como env de build no EasyPanel). Trazer os
valores reais é a rota `POST /api/admin/tenants/[id]/importar-marca-do-ambiente`
(D20).

### 2.3 `public.bootstrap_super_admins`

```
email      text PRIMARY KEY   -- minúsculas, sem espaços (CHECK)
motivo     text NULL
created_at timestamptz NOT NULL default now()
```

RLS ligada; **nenhuma** policy para `anon`/`authenticated` (falha fechada), uma
policy `bootstrap_super_admins_service` (ALL) para `service_role`. `GRANT ALL`
apenas a `service_role`.

---

## 3. Storage — bucket `tenant-assets`

`INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets','tenant-assets', true)`.

Caminhos que as policies reconhecem — são **exatamente** os que o app já escreve:

| Caminho | Quem escreve | Componente |
|---|---|---|
| `{tenant_id}/logo.png` | admin do próprio tenant | `components/admin/logo-upload.tsx:46` |
| `{tenant_id}/favicon.*` | admin do próprio tenant | (ainda sem componente) |
| `{tenant_id}/avatars/{auth.uid()}.png\|jpg` | o próprio usuário | `components/onboarding/step-welcome.tsx:50` |

| Policy | Comando | Papel | Resumo |
|---|---|---|---|
| `tenant_assets_marca_read` | SELECT | `anon`, `authenticated` | `name ~ '^[^/]+/logo'` ou `'^[^/]+/favicon'` |
| `tenant_assets_avatar_read` | SELECT | `authenticated` | só o próprio arquivo de avatar |
| `tenant_assets_staff_read` | SELECT | `authenticated` | admin/manager do próprio tenant, qualquer objeto do tenant |
| `tenant_assets_super_admin_read` | SELECT | `authenticated` | `is_super_admin()` |
| `tenant_assets_marca_insert` / `_update` / `_delete` | INSERT/UPDATE/DELETE | `authenticated` | prefixo de marca **e** pasta == `auth_tenant_id()` **e** chapéu `admin` |
| `tenant_assets_avatar_insert` / `_update` / `_delete` | INSERT/UPDATE/DELETE | `authenticated` | pasta == `auth_tenant_id()` **e** nome == `auth.uid()` |
| `tenant_assets_super_admin_write` | ALL | `authenticated` | `is_super_admin()` |

O chapéu é checado por `public.auth_user_role()` **ou** por `public.user_roles`
(multi-chapéu). `manager` não escreve marca; trocar o logo da empresa é ato de
`admin`.

> **Decisão de privacidade em aberto, declarada.** Com `public = true`, a URL
> `/storage/v1/object/public/tenant-assets/<caminho>` serve o arquivo **sem passar
> pelas policies**. Logo, a foto de um aluno em `{tenant}/avatars/{uid}.png` é
> legível por quem souber o par `tenant_id`+`user_id`. As policies de SELECT
> governam a API autenticada, não o caminho público. O bucket é público porque
> `logo-upload.tsx:60` e `step-welcome.tsx:59` usam `getPublicUrl()`, que só
> funciona assim. **Correção proposta:** bucket separado `tenant-avatars` com
> `public = false` + `createSignedUrl` nos dois componentes — muda `apps/web`,
> fora do escopo desta onda.

---

## 4. Funções e RPC

### 4.1 `public.seed_tenant_defaults(p_tenant_id uuid) RETURNS void`

`SECURITY DEFINER`, `SET search_path = public`. `GRANT EXECUTE` só a `service_role`.

Semeia, de forma idempotente (`ON CONFLICT ... DO NOTHING`), tudo que hoje é
backfill único por tenant:

- `areas` — a área `Geral` (slug `geral`), reproduzindo `20260210000000:200-208`;
- `notification_templates` — os 6 templates (`never_accessed`, `inactive_14d`,
  `session_no_reflection`, `top_performer_recognition`, `announcement_generic`,
  `behind_teaching_plan`), com `intent`/`tone` já preenchidos e com os corpos no
  estado **final** (sem a saudação, como `20260712000000` deixou os 5 primeiros).

Levantamento que sustenta essa lista (`grep -ln "FROM tenants" supabase/migrations/*.sql`,
os 5 arquivos lidos): `20260210000000:200`, `20260604120000:396`, `20260708120000:165`
semeiam por tenant; `20260315100001:364` usa id fixo e `20260803000000:660` é comentário.

**Gatilho:** `trg_tenants_seed_defaults AFTER INSERT ON public.tenants FOR EACH ROW`
executa `public.trg_seed_tenant_defaults()`, que chama a função acima. Cobre
insert manual, seed e migration — não só a RPC.

### 4.2 `public.provisionar_tenant(...) RETURNS jsonb`

```sql
provisionar_tenant(
  p_name        text,
  p_slug        text,
  p_plan        text,               -- 'essencial' | 'standard' | 'premium'; NULL => 'standard'
  p_brand       jsonb,              -- TenantConfig.brand; customCSS é removido
  p_modules     text[],
  p_custom_host text DEFAULT NULL,  -- domínio PRÓPRIO; o canônico é derivado por string
  p_id          uuid DEFAULT NULL,  -- UUID gerado no cliente, para o upload do logo
  p_actor_id    uuid DEFAULT NULL   -- super_admin que pediu (auditoria)
) RETURNS jsonb
```

`SECURITY DEFINER`, `SET search_path = public`.
`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`.
**Só o service client chama.** O guard de `super_admin` continua no app
(`api/admin/tenants/route.ts:20-22`).

O que faz, numa transação só:

1. valida `name` (1..200), `slug` (`^[a-z0-9-]{1,50}$` **e** não reservado),
   `plan`, `brand` (tem que ser objeto);
2. força `brand.slug = slug` e `brand.name` (default `p_name`); remove
   `customCSS`/`custom_css`;
3. `INSERT INTO tenants (id, name, slug, plan, brand, modules, status='active')`;
4. se `p_custom_host` → `INSERT INTO tenant_domains (tenant_id, host, is_primary=true)`;
5. `PERFORM seed_tenant_defaults(id)` (redundante com o gatilho, e de propósito);
6. `INSERT INTO platform_audit_log` (`action='tenant.provisioned'`, `target_type='tenant'`);
7. retorna `{"tenant_id": uuid, "slug": text, "auditado": boolean}`.

**Slugs reservados (D5):** `www, app, api, admin, central, academy, demo, neutro, __neutro__`.
`demo` está na lista porque `supabase/seed.sql` cria um tenant **real** com esse
slug e `NEUTRO.slug` era `demo` — resolver "host desconhecido" por slug cairia num
tenant existente em vez de "nenhum".

**Erros que o TS precisa mapear:**

| SQLSTATE | Causa | HTTP sugerido |
|---|---|---|
| `22023` | nome/slug/plano/brand/host inválidos, ou slug reservado | 400 |
| `23505` | slug duplicado (`tenants.slug`) ou host duplicado (`tenant_domains`) | 409 |
| `23503` | `p_tenant_id` inexistente em `seed_tenant_defaults` | 500 |

**Duas coisas fora da RPC, de propósito:**

- **O convite do primeiro admin.** `inviteUserByEmail` é I/O externo (GoTrue); um
  HTTP dentro da transação seguraria lock de banco esperando rede. O TS convida
  **depois do commit**; se falhar, a empresa existe e a UI oferece "reenviar
  convite" — nunca recria o tenant.
- **`p_actor_id`.** `platform_audit_log.actor_id` é `NOT NULL` com FK para
  `auth.users(id)`, e o JWT de `service_role` não tem `sub` — `auth.uid()` é
  **sempre NULL** aqui. Sem esse parâmetro, ou a auditoria mentiria ou a RPC
  quebraria. Se ele vier NULL (ou apontar para um usuário inexistente), a empresa
  **é criada mesmo assim**, o log **não** é escrito, sai um `RAISE WARNING` e o
  retorno traz `"auditado": false` — **a API deve auditar por fora nesse caso**
  (`lib/audit.ts`, `logAdminAction`).

### 4.3 `public.promover_super_admin(p_email text) RETURNS boolean`

`SECURITY DEFINER`, só `service_role`. Promove um e-mail que **já tem conta** em
`auth.users`: garante `public.users` com `role='super_admin'`, `tenant_id=NULL`,
`status='active'`, `deleted_at=NULL` (as quatro condições de `is_super_admin()`,
mais o CHECK `users_super_admin_tenant_check`) e `public.user_roles` com o chapéu
`super_admin`. Idempotente. Devolve `false` (com `WARNING`) se não achar o e-mail.

### 4.4 Funções de alcance de gestor (M0)

`subtree_student_ids(uuid) → uuid[]`, `auth_subtree_user_ids() → uuid[]`,
`auth_reachable_student_ids() → uuid[]`. `SECURITY DEFINER STABLE`,
`search_path = public`. `EXECUTE` para `authenticated` e `service_role`; **nada**
para `anon`. As três leem `auth.uid()` — o cliente passado a
`lib/area-context.ts` tem que ser o **autenticado**, nunca o service client.
Assinaturas idênticas às que `packages/database/src/types/supabase.ts` já
declarava; nenhum código TS precisa mudar por causa desta migration.

---

## 5. Bootstrap do super_admin (D13) — as duas formas

**Forma A — parâmetro de banco** (equivale ao env `BOOTSTRAP_SUPER_ADMIN_EMAIL`):

```sql
ALTER DATABASE postgres SET app.bootstrap_super_admin_email = 'hugo@exemplo.com';
```

O gatilho lê `current_setting('app.bootstrap_super_admin_email', true)` — o `true`
faz devolver NULL em vez de `42704` quando o parâmetro não existe. Sem ele, o
gatilho derrubaria **todo signup** de qualquer banco que não o tivesse configurado.

**Forma B — tabela** (a prática no Supabase hospedado, onde não há como injetar
env do processo dentro do Postgres):

```sql
INSERT INTO public.bootstrap_super_admins (email, motivo)
VALUES ('hugo@exemplo.com', 'bootstrap do ambiente');
```

**Quando a pessoa já tem conta** (o gatilho só pega signup novo):

```sql
SELECT public.promover_super_admin('hugo@exemplo.com');
```

Gatilho: `trg_bootstrap_super_admin AFTER INSERT ON auth.users FOR EACH ROW`.
Ele é **fail-open por decisão**: qualquer erro na promoção vira `WARNING`, porque
um gatilho que levanta em `auth.users` derruba o cadastro inteiro — trocar "não
promovi o super_admin" por "ninguém consegue se cadastrar" seria pior.

---

## 6. Auth / Redirect URLs (D11)

`supabase/config.toml` (**só vale para o Supabase local**) passou a ter:

```toml
additional_redirect_urls = [
  "https://127.0.0.1:3000",
  "http://localhost:3000/**",
  "http://*.localhost:3000/**",
]
```

No projeto hospedado a mesma lista vive em **Authentication → URL Configuration →
Redirect URLs** e precisa de `https://*.{NEXT_PUBLIC_APP_BASE_DOMAIN}/**` mais
**uma linha por domínio próprio** (`https://argos.eximiaacademy.com.br/**` hoje).
Sem isso o link de convite sai apontando para o host errado **em silêncio**.
Tarefa do Hugo.

---

## 7. O que a onda B (TypeScript) precisa fazer com isto

| Onde | O quê |
|---|---|
| `apps/web/src/middleware.ts` | resolver host: `tenant_domains` (service client) → subdomínio por string → env → NEUTRO; setar `x-tenant-id`/`x-tenant-slug`. Host nunca autoriza. |
| `apps/web/src/lib/tenant.ts` | `getTenantConfig()` async + `cache()`: monta `TenantConfig` a partir de `tenants.brand`, `tenants.modules`, `tenants.settings`, `tenants.whitelabel_config` (mapa da §2.2). **Nunca** ler `custom_css`. |
| `apps/web/tenant.config.ts` | `NEUTRO.slug` passa a `__neutro__` (D5). |
| `apps/web/src/app/api/admin/tenants/route.ts` | trocar o `insert` solto por `supabase.rpc("provisionar_tenant", {...})` com o **service client**, passando `p_actor_id = profile.id`; convidar o admin **depois** do retorno; mapear `22023`→400, `23505`→409. |
| `apps/web/src/lib/feature-gate.ts` | default `standard` (D6) — o Drizzle já foi alinhado. |
| `apps/web/src/lib/get-base-url.ts` + `invite-user.ts`, `resend-invite/route.ts`, `notifications/nudge/route.ts` | derivar `redirectTo` do host do tenant; sem request, usar `tenant_domains.is_primary` e, na ausência, `{slug}.{base}`. |
| tipos | `packages/database/src/types/supabase.ts` já traz `tenant_domains`, `bootstrap_super_admins`, `tenants.brand/modules` e as 3 funções novas. **Foram escritos à mão** — regerar com `supabase gen types` quando houver banco. |

---

## 8. O que **não** foi verificado (declarado, não escondido)

1. **Nenhuma migration foi executada.** Sem Docker/psql nesta máquina, `supabase db reset`
   não rodou. O critério de aceite do M0 ("reset limpo do zero") **continua por
   provar**; o que se fez foi remover o bloqueio conhecido de julho.
2. **Os corpos das 3 funções do M0 vieram do git, não de produção.** Fonte:
   `supabase/migrations/20260621102000_e3_subtree_resolvers.sql` no commit `8388e0e`
   (branch `feat/epic-30-multinivel`, nunca mergeada). `20260718120000:23-30` diz
   textualmente que o texto atual delas em produção não pôde ser auditado. **Antes
   de aplicar em produção**, comparar com `pg_get_functiondef` (o SQL está no
   cabeçalho daquele arquivo e em `05-tarefas-para-o-hugo.md`).
3. **O UUID de produção da Harven Finance é desconhecido.** A linha nasce com
   `gen_random_uuid()` num ambiente novo. Inventar um id seria pior: um script que
   assumisse igualdade apontaria para o vazio.
4. **Os planos de `eximia-academy` / `harven-finance` / `vertice-industria` foram
   escolhidos, não medidos** (`premium`/`standard`/`premium`). Em produção o
   `ON CONFLICT DO NOTHING` não sobrescreve nada, então o efeito é só no ambiente novo.
5. **`20260311000000_cory_alimentos_tenant_update.sql` nunca foi aplicada neste
   projeto** (os slugs de produção são `cory-alimentos`, não `-rp`/`-mg`). A
   divergência é herdada e não foi corrigida aqui — num banco reconstruído aquela
   migration cria um `cory-alimentos-mg` que produção não tem.
6. **Privacidade dos avatares** — §3, quadro destacado.
