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

export type CourseManagerCheck =
  | { ok: false; error: string; ctx?: never }
  | { ok: true; error?: never; ctx: CourseManagerContext }

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
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, user_roles!user_roles_user_id_fkey(role)")
    .eq("id", userId)
    .single()

  if (!profile) return { ok: false, error: "Perfil não encontrado" }

  const rawHats = (profile as { user_roles?: { role: string }[] } | null)?.user_roles ?? []
  const hats: string[] = rawHats.length > 0 ? rawHats.map((r) => r.role) : profile.role ? [profile.role] : []

  const isCourseManager =
    hats.includes("instructor") || hats.includes("admin") || hats.includes("super_admin")

  if (!isCourseManager) {
    return { ok: false, error: "Permissão negada" }
  }

  return { ok: true, ctx: { tenantId: profile.tenant_id, hats } }
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
  activeShell: "studio" | "standard" = "studio",
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
  activeShell: "studio" | "standard",
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
