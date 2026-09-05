import type { createClient } from "@/lib/supabase/server"

/**
 * Course management gate — LGPD/permission fix (fix-manager-privacy-gates).
 *
 * Course management controls (Enriquecer com IA, Interações, Editar, Exportar,
 * Adicionar Capítulo, publicar/arquivar/excluir) are restricted to the
 * INSTRUCTOR and ADMIN hats. A manager-only user (no instructor/admin hat) is
 * denied, even though the legacy singular `users.role` column may still say
 * "manager" — multi-chapéu (E1/E7) means the DECISION is made over the UNION
 * of hats in `user_roles`, never the singular column.
 *
 * Decision rule (per the dono, fix-manager-privacy-gates):
 *   permitido  se o usuário TEM chapéu instructor OU admin.
 *   negado     se ele só alcança o dado pela lente de manager.
 * A manager+instructor keeps everything the instructor gets — this checks the
 * UNION, so holding a manager hat alongside instructor/admin never subtracts
 * access.
 *
 * `super_admin` is also treated as full access (it already has that reach
 * everywhere else in the app), even when it has no explicit `user_roles` row.
 */
export interface CourseManagerContext {
  tenantId: string | null
  hats: string[]
}

/**
 * TRÊS estados, não dois. O par `ok:false`/`ok:true` colapsava "você não tem o
 * chapéu" com "não deu para verificar qual chapéu você tem" — o mesmo E→NEGA que
 * as 47 rotas de API carregavam, e que aqui é pior: a recusa por falha de leitura
 * imita exatamente a recusa legítima que este gate existe para aplicar, e por isso
 * passa por "o gate funcionando".
 *
 * OS NOMES DOS CAMPOS SÃO ASSIMÉTRICOS DE PROPÓSITO (`error` numa perna,
 * `mensagem` na outra), e o campo ausente é ausente MESMO — não `?: never`. A
 * diferença decide se a trava funciona: com `error?: never`, ler `check.error` é
 * legal e devolve `string | undefined`, então o compilador só reclama onde o
 * destino exige `string` (mediu 3 sítios). Sem o campo, `check.error` sobre a
 * união é erro de propriedade inexistente e o compilador aponta TODOS os sítios
 * que leem a mensagem sem decidir qual dos dois casos é (mediu 8).
 *
 * Sem isso o terceiro estado nasceria no guard e morreria no chamador — o defeito
 * reapareceria um andar acima, com aparência de corrigido. O compilador enumera
 * os sítios; a boa vontade de quem varre, não.
 *
 * Os chamadores que nunca leem a mensagem (páginas que só fazem `redirect`, e o
 * `slide-actions` que só faz `throw`) o compilador NÃO pega — esses foram varridos
 * à mão e estão listados no relatório FIX-B8.
 */
export type CourseManagerCheck =
  | { ok: false; motivo: "sem-permissao"; error: string }
  | { ok: false; motivo: "indisponivel"; mensagem: string }
  | { ok: true; motivo?: never; ctx: CourseManagerContext }

/** Código do PostgREST para "zero (ou mais de uma) linha" num `.single()`. */
const ZERO_LINHAS = "PGRST116"

/**
 * Texto único da indisponibilidade. Chega ao usuário como texto nas server
 * actions (cujo contrato de retorno só carrega string), e por isso precisa dizer
 * "tente de novo" — que é a diferença que importa para quem está do outro lado.
 */
export const MENSAGEM_INDISPONIVEL =
  "Não foi possível verificar suas permissões agora. Tente novamente em instantes."

/**
 * Resolves the caller's hats (union from `user_roles`, falling back to the
 * singular `users.role` only when `user_roles` has no rows for the user —
 * mirrors the same defensive fallback `getAuthProfile` uses) and checks
 * instructor/admin/super_admin membership.
 *
 * Narrow on `.ok` (not `.error`/`.ctx` directly) — `ok` is the literal-typed
 * discriminant TypeScript's control-flow analysis narrows reliably across the
 * union; `.error`/`.ctx` alone (both typed as `T | undefined` in isolation)
 * do not narrow the sibling field the same way.
 */
export async function requireCourseManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CourseManagerCheck> {
  const { data: profile, error } = await supabase
    .from("users")
    .select("role, tenant_id, user_roles!user_roles_user_id_fkey(role)")
    .eq("id", userId)
    .single()

  // A checagem que faltava. Qualquer erro que não seja "zero linhas" é uma leitura
  // que NÃO aconteceu — e uma leitura que não aconteceu não autoriza ninguém a
  // dizer "permissão negada". `PGRST116` fica de fora de propósito: ali a leitura
  // aconteceu e o veredito "não há perfil" é legítimo, exatamente como nas 47
  // rotas já corrigidas.
  if (error && error.code !== ZERO_LINHAS) {
    console.error(`[course-management-guard] leitura de perfil indisponivel para ${userId}:`, error)
    return { ok: false, motivo: "indisponivel", mensagem: MENSAGEM_INDISPONIVEL }
  }

  if (!profile) return { ok: false, motivo: "sem-permissao", error: "Perfil não encontrado" }

  const rawHats = (profile as { user_roles?: { role: string }[] } | null)?.user_roles ?? []
  const hats: string[] =
    rawHats.length > 0 ? rawHats.map((r) => r.role) : profile.role ? [profile.role] : []

  const isCourseManager =
    hats.includes("instructor") || hats.includes("admin") || hats.includes("super_admin")

  if (!isCourseManager) {
    return { ok: false, motivo: "sem-permissao", error: "Permissão negada" }
  }

  return { ok: true, ctx: { tenantId: profile.tenant_id, hats } }
}

/**
 * Texto a mostrar para uma recusa, qualquer que seja o motivo.
 *
 * Existe porque as server actions têm um contrato de retorno que só carrega
 * string (`{ error }`), então a distinção entre os dois casos precisa chegar ao
 * usuário como TEXTO — e "Permissão negada" para uma falha de leitura é
 * exatamente a mentira que esta rodada veio corrigir. Aqui a indisponibilidade
 * diz "tente novamente", que é a única informação acionável que a pessoa tem.
 *
 * NÃO é um atalho para voltar a tratar os dois casos igual: o chamador que quiser
 * desfecho diferente (as rotas de API querem, e usam 503 com `Retry-After`) faz
 * `if (check.motivo === "indisponivel")` antes. Esta função é para quem só tem um
 * campo de texto por onde falar.
 *
 * LIMITE HONESTO: o cliente recebe string, não um campo legível por máquina, e
 * portanto não consegue oferecer um botão "tentar de novo" nem instrumentar a
 * taxa de indisponibilidade. Elevar isso exigiria mudar o contrato de retorno das
 * 8 actions e os componentes que as consomem — fora do escopo desta rodada, e
 * registrado no relatório para quem for dono da UI.
 */
export function mensagemDaRecusa(check: Extract<CourseManagerCheck, { ok: false }>): string {
  return check.motivo === "indisponivel" ? check.mensagem : check.error
}

/** Pure predicate version — reuse in client components fed by `profile.roles`. */
export function isCourseManagerRole(roles: string[]): boolean {
  return roles.includes("instructor") || roles.includes("admin") || roles.includes("super_admin")
}

/**
 * Which listing the /courses page ("Cursos e Trilhas") must render.
 *
 * BUG (fix-student-courses-not-listed): the page used to key the branch off the
 * SINGULAR legacy `users.role` column, so a manager-only user (whose role column
 * says "manager") fell into the AUTHORING branch — a table of courses they OWN /
 * created / area-scoped — which is empty for someone who authors nothing. That
 * user is enrolled as a STUDENT (the dashboard header shows "1 CURSOS"), but the
 * authoring branch never queries enrollments, so the course they are matriculated
 * in vanishes and they cannot ENTER it.
 *
 * BUG (fix-instructor-student-context, 2026-07-14): the first fix keyed the
 * branch off the UNION of hats alone (isCourseManagerRole), which is still wrong
 * for a MULTI-CHAPÉU user in the STUDENT context. Rinaldo is instructor + enrolled
 * student; when he SWITCHES WORKSPACE to the standard world ("Minha Trilha" /
 * "Plataforma de Aprendizagem"), his instructor hat won the branch and he saw the
 * empty AUTHORING table instead of his enrollment — even though the SAME page
 * already hid the authoring BUTTONS via `canAuthorCourses` (workspace-keyed). The
 * listing and the buttons disagreed. The ACTIVE WORKSPACE must decide the listing,
 * exactly as it already decides the shell (`resolvePlatformShell`) and the buttons
 * (`canAuthorCourses`): standard context => enrollment listing, always; only the
 * Estúdio context yields authoring.
 *
 * Decision (workspace-first): the AUTHORING listing renders only when the active
 * platform shell is the Estúdio ("studio") — i.e. active workspace is "studio" AND
 * the caller holds a real instructor/admin/super_admin hat (E1/E7 union, mirroring
 * fix-manager-privacy-gates; a lone `manager` hat does NOT author). Every other
 * context — standard workspace, absent workspace, non-authoring hats — gets the
 * student "enrollment" listing, with the CourseGrid path that links
 * "Continuar"/"Acessar" into the course.
 *
 * `isPreviewingAsStudent` (the instructor "Ver como Aluno" toggle) still forces the
 * student listing even in the Estúdio — preserving the existing preview behaviour.
 *
 * `activeShell` is the resolved platform shell (`resolvePlatformShell`), NOT the raw
 * cookie: it already fails closed on a forged "studio" cookie without the instructor
 * hat. When omitted it defaults to "studio", preserving the pre-workspace call sites
 * and the pure role-only tests (an authoring hat in the Estúdio still authors).
 */
export function resolveCoursesListView(
  roles: string[],
  isPreviewingAsStudent = false,
  // 3º e 4º workspaces (mundo do admin e do super admin): o shell resolvido
  // pode ser "admin" ou "super". A regra NÃO muda — autoria é do Estúdio, então
  // qualquer shell != "studio" cai na listagem de matrícula, exatamente como já
  // acontecia. O "super" entra só para o tipo aceitar o 4º mundo (rodada 9).
  activeShell: "studio" | "standard" | "admin" | "super" = "studio",
): "authoring" | "enrollment" {
  if (isPreviewingAsStudent) return "enrollment"
  if (activeShell !== "studio") return "enrollment"
  return isCourseManagerRole(roles) ? "authoring" : "enrollment"
}

/**
 * BUG (Hugo 2026-07-14) — the COURSE DETAIL page's `userRole`, workspace-first.
 * Instructor-authoring UI ("Adicionar Capítulo", status badges, drag handles, ⋮,
 * "Enriquecer com IA"/"Interações"/"Editar"/"Exportar") leaked into the MANAGER
 * context because the page derived `effectiveRole` from the HAT UNION alone
 * (isCourseManagerRole → profile.role), ignoring the active workspace — the same
 * pattern already fixed on the LISTING (resolveCoursesListView).
 *
 * Rule: authoring renders ONLY in the Estúdio shell (`activeShell === "studio"`,
 * itself fail-closed to the real instructor hat via resolvePlatformShell) with an
 * authoring hat in the union. Everywhere else — manager context, student "Minha
 * Trilha", preview "Ver como Aluno" — the page renders the READ view ("student").
 *
 * NORMALIZATION: when authoring, the returned role is always one the client
 * recognizes as authoring ("admin" or "instructor") — never the legacy singular
 * "manager" column value (a multi-hat instructor whose `users.role` still says
 * "manager" must not depend on the client accepting "manager" as author).
 */
export function resolveCourseDetailRole(
  roles: string[],
  profileRole: string,
  activeShell: "studio" | "standard" | "admin" | "super",
  isPreviewingAsStudent = false,
): string {
  const view = resolveCoursesListView(roles, isPreviewingAsStudent, activeShell)
  if (view !== "authoring") return "student"
  return profileRole === "admin" || profileRole === "instructor" ? profileRole : "instructor"
}

/**
 * Whether the course-detail CLIENT treats `userRole` as authoring. "manager" is
 * NEVER authoring (fix-manager-privacy-gates + Hugo 2026-07-14): the manager
 * lens reads, it does not author — even if a legacy singular role slips through.
 */
export function isCourseAuthoringRole(userRole: string): boolean {
  return userRole === "admin" || userRole === "instructor"
}
