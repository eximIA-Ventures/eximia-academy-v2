# EPIC-MANAGER-UX / S3, Analytics em "Gestão do Time", moldado pelo recorte de time (nav-move, SSR union, UnitComparison oculto na lente Gestor)

> Status: Draft, PRONTA PARA REVISAO, NAO IMPLEMENTAR ate GO de Hugo.
> Executor: @dev · Tipo: refactor · Branch: feat/engajamento-gestor-m1

## User Story

Como GESTOR com a lente Gestor ativa, quero que o Analytics apareca dentro da secao "Gestão do Time" (nao como item solto de "Aprendizado"), e que TODOS os numeros do dashboard sigam meu recorte de time (Diretos / Hierarquia / sub-time em foco) sem eu precisar saber que existe um "escopo" por baixo, para o Analytics ser uma ferramenta de GESTAO DE TIME coerente, nunca uma janela que mistura minha equipe com o tenant inteiro nem que mostra comparacoes de Unidade sem sentido para meu time.

Como gestor multi-chapeu cujo papel primario singular (`profile.role`) nao e `manager` (ex.: gestor+instrutor cujo primario resolveu `instructor`), quero que a pagina de Analytics me admita e escope EXATAMENTE a mesma populacao que o endpoint `aggregate` ja escopa pela uniao de chapeus, para nao cair numa divergencia SSR vs client (primeiro paint mostra uma coisa, o fetch client mostra outra, ou me barra na porta).

## Estado atual (recon arquivo:linha)

- `packages/shared/src/modules/registry.ts:167-181`, modulo `analytics`. A chave `manager` (registry.ts:174) emite `{ label: "Analytics", href: "/analytics", icon: "BarChart3" }`. As chaves `leader` (173), `admin` (175) e `instructor` (177) emitem o MESMO item.
- `packages/shared/src/modules/registry.ts:183-219`, modulo `admin`. A chave `manager` (registry.ts:194-198) ja e TEAM-scoped e hoje contem: `{ section: "Gestão do Time" }` (linha 195, literal ACENTUADO, D4), `{ label: "Perfis da Equipe", href: "/team/profiles", icon: "Users" }` (196), `{ label: "Engajamento", href: "/admin/notifications", icon: "Sparkles" }` (197). O comentario 189-193 declara que a nav do gestor e time, nunca tenant, e o gate e a uniao de chapeus.
- `packages/shared/src/modules/registry.ts:360-368`, `navRoleForContext(...)` PODE retornar `"leader"` (linha 366). `navKeysForContext` (387-393) gateia chaves admin-tier pela uniao de chapeus.
- `packages/shared/src/modules/index.ts` re-exporta `registry.ts`; `apps/web/src/lib/navigation.ts:107-122` (`getNavigation`) consome `buildNavigation` e mapeia section->NavSection, item->NavItem.
- `apps/web/src/components/layout/sidebar.tsx:115-133`, o agrupador comeca grupo NOVO a cada `{section}` e NAO funde labels iguais. Dois `{section:"Gestão do Time"}` gerariam DOIS cabecalhos identicos.
- `apps/web/src/app/(platform)/analytics/page.tsx:58`, `const { user, profile, supabase, roles } = await getAuthProfile()`. `roles` (uniao) ja disponivel.
- `apps/web/src/app/(platform)/analytics/page.tsx:61-62`, GATE de admissao SSR por `profile.role` SINGULAR: `if (!["leader","manager","admin","instructor","super_admin"].includes(profile.role)) return redirect("/dashboard")`.
- `apps/web/src/app/(platform)/analytics/page.tsx:71-72`, `canSeeRawContent` ja usa a uniao (`roles.includes(...)`), precedente do padrao alvo.
- `apps/web/src/app/(platform)/analytics/page.tsx:116`, resolucao de escopo por `profile.role === "manager"` SINGULAR. Le contexto ativo (`getActiveContextCookie`), `teamViewMode` (`getTeamViewMode`), `?focus=` gated por `auth_subtree_user_ids` e resolve Diretos vs Hierarquia (117-147). O ramo `else` (148-150) usa area/unidade.
- `apps/web/src/app/(platform)/analytics/page.tsx:499-540`, `unitStats` (UnitComparison de Uso). `:711-742`, `unitDepthComparison` (Aprendizagem por Unidade). Ambos derivam de `areasList` (500), populados SEMPRE, inclusive para manager scoped.
- `apps/web/src/app/(platform)/analytics/page.tsx:805-811`, `userRole` ao dashboard derivado de `profile.role` SINGULAR (super_admin/admin/senao "manager").
- `apps/web/src/components/analytics/analytics-dashboard.tsx:202-214`, `useQuery(["analytics-aggregate", period, courseId, areaId, interactionType])` -> `/api/analytics/aggregate`. O aggregate ja escopa por uniao, independente do areaId client.
- `apps/web/src/components/analytics/analytics-dashboard.tsx:218-229`, `useQuery(["analytics-comparison", period, areaId, courseId, corporateUnitFilter])` -> `/api/analytics/manager-groups`. QueryKey ACOPLA areaId e corporateUnitFilter; body envia areaId e unitFilter (222-224). Alimenta areaStats/courseStats (235-237) e o UnitComparison.
- `apps/web/src/components/analytics/analytics-dashboard.tsx:370-372`, `showUnitComparison = unitStats.length >= 2 || areaStats.length >= 2 || courseStats.length >= 2`. `554-562` renderiza UnitComparison em Uso. `823-885` renderiza "Aprendizagem por Unidade" (unitDepthComparison.length >= 2). `525-552` renderiza o seletor "Visão corporativa".
- `apps/web/src/app/api/analytics/aggregate/route.ts:721-747`, gate de admissao por `profile.role` singular (727-732), MAS a decisao de escopo (`callerRoles`/`isTenantWideRole`/`isManagerScoped`) ja e por UNIAO (user_roles, 741-747). `965-971` aplica subtree fail-closed `[]` ao manager scoped. Comportamento de referencia que o SSR deve ESPELHAR (D3).
- `apps/web/src/app/api/analytics/manager/route.ts:33-35`, gate por `profile.role === "manager"` singular (rota que S5 possui/migra; S3 nao toca).
- `apps/web/src/app/api/analytics/manager-groups/route.ts:109-118`, gate por `toAnalyticsRole(profile?.role)` singular (migracao e S5; S3 so propaga/nao-propaga params, D7).
- `apps/web/src/lib/role-helpers.ts:12-18`, `hasRole(profile:{roles:string[]}, role)` e `hasAnyRole(...)` sobre a uniao. Contrato existente reusavel.
- `apps/web/src/lib/area-context.ts:126-145` (`getManagedTeamStudentIds`, subtree via `auth_reachable_student_ids`, precisa do client autenticado), `:247-259` (`getSubtreeStudentIdsAtNode`, gated `[]`), helpers ja usados pelo SSR em 133-147.
- `apps/web/src/components/layout/header.tsx:16,84-100`, `ContextSwitcher` (eixo POPULACAO). Comentario 84-86 chama Context de "lente de papel" (impreciso; corrigido por S1/D5). Props `user={{full_name, roles}}` (roles ANINHADO), sem activeLens/eligibleLenses ainda (S1/D5).
- `apps/web/src/app/(platform)/layout.tsx:145-156`, `<Header user={{ full_name, roles }} ... />` (wiring D5 de S1).
- `apps/web/src/types/analytics.ts:551,554,575`, `ComparisonMode`, `AnalyticsRole = "student"|"manager"|"admin"|"super_admin"`, `COMPARISON_MODES_BY_ROLE`.

## Escopo decidido

QUATRO coisas, todas dentro dos arquivos que a story POSSUI:

1. NAV-MOVE (D2). Mover o item Analytics do modulo `analytics` (chave `manager`) para o modulo `admin` (chave `manager`), logo apos o item Engajamento sob o `{ section: "Gestão do Time" }` (registry.ts:197). Remover o item Analytics APENAS da chave `manager` do modulo `analytics`. NAO adicionar `{section}` ao modulo `analytics` (evita cabecalho duplicado, dado o agrupador nao-fusor). Chaves `leader`/`admin`/`instructor` do modulo `analytics` INTACTAS.

2. SSR UNION (D3). Migrar o GATE de admissao (61-62) e a DECISAO de escopo (116) do `analytics/page.tsx` de `profile.role` singular para a uniao/lente, consumindo `isManagerLens`/`roles` de S1. Objetivo verificavel: para um multi-chapeu cujo primario `!= "manager"` mas com chapeu `manager` na uniao, SSR e `aggregate` resolvem a MESMA populacao.

3. UNITCOMPARISON OCULTO NA LENTE GESTOR (D7). Na lente Gestor o fetch de comparacao (`manager-groups`) NAO envia `areaId`/`unitFilter`, e os blocos de comparacao por Unidade (UnitComparison em Uso, "Aprendizagem por Unidade" em Aprendizagem, seletor "Visão corporativa") ficam OCULTOS. Unidade x Time exclusivos: na lente Gestor a Unidade some.

4. MOLDAR AO RECORTE. O dashboard, na lente Gestor, molda-se ao recorte ativo (Diretos/Hierarquia + sub-time em foco) de ponta a ponta: o SSR ja resolve `scopedStudentIds` (116-147); S3 propaga o MESMO `focus`/`mode` para os fetches client, consumindo o `TeamScopeControl` de S2.

INEGOCIAVEL: Hierarquia = `reports_to` gated por `auth_subtree_user_ids` (nunca `manager_group`), fail-closed `[]`. A propagacao client NAO pode introduzir caminho que resolva por `manager_group`.

## Fora de escopo

- MIGRACAO de gate/escopo das 5 rotas de disparo do engajamento (campaign, suggestions/generate, suggestions/[id], notifications/nudge, admin/notifications POST) e do gate de admissao de analytics/manager / nudge, S5 (D1).
- Migracao do gate de `manager-groups/route.ts` e `manager/route.ts` de singular para uniao, S5. S3 so ajusta PARAMS enviados a manager-groups (D7).
- Assinatura de `resolveCallerStudentScope` -> `roles:string[]`, S5 (D1).
- Escopo de LEITURA da pagina de Engajamento (roster, historico, sugestoes, audiences, eficacia) e subtracao de UI, S4 (D1). S3 nao mexe em /admin/notifications.
- Introduzir `RoleLensSwitcher`, `resolveRoleLens`, tipo `RoleLens`, props `activeLens`/`eligibleLenses` do Header, S1 (D5). S3 CONSOME `isManagerLens`/`roles`.
- Introduzir `TeamScopeControl`, S2. S3 CONSOME o recorte publicado por S2.
- Estender candidate pool para group-owner nodes, S2/D6.
- Migrar `auth_user_role()` (DB) para uniao, sinalizado por S5/D8, fora de M1.
- DEFERIDOS: remover aprendizado da lente Gestor, Rinaldo ver 2 lentes juntas, composicao Unidade x Time.

## Mudancas de codigo (POR ARQUIVO, com assinatura/shape)

### 1) packages/shared/src/modules/registry.ts (D2, D4)

MODULO `admin`, chave `manager` (194-198). Inserir Analytics apos Engajamento, DENTRO do `{ section: "Gestão do Time" }` (label ACENTUADO):

```ts
manager: [
  { section: "Gestão do Time" },
  { label: "Perfis da Equipe", href: "/team/profiles", icon: "Users" },
  { label: "Engajamento", href: "/admin/notifications", icon: "Sparkles" },
  { label: "Analytics", href: "/analytics", icon: "BarChart3" }, // D2: movido do modulo analytics
],
```

MODULO `analytics`, chave `manager` (174). REMOVER a chave `manager` inteira (unico item era o Analytics, agora emitido pelo modulo admin). NAO adicionar `{section}`:

```ts
analytics: {
  ...
  nav: {
    leader: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],
    // manager REMOVIDO, Analytics do gestor sai pelo modulo `admin` sob "Gestão do
    // Time" (D2). Nao readicionar aqui: geraria 2o cabecalho igual (sidebar nao funde).
    admin: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],
    instructor: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],
  },
  routes: ["/analytics"],
  apiRoutes: ["/api/analytics"],
},
```

Invariante: `/analytics` continua coberto por `routes`/`apiRoutes` do modulo `analytics` (que segue habilitado), entao `isRouteAllowed`/ModuleGate nao regride. Guard DEFER: nao tocar academy/biblioteca.

Ordering: `buildNavigation` (403-416) itera na ordem canonica de MODULE_IDS (`analytics` antes de `admin`). Para o gestor: (modulos anteriores) -> [analytics: nada p/ manager] -> [admin.manager: "Gestão do Time" + Perfis + Engajamento + Analytics]. Um unico cabecalho, Analytics como ultimo item. Validado contra sidebar.tsx:119-133.

### 2) apps/web/src/app/(platform)/analytics/page.tsx (D3, D7, propagacao)

2a. GATE de admissao (61-62) por uniao (`hasAnyRole` sobre `roles`):

```ts
// ANTES: if (!["leader","manager","admin","instructor","super_admin"].includes(profile.role)) redirect("/dashboard")
const capabilityProfile = { roles }
if (!hasAnyRole(capabilityProfile, ["leader","manager","admin","instructor","super_admin"]))
  return redirect("/dashboard")
```

2b. DECISAO de escopo (116) migrada de `profile.role === "manager"` para a lente (consome `isManagerLens` de S1). A logica interna (contexto team, teamViewMode, focus gated, Diretos/Hierarquia) fica BYTE-A-BYTE; muda so a CONDICAO:

```ts
// ANTES: if (profile.role === "manager") { ... }
// isManagerLens(roles, activeLens) === true  <=>  chapeu `manager` na uniao E lente Gestor ativa.
if (isManagerLens(roles, activeLensFromS1)) {
  // 117-147 inalterado
} else {
  scopedStudentIds = await getAreaStudentIds(db, tenantId, initialAreaId) // 148-150 inalterado
}
```

Contrato consumido (S1): `isManagerLens(roles: Role[], lens: RoleLens): boolean`. S3 NAO define `RoleLens`/`resolveRoleLens` (D5: `resolveRoleLens` nunca retorna "leader" como RoleLens; leader-puro nao ativa lente Gestor). Fallback documentado se S1 atrasar: `hasRole(capabilityProfile,"manager") && (await getActiveContextCookie())?.type === "team"` (mesma populacao, sem singular).

Paridade (D3): para `profile.role !== "manager"` com `roles.includes("manager")` e lente Gestor ativa, `scopedStudentIds` do SSR = `scopeStudentIds` do aggregate (isManagerScoped, 965-971) para os MESMOS params. Ambos usam `getManagedTeamStudentIds(...,{includeSubtree:true})` / `getSubtreeStudentIdsAtNode(...)` sob o client autenticado.

2c. `userRole` do dashboard (805-811) por uniao/lente:

```ts
const userRole: AnalyticsRole =
  isManagerLens(roles, activeLensFromS1)
    ? "manager"
    : roles.includes("super_admin")
      ? "super_admin"
      : roles.includes("admin")
        ? "admin"
        : "manager"
```

2d. UNITCOMPARISON OCULTO (D7). Na lente Gestor zerar as fontes de comparacao por Unidade (derivadas de `areasList`, 500) e passar flag novo ao dashboard:

```ts
const isManagerLensView = isManagerLens(roles, activeLensFromS1)
const unitStats = isManagerLensView ? [] : areasList.map((area) => ({ /* 506-540 inalterado */ }))
const unitDepthComparison = isManagerLensView ? [] : areasList.map((area) => ({ /* 711-742 inalterado */ }))
// ...
<AnalyticsDashboard ... isManagerLensView={isManagerLensView} teamScope={teamScopeFromS2} />
```

`teamScope` (recorte ativo, contrato consumido de S2, NAO definido por S3):

```ts
interface TeamScope { mode: "direct" | "hierarchy"; focusUserId: string | null }
```

O SSR passa o MESMO `mode`/`focusUserId` que usou em 122-142, para os fetches client refazerem sobre o mesmo recorte.

### 3) apps/web/src/components/analytics/analytics-dashboard.tsx (D7, propagacao)

3a. Props novas (top-level):

```ts
interface AnalyticsDashboardProps {
  ...
  isManagerLensView?: boolean
  teamScope?: { mode: "direct" | "hierarchy"; focusUserId: string | null }
}
```

3b. `aggregate` queryKey + body (202-214) incluem o recorte na lente Gestor:

```ts
useQuery<AggregateAnalyticsResponse>({
  queryKey: ["analytics-aggregate", period, courseId, areaId, interactionType, teamScope?.mode, teamScope?.focusUserId],
  queryFn: async () => {
    const params = new URLSearchParams({ period })
    if (courseId) params.set("courseId", courseId)
    if (areaId && !isManagerLensView) params.set("areaId", areaId)   // D7: lente Gestor nao envia areaId
    if (interactionType) params.set("interactionType", interactionType)
    if (isManagerLensView && teamScope) {
      if (teamScope.mode === "hierarchy") params.set("includeSubtree", "true")
      if (teamScope.focusUserId) params.set("focusUserId", teamScope.focusUserId)
    }
    const r = await fetch(`/api/analytics/aggregate?${params.toString()}`)
    ...
  },
})
```

Nota: o aggregate ja e fail-closed p/ manager scoped (965-971), entao suprimir areaId aqui e coerencia de UX, nao a barreira (a barreira e `isManagerScoped`, unico gate app-layer sob service client, per D8/S5).

3c. `manager-groups` (comparison) (218-229): desligado na lente Gestor:

```ts
useQuery<ComparisonResponse>({
  queryKey: ["analytics-comparison", period, areaId, courseId, corporateUnitFilter, isManagerLensView],
  enabled: !isManagerLensView, // D7
  queryFn: async () => {
    const params = new URLSearchParams({ view: "comparison", period })
    if (areaId) params.set("areaId", areaId)
    if (courseId) params.set("courseId", courseId)
    if (corporateUnitFilter) params.set("unitFilter", corporateUnitFilter)
    const r = await fetch(`/api/analytics/manager-groups?${params.toString()}`)
    ...
  },
})
```

Com `enabled:false`, `comparisonData` fica `undefined` -> areaStats/courseStats `[]` (235-237), `hasCorporateGroup` `false` (261) -> seletor "Visão corporativa" (525-552) some.

3d. Ocultar blocos de Unidade:

```ts
const showUnitComparison =
  !isManagerLensView &&
  (unitStats.length >= 2 || areaStats.length >= 2 || courseStats.length >= 2)
```

"Aprendizagem por Unidade" (823-885) ja depende de `unitDepthComparison.length >= 2`, que na lente Gestor e `[]` (2d).

3e. `SummaryOverview` (472-475): na lente Gestor recebe `unitStats=[]`; garantir degradacao sem quebra (nao renderiza breakdown por unidade). Se exigir >=1 unidade, condicionar a `!isManagerLensView || unitStats.length > 0` (AC8).

### 4) apps/web/src/app/api/analytics/aggregate/route.ts (propagacao, SEM migrar gate)

Nenhuma mudanca de seguranca (gate/escopo por uniao ja existe, 741-747, 965-971). Apenas garantir que `includeSubtree`/`focusUserId` (ja lidos em 924-940) sao honrados quando o dashboard os envia (3b). NAO migrar o gate de admissao (727-732).

### 5) apps/web/src/app/api/analytics/manager/route.ts e manager-groups/route.ts (propagacao apenas)

`manager/route.ts` nao e chamado neste fluxo (dashboard usa aggregate + manager-groups); sem mudanca. `manager-groups/route.ts`: sem mudanca de codigo, apenas o client deixa de chama-la na lente Gestor (3c). Gate singular dessas rotas e migrado por S5.

## Dados-RLS-Seguranca

- `aggregate/route.ts` roda sob `createServiceClient` (RLS bypass) para os dados, MAS resolve a subtree do manager scoped sob o CLIENT AUTENTICADO (`supabase`, `auth.uid()`) via `getManagedTeamStudentIds`/`getSubtreeStudentIdsAtNode` (965-971). Para o gestor, o gate REAL de populacao e a app-layer union (`isManagerScoped`), fail-closed `[]`, nunca tenant-wide. S3 apenas garante que o SSR ESPELHA a mesma resolucao (D3), matando a divergencia SSR vs client.
- NAO ha anel RLS que pegue o escape multi-chapeu neste caminho (service client). A paridade SSR==aggregate e a garantia de que ambos aplicam o MESMO gate de uniao (coerente com D8/S5: RLS nao e defense-in-depth aqui; migrar `auth_user_role()` para uniao fica FORA DE ESCOPO, so sinalizado por S5).
- `focusUserId` (client) e SEMPRE gated server-side (`auth_subtree_user_ids` em getSubtreeStudentIdsAtNode e no ramo subtree do aggregate, 263-266). No forjado/fora-de-escopo -> `[]`, nunca widen.
- INEGOCIAVEL: Hierarquia = `reports_to` gated por `auth_subtree_user_ids`, nunca `manager_group`. Helpers consumidos usam `auth_reachable_student_ids`/`subtree_student_ids`/`auth_subtree_user_ids` (reports_to uniao descendant group members via E3). A propagacao client de `mode`/`focusUserId` nunca cria caminho `manager_group`-based.
- LGPD (71-72): `canSeeRawContent` ja e union; nenhuma reflexao verbatim vaza para gestor. S3 nao altera esse gate.
- registry D2: mover o item de nav e EXPOSICAO de UI, NUNCA permissao. `navKeysForContext` so emite chaves admin-tier para quem POSSUI o chapeu; a chave `manager` e emitida para a lente Gestor, e o acesso real e re-checado no server.

## Acceptance Criteria (numerados)

1. NAV-MOVE: com lente Gestor ativa, a sidebar exibe UM unico cabecalho `Gestão do Time` (acentuado) contendo, nesta ordem: Perfis da Equipe, Engajamento, Analytics. Sem cabecalho duplicado.
2. NAV-MOVE (nao-regressao): com lente Instrutor ou Admin ativa, o item Analytics aparece como antes (chaves instructor/admin/leader do modulo analytics intactas).
3. NAV-MOVE (sem section no analytics): o modulo `analytics` NAO contem `{section:"Gestão do Time"}`; a chave `manager` do modulo analytics foi removida.
4. SSR ADMISSAO (union): caller com `profile.role="instructor"` e `roles=["instructor","manager"]` acessa `/analytics` sem redirect (gate por hasAnyRole, nao singular).
5. SSR PARIDADE (D3, teste de OURO): para o caller de AC4, com lente Gestor ativa e mesmo focus/period, `scopedStudentIds` do SSR = `scopeStudentIds` do aggregate. Nenhum resolve tenant-wide; ambos fail-closed `[]` em erro/vazio.
6. SSR ESCOPO (union, nao singular): a condicao de entrada no ramo subtree do SSR e a LENTE Gestor (isManagerLens/fallback), nao `profile.role === "manager"`. Gestor-puro mantem comportamento identico.
7. UNITCOMPARISON OCULTO (D7): na lente Gestor, UnitComparison (Uso), "Aprendizagem por Unidade" (Aprendizagem) e o seletor "Visão corporativa" NAO sao renderizados.
8. FETCH SEM UNIDADE (D7): na lente Gestor, o request a `/api/analytics/aggregate` NAO contem `areaId`, e `/api/analytics/manager-groups` nao e disparado (enabled:false). SummaryOverview degrada sem quebrar com unitStats=[].
9. MOLDAR AO RECORTE: na lente Gestor com `teamScope.mode="hierarchy"`, o fetch aggregate envia `includeSubtree=true`; com focusUserId, envia `focusUserId=<uuid>`; trocar o recorte (S2) re-dispara o fetch (queryKey inclui teamScope) e todo o dashboard re-molda.
10. INEGOCIAVEL Hierarquia: nenhum caminho novo (SSR ou client) resolve a populacao do gestor via `manager_group` como eixo de hierarquia; Hierarquia usa `reports_to` gated por `auth_subtree_user_ids`, fail-closed `[]`.
11. NAO-INVASAO: S3 nao modifica as 5 rotas de disparo, nem `manager/route.ts` (gate), nem `manager-groups/route.ts` (gate/codigo), nem /admin/notifications, nem assinaturas de S1/S2/S5.
12. userRole: na lente Gestor o dashboard recebe `userRole="manager"` (independe do singular); com admin/super_admin na uniao e sem lente Gestor, recebe o papel mais alto.

## Plano de testes (first-move rule)

Cada teste RED-first (falha antes da mudanca), depois implementar ate verde.

1. RED nav (registry): `buildNavigation(enabledIds, { roles:["manager"], context:{type:"team"} })` contem EXATAMENTE um `{section:"Gestão do Time"}` seguido de Perfis, Engajamento, Analytics; ZERO section vinda do modulo analytics.
2. RED nav (agrupador): aplicar a logica de sidebar.tsx:115-133 ao output e assertar `groups.filter(g => g.label === "Gestão do Time").length === 1`.
3. RED nav (nao-regressao): `buildNavigation(..., { roles:["instructor"], context:{type:"team"} })` ainda contem o item Analytics (analytics.instructor). Idem admin.
4. RED SSR admissao: `AnalyticsPage` com getAuthProfile mockado `profile.role="instructor"`, `roles=["instructor","manager"]`, lente Gestor ativa -> NAO redireciona.
5. RED SSR paridade (teste de OURO): fixture multi-chapeu (primario instructor, roles inclui manager) dono de sub-time via reports_to. SSR (116-147) e aggregate (965-971) com os mesmos params -> conjuntos de ids IDENTICOS e NAO tenant-wide. (Falha hoje: SSR cai no else area pelo singular.)
6. RED UnitComparison oculto: render com `isManagerLensView=true`, unitStats/unitDepthComparison vazios -> ausencia de UnitComparison, "Aprendizagem por Unidade" e "Visão corporativa".
7. RED fetch sem Unidade: mock fetch; `isManagerLensView=true` + areaId setado -> URL de aggregate SEM `areaId=`, manager-groups NAO chamada.
8. RED moldar ao recorte: `isManagerLensView=true`, `teamScope={mode:"hierarchy", focusUserId:"<uuid>"}` -> URL de aggregate com `includeSubtree=true` e `focusUserId=<uuid>`; trocar teamScope re-dispara (novo queryKey).
9. RED INEGOCIAVEL: spy nos RPCs `auth_reachable_student_ids`/`subtree_student_ids`/`auth_subtree_user_ids`; Hierarquia nunca consulta `manager_group_members` como eixo.
10. Consumo de contrato (S1/S2): stub de isManagerLens/TeamScope; sem contratos reais, testes usam o fallback documentado (2b) sem singular. GREEN so consumindo os contratos reais.

## Dependencias

- DEPENDE de S1: consome `isManagerLens(roles, lens)` e o conceito RoleLens/activeLens. S1 lands antes (S5 -> S1 -> S2 -> S3). Fallback (2b) permite RED antes de S1; GREEN canonico consome S1.
- DEPENDE de S2: consome `TeamScopeControl`/`TeamScope` como fonte do recorte. S2 lands antes.
- DEPENDE de S5 indiretamente: S5 migra os gates das rotas; S3 nao re-migra nenhum gate de rota, reusa o gate union que o aggregate ja tem.
- NAO bloqueia S4 (arquivos disjuntos: S3 analytics+registry; S4 /admin/notifications + history route).
- Reusa contratos existentes: hasRole/hasAnyRole (role-helpers.ts), getManagedTeamStudentIds/getSubtreeStudentIdsAtNode (area-context.ts), getActiveContextCookie/getTeamViewMode.

## Riscos

- BIGGEST: SSR e aggregate divergirem apos a migracao por diferenca sutil de resolucao (nome/default de focus/mode). Mitigacao: AC5 (teste de OURO de paridade) trava conjunto-identico com os MESMOS params; ambos usam os MESMOS helpers.
- Acoplamento com S1/S2 nao materializados: se isManagerLens/TeamScope mudarem de forma, S3 quebra. Mitigacao: shape minimo documentado + fallback (2b) + sequenciamento.
- Regressao de nav p/ admin/instrutor ao remover a chave `manager` do modulo analytics. Mitigacao: AC2/AC3 + essa chave so era emitida na lente Gestor (navKeysForContext == manager).
- SummaryOverview/cards que assumem unitStats>=1 quebrarem com `[]`. Mitigacao: AC8 + condicionar render (3e).