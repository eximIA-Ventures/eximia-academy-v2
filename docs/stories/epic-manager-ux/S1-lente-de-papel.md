# EPIC-MANAGER-UX / S1, Lente de papel explicita (fim do colapso por precedencia)

> Status: Draft, PRONTA PARA REVISAO, NAO IMPLEMENTAR ate GO de Hugo.
> Executor: @dev · Tipo: feat · Branch: feat/engajamento-gestor-m1

## User Story

Como usuario multi-chapeu da Academy (ex.: Rinaldo, que e ao mesmo tempo Aluno, Instrutor e Gestor), quero ALTERNAR explicitamente a lente de PAPEL pela qual estou operando (Aluno / Instrutor / Gestor), com um marcador visivel "Vendo como: X", em vez de a plataforma colapsar silenciosamente para o meu papel de maior precedencia, para que eu enxergue exatamente a superficie do papel que escolhi e nunca fique preso na visao de admin/gestor quando quero operar como aluno ou instrutor. A lente move a lente (qual visao renderiza), nunca o privilegio: nenhum item de administracao do tenant aparece por efeito de trocar de lente, ele so aparece se eu POSSUIR de fato o chapeu de admin (gate por posse real, RLS continua sendo a trava).

Esta story cria o EIXO DE PAPEL (RoleLensSwitcher) e o reconcilia com o EIXO DE POPULACAO ja existente (ContextSwitcher, `x-active-context`). Ela nao migra gates de seguranca de rotas de disparo (isso e da S5), nao move o item Analytics de secao (isso e da S3), nao escopa leitura do engajamento (isso e da S4). Ela entrega o CONTRATO de lente que S2/S3/S4/S5 consomem.

## Estado atual (recon arquivo:linha)

- `packages/shared/src/modules/registry.ts:37`, `export type Role = "student" | "leader" | "manager" | "admin" | "instructor" | "super_admin"`. E o unico tipo de papel canonico; nao existe nenhum tipo `RoleLens` no repo (confirmado por grep vazio em `apps/web/src` + `packages/shared/src`).
- `packages/shared/src/modules/registry.ts:340-368`, `interface NavContext { roles: Role[]; context: NavContextShape }` e `navRoleForContext(navCtx): Role`. A funcao aplica precedencia `super_admin > admin > manager > instructor > leader > student` e PODE retornar `"leader"` (linha 366: `if (roles.includes("leader")) return "leader"`). Este e o colapso por precedencia que a story elimina como default silencioso, dando ao usuario o controle explicito.
- `packages/shared/src/modules/registry.ts:375-393`, `ADMIN_NAV_KEYS = {admin, super_admin}` (triplo-trava parte 1: conjunto de chaves de nav de tenant-admin) e `navKeysForContext(navCtx): Role[]`, que so emite uma chave admin-tier se `navCtx.roles.includes(viewRole)` (triplo-trava parte 2: posse real). O critico validou esse gate como solido; ele deve ser PRESERVADO intacto.
- `packages/shared/src/modules/registry.ts:403-416`, `buildNavigation(enabledIds, navCtx: NavContext)` itera modulos x navKeys. E o consumidor de `navKeysForContext`.
- `packages/shared/src/modules/index.ts:1-24`, barril que reexporta `navRoleForContext`, `navKeysForContext`, `buildNavigation`, `NavContext`, `NavContextShape`, `Role`, etc. Consumido por `@eximia/shared`.
- `apps/web/src/lib/navigation.ts:107-122`, `getNavigation(enabledModules, navCtx: NavContext)` chama `buildNavigation`. E o adaptador web -> shared.
- `apps/web/src/components/layout/header.tsx:21-38`, `HeaderProps` recebe `user: { full_name; roles: Role[] }` (roles ja chega ANINHADO em `user`, confirmado; NAO ha prop `roles` top-level). Ja tem props top-level `activeContext: AvailableContext` e `availableContexts: AvailableContext[]`. NAO ha `activeLens`/`eligibleLenses`.
- `apps/web/src/components/layout/header.tsx:84-99`, bloco de filtros do gestor. Comentario (linhas 84-87) chama o ContextSwitcher de "Contexto (lente de papel)" e ancora o rotulo "Contexto". ISTO E O MISLABEL que D5(c) manda corrigir: o ContextSwitcher e eixo de POPULACAO (Minha Trilha / Meu Time / Minha Org), nao de papel.
- `apps/web/src/components/layout/header.tsx:61-64,122`, `primaryRoleLabel(roles)` deriva um rotulo de precedencia SO para exibicao no menu do usuario (nunca um gate). Reusavel como base do rotulo da lente.
- `apps/web/src/app/(platform)/layout.tsx:35,43,143,145-156`, `const { user, profile, roles } = await getAuthProfile()`; `roles` disponivel como `string[]`. Sidebar recebe `roles={roles as Role[]}` (143). Header e montado em 145-156 com `user={{ full_name, roles: roles as Role[] }}`, `activeContext`, `availableContexts`. E onde ligamos as novas props.
- `apps/web/src/lib/auth.ts:34-72`, `getAuthProfile()` retorna `{ user, profile, roles: effectiveRoles, hasSubordinates, hasEnrollment, ... }`. `roles` = union de chapeus de `user_roles` (E1). Nao ha campo de lente.
- `apps/web/src/lib/context-resolver.ts:14-117`, eixo de POPULACAO. `AvailableContext { type: "personal"|"team"|"organization"; id; label }`, `resolveContext()`. Este e o eixo que NAO deve ser confundido com papel.
- `apps/web/src/lib/context-context.ts:4,25`, cookie `x-active-context` (`CONTEXT_COOKIE`), UI hint de populacao, "NEVER grants permission". A lente de papel e um EIXO SEPARADO deste.
- `apps/web/src/components/layout/sidebar.tsx:105-133`, `getNavigation(enabledIds, { context, roles })` monta e agrupa nav por `{section}`; o agrupador empurra um NOVO grupo a cada marcador `{section}` e NAO funde labels iguais (relevante para S3, nao para esta story, mas o contrato de lente precisa nao introduzir marcadores duplicados).
- `apps/web/src/lib/role-helpers.ts:12-18`, `hasRole(profile, role)` / `hasAnyRole(profile, roles)` puros sobre `profile.roles` (union). Base para o helper `isManagerLens` desta story consumir posse real.

## Escopo decidido

Aplica D5(a), D5(b), D5(c) e D4. Cria o eixo de lente de papel e o reconcilia com o eixo de populacao. Preserva o triplo-trava de admin.

1. **Tipo `RoleLens` (D5b) em `registry.ts`.** Nova uniao FECHADA de lentes de papel apresentaveis: `type RoleLens = "student" | "instructor" | "manager"`. `RoleLens` NUNCA inclui `super_admin`, `admin` nem `leader` como lente distinta. Documentado NA SPEC: `super_admin`/`admin` operam pela lente de ADMINISTRACAO que continua sendo gated por posse via `ADMIN_NAV_KEYS` (nao vira uma lente separada nesta M1), e `leader` (educador) NAO e uma lente distinta e e mapeado para `student` explicitamente (ver decisao abaixo).
2. **`resolveRoleLens` / `eligibleRoleLenses` (D5b) em `registry.ts`.** Funcoes puras que, dado o union de chapeus `roles: Role[]` e uma escolha opcional de lente, resolvem: (a) quais lentes o usuario pode assumir (`eligibleRoleLenses(roles): RoleLens[]`), e (b) a lente ativa (`resolveRoleLens(roles, requested?): RoleLens`). Decisao cravada na spec: **`resolveRoleLens` NUNCA retorna `"leader"`**; um usuario leader-puro nao ve o switcher (uma unica lente elegivel) e e tratado pelo caminho de Role via mapeamento `leader -> student` na producao de `eligibleRoleLenses`.
3. **Helper `isManagerLens` (contrato para S3/S4) em `registry.ts`.** `isManagerLens(activeLens: RoleLens): boolean` (=== "manager"). Este e o conceito que a S3 consome para migrar o SSR gate de `analytics/page.tsx:116` (D3) e que a S4 consome para decidir "estou operando como gestor?". S1 e DONA da assinatura; S3/S4 apenas importam.
4. **Ponte lente -> nav (`navRoleForContext` reconciliado).** Introduzir `navRoleForRoleLens(lens: RoleLens): Role` (mapeia 1:1: `student->student`, `instructor->instructor`, `manager->manager`), e estender `NavContext` para carregar a lente ativa como fonte da chave de nav quando presente, mantendo `navKeysForContext` (triplo-trava) intacto. Compatibilidade: quando a lente nao for informada, o comportamento LEGADO (`navRoleForContext` por contexto+precedencia) permanece byte-a-byte, para nao quebrar S2/S3 antes de migrarem.
5. **Novas props do Header `activeLens` / `eligibleLenses` (D5a).** Adicionar como props TOP-LEVEL do `Header` (nao aninhadas em `user`), tipadas `activeLens: RoleLens` e `eligibleLenses: RoleLens[]`. Corrigir o recon: `roles` continua em `user.roles` (aninhado, ja e assim), nao vira prop top-level.
6. **Componente `RoleLensSwitcher` + marcador "Vendo como: X" (D5a).** Novo client component que renderiza o dropdown de lente e o marcador textual "Vendo como: {label}". Auto-oculta quando `eligibleLenses.length <= 1`. Coloca-se no bloco de filtros do Header, ao lado do ContextSwitcher, com divisor sutil (mesmo padrao ja existente).
7. **Correcao do mislabel (D5c).** Reescrever o comentario em `header.tsx:84-87`: ContextSwitcher = eixo de POPULACAO (qual grupo de alunos), RoleLensSwitcher = eixo de PAPEL (qual superficie). Remover a expressao "lente de papel" da descricao do ContextSwitcher.
8. **Wiring em `layout.tsx` (D5a).** Resolver `eligibleLenses`/`activeLens` no servidor (a partir de `roles` de `getAuthProfile` + cookie de lente, ver Dados) e passar ao Header nas linhas 145-156.
9. **Persistencia da lente (cookie proprio, eixo separado).** Novo cookie `x-role-lens` (UI hint, forma validada, nunca privilegio), simetrico a `x-active-context`, para a escolha de lente persistir entre navegacoes. Server actions `switchRoleLens` / `exitRoleLens`.
10. **D4 acentos.** Todo AC/teste/codigo novo usa literais acentuados exatos onde existirem (ex.: "Gestão do Time" em `registry.ts:195` NAO e tocado aqui, mas qualquer referencia textual usa o literal acentuado). O marcador de lente usa rotulos acentuados de `roleLabels` reusados de `header.tsx:40-47` ("Gestor", "Instrutor", "Aluno").

## Fora de escopo

- Migracao dos gates de disparo do engajamento (campaign, suggestions/generate, suggestions/[id], notifications/nudge, admin/notifications POST) e do gate de admissao de analytics/manager/nudge para union, **S5** (seguranca, lands primeiro).
- Escopo de LEITURA da pagina do engajamento (roster/historico/sugestoes/audiences/eficacia) + subtracao de UI, **S4** (consome o helper de lente desta story; nunca re-migra gate).
- Mover o item Analytics para a chave `manager` do modulo `admin` e remove-lo do modulo `analytics` + migracao do SSR `analytics/page.tsx:116` para union, **S3** (D2, D3). S3 consome `isManagerLens`/`RoleLens` desta story.
- Estender candidate pool para group-owner nodes + `resolveGroupOwningNodes`, **S2** (D6).
- Migracao de `auth_user_role()` (DB) para union, sinalizado por **S5/D8**, fora de escopo geral.
- Remover aprendizado da lente Gestor; Rinaldo ver 2 lentes juntas; composicao Unidade x Time, DEFERIDO (nao mexer).

## Mudancas de codigo (POR ARQUIVO, com assinatura/shape)

### `packages/shared/src/modules/registry.ts` (DONO desta story)

Adicionar apos o bloco de `NavContext`/`navKeysForContext` (nao remover nada existente):

```ts
// ---------------------------------------------------------------------------
// Role lens (S1), the PAPEL axis. Orthogonal to the POPULATION axis
// (x-active-context / ContextSwitcher). A lens decides WHICH surface renders;
// it NEVER widens permission. Admin-tier surfaces stay gated by posse via
// ADMIN_NAV_KEYS. RLS remains the only authorization trava.
// ---------------------------------------------------------------------------

/**
 * Presentable role lenses. CLOSED union, intentionally excludes admin/
 * super_admin (they operate via the posse-gated admin nav, not a lens in M1)
 * and `leader` (educador is mapped to `student`, never a distinct lens).
 */
export type RoleLens = "student" | "instructor" | "manager"

/** Precedence when auto-picking the default lens (highest management first). */
const ROLE_LENS_PRECEDENCE: RoleLens[] = ["manager", "instructor", "student"]

/**
 * Which lenses this person may assume, from the UNION of hats.
 *   - `manager` lens requires the `manager` hat.
 *   - `instructor` lens requires the `instructor` hat.
 *   - `student` lens: available to anyone who is a student OR a `leader`
 *     (leader/educador is mapped to student, it is NOT a distinct lens).
 *   - admin/super_admin do NOT add a lens (admin surface is posse-gated by
 *     ADMIN_NAV_KEYS, not a lens). A pure admin therefore sees `student` only,
 *     unless they also hold manager/instructor.
 * Guarantee: never empty, falls back to ["student"].
 */
export function eligibleRoleLenses(roles: Role[]): RoleLens[] {
  const out: RoleLens[] = []
  if (roles.includes("manager")) out.push("manager")
  if (roles.includes("instructor")) out.push("instructor")
  if (roles.includes("student") || roles.includes("leader")) out.push("student")
  if (out.length === 0) out.push("student")
  // stable order by precedence
  return ROLE_LENS_PRECEDENCE.filter((l) => out.includes(l))
}

/**
 * Resolve the ACTIVE lens. `requested` is the (already form-validated) cookie
 * choice; honoured only if it is genuinely eligible, else the highest-precedence
 * eligible lens. NEVER returns "leader".
 */
export function resolveRoleLens(roles: Role[], requested?: RoleLens | null): RoleLens {
  const eligible = eligibleRoleLenses(roles)
  if (requested && eligible.includes(requested)) return requested
  return eligible[0]
}

/** Contract consumed by S3 (SSR gate migration, D3) and S4 (read scoping). */
export function isManagerLens(lens: RoleLens): boolean {
  return lens === "manager"
}

/** Map a resolved lens to the nav view-role (1:1; leader never reaches here). */
export function navRoleForRoleLens(lens: RoleLens): Role {
  return lens // RoleLens ⊂ Role, structurally identical for these three
}
```

Estender `NavContext` de forma retrocompativel (a lente e OPCIONAL; ausencia = comportamento legado):

```ts
export interface NavContext {
  roles: Role[]
  context: NavContextShape
  /** S1: active role lens. When present, it is the AUTHORITATIVE source of the
   *  view-role (via navRoleForRoleLens); when absent, legacy context+precedence
   *  (navRoleForContext) is used. Kept optional so S2/S3 migrate incrementally. */
  lens?: RoleLens
}
```

Ajuste MINIMO em `navKeysForContext` para consumir a lente quando presente, preservando o triplo-trava:

```ts
export function navKeysForContext(navCtx: NavContext): Role[] {
  // S1: if a lens is set, it authoritatively picks the view role; otherwise
  // fall back to the legacy context/precedence resolution. The ADMIN_NAV_KEYS
  // posse gate below is UNCHANGED, a lens can never mint an admin key.
  const viewRole = navCtx.lens ? navRoleForRoleLens(navCtx.lens) : navRoleForContext(navCtx)
  if (!ADMIN_NAV_KEYS.has(viewRole)) return [viewRole]
  return navCtx.roles.includes(viewRole) ? [viewRole] : ["manager"]
}
```

Nota de invariante (na spec, nao no codigo): como `RoleLens` nunca e `admin`/`super_admin`, o ramo `ADMIN_NAV_KEYS.has(viewRole)` so e alcancavel pelo caminho legado (`navRoleForContext`), portanto a lente jamais amplia para chave admin. O triplo-trava (posse + revalidacao servidor + `ADMIN_NAV_KEYS`) fica intacto.

### `packages/shared/src/modules/index.ts`

Adicionar aos exports: `eligibleRoleLenses`, `resolveRoleLens`, `isManagerLens`, `navRoleForRoleLens` e o tipo `RoleLens`.

### `apps/web/src/lib/role-lens-context.ts` (NOVO, simetrico a `context-context.ts`)

Cookie `x-role-lens` como UI hint puro. Forma validada; nunca privilegio.

```ts
import { cookies } from "next/headers"
import type { RoleLens } from "@eximia/shared"

const LENS_COOKIE = "x-role-lens"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8h, mirrors x-active-context
const VALID: readonly RoleLens[] = ["student", "instructor", "manager"]

/** Reads + validates the FORM only. Invalid => null (fresh state). */
export async function getRoleLensCookie(): Promise<RoleLens | null> {
  const raw = (await cookies()).get(LENS_COOKIE)?.value
  return raw && (VALID as string[]).includes(raw) ? (raw as RoleLens) : null
}
export async function setRoleLensCookie(lens: RoleLens) { /* httpOnly, secure, sameSite:'strict', maxAge, path:'/' */ }
export async function clearRoleLensCookie() { /* delete */ }
```

### `apps/web/src/app/(platform)/role-lens/actions.ts` (NOVO)

Server actions `switchRoleLens(lens: RoleLens)` e `exitRoleLens()`. `switchRoleLens` re-resolve via `resolveRoleLens(roles, lens)` sobre `roles` de `getAuthProfile()` (SERVIDOR e a autoridade; um valor forjado que nao e elegivel cai para a lente de maior precedencia, nunca amplia). Escreve/limpa o cookie e NAO chama `revalidatePath` (o `router.refresh()` do client re-renderiza a arvore com o novo cookie, mesmo padrao do ContextSwitcher).

### `apps/web/src/components/layout/role-lens-switcher.tsx` (NOVO, client)

```tsx
interface RoleLensSwitcherProps {
  active: RoleLens
  eligible: RoleLens[]          // <= 1 => renderiza null
}
```
Dropdown + marcador textual "Vendo como: {label}", com `label` vindo de um mapa acentuado (`manager: "Gestor"`, `instructor: "Instrutor"`, `student: "Aluno"`) reusado do padrao de `roleLabels` (header.tsx:40-47). `onSelect(lens)` chama `switchRoleLens(lens)` (ou `exitRoleLens()` para voltar ao default) via `useTransition` + `router.refresh()`, espelhando `context-switcher.tsx`.

### `apps/web/src/components/layout/header.tsx`

- Estender `HeaderProps` com props TOP-LEVEL: `activeLens: RoleLens` e `eligibleLenses: RoleLens[]` (roles CONTINUA em `user.roles`, sem prop nova).
- Renderizar `<RoleLensSwitcher active={activeLens} eligible={eligibleLenses} />` dentro do bloco `divide-x` de filtros (linhas 88-100), ANTES do ContextSwitcher, com o mesmo wrapper `empty:hidden` + padding/divisor.
- Corrigir o comentario 84-87: descrever ContextSwitcher como eixo de POPULACAO (Minha Trilha/Meu Time/Minha Org) e RoleLensSwitcher como eixo de PAPEL (Vendo como). Remover "lente de papel" da linha do ContextSwitcher.

### `apps/web/src/app/(platform)/layout.tsx`

- Apos `resolveContext()`, resolver a lente no servidor:
```ts
const { getRoleLensCookie } = await import("@/lib/role-lens-context")
const requestedLens = await getRoleLensCookie()
const eligibleLenses = eligibleRoleLenses(roles as Role[])
const activeLens = resolveRoleLens(roles as Role[], requestedLens)
```
- Passar `activeLens={activeLens}` e `eligibleLenses={eligibleLenses}` ao `<Header ... />` (linhas 145-156). Nao alterar Sidebar nesta story (Sidebar migra para lente em S3/S2 conforme consumam `NavContext.lens`; aqui mantemos `getNavigation` legado por retrocompatibilidade).

## Dados-RLS-Seguranca

- **Nenhuma escrita de DB, nenhuma mudanca de RLS nesta story.** A lente e um UI hint no cookie `x-role-lens`, exatamente como `x-active-context`: pode apenas ESTREITAR a superficie a um subconjunto do que a posse (`roles`) e a RLS ja permitem. Forjar o cookie nao concede nada: `resolveRoleLens` so honra uma lente que esteja em `eligibleRoleLenses(roles)`, e `eligibleRoleLenses` deriva exclusivamente do union de chapeus real de `getAuthProfile()` (E1, `user_roles`). Uma lente forjada fora do elegivel colapsa para a lente de maior precedencia elegivel.
- **Triplo-trava de admin preservado (nao regride):** a lente nunca produz `admin`/`super_admin` (uniao fechada), logo nunca alcanca `ADMIN_NAV_KEYS`; o gate de posse de `navKeysForContext` (registry.ts:387-393) fica byte-a-byte. Itens de administracao do tenant continuam invisiveis a quem nao POSSUI o chapeu admin, independentemente da lente escolhida.
- **A autoridade e o servidor:** a server action `switchRoleLens` re-resolve pela mesma funcao pura antes de gravar o cookie; o client (RoleLensSwitcher) nunca e autoridade, so envia a intencao.
- **Limitacao conhecida (ligada a S5/D8):** esta story nao toca `profile.role` singular nem `auth_user_role()`. A lente NAO conserta o escape multi-chapeu de gates que leem `profile.role` singular, isso e responsabilidade da S5. S1 apenas fornece o conceito de lente/`isManagerLens` que S3/S4 consomem; onde um gate singular ainda existir (rotas de disparo), o comportamento e o de hoje ate a S5 migrar. Documentado para nao dar falsa sensacao de defense-in-depth.

## Acceptance Criteria (numerados)

1. Existe `type RoleLens = "student" | "instructor" | "manager"` em `registry.ts`, exportado pelo barril `index.ts`, e ele NAO inclui `admin`, `super_admin` nem `leader`.
2. `eligibleRoleLenses(roles)` retorna as lentes corretas por posse: manager<-manager, instructor<-instructor, student<-(student OU leader); admin/super_admin puros retornam `["student"]`; nunca retorna lista vazia; ordem estavel por precedencia `manager > instructor > student`.
3. `resolveRoleLens(roles, requested)` retorna `requested` quando elegivel, senao a lente de maior precedencia elegivel; NUNCA retorna `"leader"`; um `requested` forjado nao-elegivel colapsa para a maior precedencia elegivel.
4. `isManagerLens(lens)` e `true` sse e somente se `lens === "manager"`; a assinatura e exportada e consumivel por S3 e S4.
5. `navKeysForContext` com `lens` presente escolhe a view-role via `navRoleForRoleLens(lens)`; com `lens` ausente, o resultado e IDENTICO ao legado (`navRoleForContext`). Em nenhum caso uma lente produz uma chave admin-tier sem posse: um usuario com `roles=["manager"]` e `lens="manager"` nunca recebe chave `admin`/`super_admin`.
6. O `Header` aceita `activeLens: RoleLens` e `eligibleLenses: RoleLens[]` como props TOP-LEVEL; `user.roles` permanece aninhado em `user`.
7. `RoleLensSwitcher` renderiza `null` quando `eligibleLenses.length <= 1` (ex.: aluno puro, admin puro), e renderiza o dropdown + marcador "Vendo como: {label}" quando ha 2+ lentes; os labels sao acentuados ("Gestor", "Instrutor", "Aluno").
8. Selecionar uma lente chama `switchRoleLens`, que grava `x-role-lens` apos re-resolver no servidor; `router.refresh()` re-renderiza com o novo cookie. Voltar ao default via `exitRoleLens` limpa o cookie.
9. O comentario de `header.tsx:84-87` nao chama mais o ContextSwitcher de "lente de papel"; descreve ContextSwitcher = eixo de populacao e RoleLensSwitcher = eixo de papel.
10. `layout.tsx` resolve `activeLens`/`eligibleLenses` no servidor a partir de `roles` + cookie e os passa ao Header; nenhuma regressao no wiring de `activeContext`/`availableContexts` (populacao) nem na Sidebar (mantida legada).
11. Nenhum gate de seguranca de rota de disparo, nenhum SSR gate de analytics e nenhum escopo de leitura de engajamento e modificado por esta story (pertencem a S5/S3/S4).
12. (Item de UX aberto, sinalizado, nao um AC de codigo) O Header passa a exibir potencialmente 3 controles (AreaSelector/Unidade, ContextSwitcher/Populacao, RoleLensSwitcher/Papel); a validacao do layout dos 3 controles fica marcada para Hugo aprovar.

## Plano de testes (first-move rule)

Primeiro movimento: teste RED que prova a ausencia do eixo de lente e o mislabel, ANTES de qualquer implementacao.

1. **RED (registry, `packages/shared`):** teste que importa `RoleLens`/`resolveRoleLens`/`eligibleRoleLenses`/`isManagerLens` de `@eximia/shared` e falha na compilacao/execucao por inexistencia. Depois, GREEN cobrindo:
   - `eligibleRoleLenses(["manager","instructor","student"])` => `["manager","instructor","student"]`.
   - `eligibleRoleLenses(["admin"])` => `["student"]`.
   - `eligibleRoleLenses(["leader"])` => `["student"]` (leader mapeado, nunca lente `leader`).
   - `resolveRoleLens(["manager","student"], "student")` => `"student"`; `resolveRoleLens(["manager","student"], "instructor")` => `"manager"` (nao-elegivel colapsa).
   - `resolveRoleLens(["leader","student"])` nunca === `"leader"`.
2. **RED->GREEN (triplo-trava):** `navKeysForContext({ roles:["manager"], context:{type:"team"}, lens:"manager" })` nunca contem `"admin"`/`"super_admin"`. `navKeysForContext({ roles:["admin"], context:{type:"organization"} })` (sem lens) IDENTICO ao legado (regression snapshot). Prova que lente nao mint chave admin.
3. **RED (Header props):** teste de tipos/render que monta `<Header>` sem `activeLens`/`eligibleLenses` e falha; GREEN apos adicionar as props. Assert que `user.roles` continua aninhado.
4. **GREEN (RoleLensSwitcher):** render com `eligible.length===1` => nao renderiza nada; com 2+ => renderiza "Vendo como: Gestor" e as opcoes acentuadas; clicar dispara a action mockada.
5. **GREEN (cookie/action):** `getRoleLensCookie` rejeita valor invalido (=> null) e aceita valido; `switchRoleLens` re-resolve pelo servidor (mock `getAuthProfile` com `roles`) e recusa lente nao-elegivel gravando a de maior precedencia.
6. **Regression (mislabel):** teste de string/render assertando que o texto/comment do Header nao contem "lente de papel" associado ao ContextSwitcher (ou snapshot atualizado).

## Dependencias

- **Nenhuma dependencia de codigo de outras stories para LANDAR** (S1 e pura infra de lente + shared contract). Sequenciamento do epico: S5 -> S1 -> S2 -> S3, S4 apos S5. S1 pode landar apos S5 sem consumir nada de S5.
- **S1 e DONA e PRODUZ os contratos** `RoleLens`, `resolveRoleLens`, `eligibleRoleLenses`, `isManagerLens`, `navRoleForRoleLens`, `NavContext.lens`, e as props `activeLens`/`eligibleLenses` do Header. **S2** consome `RoleLens`/`NavContext.lens` para a nav do gestor; **S3** consome `isManagerLens`/`RoleLens` para migrar o SSR gate (D3) e para o UnitComparison (D7); **S4** consome `isManagerLens` para decisao de papel na leitura do engajamento. Nenhuma dessas stories re-define esses contratos.
- Depende do barril `@eximia/shared` (packages/shared) ser recompilado para expor os novos exports antes de `apps/web` consumir.

## Riscos

- **Maior risco: proliferacao de eixos no Header confundir o gestor** (agora ate 3 controles: Unidade, Populacao/Contexto, Papel/Lente). Mitigacao: RoleLensSwitcher auto-oculta com <=1 lente (aluno puro e admin puro nao veem nada novo), divisor sutil reusa o padrao existente, e o item fica SINALIZADO como UX aberto para Hugo validar (AC12). Nao e risco de seguranca, e de clareza.
- **Risco de retrocompatibilidade:** tornar `NavContext.lens` opcional mantem S2/S3 funcionando ate migrarem; um erro seria fazer a lente authoritative sempre e quebrar o nav legado da Sidebar (que ainda passa `{ context, roles }` sem `lens`). Mitigado pelo ramo `navCtx.lens ? ... : navRoleForContext(navCtx)`.
- **Risco de falsa sensacao de seguranca:** alguem poderia achar que a lente "conserta" o escape multi-chapeu dos gates singulares. Ela NAO conserta (S5 e a dona disso); documentado explicitamente em Dados-RLS-Seguranca para evitar que S3/S4 assumam garantia inexistente.