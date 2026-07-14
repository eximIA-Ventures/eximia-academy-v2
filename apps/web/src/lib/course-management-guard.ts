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
 * The decision must mirror the rest of the platform (E1/E7 multi-chapéu +
 * fix-manager-privacy-gates): course AUTHORING is an instructor/admin/super_admin
 * capability over the UNION of hats — a lone `manager` hat does NOT author. Anyone
 * else (student, manager-only, leader) gets the student "enrollment" listing, with
 * the CourseGrid path that links "Continuar"/"Acessar" into the course.
 *
 * `isPreviewingAsStudent` (the instructor "Ver como Aluno" toggle) forces the
 * student listing even for a real course manager — preserving the existing
 * preview behaviour.
 */
export function resolveCoursesListView(
  roles: string[],
  isPreviewingAsStudent = false,
): "authoring" | "enrollment" {
  if (isPreviewingAsStudent) return "enrollment"
  return isCourseManagerRole(roles) ? "authoring" : "enrollment"
}
