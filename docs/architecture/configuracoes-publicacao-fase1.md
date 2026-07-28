# Configurações — Publicação Fase 1 (plano executável) + Matriz da camada de departamento

> Documento aditivo. Nenhum outro arquivo foi tocado ao escrevê-lo. Nada aqui foi commitado.
> Branch de referência: `deploy/cory`. Working tree com ~92-93 entradas em `git status --porcelain`
> no momento da redação (frentes Jornada, engagement, meu-plano; o número **oscila**, porque outras
> frentes estão ativas na mesma árvore — medir o baseline no início da execução, não copiar daqui).
> Insumos: 4 mapeamentos + 2 refutações adversariais. Onde houve contradição, a refutação com
> evidência de arquivo prevaleceu, e os números do mapeamento foram corrigidos abaixo.

---

## 1. Veredito em 5 linhas

1. **Sobem VIVAS na Fase 1** as 5 seções decididas (Dados da organização, Marca & Aparência, Unidades & Áreas, Cargos, Usuários), **sem uma única migration**, reusando os componentes e as actions que já existem em `/admin/settings`, `/admin/areas`, `/admin/job-roles`, `/admin/users`.
2. **Ficam "Em breve"** as outras 11 seções (inclusive Auditoria), como itens não-clicáveis, em cinza, com pílula — e **sem arquivo de rota**, para não gerar 404 nem guard duplicado.
3. **A Fase 1 não resolve a colisão semântica de `areas`** (a mesma tabela guarda UNIDADE na Cory e DEPARTAMENTO na Harven). "Unidades & Áreas" sobe entregando **exatamente o que a tabela já é hoje**, com o nível "Área/departamento" e "Áreas corporativas" marcados *Em breve dentro da própria seção*.
4. **O único bloqueio real é uma decisão do dono, não um problema técnico:** `/admin/areas` hoje é liberada para `manager` e `/admin/job-roles` para `manager` + `instructor` (guards de página verificados); um hub gated em admin-tier precisa que o Hugo escolha entre (a) manter as rotas antigas vivas sem nav — recomendado, revoga zero acesso — (b) gate por seção dentro do hub, ou (c) aceitar a revogação explicitamente.
5. Dois achados mecânicos precisam entrar **antes** de tocar em navegação: o teste de nav **já está vermelho** (2 falhas pré-existentes) e o step de repointar `Configurações` deixaria **a aba "Autenticação"/SSO de `/admin/settings` órfã de nav** — ela é uma 8ª superfície que ninguém contou e que pertence a `plataforma-seguranca`, uma das 11 "Em breve".

---

## 2. Fase 1 — escopo path-independent, passo a passo

Ordem de execução obrigatória. Cada passo tem comando de verificação literal. Todos os caminhos são relativos a `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`.

### Passo 0 — Baseline (antes de editar nada)

Registrar os dois baselines, para que qualquer vermelho posterior seja distinguível de regressão nova.

```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd packages/shared && npx vitest run src/__tests__/registry-nav.test.ts 2>&1 | tail -5
```

Baseline **verificado nesta análise**:
- typecheck: saída vazia, `exit=0` (limpo, mesmo com a árvore suja).
- nav test: `Test Files 1 failed (1) / Tests 2 failed | 12 passed (14)`.

### Passo 1 — Zerar o vermelho pré-existente do teste de nav

`packages/shared/src/modules/registry.ts:206` diz `{ label: "Ações de Engajamento", href: "/engagement" }` (mudança E10 deliberada, com comentário em `:203-205`), mas `packages/shared/src/__tests__/registry-nav.test.ts:134` e `:157` ainda esperam `"Engajamento"`. Falha reproduzida verbatim:

```
- Expected "Engajamento"
+ Received "Ações de Engajamento"
  ❯ src/__tests__/registry-nav.test.ts:157:25
```

Ação: alinhar o **teste** ao código (o label do produto é o canônico; o registry tem comentário justificando a mudança). Editar `registry-nav.test.ts:134` e `:157`, trocando `"Engajamento"` por `"Ações de Engajamento"` nas listas esperadas dos contextos `team` e `organization`.

```bash
cd packages/shared && npx vitest run src/__tests__/registry-nav.test.ts 2>&1 | tail -4
# esperado: Tests  14 passed (14)
```

### Passo 2 — Liberar a rota `/configuracoes` (pré-requisito, senão o build quebra)

`apps/web/src/app/(platform)/configuracoes/page.tsx` já existe e é a página **pessoal** de preferências (client component, sem gating), com `loading.tsx` irmão. Next.js não permite dois `page.tsx` resolvendo o mesmo path.

1. `git mv "apps/web/src/app/(platform)/configuracoes/page.tsx" "apps/web/src/app/(platform)/preferencias/page.tsx"` (e o mesmo para `loading.tsx`).
2. Renomear os componentes: `ConfiguracoesPage` → `PreferenciasPage` (`page.tsx:80`), `ConfiguracoesLoading` → `PreferenciasLoading` (`loading.tsx:1`).
3. `apps/web/src/components/layout/header.tsx:157` — `href={"/configuracoes"}` → `href={"/preferencias"}`.
4. `apps/web/src/components/studio/studio-header.tsx:112` — idem.

São as **duas únicas** referências em código-fonte (verificado por grep). O path `/preferencias` não bate nenhum prefixo de workspace do middleware, então o instrutor **não** é expulso do Estúdio (o risco original vinha do redirect para `/dashboard`, que reescreve `x-active-workspace` para `standard` em `middleware.ts:354-356`).

```bash
grep -rn '"/configuracoes"' apps/web/src --include='*.tsx' --include='*.ts'
# esperado: apenas os arquivos NOVOS do hub (nenhum hit em header.tsx / studio-header.tsx)
ls "apps/web/src/app/(platform)/preferencias/"
# esperado: loading.tsx  page.tsx
```

### Passo 3 — Shell do hub em `(platform)/configuracoes/`

Fica **dentro do route group `(platform)` existente**, não em group novo: os providers (`QueryProvider`, `ModuleProvider`, `BrandProvider`, `AreaProvider`, `ContextProvider`, `SessionTimeoutProvider`), o `Header` e o CSS de tenant são montados em `(platform)/layout.tsx:187-253`; replicar isso num group novo é custo alto e ganho zero.

Arquivos novos:
- `(platform)/configuracoes/layout.tsx` — guard de servidor + sidebar do hub como segunda coluna dentro do `<main>`.
- `(platform)/configuracoes/page.tsx` — `redirect("/configuracoes/organizacao")` (a raiz não é uma tela, é a porta).
- `(platform)/configuracoes/_components/settings-hub-nav.tsx` — as 16 seções em 4 grupos.

Guard (usar união de chapéus, canônico segundo os comentários do próprio repo em `registry.ts:398-401` e `lib/role-helpers.ts`, em vez do `profile.role` singular legado usado em `admin/users/page.tsx:16`):

```ts
const { user, profile, roles } = await getAuthProfile()
if (!user || !profile) redirect("/login")
if (!hasAnyRole({ roles }, ["admin", "super_admin"])) redirect("/dashboard")
```

`getAuthProfile` é `cache()`-ado (`lib/auth.ts`), logo não duplica query com `(platform)/layout.tsx`.

Sidebar — 16 itens, 4 grupos, ids espelhando os `data-panel` do mockup (`/Users/hugocapitelli/Dev/eximia/JARVIS/apps/hub-discovery/configuracoes-hub.html:1409-1487`):

| Grupo | Item | id do mockup | Fase 1 |
|:--|:--|:--|:--|
| ORGANIZAÇÃO | Dados da organização | `org-dados` | **VIVA** → `/configuracoes/organizacao` |
| ORGANIZAÇÃO | Marca & Aparência | `org-marca` | **VIVA** → `/configuracoes/marca` |
| ORGANIZAÇÃO | Unidades & Áreas | `org-unidades` | **VIVA** → `/configuracoes/unidades` |
| ORGANIZAÇÃO | Cargos | `org-cargos` | **VIVA** → `/configuracoes/cargos` |
| PESSOAS | Usuários | `pessoas-usuarios` | **VIVA** → `/configuracoes/usuarios` |
| PESSOAS | Convites | `pessoas-convites` | Em breve |
| PESSOAS | Grupos de gestores | `pessoas-grupos` | Em breve (vive na sidebar principal) |
| PESSOAS | Perfis & Permissões | `pessoas-perfis` | Em breve |
| PLATAFORMA | Preferências | `plataforma-preferencias` | Em breve (existe como `/preferencias`, pessoal) |
| PLATAFORMA | Notificações | `plataforma-notificacoes` | Em breve (vive na sidebar principal) |
| PLATAFORMA | Segurança & Sessão | `plataforma-seguranca` | Em breve (a aba SSO vive em `/admin/settings`, ver Passo 5) |
| PLATAFORMA | Auditoria | `plataforma-auditoria` | Em breve (ver Passo 5, item de nav a ADICIONAR) |
| AVANÇADO | Integrações | `avancado-integracoes` | Em breve |
| AVANÇADO | API Keys | `avancado-apikeys` | Em breve |
| AVANÇADO | Webhooks | `avancado-webhooks` | Em breve |
| AVANÇADO | Plano & Cobrança | `avancado-plano` | Em breve (rota existe, sem nav — ver Passo 5) |

Os 11 bloqueados são `<span>`/`<button disabled>`, nunca `<Link>`, com pílula "Em breve" e `aria-disabled="true"`.

```bash
ls "apps/web/src/app/(platform)/configuracoes/"
grep -c 'href="/configuracoes/' "apps/web/src/app/(platform)/configuracoes/_components/settings-hub-nav.tsx"   # esperado: 5
grep -c 'Em breve' "apps/web/src/app/(platform)/configuracoes/_components/settings-hub-nav.tsx"                 # esperado: 11
grep -cE 'ORGANIZAÇÃO|PESSOAS|PLATAFORMA|AVANÇADO' "apps/web/src/app/(platform)/configuracoes/_components/settings-hub-nav.tsx"  # esperado: 4
```

### Passo 4 — As 5 sub-rotas vivas, reusando o que existe (zero reimplementação)

Regra dura da Fase 1: **a seção do hub não reescreve tela, ela monta o componente que já existe**. Os clients são importáveis (`components/admin/*` e `app/(platform)/admin/*/_components/*`). O que **não** é reaproveitável direto é o carregamento de dados, hoje inline nos `page.tsx` server (ex.: `admin/users/page.tsx` monta filtros, paginação por cursor e `user_areas`). Padrão a seguir: **extrair o loader** de cada `page.tsx` para um módulo (`loader.ts` co-locado) e as duas rotas (antiga e do hub) chamarem o mesmo loader. Isso evita a "implementação paralela" que a refutação apontou como risco (duas telas para a mesma coisa).

| Sub-rota | Reusa | Loader a extrair |
|:--|:--|:--|
| `/configuracoes/organizacao` | novo form + `saveTenantSettings` (`admin/settings/actions.ts:40`, hoje **sem nenhum caller**) + `LogoUpload`/`ColorPicker`/`BrandingPreview` (existem, órfãos) | leitura de `tenants` em `admin/settings/page.tsx` |
| `/configuracoes/marca` | `WhitelabelSettingsForm` + `WhitelabelPreview` + `saveWhitelabelConfig` | idem |
| `/configuracoes/unidades` | `AreaManagementClient` + `/api/admin/areas*` | `admin/areas/page.tsx` (inclui o gate do módulo `units`) |
| `/configuracoes/cargos` | `JobRolesClient` + `listJobRolesWithStats` + `listAreas` | `admin/job-roles/page.tsx` |
| `/configuracoes/usuarios` | `UserManagementClient` + `UserList` + `InviteUserDialog` + `UserProfileDialog` | `admin/users/page.tsx` |

```bash
find "apps/web/src/app/(platform)/configuracoes" -name page.tsx | sort
# esperado: 6 linhas (raiz + organizacao + marca + unidades + cargos + usuarios)
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"   # esperado: exit=0
```

### Passo 5 — Sidebar principal (todas as edições em `packages/shared/src/modules/registry.ts`)

Estado verificado do bloco `admin` (linhas 209-217): `{section:"Administração"}`, Engajamento (`/admin/notifications`), Cargos (`:212`), Usuários (`:213`), Unidades (`:214`), Grupos de Gestor (`:215`), `{section:"Sistema"}` (`:216`), Configurações (`/admin/settings`, `:217`).

Edições:

1. **Remover** `:212` (Cargos), `:213` (Usuários), `:214` (Unidades) — migrados para o hub.
2. **`:217`** — trocar o href: `{ label: "Configurações", href: "/configuracoes", icon: "Settings" }`. Cria a porta do hub e remove o item `/admin/settings` no mesmo movimento. O grupo "Sistema" (`:216`) continua com item, nenhum header vazio é criado.
3. **Remover** o item duplicado em `:300` (módulo `units`, `{ label: "Unidades", href: "/admin/areas" }`), deixando `nav: {}`. **Não** tocar `routes` (`:302`) nem `apiRoutes` (`:303`) — `ModuleGate` e `isRouteAllowed` dependem deles. (`buildNavigation` não deduplica, por isso "Unidades" aparecia 2×.)
4. **ADICIONAR** um item para não orfanar a aba **Autenticação/SSO**: `/admin/settings` tem **3 abas** (`settings-tabs-wrapper.tsx:49-51`: "Configurações Gerais", "Autenticação", "Whitelabel"), e a de Autenticação é funcional (`SSOConfigForm` + `POST/GET/DELETE /api/admin/sso`). Ela pertence a `plataforma-seguranca`, que é **Em breve**. Sem esse item, `/admin/settings` fica com **zero** entradas de nav no registry inteiro. Ação: `{ label: "Autenticação", href: "/admin/settings", icon: "Shield" }` sob "Sistema", até `plataforma-seguranca` ser portada.
5. **ADICIONAR** à chave `admin` (restrição 3 exige *aditividade*, e hoje esses dois não existem para admin de tenant):
   - `{ label: "Auditoria", href: "/admin/audit", icon: "Shield" }` — hoje só existe na chave `super_admin` (`:221`), embora a página libere `admin` (`admin/audit/page.tsx`). Um admin de tenant só chega lá por deep link da ficha do usuário.
   - `{ label: "Plano & Cobrança", href: "/admin/plans", icon: "CreditCard" }` — a rota existe e libera admin, e **não tem nenhuma entrada de nav** em todo o registry.
6. **NÃO** ligar o módulo `integrations`. `apps/web/tenant.config.ts:20-23` habilita apenas `["biblioteca","units"]`, logo API Keys / Integrações / Webhooks **não aparecem hoje** para o admin da Cory: não há acesso a perder, e ligar o módulo seria *ampliar* superfície, não preservar. Registrado como decisão do dono, não como bug.

`apps/web/src/lib/navigation.ts` **não precisa de edição** (`ICON_MAP` já tem `Settings` e `Shield`). Se o item de Plano usar `CreditCard`, confirmar no `ICON_MAP` — ícone ausente **não quebra build**, cai silenciosamente em `LayoutDashboard`.

```bash
grep -n '"/admin/job-roles"\|"/admin/users"\|"/admin/areas"\|"/configuracoes"\|"/admin/settings"\|"/admin/audit"\|"/admin/plans"' packages/shared/src/modules/registry.ts
# esperado: /admin/areas só em routes/apiRoutes; /configuracoes 1×; /admin/settings 1× (Autenticação);
#           /admin/audit 2× (admin + super_admin); /admin/plans 1×
grep -n 'CreditCard' apps/web/src/lib/navigation.ts   # se vazio, escolher ícone já mapeado
```

### Passo 6 — Gating no middleware (`apps/web/src/middleware.ts`)

1. `:329` — incluir a rota nas protegidas:
   `const protectedPaths = ["/dashboard", "/courses", "/admin", "/analytics", "/instructor", "/configuracoes"]`
2. Após o guard de `/instructor` (`:337-339`) e **antes** do bloco que escreve o cookie de workspace (`:344-357`), inserir:

```ts
// Hub de configurações: admin-tier por CHAPÉU real (nunca profile.role).
if (
  pathname.startsWith("/configuracoes") &&
  user &&
  !effectiveHats.some((h) => h === "admin" || h === "super_admin")
) {
  return NextResponse.redirect(new URL("/dashboard", request.url))
}
```

`effectiveHats` já está no escopo (declarado ~`:244`, populado em `:300-305` lendo `user_roles`).

3. **NÃO** adicionar `/configuracoes` a `blockedForInstructor` (`:362-368`): o guard novo já cobre instrutor (ele não tem chapéu admin), e mexer ali obrigaria a atualizar a lista-sombra do teste `courses/__tests__/role-permissions.test.ts` (que é um array literal copiado, não lê o middleware — dívida conhecida, já divergente: falta `/admin/audit`).

```bash
grep -n '"/configuracoes"' apps/web/src/middleware.ts        # esperado: 2 hits (protectedPaths + guard)
grep -n 'blockedForInstructor' apps/web/src/middleware.ts     # esperado: inalterado
npx vitest run "apps/web/src/app/(platform)/courses/__tests__/role-permissions.test.ts" 2>&1 | tail -3
```

### Passo 7 — Repointar os inbound links

Links verificados que apontam para telas migradas:

| Arquivo:linha | Hoje | Ação |
|:--|:--|:--|
| `apps/web/src/app/(platform)/dashboard/_components/admin-dashboard-page.tsx:116` | `/admin/users` | → `/configuracoes/usuarios` |
| `apps/web/src/app/(platform)/dashboard/_components/admin-dashboard-page.tsx:126` | `/admin/settings` | → `/configuracoes/organizacao` |
| `apps/web/src/app/(platform)/dashboard/_components/admin-dashboard-page.tsx:229` | `/admin/areas/{id}` | manter (detalhe da unidade não sobe na v1, ver §3.3) |
| `apps/web/src/components/dashboard/manager-dashboard.tsx:156` | `/admin/users` | **decisão**: já é link quebrado hoje (guard admin-only expulsa manager) — remover do quick-action do gestor ou manter quebrado |
| `apps/web/src/components/dashboard/manager-dashboard.tsx:166` | `/admin/settings` | idem |
| `apps/web/src/app/(platform)/dashboard/_components/super-admin-dashboard-page.tsx:78` | `/admin/users` | manter (super_admin, ver ressalva F6 em §5) |
| `apps/web/src/app/(platform)/admin/areas/[areaId]/page.tsx:73` | `/admin/areas` | manter (breadcrumb interno da rota antiga, que segue viva) |

```bash
grep -rn '"/admin/settings"' apps/web/src/app "apps/web/src/components/dashboard" | grep -v revalidatePath
# esperado: nenhum quick-action de dashboard apontando para /admin/settings
```

### Passo 8 — Destino das rotas antigas (decisão do dono, ver §1 item 4)

Recomendação: **manter `/admin/areas`, `/admin/job-roles`, `/admin/users`, `/admin/settings` vivas e sem nav na Fase 1**, renderizando os mesmos componentes via o loader extraído no Passo 4. Consequência: zero revogação para `manager` (`/admin/areas`, `/admin/job-roles`) e `instructor` (`/admin/job-roles`), zero duplicação de implementação, e a Fase 2 decide redirects com dados de uso. Redirect imediato (`redirect("/configuracoes/...")`) **revogaria** acesso desses papéis, porque o hub é admin-tier.

```bash
grep -n 'includes(profile.role)' "apps/web/src/app/(platform)/admin/areas/page.tsx" "apps/web/src/app/(platform)/admin/job-roles/page.tsx"
# esperado (verificado): areas → ["admin","super_admin","manager"] ; job-roles → ["manager","admin","instructor","super_admin"]
```

---

## 3. As 5 seções vivas

### 3.1 Dados da organização

**Sobe na v1:** um form de verdade onde hoje não há nenhum. A aba "Configurações Gerais" de `/admin/settings` é literalmente um `<p>`: *"Configurações gerais do tenant são definidas no tenant.config.ts do deploy"* (`settings-tabs-wrapper.tsx:70`), e `saveTenantSettings` (`admin/settings/actions.ts:40`) existe, valida, grava audit log `settings.updated` e **não tem um único caller** no repo. `LogoUpload`, `ColorPicker` e `BrandingPreview` existem e só são referenciados pelos próprios testes.

- Nome da organização (`tenants.name`) — action já aceita.
- Logo (`branding.logo_url`) e Cores Primária/Secundária (`branding.primary_color`/`secondary_color`, validação hex) — ligar os 3 componentes órfãos.
- Salvar / Descartar, com o audit log que já está pronto.

**Fica para depois:** Slug (existe a coluna, mas não está no `tenantSettingsSchema` — só em `createTenantSchema` de super-admin), **Domínio de acesso** (nenhuma coluna em `tenants`), **Idioma padrão** (nenhum campo em `tenants.settings`), **cores Texto e Fundo** (o schema de branding tem só 2 cores), e o **pipeline de upload para storage** (hoje a action aceita URL pronta, não arquivo).

Nota: o mockup deixa esta seção sem uma linha de JS (`configuracoes-hub.html:1495-1570` é HTML estático). Não há comportamento a copiar, só layout. E há um gap de autoridade a decidir: hoje editar `name`/`slug` do tenant é `requireSuperAdmin` (`/admin/tenants`); dar isso ao admin do tenant é ampliação de escopo de permissão, não porte.

### 3.2 Marca & Aparência

**Sobe na v1: praticamente tudo, é a única seção onde o produto está À FRENTE do mockup.** `WhitelabelSettingsForm` já tem Nome do App (contador real `{appName.length}/100`, contra `12/100` chumbado no mockup), Tagline, Título/Subtítulo do login, Rodapé, Email de suporte, URL do favicon **com preview e erro "URL deve usar HTTPS"** (o mockup não tem), preview do login **reativo de verdade** (no mockup o preview é markup estático apesar do texto "atualiza em tempo real"), Salvar e "Resetar para Padrão" (`saveWhitelabelConfig({})`), com audit log `settings.whitelabel_updated`.

**Fica para depois:** `custom_css` (existe no schema, sem UI em nenhum dos dois lados) e a representação do **gate de plano**: a aba só aparece com whitelabel habilitado (aba condicional + gate no server action), e o mockup não modela isso — pinta a seção como sempre viva. Decidir se no hub o item vira "Marca & Aparência (PRO)" ou some.

### 3.3 Unidades & Áreas — o que dá para entregar HOJE, sem migration

**Fato de produção:** a tabela `areas` tem só `id, tenant_id, name, slug, description, created_at, updated_at` (+ `UNIQUE(tenant_id, slug)`). **Não existe `units`, não existe `area_units`, não existe `parent_id`, `manager_id`, `status`/`archived_at`.** A tabela nasceu departamento (migration `20260210000000_areas_role_unification.sql:4,11` — "Adds formal areas/departments") e foi apropriada como unidade em abril/maio (`20260406000000_unit_scoped_enrollments.sql`, `20260517200000_course_areas_unification.sql` seedando "Ribeirão Preto" e "Minas Gerais"). Os dois seeds do repo discordam entre si: `supabase/seed-remote.ts:128-134` semeia **departamentos** ("Tecnologia", "Negocios").

**Sobe na v1 (tudo já existe, é porte de superfície):**
- Lista com Nome, Slug, **Descrição**, contagem de Usuários e de Cursos (`AreaManagementClient`).
- Criar (nome, slug, descrição), Editar, Excluir com a confirmação atual.
- Detalhe: adicionar/remover pessoas (`user_areas`) e vincular/desvincular cursos.
- **Expor a `description` com destaque na UI** — é grátis (coluna existe, a produção Cory já a usa dizendo "Unidade de...") e é o remédio mais barato para a ambiguidade atual. É o único dos 3 itens que vale copiar do Stratws que custa zero.
- O gate do módulo `units` continua valendo: tenant sem o módulo vê o upsell atual (Cory tem `units` ligado, `tenant.config.ts:22`).

**Fica para depois (bloqueado por esquema, e a seção deve dizer isso na tela):**
hierarquia Unidade→Área, **Área corporativa N:N**, MOVER área entre unidades, EXPANDIR/ENCOLHER, vista Mapa (kanban/pilares/drag), vista Lista com grupos colapsáveis, Arquivar/Restaurar + filtro Arquivadas, Gestor da área (avatar/cluster/"gestor local"), busca "por área **ou gestor**", dot de governança, Desfazer com snapshot, sugestões de IA, e os stats "Unidades (sites)" vs "Áreas ativas".

**Duas armadilhas de rótulo, registradas:**
1. A tela atual se auto-rotula **"Unidades Gerenciais"** (`admin/areas/page.tsx`), e o paywall do módulo diz "unidades (filiais, plantas, **departamentos**)" — mistura os dois conceitos na mesma frase. O item do hub é "Unidades & Áreas" (nomenclatura cravada), mas **nenhum rótulo único é correto para Cory e Harven ao mesmo tempo** sem a camada nova. A v1 mantém o vocabulário atual no conteúdo e não promete o nível de departamento.
2. Não reusar `manager_groups` como "área corporativa". Ele é outra entidade ("time de alunos com dono gestor", `20260530130000_area_gestor.sql`), pertence a **Grupos de gestores** (uma das 11 Em breve), e — corrigido pela refutação — o fan-out corporativo está **deliberadamente desligado**: `lib/area-context.ts:104-106` diz *"There is NO corporate fan-out: manager_group_units / is_corporate are intentionally ignored"*, e a invariante "grupo não-corporativo tem exatamente 1 unidade" está documentada como **não implementada** (`20260604140000_fix_area_gestor_rls.sql:70-95`, trigger só como esboço comentado). Ou seja: `is_corporate` é decorativo no banco. **DESCONHECIDO, precisa checar:** se `20260530130000_area_gestor.sql` está aplicado em produção — o repo se contradiz (`lib/analytics/area-gestor.ts:19-25` diz "NOT yet applied to the DB"; `20260604140000:4` diz "already applied in production").

### 3.4 Cargos

**Sobe na v1:** lista agrupada por área com grupo "Sem área", criar (nome → slug derivado, área, senioridade, descrição), editar, pill de senioridade com os mesmos 5 níveis do mockup (`junior|mid|senior|lead|manager`), contagem real de trilhas ativas (`actions.ts:89`), excluir. Mais barato e de alto valor: "Sem área" por último e cores por nível de senioridade (UI pura).

**Fica para depois:** chips com os **nomes** das trilhas (hoje só o número), vincular/desvincular trilha pelo lado do cargo, "Pessoas com este cargo" (contagem/avatares/lista), "Mover pessoas de cargo…" em massa (o write unitário existe: `PATCH /api/admin/users/[userId]` com `jobRoleId`), busca, filtros, 4 stats clicáveis, grupos colapsáveis persistentes, drawer no lugar de modal, duplicar cargo, dot âmbar, IA, Desfazer. E o **excluir com realocação**: hoje o delete **bloqueia** com `"Nao e possivel excluir: N trilha(s) ativa(s) vinculada(s)"` em vez de oferecer reatribuição.

**Duas ressalvas:**
- `job_roles.area_id` referencia `areas`, ou seja na Cory escolher a "Área" de um cargo é escolher **Ribeirão Preto ou Minas Gerais**. **Não renomear** o campo para "Área (departamento)" na v1 — sem a camada nova, o rótulo novo mentiria sobre o dado.
- `learning_trails.target_job_role_id` é **1 cargo por trilha**: "+ Vincular trilha" escolhendo trilha de outro cargo **MOVE**, não adiciona. Vínculo múltiplo exige tabela de junção.
- **Não copiar** o CRUD de 1 campo do Stratws: o nosso cargo já tem área, senioridade, descrição e trilhas. Seria regressão.

### 3.5 Usuários

**Sobe na v1:** lista com paginação por cursor (o mockup não pagina), busca por nome/email com debounce 300ms, filtro por papel, filtro por área, papel editável inline (`RoleSelector`, mais poderoso que o pill do mockup), Ativo/Inativo, ⋯ com Editar ficha / Gerenciar Permissões (instrutor) / Desativar-Reativar, e o convite (Nome completo, Nome para relatório, Email, Papel).

Ganhos baratos: adicionar `"Instrutor"` ao filtro de papel (falta 1 `<option>`, embora o papel já seja badgeado na linha), e resolver **Cargo** e **Área** como colunas — `job_role_id` já vem no `select` do `page.tsx` e nunca é resolvido para nome; `user_areas` é usada só como filtro.

**⚠ Ressalva de baseline (corrigida pela refutação, é importante):** 4 capacidades reportadas como "JÁ EXISTE" vivem em arquivos **não commitados** (`git status` untracked): `components/admin/user-profile-dialog.tsx` (Ficha: Superior imediato + Cargo), `api/admin/users/[userId]/reset-password/`, `(platform)/admin/audit/` (diretório inteiro), `api/admin/audit-log/`, `components/admin/audit-log-client.tsx`, e a migration `20260718130000_users_report_name.sql` (**não aplicada**). Prova: `git show HEAD:apps/web/src/components/admin/user-list.tsx | grep user-profile-dialog` → vazio. **Decisão necessária do dono:** essa fila de trabalho entra no branch do hub? Se não entrar, o escopo real da Fase 1 é maior do que o mapeamento sugere (Ficha, Redefinir senha, "Ver ações deste usuário" → Auditoria, e o campo "Nome para relatório" **não existem no HEAD**).

**Fica para depois:** "Último acesso" (a coluna é renderizada mas `page.tsx` chumba `last_sign_in_at: null` — exige ler `auth.users` via service role), filtro de status segmentado, stats clicáveis, Convites pendentes/Reenviar/Revogar (`users.status` é `CHECK IN ('active','inactive')` e o convite já insere `active`; não há tabela de convites), **chapéus múltiplos** (`users.role` é valor único e `user_tenant_memberships` tem `UNIQUE(user_id, tenant_id)`), sub-rótulo "Unidade" na coluna Área (bloqueado por esquema), importação em massa, Desfazer, IA, e o drawer no lugar do modal.

**Vale copiar do Stratws (barato):** vínculo gerenciável **dos dois lados** — hoje só existe pelo lado da área (`/admin/areas/[areaId]/users`). Falta "Mover de área" pelo lado da pessoa, e o drawer da pessoa já existe para receber o campo.

---

## 4. Matriz de decisão — camada de departamento

Números **corrigidos pela refutação**: o inventário original ("75 arquivos / 72 consumidores") não é reproduzível neste repo — o padrão dele, no escopo dele, dá **67 arquivos** (68 repo-wide), e 2 dos 3 "falsos-positivos" citados (`apps/brandbook`, `packages/agents/.../perfilador.ts`) **não pertencem a este repo** (`ls apps` = `central`, `web`). Call-sites de banco: **23×** `.from("areas")` (o 23º é `supabase/seed-remote.ts`), **30×** `.from("user_areas")`, **5×** `.from("course_areas")`.

| Caminho | O que destrava | Arquivos afetados | Risco em produção | Reversibilidade | Veredito |
|:--|:--|:--|:--|:--|:--|
| **P1** — `areas` **fica** Unidade; tabela nova de departamento + junção N:N | Hierarquia, departamento de verdade, **área corporativa N:N** (a junção nova resolve), sem tocar em nada existente | **0** TS alterados obrigatórios; ~10-14 novos (2 schemas, 1 migration aditiva, 2 rotas API, 2 páginas, 2 clients, validator, entrada de registry). **+5 não-opcionais** para não deixar semântica errada: `schema/job-roles.ts`, `validators/job-roles.ts`, `admin/job-roles/actions.ts`, `job-roles-client.tsx`, `lib/trails/recommendations.ts` (a "Rule 2: adjacent role in same area" hoje recomenda trilha por estar na **mesma filial**) | **Baixo.** Nenhum objeto de banco existente é tocado; 1 migration aditiva | **Total** (`DROP TABLE` das novas; zero dado existente mexido) | **RECOMENDADO** (fora da Fase 1) |
| **P2** — renomear `areas`→`units` e criar `areas` nova = departamento | Mesma coisa que P1, mais o vocabulário "certo" no banco | **~67** arquivos no escopo mapeado + 9-10 migrations + 16 arquivos de doc | **ALTO e SILENCIOSO.** Confirmado e **agravado** pela refutação: os 3 clientes supabase são **não-tipados** (`client.ts`, `server.ts` sem genérico; `service.ts` usa `SupabaseClient<any,...>`), e `Database` não tipa nenhuma query (`createClient<` tem 1 hit no repo, e é comentário). **Regenerar `supabase.ts` não produz um único erro de compilação** — `.from("areas")` é string opaca ponta a ponta, a falha só aparece em runtime. Somam-se: `trg_enrollment_area` para de disparar, 4 policies de leader com `JOIN user_areas` negam tudo, **5 policies de `course_areas`** (2 originais + 3 recriadas em `20260530120000_security_hardening_rls.sql:104-125`, uma delas justamente por furo de isolamento de tenant), `campaigns.criteria` JSONB guardando `unit_id`→`areas.id` **sem FK e sem índice**, `assigned_area_ids UUID[]` **sem FK** (`20260228100000_instructor_role.sql:31`), e o **contrato público** `/api/v1/courses` + `/api/v1/enrollments` (`area_id` já publicado no OpenAPI) quebra para cliente externo | **Baixa.** Rename + tabela homônima com semântica diferente torna rollback ambíguo; exige janela coordenada DB+app; colide com o símbolo Drizzle `áreas` existente | **REJEITADO** |
| **P3** — `kind` + `parent_id` em `areas` | Departamento coexistindo na mesma tabela. **Não** destrava N:N: `parent_id` é 1:N, a junção é necessária de qualquer jeito | **2** obrigatórios (`schema/areas.ts` + regen de tipos) + **~30-35 call-sites** que precisam de `.eq("kind","unit")` para não regredir | **Nada dá erro — passa a contar errado, em silêncio.** Departamento novo vaza para o seletor "Unidade" do header, contagens do dashboard admin, público de campanha (`audiences.ts`), comparação de unidades do analytics; e `set_enrollment_area()` (`LIMIT 1` **sem `ORDER BY`**, `20260406000000:8-24`) passa a gravar unidade **ou** departamento na matrícula de forma não-determinística. `UNIQUE(tenant_id, slug)` passa a colidir entre unidade e departamento homônimos | **Média** (`DROP COLUMN` é trivial, mas ~30 filtros espalhados ficam como dívida) | **REJEITADO** |

### Recomendação única

**P1, aditivo, e NÃO na Fase 1.** A Fase 1 sobe com zero migration; P1 vira story própria após o hub estar publicado e o Hugo ver as 5 seções em uso.

**Motivo:** é o único caminho com custo de quebra **zero** em produção (nenhum dos 6 FKs, 7 policies de `areas`/`user_areas`, 4 policies de leader, 5 policies de `course_areas`, trigger de matrícula ou contrato público `/api/v1` é tocado), com reversibilidade total, e é **precedente comprovado neste mesmo repo**: `20260530130000_area_gestor.sql` fez exatamente isso — criou uma camada nova (`manager_groups` + `manager_group_units` + `manager_group_members`) declarando-se *"fully ADDITIVE (no DROP...) and IDEMPOTENT"*, nomeou a coluna `unit_id` *"on purpose to disambiguate"* e deixou `areas` intacta (*"We do NOT touch it here — it keeps its meaning"*). P2 falha por não ter rede do compilador (o risco é regressão silenciosa em 52+ call-sites em produção compartilhada) e P3 falha por não fechar o requisito N:N e por corromper contagens sem levantar nenhum erro.

Ressalva à recomendação, também da refutação: **não contar `manager_groups` como "metade pronta"**. O que existe é schema + CRUD admin + RLS, com a semântica corporativa **inerte** (fan-out "intentionally ignored", invariante 1-unidade não enforced). Planejar P1 assumindo meio caminho andado superestima o crédito existente.

### A informação que mudaria a recomendação

1. **Quantas linhas de `areas` são departamento hoje, em TODOS os tenants de produção.** Se for só a linha "Finanças" da Harven (e nenhum outro tenant), o custo de reclassificar manualmente cai a quase zero e P2 volta à mesa — mas apenas se combinado com uma varredura dos 52 call-sites, porque o compilador não ajuda.
2. **Se `20260530130000_area_gestor.sql` está aplicado em produção** — DESCONHECIDO, o repo se contradiz. Se **não** estiver, a camada N:N pode ser redesenhada junto com P1 num único movimento, em vez de duas entidades concorrentes com `unit_id` homônimo apontando para tabelas diferentes.
3. **Se algum cliente exige departamento em relatório/matrícula agora.** Se sim, P1 sobe de prioridade e vem acoplado ao item B3 da ficha corretiva (`users.registration_code` + `is_third_party`), que se paga como chave de match de planilha de RH no bulk import.

---

## 5. Riscos e o que NÃO fazer

1. **Working tree compartilhado.** ~92-93 entradas em `git status --porcelain` (número oscila, outras frentes ativas), de outras frentes (Jornada, engagement, meu-plano). **NÃO** rodar `git add -A`, **NÃO** rodar `git stash`, **NÃO** tocar arquivo fora da lista dos passos §2. Qualquer commit deve ser por path explícito.
2. **Push é autoridade exclusiva de @devops.** `git push`, `gh pr create` e `gh pr merge` são **proibidos** nesta frente. Também **não** rodar migrations: o Supabase apontado pelo `.env.local` **é produção** (Cory/Argos).
3. **Banco é produção → Fase 1 tem zero migration.** Se algum passo parecer exigir `ALTER TABLE`, ele saiu do escopo da Fase 1 e vira story.
4. **NÃO** criar route group novo para `/configuracoes`: colide com a rota existente (dois `page.tsx` no mesmo path = build quebrado) e obriga a replicar 6 providers + Header + CSS de tenant.
5. **NÃO** assumir "hub aditivo" como equivalente a "não remover itens". Para 2 das 7 seções prometidas é preciso **adicionar** nav (Auditoria só existe para `super_admin`; Plano & Cobrança não tem nav nenhuma), e para 3 delas (API Keys, Integrações, Webhooks) o módulo `integrations` está **OFF** no tenant — não há acesso a preservar.
6. **NÃO** orfanar `/admin/settings`. A aba Autenticação/SSO é funcional e não sobe no hub na Fase 1 (é `plataforma-seguranca`, Em breve). Sem o item do Passo 5.4, a capacidade fica inalcançável por navegação.
7. **NÃO** redirecionar as rotas antigas na Fase 1: revoga acesso de `manager` (areas, job-roles) e `instructor` (job-roles), que os guards de página liberam hoje.
8. **NÃO** reimplementar tela. Extrair loader e reusar componente. Duas implementações da mesma seção divergem em semanas.
9. **Bug herdado, não introduzido, mas registrar:** a porta do hub é **invisível para `super_admin` puro**. `navKeysForContext` devolve **uma única chave** e dá precedência a `super_admin`, e `buildNavigation` só empilha `mod.nav[key]` — logo super_admin nunca vê os itens da chave `admin` (não vê `/admin/settings` hoje, não verá `/configuracoes` depois). O middleware/layout admitem super_admin na rota; o link é que não existe.
10. **Sombra de teste divergente:** `courses/__tests__/role-permissions.test.ts` reimplementa a lista de bloqueio do instrutor como array literal (já divergente do middleware: falta `/admin/audit`). Não confiar nela como prova de gating.
11. **DESCONHECIDO, precisa checar com o dono:** (a) se a fila untracked de CFG-0.1/CFG-0.2 entra no branch do hub; (b) se `20260530130000` está aplicado em produção; (c) o documento formal com as 4 decisões do dono não foi localizado em `.maestri/handoffs/` — elas estão registradas apenas no briefing desta frente.

---

## 6. Gates de aceite da Fase 1

Comandos literais. A Fase 1 só está pronta quando **todos** passam. Rodar de `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`.

**G1 — Tipos limpos (baseline era `exit=0`, saída vazia):**
```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
```
Esperado: nenhuma linha de erro, `exit=0`.

**G2 — Teste de nav verde (baseline era 2 failed | 12 passed):**
```bash
cd packages/shared && npx vitest run src/__tests__/registry-nav.test.ts 2>&1 | tail -4
```
Esperado: `Tests  14 passed (14)` (ou mais, com as asserções novas de G3).

**G3 — Asserções novas no guard de regressão de nav** (`packages/shared/src/__tests__/registry-nav.test.ts`, bloco `"buildNavigation — admin keys are untouched (regression guard)"`, hoje em `:165-176`; o helper `hrefs()` já existe em `:64-68`):
```ts
expect(s).toContain("Administração")
expect(l).toContain("Configurações")
expect(hrefs(nav)).toContain("/configuracoes")
expect(l).not.toContain("Usuários")
expect(l).not.toContain("Cargos")
expect(hrefs(nav)).not.toContain("/admin/areas")        // dup do módulo units removida
expect(hrefs(nav)).toContain("/admin/settings")          // aba Autenticação NÃO orfanada
expect(hrefs(nav)).toContain("/admin/audit")             // aditividade p/ admin de tenant
expect(hrefs(nav)).toContain("/admin/plans")             // aditividade p/ admin de tenant
expect(s).not.toContain("Gestão do Time")
```
```bash
cd packages/shared && npx vitest run src/__tests__/registry-nav.test.ts 2>&1 | tail -4
```

**G4 — Estrutura do hub (16 itens, 4 grupos, 5 vivos, 11 bloqueados):**
```bash
find "apps/web/src/app/(platform)/configuracoes" -name page.tsx | wc -l          # esperado: 6
grep -c 'href="/configuracoes/' "apps/web/src/app/(platform)/configuracoes/_components/settings-hub-nav.tsx"   # esperado: 5
grep -c 'Em breve' "apps/web/src/app/(platform)/configuracoes/_components/settings-hub-nav.tsx"                # esperado: 11
grep -cE 'ORGANIZAÇÃO|PESSOAS|PLATAFORMA|AVANÇADO' "apps/web/src/app/(platform)/configuracoes/_components/settings-hub-nav.tsx"  # esperado: 4
```

**G5 — Rota pessoal movida, zero link órfão:**
```bash
ls "apps/web/src/app/(platform)/preferencias/"                                   # esperado: loading.tsx  page.tsx
test ! -e "apps/web/src/app/(platform)/configuracoes/page.tsx.orig" && echo ok
grep -rn '"/configuracoes"' apps/web/src/components/layout/header.tsx apps/web/src/components/studio/studio-header.tsx
# esperado: nenhum hit (ambos apontam para /preferencias)
```

**G6 — Guard presente no middleware e no layout:**
```bash
grep -n '"/configuracoes"' apps/web/src/middleware.ts                            # esperado: 2 hits
grep -n 'effectiveHats' apps/web/src/middleware.ts | head -5
grep -n 'hasAnyRole' "apps/web/src/app/(platform)/configuracoes/layout.tsx"      # esperado: 1 hit
```

**G7 — Rota respondendo e negando sem sessão** (com `npm run dev` rodando em `:3000`):
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/configuracoes
# esperado: 307 http://localhost:3000/login   (rota agora é protegida)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/preferencias
# esperado: 200
```

**G8 — Gating negando não-admin (E2E):** o harness Playwright existe (`playwright.config.ts`, `tests/e2e/helpers/auth.ts`), mas `loginAs` cobre **apenas** `student | manager | admin`. Gate mecânico possível hoje, com um spec novo `tests/e2e/settings-hub-gating.spec.ts`:
```bash
npx playwright test tests/e2e/settings-hub-gating.spec.ts
```
Asserções: `loginAs(page,"student")` → `page.goto("/configuracoes")` termina em `/dashboard`; `loginAs(page,"manager")` → idem; `loginAs(page,"admin")` → `/configuracoes/organizacao` responde e a sidebar mostra 5 itens clicáveis + 11 com "Em breve".
**Negação de `instructor` não é automatizável sem estender `loginAs` com credencial de instrutor** (DESCONHECIDO, precisa checar se existe usuário instrutor no seed de teste). Até lá, gate manual: logar como instrutor, abrir `/configuracoes`, confirmar redirect para `/dashboard`, e confirmar que `/admin/job-roles` **continua** acessível (nenhuma revogação).

**G9 — Nenhum arquivo fora do escopo tocado:**
```bash
git status --porcelain | wc -l
# esperado: baseline medido no Passo 0 + apenas os arquivos listados nos passos §2
git status --porcelain | grep -vE 'jornada|engagement|meu-plano' | sort
```
