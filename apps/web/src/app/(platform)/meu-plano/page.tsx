import { computeStudentComparison } from "@/lib/analytics/area-gestor"
import type { StudyPlanDiagnostic } from "@/lib/analytics/study-plan-projection"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { MeuPlanoClient } from "./_components/meu-plano-client"
import { MeuPlanoEmptyState } from "./_components/meu-plano-empty-state"

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

  const deadline = await fetchLeadingEnrollmentDeadline(supabase, user.id)

  const diagnostic: StudyPlanDiagnostic = {
    progressNow: subject.progressPct,
    progressTarget: subject.expectedProgressPct ?? null,
    reflDoneCount: subject.reflections,
    reflTotal: subject.reflectionsMax ?? null,
    reflNow:
      subject.reflectionsMax && subject.reflectionsMax > 0
        ? (subject.reflections / subject.reflectionsMax) * 100
        : null,
    reflTarget: subject.expectedProgressPct ?? null,
    daysLeft: deadline?.daysLeft ?? null,
    weeksLeft: deadline ? Math.max(1, Math.round(deadline.daysLeft / 7)) : null,
  }

  const studentFirstName = profile.full_name?.split(" ")[0] ?? null

  return <MeuPlanoClient diagnostic={diagnostic} studentFirstName={studentFirstName} />
}

/** Parse the enrollment `progress` json/number into a plain percentage (same
 *  shape as student-dashboard-page.tsx's `progressPctOf`, duplicated here per
 *  the codebase's existing convention rather than importing a page module). */
function progressPctOf(rawProgress: unknown): number {
  if (typeof rawProgress === "number") return rawProgress
  if (typeof rawProgress === "object" && rawProgress !== null && "percentage" in rawProgress) {
    return (rawProgress as { percentage: number }).percentage
  }
  return 0
}

/**
 * Finds the student's LEADING enrollment (highest progress %, same tie-break
 * concept `computeBehindAndProgress`/`expectedPctByStudent` already use — see
 * SH-2.7 Dev Notes) and derives real days-left until its deadline. Read-only,
 * isolated to this route: does NOT touch engagement-triage.ts/area-gestor.ts.
 * Returns null when no active enrollment has a computable `deadline_days`.
 */
async function fetchLeadingEnrollmentDeadline(
  supabase: Awaited<ReturnType<typeof getAuthProfile>>["supabase"],
  studentId: string,
): Promise<{ daysLeft: number } | null> {
  const { data: rows } = await supabase
    .from("enrollments")
    .select("progress, created_at, courses!inner(deadline_days, status)")
    .eq("student_id", studentId)
    .in("status", ["active", "completed"])
    .is("deleted_at", null)
    .neq("courses.status", "archived")

  if (!rows || rows.length === 0) return null

  const withDeadline = rows
    .map((row) => {
      const course = row.courses as unknown as { deadline_days: number | null }
      return {
        progress: progressPctOf(row.progress),
        createdAt: row.created_at as string,
        deadlineDays: course?.deadline_days ?? null,
      }
    })
    .filter((row) => row.deadlineDays != null && row.deadlineDays > 0)

  if (withDeadline.length === 0) return null

  const leading = withDeadline.reduce((max, row) => (row.progress > max.progress ? row : max))
  const elapsedDays = Math.max(0, (Date.now() - new Date(leading.createdAt).getTime()) / 86_400_000)
  const daysLeft = Math.max(0, Math.round((leading.deadlineDays as number) - elapsedDays))
  return { daysLeft }
}
