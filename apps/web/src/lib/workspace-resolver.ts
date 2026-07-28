import type { WorkspaceId } from "@/lib/workspace-context"
import type { Role } from "@eximia/shared"

/**
 * POLÍTICA DO CHAPÉU: quem entra no Estúdio (rodada 7).
 *
 * Antes: SÓ o chapéu `instructor`. Agora: `instructor` OU `super_admin`. É
 * POLÍTICA DE CHAPÉU, não exceção de e-mail chumbado — o dono do produto
 * (`super_admin`, `tenant_id` nulo) alcança os TRÊS mundos por ser super_admin,
 * e qualquer futuro super_admin herda o mesmo alcance.
 *
 * O `admin` de tenant NÃO entra aqui de propósito: o dono pediu as três portas
 * para o `super_admin`, e alargar para admin comum seria decisão que ele não
 * tomou (ver o relatório, "poder NÃO concedido").
 *
 * Esta é a ÚNICA definição de "alcança o Estúdio" — `accessibleWorkspaces`
 * (a porta), `resolvePlatformShell` (o shell) e `canAuthorCourses` (a
 * autoridade dentro da sala) consomem TODOS daqui, para que porta e autoridade
 * nunca voltem a divergir. Os guards de rota (`(studio)/layout.tsx`,
 * `(studio)/instructor/page.tsx`, middleware `/instructor`) usam o mesmo
 * predicado — por isso ele aceita `string[]`, o formato dos chapéus crus do
 * middleware.
 */
export function canEnterStudio(roles: string[]): boolean {
  return roles.includes("instructor") || roles.includes("super_admin")
}

/** Which worlds a person may enter, derived from the union of hats (E1).
 *  instructor (ou super_admin, ver `canEnterStudio`) => Estúdio;
 *  student/manager hat => Padrão; admin/super_admin
 *  hat => Administração E Padrão (W4: o admin sempre pode ver o produto como o
 *  cliente vê). Order is stable (studio first) so single-access resolution is
 *  deterministic. Never empty for a real user: anyone reaching the platform
 *  holds at least one of these hats; as a defensive floor, a hatless user
 *  resolves to ["standard"]. */
export function accessibleWorkspaces(roles: Role[]): WorkspaceId[] {
  const out: WorkspaceId[] = []
  const isAdminTier = roles.includes("admin") || roles.includes("super_admin")
  if (canEnterStudio(roles)) out.push("studio")
  // W4: o admin-tier SEMPRE mantém a porta do Padrão (ver o produto como o cliente vê).
  if (
    roles.includes("student") ||
    roles.includes("manager") ||
    roles.includes("leader") ||
    isAdminTier
  )
    out.push("standard")
  if (out.length === 0) out.push("standard")
  // "admin" entra POR ÚLTIMO de propósito: nenhum out[0] existente muda de
  // valor, então a resolução de acesso ÚNICO (middleware, /workspace) continua
  // idêntica para todas as combinações que já existiam. Por W4 um admin nunca é
  // single-access, então esse out[0] nunca é consumido por ele.
  if (isAdminTier) out.push("admin")
  // 4º MUNDO (rodada 9) — SUPER ADMIN, concedido SÓ pelo chapéu `super_admin`.
  // Entra depois de "admin" pela MESMA razão: nenhum `out[0]` pré-existente se
  // move, então single-access continua resolvendo igual para todo mundo. O
  // `admin` de tenant não ganha nada aqui — a administração ENTRE empresas é do
  // dono do produto, e nenhum outro papel muda de porta nesta rodada.
  if (roles.includes("super_admin")) out.push("super")
  return out
}

/** True when the person can enter the given world. */
export function canAccessWorkspace(roles: Role[], ws: WorkspaceId): boolean {
  return accessibleWorkspaces(roles).includes(ws)
}

/** The landing route for a workspace. Studio => /instructor; Administração =>
 *  /admin (W2: a home do mundo admin é o PAINEL, não uma tela de ajuste);
 *  Super Admin => /super-admin; Padrão => /dashboard.
 *
 *  POR QUE `/super-admin` (rodada 9, escolha explicada): cada mundo tem como
 *  home um SEGMENTO DE TOPO próprio, com o nome do mundo — Padrão `/dashboard`,
 *  Estúdio `/instructor`, Administração `/admin`. O 4º segue o mesmo padrão em
 *  vez de se pendurar em `/admin/*` (que é a administração DE uma empresa) ou
 *  de adotar `/admin/tenants` como home (que é uma SEÇÃO do mundo, "Empresas",
 *  não a home). Nenhuma URL pública se move: `/super-admin` nunca existiu no
 *  app — era, aliás, o prefixo morto que uma rodada anterior removeu do
 *  registry. O painel global continua também em `/dashboard` para o caminho
 *  legado? NÃO: ver `resolveDashboardKind`, o mundo Padrão passa a mostrar o
 *  aluno. O painel global agora tem UM endereço só. */
export function workspaceHomeRoute(ws: WorkspaceId): string {
  if (ws === "studio") return "/instructor"
  if (ws === "admin") return "/admin"
  if (ws === "super") return "/super-admin"
  return "/dashboard"
}

/**
 * Which shell the (platform) route group must render for a request (BUG-2).
 *
 * The Studio nav ("Meus Cursos", "Conteúdo e Materiais", "Sessões e Lives",
 * "Acompanhamento", "Análises") deliberately links to SHARED pages that live in
 * the (platform) route group (/courses, /materiais, /lives, /trails, /analytics)
 * — only /instructor lives in (studio). Because Next.js route groups do not share
 * a layout, those pages would otherwise render the STANDARD shell, flipping the
 * instructor into "Plataforma de Aprendizagem" and losing the Estúdio he came
 * from. This decides the shell by the ACTIVE workspace, not by the route group.
 *
 * Fail-closed: a forged `studio` cookie without the real instructor hat resolves
 * to the standard shell (mirrors switchWorkspace/canAccessWorkspace). Absent or
 * standard workspace => standard shell.
 */
export function resolvePlatformShell(
  activeWorkspace: WorkspaceId | null,
  roles: Role[],
): WorkspaceId {
  if (activeWorkspace === "studio" && canEnterStudio(roles)) return "studio"
  // Mundo do admin (W1): mesma disciplina fail-closed do ramo studio — um cookie
  // `admin` forjado por quem não tem o chapéu resolve para o shell padrão.
  if (activeWorkspace === "admin" && (roles.includes("admin") || roles.includes("super_admin")))
    return "admin"
  // 4º mundo (rodada 9): mesma disciplina fail-closed, chapéu `super_admin` e
  // só ele. Um cookie `super` forjado por um admin de tenant cai no padrão.
  if (activeWorkspace === "super" && roles.includes("super_admin")) return "super"
  return "standard"
}

/**
 * Whether course-authoring actions ("Criar Curso", "Criar Blueprint", "Importar
 * com IA") may appear on /courses (BUG-2 side effect). Authoring belongs to the
 * Estúdio: it requires BOTH the active studio workspace AND um chapéu que
 * alcança o Estúdio (`canEnterStudio`). In the standard world (student "Minha
 * Trilha" or manager context) nobody authors — the old gating leaked because it
 * keyed off the singular role alone.
 *
 * Rodada 7: o `super_admin` passou a alcançar o Estúdio, então ele TAMBÉM
 * autora ali dentro. Isto é deliberado: dar a porta sem a autoridade produz uma
 * sala que abre e não funciona. O `admin` de tenant continua SEM autoria
 * (`canEnterStudio` não o inclui), byte a byte como antes.
 */
export function canAuthorCourses(activeWorkspace: WorkspaceId | null, roles: Role[]): boolean {
  return activeWorkspace === "studio" && canEnterStudio(roles)
}
