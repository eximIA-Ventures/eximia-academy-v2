// =============================================================================
// Mundo do ADMIN — decisões PURAS consumidas pelo middleware (3º workspace)
// =============================================================================
//
// O middleware não tem harness de teste neste repo, então toda decisão dele que
// carrega risco vive aqui como função pura, testável em `__tests__`. O
// middleware fica sendo só o encanamento (ler cookies, redirecionar).
//
// Regra dura 3 da doutrina de workspaces: todo gate de papel usa CHAPÉUS REAIS
// (`user_roles`), NUNCA a coluna singular `users.role`.
// =============================================================================

import { ADMIN_ROUTE_ROLES, type AdminRoute, canOpenAdminRoute } from "@/lib/admin-route-access"

/** Chapéu admin-tier pela união de chapéus reais. */
export function isAdminTier(hats: string[]): boolean {
  return hats.some((h) => h === "admin" || h === "super_admin")
}

/**
 * Rotas que PERTENCEM ao mundo do admin (allowlist deliberada, não
 * `startsWith("/admin")`).
 *
 * `/admin/notifications`, `/admin/areas`, `/admin/job-roles` e `/admin/users`
 * ficam DE FORA por CONSERVADORISMO DELIBERADO: são as rotas sob `/admin/` que
 * NÃO são exclusivas do mundo admin. `/admin/areas` abre também para `manager` e
 * `/admin/job-roles` para `manager` e `instructor` (ver `ADMIN_ROUTE_ROLES` em
 * `admin-route-access.ts`), e as quatro seguem vivas fora do hub de
 * Configurações. Como `shouldEnterAdminWorld` FLIPA o cookie de mundo no mesmo
 * request, só flipamos em rota que a pessoa realmente CONSEGUE abrir — e essa
 * garantia agora é do código, não deste comentário (ver `pageGuardAdmits`).
 *
 * CORREÇÃO DE AUDITORIA (rodada 3): a justificativa anterior era FALSA. Ela
 * dizia que "um `admin + instructor` clicando 'Engajamento' dentro do Estúdio
 * seria expulso do Estúdio". Esse caminho NÃO EXISTE no código:
 *   - o Estúdio renderiza `components/studio/studio-sidebar.tsx`, que tem ZERO
 *     link `/admin/*` (`grep -n "/admin" .../studio-sidebar.tsx` não casa nada);
 *   - a chave `instructor` do registry (a única com `/admin/notifications`) é
 *     estruturalmente inalcançável no mundo Padrão — `navKeysForContext` faz
 *     `if (viewRole === "instructor") return ["student"]`.
 * A exclusão continua (é conservadora e não custa nada); a justificativa é que
 * estava errada, e justificativa errada induz o próximo mantenedor ao erro.
 */
export const ADMIN_WORLD_PATHS = [
  "/admin/configuracoes",
  // ADM-1/2/3 — a régua desta lista é EXCLUSIVIDADE, não o prefixo `/admin/`.
  // `/admin/visao-geral` só abre para admin-tier (o guard está no loader dela,
  // `admin/visao-geral/loader.ts`, união de chapéus como o hub), então o
  // deep-link pode flipar o mundo sem risco de levar alguém a uma rota que ele
  // não consegue abrir. Como o hub, ela NÃO tem entrada em `ADMIN_ROUTE_ROLES`:
  // o guard dela é admin-tier, não uma lista de papéis por rota.
  "/admin/visao-geral",
  "/admin/manager-groups",
  "/admin/settings",
  "/admin/audit",
  "/admin/plans",
  "/admin/integrations",
  "/admin/api-keys",
  "/admin/webhooks",
  "/admin/biblioteca",
] as const

/** True quando o pathname é a home do mundo admin ou uma rota da allowlist. */
export function isAdminWorldPath(pathname: string): boolean {
  if (pathname === "/admin") return true
  return ADMIN_WORLD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// =============================================================================
// 4º MUNDO — SUPER ADMIN (rodada 9)
// =============================================================================
//
// `/admin/tenants` SAIU de `ADMIN_WORLD_PATHS` e entrou aqui. Ela nunca foi uma
// rota da administração DE uma empresa: `ADMIN_ROUTE_ROLES["/admin/tenants"]` é
// `["super_admin"]` sozinho, e era justamente ela que obrigou a terceira trava
// (`pageGuardAdmits`, rodada 4) e o redirect de permanência (rodada 5) — duas
// redes para o mesmo desencaixe. Com o 4º mundo, "Empresas" passa a pertencer
// ao mundo cujo guard é o mesmo dela, e o desencaixe deixa de existir.
//
// A URL NÃO muda (`/admin/tenants` continua sendo `/admin/tenants`, com a mesma
// página e o mesmo guard); o que muda é para qual MUNDO o deep-link a leva.

/** Rotas que pertencem ao MUNDO DO SUPER ADMIN, além da home `/super-admin`. */
export const SUPER_WORLD_PATHS = ["/admin/tenants"] as const

/** True quando o pathname é a home do 4º mundo ou uma rota dele. */
export function isSuperWorldPath(pathname: string): boolean {
  if (pathname === "/super-admin") return true
  return SUPER_WORLD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Deve o deep-link SETAR o mundo do super admin? Duas travas: o chapéu real
 * `super_admin` e uma rota que pertence ao mundo. Não precisa da terceira trava
 * (`pageGuardAdmits`) porque o conjunto do mundo e o conjunto das páginas dele
 * são o MESMO (`super_admin`) — a divergência que exigia a trava era exatamente
 * `/admin/tenants` dentro do mundo admin, e ela mudou de mundo.
 */
export function shouldEnterSuperWorld(pathname: string, hats: string[]): boolean {
  return hats.includes("super_admin") && isSuperWorldPath(pathname)
}

/**
 * O guard da PÁGINA admite estes chapéus nesta rota?
 *
 * Correção de auditoria (rodada 4), TERCEIRA TRAVA. Até aqui `shouldEnterAdminWorld`
 * exigia só `isAdminTier` + allowlist, e o comentário de `ADMIN_WORLD_PATHS`
 * afirmava que a allowlist só continha rota "que pertence ao mundo sem
 * ambiguidade". `/admin/tenants` desmentia a afirmação: o middleware flipava o
 * cookie de mundo para `admin` para QUALQUER admin-tier, mas a página é
 * `super_admin` SOZINHO (`ADMIN_ROUTE_ROLES["/admin/tenants"]`) e rebate o admin
 * comum para `/dashboard` — que reescreve o cookie para `standard`. O admin
 * comum (ou o `admin + instructor`, que estava no Estúdio) era prometido a um
 * mundo por uma rota que ele não podia abrir, e terminava fora do mundo em que
 * estava.
 *
 * A trava é o MESMO conjunto que a página usa, não uma segunda cópia da regra.
 * Rota do mundo sem entrada em `ADMIN_ROUTE_ROLES` — hoje `/admin` (a home, W2)
 * e `/admin/configuracoes` (o hub) — devolve `true` de propósito: o guard delas
 * É admin-tier, aplicado no `layout.tsx` do hub e no próprio middleware, e
 * `isAdminTier` já foi checado por quem chama.
 *
 * POR QUE NÃO É REGRESSÃO (W4): a trava só pode negar onde `canOpenAdminRoute`
 * é mais estreito que `isAdminTier`, e hoje `/admin/tenants` é a ÚNICA rota da
 * allowlist nessa condição. Quem ela passa a barrar (admin comum em
 * `/admin/tenants`) já era rebatido pela página no mesmo request — ninguém
 * perde acesso a nada, só deixa de ser jogado num mundo de onde seria expulso.
 * O `super_admin` continua entrando pelo deep-link, exatamente como antes.
 */
function pageGuardAdmits(pathname: string, hats: string[]): boolean {
  const route = (Object.keys(ADMIN_ROUTE_ROLES) as AdminRoute[]).find(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  )
  if (!route) return true
  return canOpenAdminRoute(route, hats)
}

/**
 * Deve o deep-link SETAR o mundo admin? Exige as TRÊS travas: o chapéu real
 * admin-tier, uma rota que pertence ao mundo (allowlist acima) e o guard da
 * própria página admitindo esses chapéus (`pageGuardAdmits`).
 */
export function shouldEnterAdminWorld(pathname: string, hats: string[]): boolean {
  return isAdminTier(hats) && isAdminWorldPath(pathname) && pageGuardAdmits(pathname, hats)
}

/**
 * Para onde mandar quem foi RECUSADO por uma rota do MUNDO ADMIN.
 *
 * Correção de auditoria (rodada 5), EJEÇÃO RESIDUAL. A trava da rodada 4
 * (`pageGuardAdmits`) cobre a ENTRADA no mundo, não a PERMANÊNCIA. Um `admin`
 * comum JÁ DENTRO do mundo que pedisse `/admin/tenants` (URL na barra,
 * bookmark, histórico) era rebatido pela página para `/dashboard` — e
 * `/dashboard` reescreve o cookie `x-active-workspace` para `standard`
 * (`middleware.ts`). Ele era EXPULSO DO MUNDO por pedir uma rota do próprio
 * mundo que não podia abrir. Recusar a ROTA é correto; recusar o MUNDO não é.
 *
 * Quem é admin-tier volta para `/admin`, a home do mundo (W2). Quem não é
 * continua indo para `/dashboard`, exatamente como antes — para esses o
 * destino é byte-idêntico, então nada se perde (W4).
 *
 * Hoje a única rota do mundo capaz de recusar um admin-tier é `/admin/tenants`
 * (mais `/admin/tenants/[id]`), porque é a única cujo conjunto em
 * `ADMIN_ROUTE_ROLES` é mais estreito que admin-tier. O teste
 * `admin-world.test.ts` guarda esse invariante: se alguém estreitar OUTRA rota
 * do mundo, o canário fica vermelho e cobra este mesmo tratamento lá.
 */
export function adminWorldDeniedRedirect(hats: string[]): "/admin" | "/dashboard" {
  return isAdminTier(hats) ? "/admin" : "/dashboard"
}

/**
 * Rotas administrativas barradas para o INSTRUTOR PURO.
 *
 * Inventário preservado VERBATIM do middleware em HEAD (nada adicionado, nada
 * removido). Confira com:
 *   `git show HEAD:apps/web/src/middleware.ts | grep -n "admin/"` -> 4 linhas.
 *
 * Correção de auditoria (rodada 2), FURO 3: a rodada 1 tinha somado
 * `/admin/audit` a esta lista enquanto o comentário jurava "nada adicionado".
 * `/admin/audit` foi REMOVIDO daqui e a lista voltou às 4 originais — nada se
 * perde, porque a própria página de auditoria barra o instrutor pelo guard de
 * página (`canOpenAdminRoute("/admin/audit", ...)`, conjunto admin-tier).
 */
export const INSTRUCTOR_BLOCKED_PATHS = [
  "/admin/users",
  "/admin/settings",
  "/admin/api-keys",
  "/admin/webhooks",
] as const

/**
 * "Instrutor PURO" pelo eixo de CHAPÉUS (correção de auditoria — eixo duplo).
 *
 * O bloqueio antigo lia `users.role === "instructor"`, a coluna singular, ainda
 * por cima cacheada em cookie por 5 minutos. Resultado: alguém com chapéu
 * `admin` e `users.role = "instructor"` PASSAVA no guard do hub (que já usa
 * chapéus) e era EXPULSO do resto de `/admin` no mesmo request — os dois eixos
 * discordando dentro da mesma requisição.
 *
 * `manager` entra na exclusão por obrigação, não por gosto: um
 * `instructor + manager` tem hoje `users.role = "manager"` por precedência e
 * portanto NÃO é bloqueado. Sem excluir `manager` aqui, ele passaria a ser
 * bloqueado — regressão real.
 */
export function isInstructorOnly(hats: string[]): boolean {
  return (
    hats.includes("instructor") &&
    !hats.some((h) => h === "admin" || h === "super_admin" || h === "manager")
  )
}

/** True quando a rota deve ser barrada para este conjunto de chapéus. */
export function isBlockedForInstructor(pathname: string, hats: string[]): boolean {
  if (!isInstructorOnly(hats)) return false
  return INSTRUCTOR_BLOCKED_PATHS.some((p) => pathname.startsWith(p))
}
