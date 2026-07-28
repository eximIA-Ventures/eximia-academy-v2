import { computeStudentComparison } from "@/lib/analytics/area-gestor"
import {
  type PlanDashboardData,
  buildStudyPlanDiagnostic,
  fetchLeadingEnrollmentContext,
  fetchPlanDashboardData,
} from "@/lib/analytics/plan-dashboard-data"
import { DEFAULT_STUDY_PLAN_CHOICE } from "@/lib/analytics/study-plan-projection"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { MeuPlanoClient } from "./_components/meu-plano-client"
import { MeuPlanoEmptyState } from "./_components/meu-plano-empty-state"

// SH-3.3 R5 (Hugo 2026-07-21) — `PlanDashboardData` moved to
// `@/lib/analytics/plan-dashboard-data` (shared with the "Comparativo com o
// Plano" toggle's API route). Re-exported here so existing imports of it
// (`from "../page"`, e.g. plan-dashboard-screen.tsx/meu-plano-client.tsx)
// keep working unchanged.
export type { PlanDashboardData }

// ---------------------------------------------------------------------------
// /meu-plano — "Monte o seu plano de estudo" (SH-3.1, Hugo 2026-07-20)
// ---------------------------------------------------------------------------
// Dedicated screen born from the "Meu ritmo" diagnostic (SH-2.7's
// expectedProgressPct). Same SSR data-fetching pattern as the other student
// pages (dashboard/page.tsx, analytics/page.tsx): auth via getAuthProfile,
// real diagnostic via `computeStudentComparison` (the SAME function that
// feeds the "Meu ritmo" table's API route, /api/analytics/manager-groups?
// view=student) — no calculation is reimplemented here.
//
// SCOPE BOUNDARY: this route ONLY reads. The weekly plan the student builds
// on this screen is NOT persisted anywhere (no new table/migration) — see
// meu-plano-client.tsx and the SH-3.1 story for the explicit next-phase note.
// ---------------------------------------------------------------------------

export default async function MeuPlanoPage() {
  const { user, profile, error: profileError, supabase } = await getAuthProfile()

  if (!user) return redirect("/login")
  if (profileError) {
    console.error("Failed to fetch user profile:", profileError.message)
    throw new Error("Failed to load user profile")
  }
  if (!profile) return redirect("/login")

  const tenantId = profile.tenant_id
  if (!tenantId) return redirect("/dashboard")

  // computeStudentComparison needs org-wide reference reads (RLS would block a
  // student from reading other students' rows) — same service client the
  // manager-groups route uses for view=student.
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()
  const comparison = await computeStudentComparison(db, tenantId, user.id)

  const subject = comparison.indicators?.subject ?? null
  if (!subject) {
    return <MeuPlanoEmptyState />
  }

  const leading = await fetchLeadingEnrollmentContext(supabase, user.id)
  const diagnostic = buildStudyPlanDiagnostic(subject, leading)

  const studentFirstName = profile.full_name?.split(" ")[0] ?? null

  const planDashboardData = await fetchPlanDashboardData(
    supabase,
    user.id,
    leading,
    DEFAULT_STUDY_PLAN_CHOICE,
  )

  // SH-3.3 audit fix — "Sua semana" items and "Continuar jornada" navigate to
  // the student's real next pending action. Same deep-links the "Meu ritmo"
  // CTAs already use (computeStudentComparison, SH-3.3): interaction → next
  // pending interaction chapter, reflection → next pending reflection slide.
  // The generic continue target degrades to /courses (never a dead href),
  // mirroring DEFAULT_CONTINUE_HREF in student-comparison-view.tsx.
  const interactionHref = comparison.nextPendingInteractionHref ?? null
  const reflectionHref = comparison.nextPendingReflectionHref ?? null
  const continueHref = interactionHref ?? "/courses"

  return (
    <MeuPlanoClient
      diagnostic={diagnostic}
      studentFirstName={studentFirstName}
      classAvgProgressPct={comparison.indicators?.reference.progressAvgPct ?? null}
      planDashboardData={planDashboardData}
      planHrefs={{ continueHref, interactionHref, reflectionHref }}
    />
  )
}
