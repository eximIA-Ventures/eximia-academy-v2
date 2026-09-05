# 02 — Plano técnico: um app, N empresas, cadastro pela plataforma

> Pré-requisito de leitura: `01-diagnostico.md`.
> Princípio que atravessa tudo: **identidade (marca/módulos) passa a vir do banco por host; autorização (quem lê o quê) continua sendo RLS por `users.tenant_id`.** Não misturar os dois eixos. Host nunca autoriza nada.

---

## 1. Estratégia de resolução de tenant — recomendação

**Recomendo: subdomínio wildcard como forma canônica, com tabela de domínios que também aceita domínio próprio, e path só em desenvolvimento.**

Concretamente:

- Canônico: `{slug}.academy.eximiaventures.com.br` — derivado do slug no cadastro, funciona no segundo em que a empresa é criada, zero trabalho de DNS por cliente.
- Opcional por empresa: domínio próprio (`academy.cory.com.br`), linha extra na mesma tabela, exige o cliente apontar CNAME e o Traefik emitir certificado.
- Fallback de dev: `?tenant=slug` ou `/t/{slug}`, **habilitado só quando `NODE_ENV !== "production"`**, para não virar porta de entrada em produção.
- Fallback de produção: host desconhecido → marca **NEUTRA** (o `NEUTRO` de `apps/web/tenant.config.ts` já é exatamente isso, byte a byte) + tela de "empresa não encontrada" no login. Nunca cair na marca do último tenant lido.

### Por que subdomínio e não as outras duas

| Critério | Subdomínio (recomendado) | Domínio próprio como base | Path (`/cory/...`) |
|---|---|---|---|
| Provisionamento de uma empresa nova | instantâneo (wildcard DNS + Traefik `HostRegexp`) | exige DNS do cliente + certificado por domínio | instantâneo |
| Certificado TLS | 1 wildcard, ou ACME on-demand | 1 por domínio, e o cliente precisa colaborar | 1 |
| Isolamento de cookie de sessão | domínio distinto por empresa → sessão não vaza entre empresas | idem | **cookie compartilhado**: sessão de A visível em `/b` |
| Risco de vazar por link/rota errada | baixo | baixo | **alto**: um `href` sem prefixo pula de empresa |
| Custo de refatorar rotas do app | zero (as ~200 rotas continuam iguais) | zero | **alto**: todo `Link`/`redirect`/middleware precisa carregar o prefixo |
| Compatível com o que já existe | `deployment_url` já foi modelado como URL base | — | o repo **já removeu** path-based em `f17b34f` |
| Marca no e-mail/convite | `redirectTo` derivável do host | idem | ambíguo |

Path é o pior dos três aqui: o app tem 451 linhas de middleware com guards por `pathname.startsWith(...)` (`apps/web/src/middleware.ts:336-345`, `:357`, `:367`, `:381`, `:407`) que teriam **todos** que aprender a ignorar um prefixo variável. Isso é uma reescrita de roteamento, não uma feature. Domínio próprio é desejável, mas como **base** ele torna "cadastrar empresa" dependente de um ticket de DNS no cliente — o oposto do objetivo. Subdomínio dá o caminho instantâneo e o domínio próprio entra depois, na mesma tabela, sem replanejar nada.

### A regra quando host e usuário divergem — decidida em `00-decisoes.md` D3

Usuário de A logado chega no host de B. Três opções eram cogitadas:

- **(R1) Redirecionar** para o host de A. Melhor UX, sem vazamento.
- (R2) Recusar com 403 e forçar novo login.
- (R3) Ignorar o host e servir A. **Não fazer** — o usuário veria a marca de B com dados de A.

**Correção importante (D3):** `users.tenant_id` não é a única fonte de vínculo usuário↔tenant. Existe `user_tenant_memberships` (`packages/database/src/schema/user-tenant-memberships.ts`, DDL em `20260311100000_user_tenant_memberships.sql`), ativa na RLS de `tenants_select` (`:40-45`: `... OR id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())`), com usuário multi-empresa real em produção. A regra final (D3): **se o usuário tem `users.tenant_id` OU `user_tenant_memberships` no tenant do host, serve; senão redireciona para o host canônico do tenant primário do usuário** (R1 corrigida). Não é decisão de estilo — define login de usuários que já existem em produção. Detalhe em `04-critica.md`.

Além disso, `api/auth/validate-tenant/route.ts:36-50` já implementa boa parte dessa lógica para o login legado (super_admin passa livre, usuário comum recebe 403 se o slug divergir) — ver `01-diagnostico.md` §(c) e `00-decisoes.md` D9. A rota fica e é adaptada para receber o slug resolvido por host, em vez de ser apagada.

Super_admin (`tenant_id` NULL) é exceção: em qualquer host, o tenant efetivo continua sendo o do cookie `x-sa-active-tenant` (`resolveTenantId`, `apps/web/src/lib/auth.ts`), e a marca renderizada deve ser a do **tenant ativo**, com fallback para a do host (D3) — senão o painel mente sobre onde ele está escrevendo (defeito idêntico ao já corrigido em `admin/settings/loader.ts`).

---

## 2. Migrações necessárias

Ordem sugerida. Todas idempotentes no sentido de "aplicáveis em produção sem downtime"; nenhuma apaga dado.

### M0 — desbloquear o replay do zero (pré-requisito de tudo)

Sem isso, não existe ambiente novo reprodutível e "cadastro self-service" fica sobre areia.
Criar migration com timestamp **anterior** a `20260702222743`, definindo as 3 funções que só existem no servidor: `subtree_student_ids(uuid)`, `auth_subtree_user_ids()`, `auth_reachable_student_ids()`. Extrair os corpos de produção via `pg_get_functiondef`. É o mesmo movimento que `20260831125000` já fez.
Critério de aceite: `supabase db reset` num banco vazio termina sem erro nas 112+ migrations.

### M1 — domínios de tenant

```sql
CREATE TABLE tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  host text NOT NULL,                    -- lowercase, sem porta
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX tenant_domains_host_key ON tenant_domains (lower(host));
CREATE UNIQUE INDEX tenant_domains_one_primary ON tenant_domains (tenant_id) WHERE is_primary;
```

Backfill: uma linha `{slug}.academy.eximiaventures.com.br` para cada tenant existente, `is_primary = true`. Migrar `tenants.deployment_url` para cá quando preenchido, e **depois** marcar a coluna como deprecada (não dropar no mesmo PR).

RLS: leitura só por `service_role` (o middleware lê com service client, antes de haver sessão) e por `is_super_admin()`. Escrita só super_admin.

### M2 — marca e módulos no banco

Duas opções; recomendo a **B**.

- (A) Reusar `tenants.branding` / `tenants.whitelabel_config` (jsonb livres já existentes).
- **(B) Coluna nova `tenants.brand jsonb NOT NULL DEFAULT '{}'` + `tenants.modules text[] NOT NULL DEFAULT '{}'`**, com o shape de `TenantConfig` (`packages/shared/src/modules/tenant-config.ts`) **exceto `settings.customCSS`** (ver abaixo). Motivo: `branding` e `whitelabel_config` já têm dois shapes divergentes escritos por duas telas diferentes (`actions.ts` grava `{logo_url, primary_color, secondary_color}`; `whitelabel-actions.ts` grava `{custom_texts, favicon_url, footer_text, support_email}`), e casar os dois shapes com o de `TenantConfig` no meio da migração é onde nascem os bugs silenciosos. Uma coluna nova com um shape só, e uma migration de dados que **derive** o valor inicial de `branding` + `whitelabel_config` + do `tenant.config.ts` de cada branch de deploy.

**`customCSS` fica FORA do shape (`00-decisoes.md` D4).** `TenantConfig.settings.customCSS` existe (`tenant-config.ts:72`) e desemboca em `dangerouslySetInnerHTML` em quatro lugares (`(platform)/layout.tsx:75,86-89` / `:211,223-226` / `:330,351-354`, `(studio)/layout.tsx:63,74-77`). `tenant.config.ts:141-144` documenta que ele nunca foi exposto por env de propósito ("quem edita o serviço no EasyPanel passaria a injetar CSS arbitrário na página"). `whitelabelConfigSchema` já aceita `custom_css` até 5000 chars (`whitelabel.ts:15`) e `saveWhitelabelConfig` (`whitelabel-actions.ts:25-26`) libera qualquer `admin` do tenant (não só super_admin) a gravar — copiar esse campo para `tenants.brand` sem tratamento transformaria um admin de cliente em injetor de CSS na plataforma inteira. Se `customCSS` voltar a existir, é gated por `is_super_admin()` na escrita, nunca por `admin` do tenant, com teste que afirme que nenhum caminho DB→layout alimenta `dangerouslySetInnerHTML` com conteúdo escrito por admin de cliente. Detalhe em `04-critica.md`.

Constraint: `CHECK (jsonb_typeof(brand) = 'object')`. Validação forte fica no app (zod), não no CHECK.

### M3 — bucket de assets

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets','tenant-assets', true)
ON CONFLICT (id) DO NOTHING;
```
**Policies corrigidas por `00-decisoes.md` D12** (o padrão genérico de `20260210000003_epic12_multimodal_content.sql:22-29`, "INSERT só para `role IN ('admin','manager')`", quebraria o upload de avatar do aluno em `components/onboarding/step-welcome.tsx:52`, que grava `${tenantId}/avatars/${userId}.${ext}` como o próprio aluno autenticado — ver `04-critica.md`). Policies de fato:

- SELECT público só para o prefixo `{tenant_id}/logo*` e `{tenant_id}/favicon*`.
- INSERT/UPDATE de logo/favicon restrito a admin do próprio tenant: `(storage.foldername(name))[1] = auth_tenant_id()::text`.
- INSERT de `{tenant_id}/avatars/{auth.uid()}` liberado ao próprio usuário autenticado (não só admin/manager).
- Decidir explicitamente se avatares vão para bucket privado com URL assinada (bucket `public: true` valia só para logo/favicon, não para foto de rosto de aluno).

Sem isso, `logo-upload.tsx:50` e `step-welcome.tsx:52` continuam quebrados.

### M4 — trazer os 3 tenants não versionados para migration

`exímIA Academy`, `Harven Finance`, `Vértice Indústria` só existem no banco de produção. Escrever um `INSERT ... ON CONFLICT (slug) DO NOTHING` com os UUIDs reais para que um ambiente novo nasça equivalente.

### M5 — RPC de provisionamento (ver §3)

### M6 — deprecações (último)

`ALTER TABLE tenants DROP COLUMN deployment_url` só depois de M1 estar em produção há um ciclo. Corrigir o drift de `plan` (Drizzle diz `essencial`, DB diz `standard`, `feature-gate.ts` cai em `essencial`) escolhendo **um** valor e alinhando os três.

---

## 3. Cadastro de empresa pelo super admin — API e tela

### O que precisa acontecer, em ordem, e por quê

Tudo abaixo em **uma transação**, dentro de uma RPC Postgres (`SECURITY DEFINER`, `GRANT EXECUTE` só para `service_role`). Motivo direto: hoje o processo equivalente é um script que travou no meio e exigiu `scripts/demo-tenant-vertice-phase5.mjs` para retomar. Meia empresa criada é pior do que nenhuma.

```
provisionar_tenant(
  p_name text, p_slug text, p_plan text,
  p_brand jsonb, p_modules text[],
  p_admin_email text, p_admin_name text,
  p_host text DEFAULT NULL
) RETURNS jsonb
```

| # | Tabela | Operação | Falha se |
|---|---|---|---|
| 1 | `tenants` | INSERT `{name, slug, plan, brand, modules, status:'active'}` | slug duplicado (23505 → 409) |
| 2 | `tenant_domains` | INSERT host primário (default `{slug}.academy.eximiaventures.com.br`) | host duplicado (409) |
| 3 | `areas` | INSERT area padrão ("Geral") | — |
| 4 | `seed_tenant_defaults(tenant_id)` | Semeia tudo que hoje é backfill único de migration: `notification_templates` (`20260604120000:396-401`, `20260708120000:165-171`), e qualquer outro conjunto encontrado por `grep -l 'FROM tenants' supabase/migrations/*.sql`. Chamada também por um trigger `AFTER INSERT ON tenants`, para cobrir inserts manuais fora da RPC | — |
| 5 | `platform_audit_log` | INSERT ação do super_admin | — |

**Correção (`00-decisoes.md` D10, lacuna bloqueante da crítica):** sem o passo 4, a empresa nasce com a Central de Engajamento vazia — `notification_templates` só existe hoje por causa de dois `INSERT ... SELECT t.id ... FROM tenants t CROSS JOIN (VALUES ...)` rodados uma vez em migration, sem trigger em `tenants` (grep por `TRIGGER ... ON tenants` = zero nas 111 migrations). Há 12+ call-sites lendo essa tabela (`engine.ts:710`, `api/admin/engagement/templates/route.ts:46`, `api/engagement/campaign/route.ts:109`, `efficacy.ts:278`, `admin/notifications/page.tsx:77`...). É exatamente a "meia empresa criada" que este parágrafo diz existir para evitar. Critério de aceite do P10 passa a incluir um teste que crie tenant via RPC e afirme contagem > 0 de templates, areas e roles. Detalhe em `04-critica.md`.

**Fora da transação, depois do commit** (porque é I/O externo e não pode segurar lock de banco):

| # | Sistema | Operação | Se falhar |
|---|---|---|---|
| 5 | Supabase Auth | `inviteUserByEmail(p_admin_email, { data: { tenant_id, role:'admin' }, redirectTo: https://{host}/auth/accept-invite })` | tenant fica criado **sem admin**; a UI mostra "reenviar convite", não recria o tenant |
| 6 | `users` + `user_roles` | materializa perfil (reusar `inviteTenantUser`, `api/admin/users/invite-user.ts`) | idem |

Notar: o `redirectTo` passa a ser derivado do **host do tenant**, não de `NEXT_PUBLIC_APP_URL` (`invite-user.ts:49`) — hoje o link do convite volta sempre para a mesma URL global.

**Passo obrigatório antes disso funcionar (`00-decisoes.md` D11, lacuna bloqueante da crítica):** o GoTrue só honra URLs que estejam na allowlist exata do projeto (`supabase/config.toml:154-156` em dev; equivalente no Dashboard em produção). Sem wildcard configurado em Authentication → URL Configuration → Redirect URLs (`https://*.<NEXT_PUBLIC_APP_BASE_DOMAIN>/**`), o GoTrue reescreve silenciosamente o `redirectTo` para `site_url` — o app manda o link certo, o e-mail chega com o link errado, e nenhum teste que só confira "o `redirectTo` derivado" pega isso. Este é um passo do Hugo (checklist em `05-tarefas-para-o-hugo.md` item (b)), não uma linha de código; o critério de aceite do risco R8 muda de "conferir o `redirectTo` derivado" para um teste ponta-a-ponta que leia o link do e-mail (Inbucket local) e afirme o host.

**O que o passo 5 elimina:** a gambiarra atual de 3 passos manuais (criar → `POST /api/admin/switch-tenant` → convidar em `/admin/users`).

### API

`POST /api/admin/tenants` — mesma rota, corpo ampliado. **Reutilizar `createTenantSchema` de `packages/shared/src/validators/whitelabel.ts:28-58`, não escrever um schema novo** — ele já existe, com `name`, `slug` (via `slugSchema:20-26`), `plan` (enum essencial/standard/premium), `branding{logo_url,primary_color,secondary_color}`, `settings{ai_model,max_interactions_per_session}` e **`initial_manager{email,full_name,role}`**, e hoje tem zero chamadores (`api/admin/tenants/route.ts:7-14` reimplementa um schema de 2 campos em vez de usá-lo — ver `04-critica.md` e `00-decisoes.md` D10). Estender esse schema com o que falta (`modules: ModuleId[]` validado contra `MODULE_IDS`, `host?`) em vez de duplicar `name`/`slug`/`plan`/`branding`:

```ts
createTenantSchema.extend({
  modules: ModuleId[],   // validado contra MODULE_IDS
  host?: string,          // default derivado do slug
})
```
Guard: `profile.role !== "super_admin"` → 403 (já existe, `route.ts:20-22`).
Slug reservado: recusar `www`, `app`, `api`, `admin`, `central`, `academy`, `neutro`, `demo`.

### Tela

`(platform)/admin/tenants` — o modal atual (`tenants-management-client.tsx`, hoje 2 campos) vira wizard de 3 passos:

1. **Identidade**: nome, slug (auto), host primário (pré-preenchido, editável), plano.
2. **Marca**: logo + logo claro + favicon (upload → `tenant-assets/{tenantId}/`), cor primária, cor de destaque, footer, e-mail de suporte. Reusar `logo-upload.tsx`, `color-picker.tsx`, `branding-preview.tsx` — já existem e funcionam do lado da escrita.
3. **Acesso**: nome + e-mail do primeiro admin; checkboxes dos **6 módulos contratáveis** (`MODULE_IDS` tem 9, mas academy/analytics/admin são `core: true` — `registry.ts:102,204,219` — e sempre ligados por `getEnabledModules`, `registry.ts:430`; só os outros 6 aparecem como opção), pré-marcados pelo plano.

Nota de ordem: o upload de logo precisa de um `tenantId` para o path. Duas saídas — (i) gerar o UUID no cliente e passá-lo ao INSERT, ou (ii) criar o tenant no passo 1 como `status='draft'` e ativar no fim. Prefiro (i): evita tenant meio-criado visível na lista.

`apps/central` **não** entra nisso. Ele é uma casca de 8 arquivos versionáveis com KPIs `"—"` (`apps/central/src/app/page.tsx:4-9`), ausente do `docker-compose.yml` (mas builda/tipa no CI via `pnpm-workspace.yaml` + turbo — não é órfão de CI, é órfão de produto; ver `04-critica.md`). Construir o cadastro lá seria criar um segundo app para deployar — exatamente o custo que estamos eliminando. O painel de super_admin já existe dentro de `apps/web` e já tem guard, auditoria e seletor de empresa.

---

## 4. Branding e módulos vindos do banco

### Fluxo por request

```
Traefik → Next middleware
  host = x-forwarded-host ?? host  (lowercase, sem porta)
  tenant = lookup(tenant_domains.host)        [cache LRU em memória, TTL 60s]
  request.headers.set("x-tenant-id",  tenant.id)
  request.headers.set("x-tenant-slug", tenant.slug)
    ↓
Server Components (layouts)
  cfg = await getTenantConfig()   // React cache(), lê headers() → banco → TenantConfig
    ↓
  <TenantProvider config={cfg}>   // o provider que HOJE nunca é montado
    <BrandProvider brand={cfg.brand}>
    <ModuleProvider modules={cfg.modules}>
```

### Mudanças de código, por arquivo

| Arquivo | Mudança |
|---|---|
| `apps/web/src/middleware.ts` | resolver host antes do bloco de auth; setar 2 headers; nunca autorizar por host |
| `apps/web/src/lib/tenant.ts` | `getTenantConfig()` vira `async`, embrulhada em `cache()` (mesmo padrão de `getAuthProfile`, `lib/auth.ts:13`); lê `headers()`; cai no `NEUTRO` se não achar |
| `apps/web/tenant.config.ts` | mantém só o objeto `NEUTRO` + o parser; deixa de ser fonte por cliente |
| `apps/web/src/app/(platform)/layout.tsx` | `await getTenantConfig()` nos 3 shells; monta `TenantProvider` |
| `(studio)/layout.tsx`, `(auth)/layout.tsx`, `onboarding/layout.tsx`, `not-found.tsx`, `app/layout.tsx` | `await` |
| `workspace/_components/workspace-picker.tsx` | **para de chamar `getTenantConfig()`**; recebe `brand` por prop do Server Component pai. É o desbloqueio que permite tirar o `NEXT_PUBLIC_` |
| `lib/email-template.ts`, `api/admin/notifications/route.ts` | recebem `brand`/`supportEmail` do tenant resolvido |
| `api/admin/users/invite-user.ts:52`, `api/admin/users/[userId]/resend-invite/route.ts:44`, `api/notifications/nudge/route.ts:95` | os **3 call-sites** de `NEXT_PUBLIC_APP_URL` como URL de e-mail (não só o primeiro — corrigido em `04-critica.md`); `redirectTo`/link derivado do host primário do tenant nos três |
| `lib/get-base-url.ts:8` | **reutilizar**, não reescrever: já deriva base URL de `x-forwarded-proto`/`x-forwarded-host` com fallback `NEXT_PUBLIC_APP_URL`, e hoje tem zero chamadores (código morto que `03-inventario-sujeira.md` não listava). É a função a usar nos 3 call-sites acima; onde não houver request (cron, jobs), derivar do host primário em `tenant_domains`. `00-decisoes.md` D11 |
| `gauntlet-preview/*/leitura-real.ts` | **trancar atrás de auth de super_admin** e parar de resolver tenant por slug de build (ver Riscos) — sem urgência de segurança (rotas já fazem `notFound()` em produção, `00-decisoes.md` D8), mas o mecanismo de resolução por slug de build ainda precisa sair |
| `next.config.ts:13` | hostname de imagem parametrizado por env, não literal — **[ABERTO]**: `next.config.ts` é avaliado no build e serializado no artefato, então env em runtime não muda a allowlist de um serviço já buildado; não resolve logo em CDN externo de cliente. Decisão pendente do Hugo, ver `05-tarefas-para-o-hugo.md` item (g)6 |

### Módulos: unificar o vocabulário

Hoje há 3 sistemas (`modules[]` de env, `plan_features` por plano, `tenants.settings.features` por tenant). Proposta:

- `tenants.modules text[]` = o que a empresa **contratou** (nav e rotas de UI).
- `plan_features` continua sendo o catálogo comercial por plano (quota + capability de negócio).
- `tenants.settings.features` continua sendo **kill switch operacional** por tenant (é o que `20260803000000_onboarding_novidades.sql` já usa).
- Renomear as chaves para um vocabulário só: `course_designer` ≠ `course-designer` hoje. Escolher `snake_case` e escrever um mapa de migração.
- `isCapabilityEnabled` / `isApiRouteAllowed` (`packages/shared/src/modules/registry.ts`, hoje sem nenhum chamador): ou ligar em `tenants.modules`, ou **apagar**. Não deixar infra morta parecendo trava.
- Manter escrita, em maiúsculas, o que `docs/features/multi-tenant.md` já diz: **módulo é exposição de UI, nunca permissão**. A trava é RLS.

---

## 5. Dockerfile e EasyPanel

### Dockerfile — o que sai

```diff
- ARG NEXT_PUBLIC_TENANT_SLUG ... (15 ARGs, Dockerfile:42-56)
- ARG MARCA_ESPERADA_SLUG                        (Dockerfile:59)
- ENV NEXT_PUBLIC_TENANT_* ...                   (Dockerfile:72-86)
- ENV MARCA_ESPERADA_SLUG=$MARCA_ESPERADA_SLUG   (Dockerfile:87)
- RUN node apps/web/scripts/verificar-marca.mjs               (Dockerfile:96)
- RUN node apps/web/scripts/verificar-marca-no-artefato.mjs   (Dockerfile:123)
```

**Escopo correto (`00-decisoes.md` D18): 2 scripts + 3 testes, não 1** — o plano original esquecia dois. Junto saem: `apps/web/scripts/verificar-marca.mjs`, `apps/web/scripts/verificar-marca-no-artefato.mjs`, `apps/web/src/lib/__tests__/dockerfile-roda-os-dois-gates.test.ts`, **e também** `apps/web/src/lib/__tests__/verificar-marca.test.ts` e `apps/web/src/lib/__tests__/verificar-marca-no-artefato.test.ts` (ambos executam os `.mjs` de verdade via `execFileSync`; apagar só os scripts sem tocar nesses dois testes deixa `pnpm test` vermelho — ver `04-critica.md`). `apps/web/src/lib/__tests__/marca-por-env.test.ts` é reescrito para provar o **fallback neutro**.

**Não remover proteção sem colocar outra no lugar.** Os gates existiam para impedir a "marca pela metade". No modelo novo o defeito equivalente é: **host cadastrado que resolve para o tenant errado**, ou **host desconhecido que cai na marca do último tenant**. O gate substituto é um teste de integração no CI:

- `tenant_domains.host` tem índice único em `lower(host)`;
- host desconhecido → NEUTRO, nunca marca de cliente;
- dois hosts diferentes na mesma instância devolvem `brand.slug` diferentes;
- nenhum `NEXT_PUBLIC_TENANT_*` sobrevive no bundle (`grep` no `.next` — é o gate 2 invertido: antes exigia a marca no artefato, agora exige a **ausência** dela).

Esse último item pode literalmente reaproveitar o mecanismo de `verificar-marca-no-artefato.mjs`, invertendo o veredito. Se for esse o caminho, o script fica e muda de nome.

### EasyPanel — um serviço, N empresas

| Item | Antes | Depois |
|---|---|---|
| Serviços | 1 por cliente (`deploy/cory`, `deploy/vertice`, …) | **1** (`academy-web`) + `blueprint` + `docling` |
| Branch | `deploy/{client}` | `main` |
| Domínio | 1 por serviço | wildcard `*.academy.eximiaventures.com.br` + domínios próprios adicionados no mesmo serviço |
| Build args de marca | 16 | 0 |

Traefik (labels no serviço; sintaxe exata depende da versão do EasyPanel — **[VERIFICAR] no painel**):

```
traefik.http.routers.academy.rule=HostRegexp(`{sub:[a-z0-9-]+}.academy.eximiaventures.com.br`) || Host(`academy.cory.com.br`)
traefik.http.routers.academy.tls.certresolver=letsencrypt
traefik.http.routers.academy.tls.domains[0].main=academy.eximiaventures.com.br
traefik.http.routers.academy.tls.domains[0].sans=*.academy.eximiaventures.com.br
```

Wildcard TLS exige **DNS-01** (HTTP-01 não emite wildcard) — ou seja, credencial de API do provedor de DNS no Traefik. Domínio próprio de cliente continua em HTTP-01 normal.

DNS: um único `*.academy.eximiaventures.com.br A → IP do EasyPanel`. Empresa nova não precisa de mudança de DNS.

**Env vars finais do serviço** (nenhuma delas é por cliente):

| Var | Papel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | banco |
| `SUPABASE_SERVICE_ROLE_KEY` | lookup de host no middleware + provisionamento |
| `NEXT_PUBLIC_APP_BASE_DOMAIN` (novo) | `academy.eximiaventures.com.br` — usado para derivar host default e para o fallback |
| `NEXT_PUBLIC_APP_URL` | só para links absolutos sem contexto de request; deixa de ser identidade |
| `ANTHROPIC_API_KEY` / demais LLM | conteúdo |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`, `NEXT_PUBLIC_POSTHOG_*` | observabilidade |
| `BLUEPRINT_MICROSERVICE_URL`, `DOCLING_API_URL`, `INTERNAL_AUTH_TOKEN` | microserviços internos-only. **`NEXT_PUBLIC_BLUEPRINT_MICROSERVICE_URL` removida (`00-decisoes.md` D15)**: `microservice/app/main.py:63` fixa `allow_origins` a uma única origem (incompatível com N subdomínios), `routes/blueprint.py:26-29` não tem nenhum `Depends(...)` e confia no `tenant_id` do corpo com `supabase_service_key`; publicar essa URL ao browser em N hosts quebraria CORS para N-1 empresas e abriria escrita cross-tenant sem auth. Junto saem `lib/blueprint-client.ts` e `components/blueprint/blueprint-generator.tsx` (sem renderizador — código morto, ver `03-inventario-sujeira.md`). Microserviço passa a exigir `Depends` checando `INTERNAL_AUTH_TOKEN` e `allow_origin_regex` do domínio base. Detalhe em `04-critica.md` |
| `UPSTASH_REDIS_REST_*`, `CRON_SECRET` | rate limit / cron |

PostHog: `tenantId` hoje é `config.brand.slug` (`(platform)/layout.tsx:338`) — passa a ser o slug do tenant resolvido. Sem isso a telemetria de todas as empresas colapsa num bucket só.

---

## 6. Sequência de PRs, do menos para o mais arriscado

| PR | Título | Escopo | Risco | Reversível por |
|---|---|---|---|---|
| **P0** | `chore: faxina de git` | apagar 30 branches merged, apagar `*.mutacao-backup`, `.gitignore` para os artefatos de script, decidir o `GABARITO.json`, commitar as docs pendentes | nulo | — |
| ~~P1~~ | ~~`fix(seguranca): tranca /gauntlet-preview`~~ | **Rebaixado e absorvido no P12** (`00-decisoes.md` D8) — refutado que houvesse falha de segurança viva (as 9 rotas já fazem `notFound()` em produção, ver `04-critica.md`). Vira só defesa em profundidade: adicionar `/gauntlet-preview` a `protectedPaths` (`middleware.ts:336`) + exigir `super_admin`, sem prioridade | — | — |
| **P2** | `fix(db): funcoes que faltam antes do REVOKE de julho` | M0 — **reescrito como "iterar até o reset passar", não "escrever uma migration"** (lacuna média da crítica): o cabeçalho de `20260905120000_equivalencia_git_producao_colunas_gatilhos_tabelas.sql:1-6` declara que faltam também gatilhos, colunas e tabelas, não só as 3 funções, e que "não foi possível reconstruir um banco vazio nesta máquina (sem Docker, sem psql, sem `supabase db reset`)". Escopo real: rodar `supabase db reset` de verdade num Docker, corrigir o erro que aparecer, repetir, até fechar. **Bloqueado nesta máquina por falta de Docker** — ver `00-decisoes.md` D14 e `05-tarefas-para-o-hugo.md` itens (d)/(e) | baixo em teoria, **desconhecido na prática** (número de iterações não medido) | revert |
| **P3** | `feat(db): bucket tenant-assets` | M3 + policies; conserta 2 uploads quebrados | baixo | revert |
| **P4** | `feat(db): tenant_domains + brand/modules em tenants` | M1 + M2 + backfill dos 4 tenants; **nenhum código lê ainda** | baixo | drop das colunas |
| **P5** | `refactor(marca): workspace-picker recebe brand por prop` | tira o único client component que chama `getTenantConfig()` | médio | revert |
| **P6** | `feat(tenant): resolucao por host no middleware` | headers `x-tenant-id`/`x-tenant-slug`; **ninguém consome ainda**; log de host→tenant para observar | médio | revert |
| **P7** | `feat(tenant): getTenantConfig le do banco, com fallback para env` | ordem: header → banco → `NEXT_PUBLIC_TENANT_*` → NEUTRO. **Aqui produção passa a poder rodar dos dois jeitos.** Kill switch por env `TENANT_RESOLUTION=host\|build` | **alto** | flag de env, sem redeploy |
| **P8** | `feat(easypanel): serviço único servindo todos os hosts` | wildcard + Traefik + apontar Cory e Vértice para o serviço novo, um de cada vez | **alto** | DNS volta para o serviço antigo |
| **P9** | `chore(build): remove os gates de marca` | Dockerfile `:42-59,72-87,96,123`, 2 scripts, 1 teste; entra o gate novo no CI | médio | revert |
| **P10** | `feat(admin): cadastro completo de empresa` | RPC `provisionar_tenant` + wizard de 3 passos + convite do 1º admin | médio | rota antiga continua existindo |
| **P11** | `refactor(modulos): vocabulário único` | unifica `modules`/`plan_features`/`settings.features`; mata ou liga `isCapabilityEnabled`/`isApiRouteAllowed` | médio | revert |
| **P12** | `chore: aposentadoria` | apagar `apps/central`, `public/logos/{argos,harven}-*`, reescrever `DEPLOY-GUIDE.md`, dropar `deployment_url`, **e** o antigo escopo do P1: `/gauntlet-preview` em `protectedPaths` + `super_admin` (defesa em profundidade, sem urgência). `.vercel/` sai desta lista — está no `.gitignore`, nunca foi versionado, não é dívida do repo (refutado em `04-critica.md`) | baixo | revert |
| **P13** | `refactor(auth): um login só` | mata `/login` ou `/entrar`; decide sobre `validate-tenant` | médio | revert |

Regra de ouro entre P7 e P8: **nunca virar os dois no mesmo dia.** P7 muda o app com o DNS antigo; P8 muda o DNS com o app já novo.

---

## 7. O que fazer com as branches

Estado medido:

- `HEAD` (`integra/main-cory`) **== `origin/deploy/cory`**, exatamente (0/0).
- `origin/main` é ancestral estrito de HEAD: 52 commits atrás, 0 à frente.
- `origin/deploy/vertice`: 3 commits próprios (`5a91cd0`, `962d347`, `8fb2fa9`), HEAD 95 à frente. O `tenant.config.ts` de lá ainda é a **versão literal antiga**, anterior ao modelo por env — ou seja, Vértice está atrás não só de features, mas do próprio mecanismo de marca.

### Plano

1. **`main` recebe fast-forward de HEAD.** Não há merge nem conflito: `git push origin integra/main-cory:main`. Depois disso `main` == o que roda em produção da Cory. Fazer isso **antes** de qualquer PR desta lista, para que todo o resto nasça sobre `main`.
2. **`deploy/cory`**: enquanto P8 não virar, ela continua sendo o que o EasyPanel builda — mas como é idêntica a `main`, mantê-la é só um alias. Depois de P8, apagar (local e remoto).
3. **`deploy/vertice`**: os 3 commits são branding + merges de reconciliação. O único conteúdo é a identidade Vértice, que vira **linha em `tenants` + `tenant_domains`** no P4/P10. Antes de apagar: extrair os valores do `tenant.config.ts` daquela branch (nome, slug `vertice-industria`, `#1E3A5F`, `#C4A882`, partner exímIA, footer, `suporte@eximiaventures.com.br`, módulos `["biblioteca","units"]`) para a migration de seed. Depois, apagar.
4. **Regra nova, escrita no CONTRIBUTING**: nenhuma branch `deploy/*` volta a existir. Cliente novo = linha no banco.

---

## 8. Riscos e como validar

| # | Risco | Como se manifesta | Como validar antes de doer |
|---|---|---|---|
| R1 | **Marca de A servida no host de B** (a "marca pela metade" que os gates protegiam, na forma nova) | cliente vê logo errado | teste de integração com 2 hosts na mesma instância, asserindo `brand.slug` diferente; `lower(host)` único em `tenant_domains` |
| R2 | **Host desconhecido cai na marca do último tenant** (cache mal escopado / módulo com estado) | tela aleatória em preview branch | teste: 3 requests alternando hosts A, desconhecido, B; o do meio tem que dar NEUTRO |
| R3 | **Vazamento de dados entre empresas** | catastrófico | **não muda nada aqui, e é assim de propósito**: RLS continua em `users.tenant_id`. Rodar as suítes existentes (`analytics/*/__tests__/isolamento-de-tenant*.test.ts`, `trava-de-tenant.test.ts`) sem alteração — elas têm que passar iguais |
| R4 | **Cache de tenant envenenado** por header `Host` forjado | tenant errado servido | ler só `x-forwarded-host` quando vier do proxy confiável; whitelist do sufixo `NEXT_PUBLIC_APP_BASE_DOMAIN`; chave de cache é o host normalizado, nunca o input cru |
| R5 | **`getTenantConfig()` vira `async` e quebra ~23 arquivos** | build vermelho, e pior: algum chamador esquecido serve NEUTRO em silêncio | `pnpm typecheck` pega os síncronos; e um teste que grep-a por `getTenantConfig()` sem `await`. **Complementado por D17** — `pnpm typecheck` não pega renderização estática: `(auth)/layout.tsx`, `app/layout.tsx` (`generateMetadata`) e `not-found.tsx` não leem cookies/headers hoje e são candidatas a prerender no `next build`; sem `export const dynamic = "force-dynamic"` explícito, a tela de login de uma empresa poderia ser servida estaticamente no host de outra pelo Full Route Cache. Gate de CI lê `.next/prerender-manifest.json` e reprova rota de marca marcada `Static` |
| R6 | **`workspace-picker` volta a chamar `getTenantConfig()`** por hábito | marca partida ao meio no browser | teste de fonte, no espírito do `marca-por-env.test.ts` atual. **Complementado por D17** — mesmo teste de prerender-manifest cobre esse regresso indiretamente: se `workspace-picker` voltar a puxar config de build, a rota tende a virar estática de novo |
| R7 | **Wildcard TLS não emite** (HTTP-01 não faz wildcard) | HTTPS quebrado no dia da virada | emitir e testar o certificado **antes** do P8, num subdomínio de teste |
| R8 | **Convite volta para o host errado** | usuário de A aceita convite no domínio de B | teste do `redirectTo` derivado do host primário; conferir template de e-mail |
| R9 | **Cookie de sessão em domínio errado** | logout aparente ao trocar de subdomínio | **FECHADO por construção, sem trabalho adicional.** `lib/supabase/server.ts:17-26` repassa `options` cru do `@supabase/ssr` sem injetar `domain`; `lib/supabase/client.ts:9` não usa `cookieOptions`; o `setAll` do middleware idem; os cookies de UI escritos à mão (`x-active-workspace`, `x-sa-active-tenant`) não têm `domain`. Já são host-only. Confirmado lendo o repo, não precisava de `[VERIFICAR]` — ver `04-critica.md` |
| R10 | **Ambiente novo continua não subindo** | provisionamento self-service impossível | critério objetivo do P2: `supabase db reset` limpo do zero |
| R11 | **Migration do repo diverge de produção** | correções que "não aplicam" | já existe o levantamento em `20260905120000_...`; usá-lo como baseline |
| R12 | **PostHog colapsa todas as empresas num bucket** | analytics inutilizável | asserir `tenantId` do provider == slug do tenant resolvido |

---

## 9. Decisões — o que já foi resolvido por default e o que ainda está aberto

`00-decisoes.md` (D1–D20) já tomou a maioria das decisões abaixo por default, para destravar a implementação, revertível pelo Hugo. As marcadas **[ABERTO]** continuam sem decisão e estão em `05-tarefas-para-o-hugo.md` §(g).

1. **Domínio canônico.** ~~`{slug}.academy.eximiaventures.com.br` ou `{slug}.eximiaacademy.com.br`?~~ **Resolvido por D1**: env `NEXT_PUBLIC_APP_BASE_DOMAIN`, host = `{slug}.{base}` derivado por string. **[HUGO] confirma o valor** no EasyPanel — `05-tarefas-para-o-hugo.md` item (a).
2. **Domínio próprio de cliente entra na v1 ou fica para depois?** **[ABERTO]** — muda o esforço de Traefik/ACME, não o modelo de dados (`tenant_domains` já suporta os dois).
3. **Regra de divergência host × usuário.** **Resolvido por D3**: serve se o usuário tem `users.tenant_id` OU `user_tenant_memberships` no tenant do host; senão redireciona para o host canônico do tenant primário do usuário (R1 corrigida — a crítica achou que `user_tenant_memberships` existe e está ativa na RLS, o que os três documentos originais não mencionavam).
4. **Marca renderizada para o super_admin.** **Resolvido por D3**: a do tenant ativo (`x-sa-active-tenant`), com fallback para a do host.
5. **Um projeto Supabase para todos, definitivamente?** Segue como pressuposto do plano (produção já roda assim); não há D# dedicada — permanece a leitura de que `DEPLOY-GUIDE.md:13-16` está desatualizado (corrigido no PR P12).
6. **Coluna nova (`tenants.brand`/`tenants.modules`) ou reuso de `branding`/`whitelabel_config`?** **Resolvido por D4**: coluna nova, shape de `TenantConfig` sem `customCSS`.
7. **`apps/central` morre?** **Resolvido por D7**: removido do monorepo — não porque "não faz nada no CI" (isso foi refutado, ele builda/tipa via turbo), mas porque custa CI sem entregar produto.
8. **`/gauntlet-preview`: trancar ou apagar?** **Resolvido por D8**: nem urgente nem prioridade — entram em `protectedPaths` com guard de `super_admin` como defesa em profundidade (parte do P12), porque são harness de paridade visual referenciado por código de produção (`moldura.tsx`, `gaveta.tsx`, `nav-abas.tsx`) e "apagar" tem custo. Refutada a premissa original de que havia falha de segurança viva.
9. **Login canônico: `/entrar` ou `/login`?** **[ABERTO]** — define se SSO por empresa entra no roadmap. `api/auth/validate-tenant` fica e é adaptado independente de qual login sobrevive (D9).
10. **Convite/e-mail transacional: SMTP único ou provedor por tenant?** **[ABERTO]** — D11 resolve o roteamento do `redirectTo`/link (host correto), não o provedor de envio.
11. **Plano default de empresa nova.** **Resolvido por D6**: `standard` (é o DEFAULT do banco); Drizzle e `feature-gate.ts` alinham a isso.
12. **Vértice: demo ativa no dia 1 ou pode ficar fora do ar durante a transição?** **[ABERTO]**.
13. **Branches abandonadas** `feat/epic-30-multinivel` (18 commits), `feat/epic-30-multinivel-pr` (20) e `feat/gestor-escopado-por-time` (12), paradas desde 21-22/jun/2026: tem trabalho de multinível a resgatar antes de apagar? **[ABERTO]**.
14. **Os 5 stashes**: recuperar em worktree isolada ou descartar? **[ABERTO]** — `03-inventario-sujeira.md` recomenda revisar só `stash@{0}` (único que toca schema Drizzle) e descartar os outros 4.

Decisões novas que a crítica trouxe e que também já foram resolvidas por default: slug neutro/`demo` (D5), bootstrap do super_admin (D13), microserviço `blueprint` interno-only (D15), rate limit com dimensão de tenant (D16), cache/prerender do Next (D17), escopo real do PR de remoção dos gates (D18), git (D19) e importação de marca da Cory antes da virada (D20). Ver `00-decisoes.md` para o texto completo de cada uma e `04-critica.md` para a lacuna que cada uma fecha.
