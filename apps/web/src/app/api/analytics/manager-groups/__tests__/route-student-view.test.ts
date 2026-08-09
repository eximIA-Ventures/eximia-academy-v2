import { describe, expect, it } from "vitest"
import type { AnalyticsRole } from "@/types/analytics"
import { canAccessView, type View } from "../gate"

/**
 * canAccessView — the pure role×view gate of GET /api/analytics/manager-groups.
 *
 * BUG FIXED (workspaces): a multi-hat user (e.g. Rinaldo = instructor+manager+student)
 * landing on the student dashboard in the personal context could NOT load their own
 * "Meu Desempenho" widget — it requests view=student, and the old gate barred every
 * non-student role from that view, returning 403.
 *
 * INVARIANT PRESERVED: view=student is a SELF-VIEW (the handler always scopes it to
 * auth.uid()), so it is safe for ANY role. The privacy-protecting half — a `student`
 * role can NEVER reach a gestor/tenant-wide view — is untouched. This gate never
 * grants access to third-party individual data; that self-scoping lives in the
 * handler (computeStudentComparison filters by student_id === auth.uid()).
 */

const GESTOR_VIEWS: View[] = ["comparison", "areas", "managers", "units", "courses"]

describe("canAccessView — self-service view=student (regression: multi-hat 403)", () => {
  it.each<[string, AnalyticsRole]>([
    ["manager (multi-hat, the reported bug)", "manager"],
    ["admin", "admin"],
    ["super_admin", "super_admin"],
    ["student (unchanged)", "student"],
  ])("permits view=student for %s (own self-view)", (_label, role) => {
    expect(canAccessView(role, "student")).toBe(true)
  })
})

describe("canAccessView — student barred from third-party (gestor) views", () => {
  it.each(GESTOR_VIEWS)("a student role is FORBIDDEN from view=%s", (view) => {
    // A student pedindo dados de terceiro (unidade/áreas/gestores) → negado.
    // Esta é a metade que protege a privacidade; NÃO muda com o fix.
    expect(canAccessView("student", view)).toBe(false)
  })
})

describe("canAccessView — non-student roles reach gestor views (further mode-gated)", () => {
  // The gate itself passes these; per-mode scoping (allowedComparisonModes +
  // managerId === auth.uid() filtering) further restricts what they SEE.
  it.each<[AnalyticsRole, View]>([
    ["manager", "areas"],
    ["manager", "managers"],
    ["admin", "units"],
    ["super_admin", "courses"],
  ])("%s may reach view=%s at the gate level", (role, view) => {
    expect(canAccessView(role, view)).toBe(true)
  })
})
