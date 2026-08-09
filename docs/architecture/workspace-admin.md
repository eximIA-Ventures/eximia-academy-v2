# Arquitetura: o 3º Workspace (Mundo do Admin)

> **Status:** Plano executável (arquitetura, não implementação) · **Autor:** @architect (Aria)
> **Resolve:** D2 de `docs/stories/workspace-separation.story.md:29` ("lugar do admin = PENDENTE").
> **Branch alvo:** `deploy/cory` · **Repo:** `eximia-academy-v2`
> **Doutrina que continua valendo integralmente:** `docs/stories/workspace-separation.story.md`
> (regras duras 1 a 5, linhas 36-41; D1 linha 28; caso canônico Rinaldo, linhas 23-24).
>
> **Status de execução (2026-07-25, rodada 6 — higiene documental):** este plano foi
> IMPLEMENTADO em 5 rodadas; a execução e as auditorias estão em `RESULT-workspace-admin.md`.
> **Convenção de leitura:** todo bloco marcado `[HISTÓRICO]` descreve o estado ANTES da
> implementação (ou um defeito já corrigido) e NÃO vale como retrato do código de hoje; o resto
> descreve o estado atual. Toda âncora `arquivo:linha` foi reconferida por `sed -n '<N>p'` contra
> a árvore de trabalho nesta rodada — as reancoradas na rodada 4 haviam se deslocado de novo com
> as edições da rodada 5. O que ficou por fazer está em **§Estado final e arestas conhecidas**.

## 0. As 4 restrições do dono (entrada, não opção)

| # | Restrição (Hugo) | Consequência arquitetural |
|:--|:---|:---|
| **W1** | Admin vira o 3º workspace; o hub `admin/configuracoes/` pertence SÓ a ele | `WorkspaceId` ganha `"admin"`; nav administrativa sai do shell Padrão |
| **W2** | Home do mundo admin = PAINEL administrativo | `/admin` ganha `page.tsx` renderizando `AdminDashboardPage` (sem duplicar o componente) |
| **W3** | Escopo = SUPERSET do que o admin vê hoje | mundo admin herda a chave de nav `admin` INTEIRA do registry (conteúdo + administração + sistema + integrações) |
| **W4** | Admin puro tem SEMPRE as duas portas (admin + Padrão) | `accessibleWorkspaces` de um admin nunca tem tamanho 1 ⇒ admin SEMPRE passa pelo picker (D1) |

Invariante herdada que W3 tensiona e esta arquitetura preserva: **um mundo nunca contém o
outro**. W3 diz que o mundo admin é grande (contém cursos, analytics, trilhas), não que o mundo
Padrão continua contendo administração. As duas coisas coexistem porque a nav passa a seguir o
**workspace ativo**, não o chapéu (§c).

---

## a) O núcleo do resolver: 2 mundos → 3

### a.1 `apps/web/src/lib/workspace-context.ts:3` e `:6`

**[HISTÓRICO — antes da implementação]** era assim:

```
apps/web/src/lib/workspace-context.ts:3  export type WorkspaceId = "studio" | "standard"
apps/web/src/lib/workspace-context.ts:6  const VALID: readonly WorkspaceId[] = ["studio", "standard"]
```

Diff conceitual (2 linhas, aditivo puro) — **hoje APLICADO**, `sed -n '3p;6p'` devolve exatamente
as duas linhas abaixo:

```ts
export type WorkspaceId = "studio" | "standard" | "admin"
const VALID: readonly WorkspaceId[] = ["studio", "standard", "admin"]
```

`getActiveWorkspace` (`:9-12`), `setActiveWorkspace` (`:16-24`) e `clearActiveWorkspace`
(`:26-29`) NÃO mudam: validam forma contra `VALID` e o cookie continua efêmero (sem `maxAge`),
como manda AC2.1 da doutrina.

### a.2 `accessibleWorkspaces` — `apps/web/src/lib/workspace-resolver.ts:11-30`

**[HISTÓRICO — antes da implementação]** `instructor → studio`; `student|manager|leader →
standard`; piso defensivo `["standard"]`, sem `"admin"`.
O comentário do JSDoc (`:4-10`) cravou que **a ordem é contrato** ("Order is stable (studio first)
so single-access resolution is deterministic"), porque `out[0]` é consumido em
`middleware.ts:409` (`workspaceHomeRoute(ws[0])`) e em `app/workspace/page.tsx:19`.

Diff conceitual — **hoje APLICADO** (`:13`, `:20`, `:28`):

```ts
export function accessibleWorkspaces(roles: Role[]): WorkspaceId[] {
  const out: WorkspaceId[] = []
  const isAdminTier = roles.includes("admin") || roles.includes("super_admin")
  if (roles.includes("instructor")) out.push("studio")
  // W4: o admin-tier SEMPRE mantém a porta do Padrão (ver o produto como o cliente vê).
  if (
    roles.includes("student") || roles.includes("manager") || roles.includes("leader") ||
    isAdminTier
  ) out.push("standard")
  if (out.length === 0) out.push("standard")
  // "admin" entra POR ÚLTIMO de propósito: nenhum out[0] existente muda de valor,
  // então a resolução de acesso ÚNICO (middleware:409, workspace/page.tsx:19)
  // continua byte-idêntica para todas as combinações que já existiam.
  if (isAdminTier) out.push("admin")
  return out
}
```

**Por que `admin` no fim e não no começo:** inserir no início mudaria `out[0]` de um
`admin+instructor` de `"studio"` para `"admin"`. Como todo admin é multi-acesso por W4, esse
`out[0]` nunca é usado por ele; mas o array também alimenta o teste de ordem existente
(`apps/web/src/lib/__tests__/workspace-resolver.test.ts:34`, "ordem estável: studio primeiro") e
o custo de mexer é maior que o ganho. Anexar é estritamente aditivo.
A ordem dos CARTÕES do picker não depende disto: `app/workspace/page.tsx:22-28` passa flags
booleanas (`canStudio`, `canStandard`, e hoje também `canAdmin`/`isSuperAdmin`), não o array.

**Efeito colateral desejado (W4), hoje EM VIGOR:** `accessibleWorkspaces(["admin"])` passou de
`["standard"]` (via piso defensivo, hoje `:23`) para `["standard","admin"]` ⇒ `length > 1` ⇒ o
admin puro **vê o picker no login** (`middleware.ts:406-407`) e **vê a pílula de troca** no header
(`(platform)/layout.tsx:304`, `canSwitchWorkspace`; no shell admin, `:180`). Isso é a mudança de
comportamento intencional de W1/W4.

> **Divergência confirmada na execução (RESULT §4.1):** a frase "estritamente aditivo" acima
> subestimou o impacto no teste. `workspace-resolver.test.ts` assertava `toEqual(["standard"])`
> para `["admin"]`/`["super_admin"]` e QUEBROU — foi reescrito de propósito. O teste de ordem
> (`:34`) seguiu verde, como previsto.

### a.3 `canAccessWorkspace` — `workspace-resolver.ts:32-35`

**Sem mudança.** Deriva de `accessibleWorkspaces`, então já passa a cobrir `"admin"` de graça.
Continua sendo o fail-closed de `switchWorkspace`
(`app/(platform)/workspace/actions.ts:17-20`).

### a.4 `workspaceHomeRoute` — `workspace-resolver.ts:37-44`

**[HISTÓRICO]** era o ternário `studio ? "/instructor" : "/dashboard"`. Diff conceitual, hoje aplicado em `:42`:

```ts
export function workspaceHomeRoute(ws: WorkspaceId): string {
  if (ws === "studio") return "/instructor"
  if (ws === "admin") return "/admin"   // W2: a home do mundo admin é o painel
  return "/dashboard"
}
```

### a.5 `resolvePlatformShell` — `workspace-resolver.ts:61-71`

**[HISTÓRICO]** decidia entre `studio` e `standard` pelo workspace ativo + chapéu real (fail-closed).
Diff conceitual (mesmo formato, terceiro ramo), hoje aplicado em `:68-69`:

```ts
export function resolvePlatformShell(
  activeWorkspace: WorkspaceId | null,
  roles: Role[],
): WorkspaceId {
  if (activeWorkspace === "studio" && roles.includes("instructor")) return "studio"
  if (
    activeWorkspace === "admin" &&
    (roles.includes("admin") || roles.includes("super_admin"))
  ) return "admin"
  return "standard"
}
```

Um cookie `x-active-workspace=admin` forjado por quem não tem o chapéu resolve para o shell
padrão — mesma disciplina do ramo studio (`:65`) e do `canAccessWorkspace`.

### a.6 `canAuthorCourses` — `workspace-resolver.ts:73-82`

**NÃO MUDA, e isso é deliberado.** Hoje exige `studio + instructor`. Um admin sem chapéu de
instrutor **não vê autoria em `/courses` hoje**, então mantê-lo assim não perde nada (W3 fala do
que o admin JÁ alcança). Registrado aqui para ninguém "melhorar" isso de passagem e abrir
autoria para admin sem decisão do dono.

---

## b) A home do mundo admin (`/admin`) e o destino de `/dashboard`

### b.1 Estado verificado

- **[HISTÓRICO]** `apps/web/src/app/(platform)/admin/` tinha 14 subdiretórios (api-keys, areas,
  audit, biblioteca, configuracoes, integrations, job-roles, manager-groups, notifications, plans,
  settings, tenants, users, webhooks) e **nenhum `page.tsx`** — a rota `/admin` estava livre.
  **Hoje o `page.tsx` existe** (41 linhas, `wc -l`), ao lado dos mesmos 14 diretórios.
- O painel administrativo existe em
  `apps/web/src/app/(platform)/dashboard/_components/admin-dashboard-page.tsx:25-30`
  (`AdminDashboardPage({ supabase, role, tenantId, fullName })`, server component que busca os
  próprios dados).
- Quem escolhe: `dashboard/page.tsx:50` (`resolveDashboardKind`) e o `switch` em `:73-124`;
  o ramo `case "admin"` (hoje `:114-123`) resolve o tenant (service client quando
  `profile.tenant_id` é nulo) ANTES de renderizar o componente — **[HISTÓRICO]** essa resolução
  vivia inline aqui e hoje vive no slot (§b.2). `case "super-admin"` (hoje `:111`) renderiza
  `SuperAdminDashboardPage`.

### b.2 Como `/admin` renderiza sem duplicar o componente

Extrair o miolo do `case "admin"` para um **slot server component** novo, e passar os dois pontos
de entrada a consumi-lo. **FEITO:** `admin-dashboard-slot.tsx` (46 linhas, `wc -l`) e
`dashboard/page.tsx:114-123` já consomem o slot.

`apps/web/src/app/(platform)/dashboard/_components/admin-dashboard-slot.tsx` (novo)

```tsx
/** Resolve tenant (service client quando o admin é global) e renderiza o painel.
 *  Único lugar onde essa resolução vive: /dashboard e /admin consomem o MESMO slot. */
export async function AdminDashboardSlot({ profile, supabase }: Props) {
  // corpo idêntico ao antigo miolo do case "admin" (hoje o slot é a única cópia)
}
```

- `dashboard/page.tsx:114-123` → `return <AdminDashboardSlot ... />` (comportamento idêntico).
- `app/(platform)/admin/page.tsx` (criado, 41 linhas):

```tsx
export default async function AdminHomePage() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) redirect("/login")
  // Guard por CHAPÉU real (regra dura 3), espelhando configuracoes/layout.tsx:23.
  if (!hasAnyRole({ roles }, ["admin", "super_admin"])) redirect("/dashboard")
  if (hasRole({ roles }, "super_admin"))
    return <SuperAdminDashboardPage fullName={profile.full_name} />
  return <AdminDashboardSlot profile={profile} supabase={supabase} />
}
```

Zero duplicação de componente; a única coisa "duplicada" é a chamada, que é o ponto.

### b.3 O que acontece com o admin que hoje cai em `/dashboard` — DECISÃO: continua funcionando, **sem redirect**

`/dashboard` **não** ganha redirect para `/admin`. Justificativa, em ordem de peso:

1. **W4 morreria com o redirect.** A porta do Padrão para o admin é justamente `/dashboard`:
   `middleware.ts:385-386` seta `x-active-workspace=standard` quando o path começa com
   `/dashboard`, e `workspaceHomeRoute("standard")` aponta para lá. Um redirect
   `/dashboard → /admin` devolveria o admin ao mundo admin no instante em que ele tentasse
   entrar no Padrão pelo picker — a segunda porta viraria decoração.
2. **Regra dura 1 da doutrina** (`workspace-separation.story.md:36`): URLs públicas não mudam.
3. **Nada se perde** (exigência explícita de W4): o painel administrativo continua acessível nos
   dois endereços, um por mundo. Não é "URL duplicada por desleixo", é a mesma tela vista de dois
   mundos — exatamente como `/courses` hoje é vista do Estúdio e do Padrão
   (ver o JSDoc de `resolvePlatformShell`, `workspace-resolver.ts:46-60`).

**Artefato conhecido e aceito nesta fase:** um admin no mundo Padrão, em `/dashboard`, continua
recebendo o **conteúdo** do painel admin (porque `resolveDashboardKind`
(`dashboard/_components/resolve-dashboard-kind.ts:66`) resolve por precedência de chapéu), mas
com a **nav de aluno/gestor** (§c/§e). É o que ele vê hoje, então não há regressão; é
inconsistente, sim. O conserto (tornar `resolveDashboardKind` ciente do workspace ativo) é
FOLLOW-UP, não desta story, porque mexe num resolver com suíte própria
(`dashboard/_components/__tests__/resolve-dashboard-kind.test.ts`) e afeta o mundo Padrão de
gestores. Registrado como pergunta em aberto ao dono (§k).

---

## c) O eixo da navegação — a mudança MÍNIMA

### c.1 Como é hoje (verificado)

- **[HISTÓRICO]** `navKeysForContext(navCtx)` devolvia **UMA** chave, escolhida por
  `navRoleForContext` (hoje `:428-441`, precedência do banco) e filtrada por `ADMIN_NAV_KEYS`
  (hoje `:443`), que exige o chapéu real para chaves admin-tier (hoje `:509`).
  **Hoje (`packages/shared/src/modules/registry.ts:455-511`) ela devolve UMA OU DUAS chaves:** no
  mundo admin, o chapéu `super_admin` recebe `["admin", "super_admin"]` (`:486`), correção da
  rodada 5 — ver §d.3.
- `buildNavigation` (hoje `:537-558`) já iterava `for (const key of navKeys)`, ou seja, **a
  estrutura já suportava N chaves**; hoje ela também deduplica por href (rodada 5).
- Consumo: `apps/web/src/lib/navigation.ts:106` → `apps/web/src/components/layout/sidebar.tsx:106`
  (`getNavigation(enabledIds, { context, roles, workspace: "standard" })`).
- O Estúdio **não usa o registry**: `components/studio/studio-sidebar.tsx:30-37` tem
  `STUDIO_NAV` fixo, com o comentário `:28-29` explicando que o registry é o mundo padrão.

### c.2 A proposta: um campo opcional `workspace` no `NavContext`

Por que não copiar o Estúdio (nav hardcoded): a nav do Estúdio são 6 itens fixos, sem dependência
de módulo. A nav administrativa **depende dos módulos habilitados do tenant** (`integrations` →
API Keys/Webhooks; `biblioteca` → Gerenciar Livros; `course-designer`; `assessments`). Hardcodar
o mundo admin quebraria o `ModuleProvider`. Então: **casca à moda do Estúdio (§d), itens vindos do
registry**.

Diff conceitual em `registry.ts`:

```ts
// hoje :403-412
export interface NavContext {
  roles: Role[]
  context: NavContextShape
  /** Workspace ATIVO (eixo de 3 mundos). OPCIONAL: ausente => comportamento legado,
   *  o que mantém os 16 testes atuais verdes sem reescrita. */
  workspace?: "standard" | "studio" | "admin"
}

// dentro de navKeysForContext, ANTES do bloco legado (hoje :506-510):
export function navKeysForContext(navCtx: NavContext): Role[] {
  const viewRole = navRoleForContext(navCtx)

  // MUNDO ADMIN: administração pertence a ele. A chave vem do chapéu real,
  // fail-closed (sem chapéu admin-tier, nav vazia — o shell nem deveria renderizar).
  if (navCtx.workspace === "admin") {
    // [HISTÓRICO] o plano previa `return ["super_admin"]` aqui. IMPLEMENTADO ASSIM,
    // e CORRIGIDO na rodada 5: o hub `/admin/configuracoes` só existe na chave
    // `admin`, então o super_admin entrava no próprio mundo SEM Configurações.
    // Hoje (registry.ts:486) a linha é `return ["admin", "super_admin"]`.
    if (navCtx.roles.includes("super_admin")) return ["admin", "super_admin"]
    if (navCtx.roles.includes("admin")) return ["admin"]
    return []
  }

  // MUNDO PADRÃO: nunca emite chave admin-tier (um mundo não contém o outro).
  // O admin no Padrão vê o mundo do cliente: gestor se tiver o chapéu, senão aluno.
  if (navCtx.workspace === "standard" && ADMIN_NAV_KEYS.has(viewRole)) {
    return navCtx.roles.includes("manager") ? ["manager"] : ["student"]
  }

  if (viewRole === "instructor") return ["student"]           // hoje :506, inalterado
  if (!ADMIN_NAV_KEYS.has(viewRole)) return [viewRole]        // hoje :508, inalterado
  return navCtx.roles.includes(viewRole) ? [viewRole] : ["manager"]   // hoje :510, inalterado
}
```

Mais dois ajustes de href dentro do registry (ambos dentro de chaves que, após o gate acima, só
renderizam no mundo admin — logo não afetam o Padrão):

- `registry.ts:135` — `{ label: "Principal", href: "/dashboard" }` (chave `admin`) → `href: "/admin"`.
- `registry.ts:148` — `{ label: "Dashboard", href: "/dashboard" }` (chave `super_admin`) → `href: "/admin"`.

E a passagem do eixo no consumidor:

- `apps/web/src/lib/navigation.ts:106` — assinatura inalterada (o campo viaja dentro de `navCtx`).
- `apps/web/src/components/layout/sidebar.tsx:25` e `:106` — a `Sidebar` do Padrão declara
  `workspace: "standard"` na chamada; quem a monta é `(platform)/layout.tsx:294`, que já tem o
  shell resolvido em `:68`.

### c.3 Impacto exato no teste existente (`packages/shared/src/__tests__/registry-nav.test.ts`)

> **[HISTÓRICO — número errado por 4 rodadas]** este cabeçalho dizia "hoje **16 passed**". O HEAD
> tinha **14** (medido rodando a versão do `HEAD`, RESULT §6). Hoje, já estendido, o arquivo tem
> **33 passed** (`vitest run` — saída em RESULT §6). A tabela abaixo continua valendo para os
> casos que existiam antes: nenhum deles quebrou.

O teste constrói o contexto com `ctx(roles, context)` (hoje `:28`), que **não passa `workspace`**.
Com o campo opcional e os dois gates condicionados a `workspace === "admin" | "standard"`, todos
os 16 casos caem no caminho legado:

| Teste | Linha | Passa? | Porquê |
|:---|:--|:--|:---|
| `navKeysForContext(["manager","student"], team) === ["manager"]` | :101 | ✅ | `workspace` undefined ⇒ caminho legado |
| `navKeysForContext(["admin","student"], organization) === ["admin"]` | :105 | ✅ | idem |
| `navKeysForContext(["instructor"], team) === ["student"]` | :109 | ✅ | ramo hoje `:506`, intocado |
| bloco "personal é PURE learner" | :118-135 | ✅ | chave `student` intocada |
| bloco "team é PURE manager" (labels exatos) | :137-163 | ✅ | chave `manager` intocada |
| bloco "organization mirrors team" | :165-180 | ✅ | idem |
| bloco "admin keys are untouched (regression guard)" | :182-221 | ✅ | asserta seções (`Administração`), `Configurações`, `/admin/configuracoes`, `/admin/settings?tab=auth`, `/admin/audit`, `/admin/plans` e as ausências (`Usuários`, `Cargos`, `/admin/areas`). **Nenhuma assertion sobre "Principal" ou "/dashboard" na chave admin** — por isso o retarget de `:135`/`:140` não quebra nada. |

**Quebraria** se alguém, em vez do campo opcional, tornasse `workspace` obrigatório (erro de tipo
em todos os `ctx(...)` do teste) ou removesse itens da chave `admin` do registry (o bloco
`:182-221` cai). Ambas as coisas estão proibidas neste plano.

Testes NOVOS obrigatórios para o eixo (§j) — **todos escritos** (`registry-nav.test.ts:232+`):
mundo admin emite a chave admin; mundo padrão com chapéu admin NÃO emite `Administração`; sem
chapéu admin-tier no mundo admin ⇒ `[]`. O caso do super_admin foi escrito como
`["super_admin"]` e **corrigido na rodada 5** para `["admin", "super_admin"]` (bloco
`:379+`, "a porta do DONO DO PRODUTO").

---

## d) O shell do mundo admin

### d.1 Onde ele mora — reusar o precedente, não inventar rota

O Estúdio tem route group próprio (`app/(studio)/layout.tsx`), MAS as páginas administrativas
já existem sob `app/(platform)/admin/*` (14 diretórios). Mover tudo para um `(admin)/` seria
~14 diretórios remexidos numa árvore que já carrega ~100 arquivos de outras frentes — risco alto,
ganho zero de URL (route group não muda URL).

O projeto **já resolveu esse mesmo problema**: `(platform)/layout.tsx:68-113` escolhe o shell do
Estúdio DENTRO do route group `(platform)` via `resolvePlatformShell`, exatamente porque páginas
compartilhadas moram lá. Logo: **terceiro ramo no mesmo lugar**.

```tsx
// (platform)/layout.tsx — implementado em :149-196, com o workspace ativo lido em :67
// e o shell resolvido em :68 (o ramo do Estúdio fica logo acima, em :69)
const shell = resolvePlatformShell(activeWorkspace, roles as Role[])
if (shell === "admin") {
  return (
    <QueryProvider><ModuleProvider modules={config.modules}><BrandProvider brand={config.brand}>
      <SessionTimeoutProvider timeoutHours={sessionTimeoutHours}>
        <div className="flex h-screen bg-bg-app font-sans text-text-primary">
          <AdminSidebar roles={roles as Role[]} />
          <div className="flex flex-1 flex-col min-w-0">
            <AdminHeader firstName={firstName} fullName={profile.full_name ?? ""}
                         canSwitchWorkspace={accessibleWorkspaces(roles as Role[]).length > 1} />
            <main id="main-content" className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
          </div>
        </div>
      </SessionTimeoutProvider>
    </BrandProvider></ModuleProvider></QueryProvider>
  )
}
```

Diferença relevante frente ao ramo do Estúdio: o mundo admin **precisa** do `ModuleProvider`
(a nav vem do registry e depende de `enabledIds`, consumido em `sidebar.tsx:53` via `useModules`).
Não precisa de `ContextProvider` nem `AreaProvider` (nenhum item do mundo admin é regido por
contexto pessoal/time nem por seletor de unidade) — mesma economia que o Estúdio fez
(`(studio)/layout.tsx`, comentário "deliberadamente ENXUTO").
**~~DESCONHECIDO~~ → RESOLVIDO (passo 6, RESULT §2.4):** o `grep` por
`useArea|useContext(|useModules` sob `(platform)/admin` devolveu **zero** ocorrências (o único
toque é `admin/users/loader.ts:1`, que importa só o TIPO `AreaData`). Os dois providers ficam
de fora com segurança.

### d.2 `AdminSidebar` — a forma do Estúdio, o conteúdo do registry

Copiar a anatomia de `components/studio/studio-sidebar.tsx` (hambúrguer mobile `:121-130`,
overlay `:132-142`, focus trap `:70-110`, `SidebarHeader/Content/Footer`, rodapé "Powered by
exímIA" `:206-228`) trocando três coisas — **FEITO** em `components/admin/admin-sidebar.tsx`
(307 linhas, `wc -l`):

1. **Badge** (`StudioBadge`, `:39-63`) → `AdminBadge`: mesmo lockup de marca, script Caveat com o
   acento do mundo admin (§g), texto **"Administração"**.
2. **Itens**: em vez de `STUDIO_NAV` fixo, `getNavigation(enabledIds, { context, roles, workspace: "admin" })`,
   agrupando por `{ section }` como a `Sidebar` do Padrão já faz (`sidebar.tsx:114+`).
3. **Rodapé**: o botão do Estúdio chama `switchWorkspace("standard")` direto (`studio-sidebar.tsx:113-117`).
   No mundo admin isso é errado: um `admin + instructor` tem **3** portas. O rodapé do admin deve
   ser `<Link href="/workspace">` (o picker), como faz `WorkspaceSwitchButton`.
   *(Follow-up opcional, fora do escopo: alinhar o rodapé do Estúdio à mesma regra.)*

`AdminHeader`: cópia enxuta de `components/studio/studio-header.tsx` **sem** "Ver como Aluno"
(D3a é do instrutor), com `<WorkspaceSwitchButton current="Administração" world="admin" .../>`
— o que exigiu estender `type World` e o mapa `ACCENT` em
`components/layout/workspace-switch-button.tsx:27` e `:44-46` com a entrada `admin`. **FEITO**
(`components/admin/admin-header.tsx`, 127 linhas), e o header ganhou também o `TenantSelector`
(furo 2 da rodada 2, `admin-header.tsx:61-65`) — sem ele o super_admin ficava sem seletor de
empresa dentro do mundo.

### d.3 A nav final do mundo admin, item a item (W3 = superset)

Chave `admin` do registry, com todos os módulos ligados, na ordem de `MODULE_IDS`
(`registry.ts:5-15`: academy, biblioteca, analytics, admin, assessments, community,
course-designer, units, integrations). Âncoras reconferidas nesta rodada por `sed -n '<N>p'`:

| # | Seção | Item | href | Origem |
|:--|:---|:---|:---|:---|
| 1 | **Conteúdo** | (cabeçalho) | — | `registry.ts:134` |
| 2 | Conteúdo | Principal | `/admin` *(retarget de `/dashboard`)* | `:135` |
| 3 | Conteúdo | Cursos e Trilhas | `/courses` | `:136` |
| 4 | Conteúdo | Trilhas de Aprendizagem | `/trails` | `:137` |
| 5 | Conteúdo | Gerenciar Livros | `/admin/biblioteca` | `:296` (módulo `biblioteca`) |
| 6 | Conteúdo | Analytics | `/analytics` | `:188` (módulo `analytics`) |
| 7 | **Administração** | (cabeçalho) | — | `:225` |
| 8 | Administração | Engajamento | `/admin/notifications` | `:226` |
| 9 | Administração | Grupos de Gestor | `/admin/manager-groups` | `:227` |
| 10 | **Sistema** | (cabeçalho) | — | `:228` |
| 11 | Sistema | Configurações *(o hub, W1)* | `/admin/configuracoes` | `:229` |
| 12 | Sistema | Autenticação | `/admin/settings?tab=auth` | `:236` |
| 13 | Sistema | Auditoria | `/admin/audit` | `:240` |
| 14 | Sistema | Plano & Cobrança | `/admin/plans` | `:241` |
| 15 | Sistema* | Avaliações | `/assessments` | `:280` (módulo `assessments`) |
| 16 | Sistema* | Course Designer | `/courses/new` | `:323` (módulo `course-designer`) |
| 17 | Sistema* | API Keys | `/admin/api-keys` | `:355` (módulo `integrations`) |
| 18 | Sistema* | Integrações | `/admin/integrations` | `:356` |
| 19 | Sistema* | Webhooks | `/admin/webhooks` | `:357` |

**Para `super_admin` — CORRIGIDO na rodada 5, leia com atenção.** O plano previa que o dono do
produto recebesse SÓ a chave `super_admin` (Dashboard, Empresas, Integracoes, Auditoria). Isso foi
implementado assim e estava ERRADO: o hub `/admin/configuracoes` existe apenas na chave `admin`,
então o super_admin entrava no próprio mundo **sem a porta do hub** — quebrando W3 (superset).
**Hoje** `navKeysForContext` devolve `["admin", "super_admin"]` no mundo admin (`registry.ts:486`),
e o super_admin vê **a tabela inteira acima** (itens 1-19, incluindo Configurações) MAIS os
exclusivos dele: **Empresas** `/admin/tenants` (`:252`, migrada da chave `super_admin` do módulo
`academy` para a do módulo `admin`, senão cairia dentro da seção "Conteúdo"), Integracoes
`/admin/integrations` (`:253`) e Auditoria `/admin/audit` (`:254`); "Dashboard" → `/admin` (`:148`)
é absorvido pela **deduplicação por href** de `buildNavigation` (primeira ocorrência vence), que
preserva ordem e cabeçalhos de seção. Provado item a item em `registry-nav.test.ts:379+`.

**Artefato cosmético honesto (itens 15-19, marcados `Sistema*`):** `buildNavigation` concatena na
ordem dos módulos e não abre seção nova, então Avaliações, Course Designer e as integrações caem
visualmente dentro de "Sistema". Correção mínima, se o dono quiser: inserir
`{ section: "Ferramentas" }` no topo de `assessments.nav.admin` (`:280`) — aditivo, e o teste
`:182-221` só asserta *presença* de "Administração" e *ausência* de "Gestão do Time", então
continua verde. **NÃO foi feito** (segue em aberto, §Estado final): é polimento, não bloqueador.

---

## e) O que SAI do shell Padrão (e por que nada fica inalcançável)

Com o gate `workspace === "standard"` de §c.2, um usuário com chapéu `admin`/`super_admin` no
mundo Padrão passa a renderizar a chave `manager` (se tiver o chapéu) ou `student`. Saem do
Padrão, portanto, **todos os itens das chaves `admin` e `super_admin`** listados em §d.3 — em
especial as seções "Administração" e "Sistema" e o hub `/admin/configuracoes` (W1).

Prova de que nada fica órfão:

| Item que saiu | Onde está agora | Como o admin chega lá |
|:---|:---|:---|
| Hub de Configurações e todo o bloco Administração/Sistema | mundo admin (§d.3) | picker `/workspace` → cartão Administração; ou pílula do header (`workspace-switch-button.tsx`), visível porque `accessibleWorkspaces().length > 1` por W4; ou deep-link `/admin/...` (§f) |
| Conteúdo (Cursos, Trilhas, Analytics, Livros) da chave admin | mundo admin (§d.3) | idem |

E por W4 a porta existe **sempre**: `accessibleWorkspaces` de qualquer admin-tier contém
`"admin"` e `"standard"`, então nunca há admin trancado fora do próprio mundo.

**Rotas NÃO tocadas na NAV (continuam vivas e liberando os mesmos papéis):** `/admin/areas`,
`/admin/job-roles`, `/admin/users` — elas liberam `manager`/`instructor` por guard de página
(comentário `registry.ts:219-223`), e nada aqui as move ou bloqueia. Os guards delas migraram do
`profile.role` para os CHAPÉUS na rodada 2 (`lib/admin-route-access.ts`), com o **conjunto
permitido de cada rota transcrito 1:1** — ninguém ganhou nem perdeu acesso.
`/admin/notifications` continua na chave `instructor` (`:154`) e `/engagement` na chave `manager`
(`:216`): o gestor e o instrutor não perdem nada.

---

## f) Middleware — as 5 costuras

Todas em `apps/web/src/middleware.ts`.

### f.1 Deep-link que seta o mundo (hoje `:370-387`)

**[HISTÓRICO]** só havia dois ramos: `/instructor → studio` (hoje `:379`) e `/dashboard → standard`
(hoje `:385`). O pseudocódigo abaixo é o do plano; **na implementação a decisão foi extraída para
funções puras** em `apps/web/src/lib/admin-world.ts` (`ADMIN_WORLD_PATHS` em `:44-55`,
`shouldEnterAdminWorld` em `:103`), e o middleware ficou com a chamada (`:381`) — não existe
harness de middleware neste repo, então a lógica testável precisa morar fora dele.

```ts
const ADMIN_WORLD_PATHS = [
  "/admin/configuracoes", "/admin/manager-groups", "/admin/settings",
  "/admin/audit", "/admin/plans", "/admin/integrations",
  "/admin/api-keys", "/admin/webhooks", "/admin/tenants", "/admin/biblioteca",
] as const
const isAdminHat = effectiveHats.some((h) => h === "admin" || h === "super_admin")
const isAdminWorldPath =
  pathname === "/admin" || ADMIN_WORLD_PATHS.some((p) => pathname.startsWith(p))

if (pathname.startsWith("/instructor") && currentWs !== "studio") { /* hoje :379, inalterado */ }
else if (isAdminHat && isAdminWorldPath && currentWs !== "admin") {
  response.cookies.set("x-active-workspace", "admin", wsCookieOpts)
}
else if (pathname.startsWith("/dashboard") && currentWs !== "standard") { /* hoje :385, inalterado */ }
```

**Duas travas explícitas, ambas necessárias:**
1. `isAdminHat` — sem ela, um instrutor abrindo `/admin/notifications` (item da nav DELE,
   `registry.ts:154`) seria jogado no mundo admin e perderia o Estúdio.
2. **Allowlist em vez de `startsWith("/admin")`** — `/admin/notifications`, `/admin/areas`,
   `/admin/job-roles` e `/admin/users` são rotas COMPARTILHADAS com instrutor/gestor. Fora da
   allowlist ⇒ não flipa.
   > **Correção factual (auditoria, rodada 3):** este item citava, como razão, um
   > `admin + instructor` no Estúdio clicando "Engajamento". Esse cenário **não existe no
   > código**: o Estúdio renderiza `components/studio/studio-sidebar.tsx`, que não tem nenhum
   > link `/admin/*`, e a chave `instructor` do registry (a única com `/admin/notifications`) é
   > inalcançável no mundo Padrão — `navKeysForContext` faz
   > `if (viewRole === "instructor") return ["student"]`. A allowlist **permanece**, como
   > conservadorismo deliberado: essas quatro rotas não são exclusivas do mundo admin
   > (`/admin/areas` abre p/ `manager`, `/admin/job-roles` p/ `manager` e `instructor`) e
   > `shouldEnterAdminWorld` flipa o cookie de mundo no mesmo request. Razão verdadeira
   > registrada em `apps/web/src/lib/admin-world.ts` (bloco de `ADMIN_WORLD_PATHS`, `:22-42`).
   >
   > **Complemento (rodada 4):** a allowlist ganhou uma TERCEIRA trava, `pageGuardAdmits` —
   > `shouldEnterAdminWorld` (`admin-world.ts:103`) só flipa o mundo se o guard de página da rota
   > também admitir a pessoa. Sem isso, um `admin` comum entrava no mundo por `/admin/tenants`
   > (rota `super_admin`-only) e era rebatido para `/dashboard`, perdendo o mundo. Rota da
   > allowlist sem entrada em `ADMIN_ROUTE_ROLES` (`/admin`, `/admin/configuracoes`) devolve
   > `true` de propósito.

### f.2 Guard fail-closed do mundo admin (hoje `:352-364`)

**[HISTÓRICO]** o guard cobria exatamente `pathname.startsWith("/admin/configuracoes")` e já usava
`effectiveHats` (correto). Mudança **mínima**, hoje aplicada em `:353`: incluir a nova home.

```ts
if (
  (pathname === "/admin" || pathname.startsWith("/admin/configuracoes")) &&
  user &&
  !effectiveHats.some((h) => h === "admin" || h === "super_admin")
) { /* fallback hoje em :363, inalterado: instrutor → /instructor, senão /dashboard */ }
```

**NÃO ampliar o guard para toda a allowlist de f.1 nesta story.** Ampliar bloquearia no
middleware rotas cujos guards de página hoje podem liberar `manager` (ex.: `/admin/settings`)
— seria regressão silenciosa. Auditoria guard-a-guard é trabalho separado (§k).
Nota de divergência já existente e **ainda de pé**: o guard de página do hub redireciona o barrado
para `/dashboard` (`admin/configuracoes/layout.tsx:23`) enquanto o middleware o devolve a
`/instructor` (`:363`); na prática o middleware chega primeiro, e quem é barrado ali não é
admin-tier — logo não há ejeção de mundo. Só registrado.

### f.3 Roteamento pós-login com 3 portas (hoje `:404-410`)

**Código inalterado.** Ele já é genérico: `accessibleWorkspaces(...)` → `length > 1` ⇒
`/workspace` (`:406-407`), senão `workspaceHomeRoute(ws[0])` (`:409`). Com §a.2 + §a.4, admin-tier
passa automaticamente a cair no picker. Essa é a prova de que a plumbing do WP2 foi bem desenhada.

**[HISTÓRICO] `app/workspace/page.tsx` tratava admin-tier como "sem workspace"** e redirecionava
(`super_admin → /admin/tenants`, `admin → /dashboard`). Com W1/W4 o admin-tier TEM workspaces.
**FEITO:** o `WORKSPACE_HATS` e o bloco de desvio foram REMOVIDOS (hoje sobra só o comentário que
explica a remoção, `:10-13`), e a guarda de acesso único ficou como piso defensivo em `:19` (que,
por W4, nunca dispara para admin).

### f.4 `blockedForInstructor` — ver §h. É a única mudança de eixo, não de mundo.

**Hoje:** o middleware chama `isBlockedForInstructor(pathname, effectiveHats)` em `:394`; a decisão
(e o inventário das 4 rotas) vive em `apps/web/src/lib/admin-world.ts:145-177`.

### f.5 Logout (`:261-263`)

**Sem mudança.** `response.cookies.delete("x-active-workspace")` apaga o cookie qualquer que seja
o valor, então `"admin"` já é coberto. (Verificado: o `if` de `:261` testa presença, não valor.)

---

## g) O 3º cartão do picker

### g.1 Acentos REAIS disponíveis (verificado, não inventado)

`apps/web/src/styles/theme.css` (bloco `@theme` de Tailwind v4, `:10`):

- `--color-cerrado-50…900` (`:14-23`) — laranja, mundo Padrão.
- `--color-studio-50…900` (`:53-62`) — navy 264, mundo Estúdio.
- `--color-accent-gold-dark | -gold | -gold-light` (`:42-44`, `#8a6a20 / #c4a040 / #d4b860`),
  documentado como "ACCENT — Gold (complementar ao Cerrado)". **3 paradas, não é escala de 10.**
- Biomas isolados: `--color-pantanal`, `--color-mata-atlantica`, `--color-caatinga`,
  `--color-amazonia`, `--color-varzea`, `--color-sertao`, `--color-caatinga-700` (`:28-37`).

**Não existe uma 3ª escala completa.** Recomendação: usar **`accent-gold`**, que é token real
(`bg-accent-gold/12`, `text-accent-gold-dark`, `dark:text-accent-gold-light` resolvem no Tailwind
v4 a partir do `@theme`, e o padrão já é usado no produto:
`trails/dashboard/trail-dashboard-client.tsx:355`, `brandbook/page.tsx:1533`).
Mapeamento no objeto `WORLDS` de `workspace-picker.tsx` (7 slots por mundo; hoje o objeto vive em
`:170-207`, com a entrada `admin` em `:197-206`) — **implementado exatamente assim**:

```ts
admin: {
  topWash:       "from-accent-gold/[0.14] to-accent-gold/0",
  hairline:      "bg-accent-gold/45",
  hoverRing:     "group-hover:ring-accent-gold/40",
  iconContainer: "bg-accent-gold/12 text-accent-gold-dark dark:text-accent-gold-light",
  eyebrow:       "text-accent-gold-dark dark:text-accent-gold-light",
  chip:          "text-accent-gold-dark ring-accent-gold/25 dark:text-accent-gold-light dark:ring-accent-gold/25",
  button:        "bg-accent-gold-dark hover:bg-accent-gold focus-visible:ring-accent-gold/50",
}
```

**Ressalva honesta:** gold (hue ≈85) é vizinho do cerrado (hue 45); os cartões Padrão e
Administração podem ler como parentes. Se UX/Hugo recusar, o plano B é **adicionar uma escala de
10 paradas `--color-admin-*` em `theme.css`** (aditivo, 1 arquivo, nenhum token existente
alterado) — mas isso é decisão de marca e **precisa do aval do dono**, não do arquiteto.

### g.2 O cartão

| Campo | Valor |
|:---|:---|
| `accent` | `"admin"` (gold) |
| `eyebrow` | **Administrar** (pareia com "Aprender" `:97` e "Criar" `:110`) |
| `title` | **Administração** |
| `subtitle` | "Configure a plataforma, as pessoas e as integrações da sua empresa." |
| `tags` | `["Admin"]` — `["Super Admin"]` quando o chapéu for `super_admin` |
| `icon` | `ShieldCheck` de `lucide-react` (já usado no repo: `trail-dashboard-client.tsx:17`) |

Mudanças de código no picker, **todas feitas**: `Props` (hoje `:9-17`) ganhou `canAdmin` (`:14`) e
`isSuperAdmin`; a união `WorkspaceTarget` (hoje `:19`) ganhou `"admin"`; `CardProps.accent` (hoje
`:157`) virou `"cerrado" | "studio" | "admin"`; `workspace/page.tsx:22-28` passa
`canAdmin={ws.includes("admin")}`.
Layout: `grid gap-5 sm:grid-cols-2` → `sm:grid-cols-2 lg:grid-cols-3` (hoje `:104`), senão o 3º
cartão fica órfão numa linha sozinho.
**O plano subdimensionou aqui (RESULT §4.3):** o corpo do cartão tinha DOIS ternários binários
(`accent === "studio" ? ... : ...`) que dariam o anel e o CTA do cerrado ao cartão de
Administração. Viraram lookup por mundo (`CARD_FOCUS_RING`, hoje `:209-213`).

---

## h) A armadilha dos dois eixos de autorização (precisa morrer nesta story)

> **[HISTÓRICO — CORRIGIDO nas rodadas 2 e 3.]** Todo o §h descreve o defeito COMO ELE ERA. Hoje o
> middleware decide por chapéus (`isBlockedForInstructor`, `middleware.ts:394`), TODOS os guards de
> página de `/admin/*` decidem por chapéus (`lib/admin-route-access.ts`, conjunto permitido de cada
> rota transcrito 1:1 do guard antigo), e `lib/api-auth/require-admin.ts` também. O que ficou
> deliberadamente fora está na **fronteira declarada** (§Estado final): 4 server actions e as rotas
> de API com gate inline.

### h.1 O achado, ancorado **[HISTÓRICO]**

- `middleware.ts:352-356` (guard do hub) usa **`effectiveHats`** — chapéus reais lidos de
  `user_roles` a cada request (`:298-306`). Eixo CERTO (regra dura 3, story `:38-39`).
- O bloco que hoje está em `middleware.ts:394` usava **`userRole`** — a coluna singular `users.role`
  (lida em `:277-282`), ainda por cima **cacheada em cookie por 5 minutos** (`:275`, `:292`).

### h.2 **[HISTÓRICO]** Como se comportava, ANTES, um usuário com chapéu `admin` e `users.role = "instructor"`

| Rota | Resultado ANTES | Resultado HOJE |
|:---|:---|:---|
| `/admin/configuracoes` | **PASSA** (tem o chapéu admin) | passa (inalterado) |
| `/admin/users`, `/admin/settings`, `/admin/api-keys`, `/admin/webhooks` | **EXPULSO para `/instructor`** | **entra** — `middleware.ts:394` decide por chapéus |
| `/admin/audit` | **EXPULSO para `/dashboard`** pelo guard da PRÓPRIA PÁGINA (`profile.role`), não pelo middleware | **entra** — `audit/page.tsx:17` usa `canOpenAdminRoute` |

> **Correção factual (auditoria rodada 2), mantida como registro:** a linha original desta tabela listava `/admin/audit`
> junto das 4 rotas do middleware. Errado: `git show HEAD:apps/web/src/middleware.ts | grep -c "admin/"`
> devolve **4**, e `/admin/audit` nunca esteve lá. Quem barrava (e barra) o instrutor na auditoria
> é o guard da página. O efeito prático era PIOR do que o descrito: `/dashboard` reescreve o cookie
> `x-active-workspace` para `standard`, então o admin-de-chapéu era EJETADO do mundo administrativo
> ao clicar num item da própria barra. Corrigido migrando os guards de página para chapéus
> (`apps/web/src/lib/admin-route-access.ts`).

Ou seja, **[HISTÓRICO]**: **o mesmo usuário era admin para o hub e instrutor para o resto do
`/admin`, no mesmo request.** É a mesma família de bug do caso canônico Rinaldo (story `:23-24`), com o sinal
invertido. E não é hipótese exótica: mesmo com o trigger `recompute_primary_role` correto, o
cache de 5 minutos (`:275`) garantia uma janela real em que um instrutor recém-promovido a admin
era barrado das rotas administrativas por um valor obsoleto.

### h.3 Opções e risco de regressão de cada uma

| Opção | Diff | Risco |
|:---|:---|:---|
| **H1 (RECOMENDADA — IMPLEMENTADA)** — "instrutor puro por CHAPÉU": `isInstructorOnly` vive hoje em `apps/web/src/lib/admin-world.ts:166-171`, consumido por `isBlockedForInstructor` (`:174-177`) e chamado no `middleware.ts:394` | 1 chamada no middleware + módulo puro testável | **Baixo.** Reproduz o comportamento de hoje em toda combinação com singular coerente (um instrutor+manager já tem `users.role="manager"` por precedência e portanto já não é bloqueado hoje). Muda o resultado **apenas** quando os dois eixos divergem — que é exatamente o bug. Excluir `manager` é obrigatório: sem isso, `instructor+manager` passaria a ser NOVAMENTE bloqueado ⇒ regressão real. |
| H2 — apagar `blockedForInstructor` e confiar nos guards de página | remove `:381-393` | **Alto.** Nenhum inventário prova que as 5 rotas têm guard de página equivalente. Exposição real. **Rejeitada.** |
| H3 — manter `userRole` e apenas somar chapéus (`userRole === "instructor" \|\| hats.includes("instructor")`) | 1 linha | **Médio-baixo em runtime, alto em dívida.** Mantém os dois eixos vivos, contra a regra dura 3. **Rejeitada.** |

### h.4 Dívida de eixo duplo que FICA (inventário, fora do escopo desta story)

- `(platform)/layout.tsx:199` — `profile.role === "student"` (gate de onboarding). **Segue no eixo singular.**
- `profile.role === "super_admin" || (profile.role === "admin" && !tenant_id)` (seletor multi-tenant) — **extraído VERBATIM** para `lib/multi-tenant-access.ts:36-38` na rodada 2 e consumido uma única vez em `(platform)/layout.tsx:123`, compartilhado pelos dois shells. **Segue no eixo singular DE PROPÓSITO** (não libera nem barra rota, só decide se um dropdown aparece), com a razão dita em `multi-tenant-access.ts:24-28` e um teste que afirma equivalência caso a caso com a expressão original (`workspace-matrix.test.ts:183-213`).
- `dashboard/page.tsx:120` — `role={profile.role}` passado a `AdminDashboardPage` (o componente tipa `"admin" | "super_admin"`, `admin-dashboard-page.tsx:21`).
- `middleware.ts:270-292` — o cookie `x-user-role` em si. **Segue.**

Cada um precisa de leitura própria antes de migrar. **~~DESCONHECIDO~~ → RESOLVIDO (rodada 2):** o
prop `role` é **morto** a jusante — `AdminDashboardPage` o desestrutura e não o usa. Por isso
`admin/page.tsx:32-36` passa o literal `"admin"` sem perda.

---

## i) Matriz de verificação — o contrato que o QA vai auditar

Estado PÓS-implementação (todos os passos de §j aplicados; a matriz virou teste executável em
`apps/web/src/lib/__tests__/workspace-matrix.test.ts`, **20 testes em runtime**). "Portas" =
cartões no picker `/workspace`. Login = `/entrar`, `/login` ou `/` com sessão viva
(`middleware.ts:404`).

| # | Chapéus (`user_roles`) | Portas no picker | Onde cai no login | `/admin` | `/admin/configuracoes` | `/instructor` | `/dashboard` |
|:--|:---|:---|:---|:---|:---|:---|:---|
| 1 | `student` | 1 — Padrão | direto `/dashboard` (sem picker) | ↪ `/dashboard` (guard f.2) | ↪ `/dashboard` (`:352`) | ↪ `/dashboard` (`:339`) | painel do aluno |
| 2 | `manager` | 1 — Padrão | direto `/dashboard` | ↪ `/dashboard` | ↪ `/dashboard` | ↪ `/dashboard` | painel de gestor (por contexto: `team`→"Meu Time", `organization`→org) |
| 3 | `instructor` | 1 — Estúdio | direto `/instructor` | ↪ `/instructor` (fallback `:363`) | ↪ `/instructor` (`:363`) | Estúdio (shell studio) | seta ws=standard e `dashboard/page.tsx:50-58` devolve para `/instructor` (staff sem matrícula) |
| 4 | `admin` (puro) | **2 — Padrão + Administração** | **`/workspace`** (picker; mudou, W4) | **home admin**: shell admin + painel administrativo | hub, dentro do shell admin | ↪ `/dashboard` (`:339`, sem chapéu instructor) | shell PADRÃO + conteúdo do painel admin, nav de aluno *(artefato §b.3)* |
| 5 | `admin` + `instructor` | **3 — Padrão + Estúdio + Administração** | `/workspace` | home admin | hub (tem o chapéu) | Estúdio | shell padrão, `resolveDashboardKind` → `admin` ⇒ painel admin |
| 6 | `super_admin` | **2 — Padrão + Administração** | `/workspace` (**antes** ia direto p/ `/admin/tenants`; o desvio foi removido) | home admin → `SuperAdminDashboardPage` | hub (`:355` aceita `super_admin`) — e desde a rodada 5 ele **também vê o item na nav**, não só pela URL | ↪ `/dashboard` | painel super-admin no shell padrão |
| 7 | **Rinaldo**: `instructor`+`manager`+`student`, `users.role` ≠ instructor | 2 — Padrão + Estúdio | `/workspace` | ↪ `/instructor` (sem chapéu admin; fallback `:363` porque tem instructor) | ↪ `/instructor` | Estúdio (o caso canônico continua passando) | shell padrão, por contexto |

Checagens extras que o QA deve rodar nas linhas 4-6 (consequência de §h):

| Cenário de eixo duplo | Antes (bug) | Depois (H1) |
|:---|:---|:---|
| chapéu `admin` + `users.role = "instructor"` abrindo `/admin/settings` | expulso para `/instructor` (bloco que hoje está em `:394`) | **entra** (chapéu manda) |
| chapéu `admin` + `users.role = "instructor"` abrindo `/admin/audit` | expulso para `/dashboard` pelo guard de página | **entra** (guard de página migrado para chapéus, rodada 2) |
| chapéu `instructor` puro abrindo `/admin/audit` | barrado pelo guard de página | barrado pelo guard de página (inalterado) |
| chapéu `instructor` + `manager` abrindo `/admin/settings` | não bloqueado (singular = manager) | não bloqueado (inalterado) |

E a checagem de fronteira do mundo (consequência de §f.1):

| Cenário | Esperado |
|:---|:---|
| deep-link para `/admin/notifications` com chapéu admin | **não flipa o mundo** (rota fora da allowlist). *Correção rodada 3: esta linha dizia "admin+instructor no Estúdio clica 'Engajamento'"; esse caminho não existe — ver a nota em §f.1.* |
| `admin+instructor` no Estúdio abre `/admin/configuracoes` por deep-link | atravessa para o mundo admin (travessia deliberada) |
| cookie `x-active-workspace=admin` forjado por um `manager` | shell padrão (`resolvePlatformShell` fail-closed) e `/admin` barrado |

---

## j) Ordem de implementação (cada passo com comando literal)

> Baseline que NÃO pode regredir: `npx tsc --noEmit -p apps/web/tsconfig.json` → exit 0 e saída
> vazia; nav test → **`14 passed`** (o "16" das rodadas 1-4 era memória, não medição: a versão do
> `HEAD` foi extraída e RODADA, RESULT §6); `next build` verde com 128 rotas.
> **Estado hoje (rodada 6, regerado por comando):** `tsc` exit=0 e saída vazia; `packages/shared`
> **69 passed**; `registry-nav.test.ts` **33 passed**; `workspace-resolver.test.ts` **29 passed**;
> os 11 arquivos de teste criados por esta frente somam **120 passed**; `next build` verde com
> **129 rotas**.
> `apps/web/src/lib/__tests__/rate-limit.test.ts` está VERMELHO em HEAD (2 falhas pré-existentes):
> não é regressão, não consertar.
> **NUNCA** nesta story: `git push`, `gh pr`, migration/`ALTER TABLE`, `git add -A`, `git stash`,
> `git restore`, commit, arquivo fora do escopo listado.

**Passo 1 — tipo e VALID (2 linhas).** `workspace-context.ts:3,6`.
```
grep -n "WorkspaceId\|VALID" /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/lib/workspace-context.ts
npx tsc --noEmit -p apps/web/tsconfig.json
```
(o `tsc` deve apontar exatamente os pontos que faltam cobrir `"admin"` — é o mapa dos passos 2-3)

**Passo 2 — resolver (§a.2, a.4, a.5).** `workspace-resolver.ts` (hoje `:11-30`, `:37-44`, `:61-71`).
```
cd apps/web && npx vitest run src/lib/__tests__/workspace-resolver.test.ts
```
(baseline: 20 casos no `HEAD`, medidos rodando a versão do `HEAD`. **Hoje: 29 passed.**)

**Passo 3 — registry (§c.2).** `packages/shared/src/modules/registry.ts` (hoje `:400-411`, `:455-511`, `:135`, `:148`).
```
cd packages/shared && ./node_modules/.bin/vitest run src/__tests__/registry-nav.test.ts
```
(o plano dizia "16 passed, exatamente como antes"; o `HEAD` tinha **14**, e hoje, já estendido,
são **33 passed**)

**Passo 4 — home `/admin` + slot (§b.2).** Novo `app/(platform)/admin/page.tsx`; novo
`dashboard/_components/admin-dashboard-slot.tsx`; `dashboard/page.tsx` (hoje `:114-123`) passa a
consumir o slot.
```
ls "/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/app/(platform)/admin/page.tsx"
cd apps/web && npx vitest run "src/app/(platform)/dashboard/_components/__tests__/resolve-dashboard-kind.test.ts"
```

**Passo 5 — shell admin (§d).** Novos `components/admin/admin-sidebar.tsx` e
`components/admin/admin-header.tsx`; terceiro ramo em `(platform)/layout.tsx` (hoje `:149-196`);
`workspace-switch-button.tsx` (hoje `:27`, `:44-46`) ganha `admin`; `sidebar.tsx:25,106` declara
o `workspace`.
```
npx tsc --noEmit -p apps/web/tsconfig.json
```

**Passo 6 — checar dependência de provider das páginas admin (dívida DESCONHECIDA de §d.1) — EXECUTADO, resultado ZERO ocorrências.**
```
grep -rn "useArea\|useContext(\|useModules" "/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/app/(platform)/admin" | grep -v node_modules
```
(se algo consumir `AreaProvider`/`ContextProvider`, incluir o provider no ramo admin do layout)

**Passo 7 — middleware (§f.1, f.2, f.4/§h).** `middleware.ts` (hoje `:352-356`, `:370-387`, `:394`), com as decisões em `lib/admin-world.ts`.
```
grep -n "ADMIN_WORLD_PATHS\|isInstructorOnly\|x-active-workspace" /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/middleware.ts
```

**Passo 8 — porta universal `/workspace` (§f.3).** `app/workspace/page.tsx` (hoje `:10-19`).
```
grep -n "WORKSPACE_HATS\|redirect(" /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/app/workspace/page.tsx
```

**Passo 9 — 3º cartão (§g).** `workspace-picker.tsx` (hoje `:9-17`, `:19`, `:104`, `:157`, `:170-207`, `:209-213`) + `workspace/page.tsx:22-28`.
```
grep -n "admin" "/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/app/workspace/_components/workspace-picker.tsx"
```

**Passo 10 — gate completo.**
```
npx tsc --noEmit -p apps/web/tsconfig.json        # exit 0 e saída VAZIA
cd packages/shared && ./node_modules/.bin/vitest run
cd apps/web && npx vitest run src/lib src/app      # rate-limit.test.ts segue vermelho (pré-existente)
cd apps/web && npx next build                      # verde; rotas 128 -> 129 (+/admin)
```

**Passo 11 — testes NOVOS obrigatórios ao final**

| Arquivo | O que prova |
|:---|:---|
| `apps/web/src/lib/__tests__/workspace-resolver.test.ts` (estender) | `accessibleWorkspaces(["admin"]) === ["standard","admin"]` (W4, nunca single-access); `["super_admin"]` idem; `["admin","instructor"] === ["studio","standard","admin"]`; ordem preservada para todos os casos antigos; `workspaceHomeRoute("admin") === "/admin"`; `resolvePlatformShell("admin", ["manager"]) === "standard"` (fail-closed); `resolvePlatformShell("admin", ["admin"]) === "admin"`; `canAuthorCourses("admin", ["admin"]) === false` |
| `packages/shared/src/__tests__/registry-nav.test.ts` (estender, mantendo os 16) | mundo `admin` + chapéu admin ⇒ `["admin"]` e a nav contém `/admin/configuracoes`; mundo `standard` + chapéu admin ⇒ NÃO contém seção "Administração" nem `/admin/configuracoes`; mundo `standard` + `admin`+`manager` ⇒ `["manager"]`; mundo `admin` sem chapéu admin-tier ⇒ `[]`; `workspace` ausente ⇒ comportamento legado idêntico |
| `apps/web/src/lib/__tests__/workspace-matrix.test.ts` (NOVO) | as 7 linhas de §i como tabela executável sobre as funções puras (`accessibleWorkspaces`, `workspaceHomeRoute`, `resolvePlatformShell`, `navKeysForContext`) — o contrato que o QA audita |
| `apps/web/src/lib/__tests__/instructor-block-hats.test.ts` (NOVO) ou extensão de `role-helpers.test.ts` | extrair `isInstructorOnly` de §h.1 como função pura e provar as 3 linhas da tabela de eixo duplo em §i |

---

## k) Perguntas em aberto para o dono (não inventadas aqui)

1. **EM ABERTO. `/dashboard` do admin no mundo Padrão** deve continuar mostrando o painel
   administrativo (hoje é o que acontece), ou deve mostrar a visão de aluno/gestor ("ver como o
   cliente vê")? O segundo exige tornar `resolveDashboardKind` ciente do workspace — follow-up com
   suíte própria (`resolve-dashboard-kind.test.ts`).
2. **EM ABERTO (decisão de marca). Acento do mundo admin**: `accent-gold` foi implementado conforme
   a recomendação, com a ressalva de hue vizinho ao cerrado de pé. O plano B (escala
   `--color-admin-*` em `theme.css`) é troca de 8 strings em 3 arquivos.
3. **~~EM ABERTO~~ → RESOLVIDO na rodada 5.** A pergunta era "`super_admin` deveria ver o hub de
   Configurações?", e o texto anterior afirmava "hoje não vê". Isso deixou de ser verdade: o dono do
   produto É super_admin e era o único perfil sem a porta do hub, o que quebrava W3. Hoje
   `navKeysForContext` devolve `["admin", "super_admin"]` no mundo admin (`registry.ts:486`) e ele vê
   a nav admin-tier inteira, com dedup por href.
4. **EM ABERTO. Ampliar o guard de middleware** para toda a allowlist administrativa exige auditar
   guard a guard as páginas de `/admin/*` (quem hoje libera `manager`?). Story separada. *(Nota: os
   guards de página JÁ migraram para chapéus na rodada 2; o que segue aberto é ampliar a cobertura
   do MIDDLEWARE.)*

## Estado final e arestas conhecidas

> Escrito na rodada 6 (higiene documental, @architect). Números e âncoras desta seção foram gerados
> por comando na hora, não de memória.

**O que está de pé (gates, 2026-07-25):** `npx tsc --noEmit -p apps/web/tsconfig.json` → `exit=0`
com saída vazia; `packages/shared` → **69 passed**; os 11 arquivos de teste criados por esta frente
→ **120 passed**; `registry-nav.test.ts` → **33 passed**; `workspace-resolver.test.ts` → **29
passed**; `npm run build` → compila e gera **129/129 rotas**. Nada commitado, nada pushed, nenhuma
migration.

**Arestas declaradas, NÃO corrigidas (por escolha, não por esquecimento):**

1. **`admin/notifications/page.tsx:111` ejeta por tenant ausente.** A linha é
   `if (!tenantId) return redirect("/dashboard")`, e `/dashboard` reescreve `x-active-workspace`
   para `standard` — quem cair nela perde o MUNDO por causa de um dado ausente, não de um papel. É a
   mesma classe da ejeção corrigida em `/admin/tenants` (`adminWorldDeniedRedirect`), com gatilho
   diferente, e a rota não pertence à allowlist do mundo. Depois da correção do fallback de tenant
   (rodada 5), `tenantId` só é nulo quando **não existe nenhuma empresa** no banco.
2. **Rótulo "Integracoes" sem acento** (`registry.ts:253`, chave `super_admin` do módulo `admin`).
   É o que o super_admin já via antes desta frente, então não é regressão; ficou intacto para o diff
   não carregar mudança cosmética não pedida. Uma linha, quando alguém quiser.
3. **`job-roles/actions.ts` não inclui `super_admin` na ESCRITA.** `requireContentRole`
   (`job-roles/actions.ts:19`) admite `["manager", "admin", "instructor"]`. Consequência real e
   assimétrica: desde a rodada 4 o dono do produto **enxerga** os cargos da empresa escolhida no
   seletor (a leitura ganhou `resolveTenantId` + `.eq("tenant_id", …)` explícito), mas
   `createJobRole`/`updateJobRole`/`deleteJobRole` recusam com "Permissão negada" para ele. Pior:
   `createJobRole` grava `tenant_id: roleCheck.tenantId`, que para um perfil de `tenant_id` nulo
   seria `null`. **Não alarguei o conjunto de propósito** — somar `super_admin` a um guard de escrita
   em produção é escalação de privilégio, e o conserto correto são as duas coisas juntas (guard por
   chapéus **e** `tenant_id` de inserção por `resolveTenantId`), com gate próprio.
4. **Fronteira do eixo de autorização.** O eixo de CHAPÉUS venceu em: middleware, TODOS os guards de
   página de `/admin/*` (`lib/admin-route-access.ts`) e `lib/api-auth/require-admin.ts`. **Seguem no
   eixo singular (`profile.role`)**, declarados em código (`lib/admin-route-access.ts`, bloco
   FRONTEIRA DO EIXO, `:98+`) e aqui:
   - 4 server actions fora desta frente: `admin/plans/actions.ts:87,91`,
     `admin/job-roles/actions.ts:19,22`, `admin/manager-groups/actions.ts:107,116`,
     `admin/users/enrollment-actions.ts:56,61,106,118`;
   - as rotas de API com gate inline que não passam por `require-admin.ts` — **62 arquivos**
     (`grep -rln "profile\.role" apps/web/src/app/api/ | wc -l` → `62`);
   - `lib/super-admin-auth.ts:19` (`requireSuperAdmin`), que guarda `api/admin/switch-tenant`;
   - o seletor multi-tenant (`lib/multi-tenant-access.ts:36-38`), singular **de propósito**: não
     libera nem barra rota, só decide se um dropdown aparece.
   *Não é regressão:* nenhum deles foi tocado, quem passa hoje continua passando. São caminhos de
   escrita em produção sem harness de teste, e migrá-los é rodada própria.
5. **Cosmético da nav admin (§d.3, itens 15-19).** Avaliações, Course Designer, API Keys, Integrações
   e Webhooks caem visualmente dentro de "Sistema", porque `buildNavigation` concatena na ordem dos
   módulos sem abrir seção nova. Correção mínima: `{ section: "Ferramentas" }` no topo de
   `assessments.nav.admin` (`registry.ts:280`). Polimento, não bloqueador.
6. **Rodapé do Estúdio** (`studio-sidebar.tsx:113-117`) ainda chama `switchWorkspace("standard")`
   direto: com 3 mundos, um `admin+instructor` que clica ali é levado ao Padrão sem escolher. A
   sidebar do admin já nasce apontando para o picker `/workspace`; alinhar o Estúdio são 3 linhas,
   fora do escopo desta frente.
7. **Sem cobertura automatizada:** o middleware em si (não há harness de `NextRequest` neste repo —
   por isso toda decisão foi extraída para `lib/admin-world.ts`, que é testado), a renderização de
   `AdminSidebar`/`AdminHeader` e o ramo de shell do layout (server component com `getAuthProfile`),
   verificáveis por `next build` + inspeção manual.
8. **Duas falhas de teste PRÉ-EXISTENTES** seguem vermelhas e não são desta frente:
   `src/lib/__tests__/rate-limit.test.ts` (declaradas na baseline).

**Perguntas de dono que continuam abertas:** §k.1 (`/dashboard` do admin no mundo Padrão), §k.2
(acento gold vs. escala `--color-admin-*`) e §k.4 (ampliar o guard do middleware para toda a
allowlist).

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-25 | Plano do 3º workspace (admin) criado, resolvendo D2 com as restrições W1-W4. | @architect (Aria) |
| 2026-07-25 | **Rodada 4 — âncoras de linha reancoradas.** Toda citação `registry.ts:NNN` deste documento apontava para o arquivo ANTES da implementação; o comentário W2 inserido na chave `admin` empurrou tudo a partir de `:128` em 4 linhas, e as âncoras estruturais de §c.1 (`navKeysForContext`, `navRoleForContext`, `ADMIN_NAV_KEYS`, `buildNavigation`) nunca bateram. Sintoma que denunciou: §d.3 dizia `:131`/`:136` para os dois retargets enquanto `RESULT-workspace-admin.md` §2.3 dizia `:135`/`:140` — dois artefatos da mesma frente discordando. Os 30 trechos que citam `registry.ts:NNN` foram regerados por comando contra `packages/shared/src/modules/registry.ts` e conferidos um a um (`sed -n "<N>p"` devolve o item que o texto afirma). Nenhum conteúdo técnico mudou, só os ponteiros. | @dev (Dex) |
| 2026-07-25 | **Rodada 6 — higiene documental (pós-aprovação do código).** O revisor adversarial aprovou o CÓDIGO e reprovou a DOCUMENTAÇÃO: vários trechos ainda descreviam, como estado atual, defeitos já corrigidos nas rodadas 3, 4 e 5 (em especial "o super_admin não vê o hub de Configurações", §k.3 e §c.2). Cada um foi (a) atualizado para o estado atual ou (b) mantido com etiqueta `[HISTÓRICO]` **na própria linha**. As âncoras `registry.ts:NNN` reancoradas na rodada 4 haviam se deslocado DE NOVO com as edições da rodada 5 (o comentário do dedup e o bloco do super_admin empurraram tudo a partir de `:128`); todas as âncoras dos dois artefatos foram reconferidas por `sed -n '<N>p'` e corrigidas. Todo número foi regerado por comando (`wc -l`, `vitest run`, `grep -c`), inclusive os três pendentes de `RESULT:180` (20/14/29, confirmados). Adicionada a seção "Estado final e arestas conhecidas". Nenhum arquivo de código tocado. | @architect (Aria) |
