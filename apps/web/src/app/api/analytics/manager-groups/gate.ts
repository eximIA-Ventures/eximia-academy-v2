// ---------------------------------------------------------------------------
// Pure role×view gate for GET /api/analytics/manager-groups (1.2).
// ---------------------------------------------------------------------------
// Lives in its own module (NOT the route file) because a Next.js route may only
// export request handlers — a co-located pure export makes typecheck fail. Keeping
// the decision here also makes it unit-testable without booting the route.

import type { AnalyticsRole } from "@/types/analytics"

export type View = "comparison" | "areas" | "managers" | "units" | "courses" | "student"
export const VALID_VIEWS: View[] = [
  "comparison",
  "areas",
  "managers",
  "units",
  "courses",
  "student",
]

/**
 * Decides whether a caller's analytics role may reach a view AT ALL, before any
 * single-mode `allowedComparisonModes` check.
 *
 * Two asymmetric rules, and ONLY these two:
 *   • view=student is a SELF-VIEW → allowed for EVERY role (the handler always
 *     scopes it to auth.uid(), so a multi-hat manager reads only their OWN data).
 *   • a `student` role is barred from every NON-student (gestor/tenant-wide) view.
 *
 * The privacy-protecting half is the second rule (a student never reaches a gestor
 * view). The first rule intentionally lets a manager/instructor/admin see their OWN
 * performance — it grants NO access to third-party individual data (that scoping
 * lives in computeStudentComparison, filtering by student_id === auth.uid()).
 * Returns false ⇒ 403.
 */
export function canAccessView(role: AnalyticsRole, view: View): boolean {
  if (view === "student") return true // self-view: any authenticated role, own data only
  if (role === "student") return false // student may only reach their own self-view
  return true // non-student → gestor/tenant-wide views (further gated per mode below)
}
