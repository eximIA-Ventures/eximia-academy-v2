// ---------------------------------------------------------------------------
// GET /api/analytics/plan-dashboard — "Comparativo com a Jornada" (SH-3.3 R5,
// reancorado na JORNADA persistida em EPIC-JORNADA / JRN-D)
// ---------------------------------------------------------------------------
// Self-view API for the "Meu ritmo" card's 3rd toggle. Returns the EXACT SAME
// real data `/meu-plano` reads (`computeStudentComparison` for the subject +
// `buildStudyPlanDiagnostic`/`fetchLeadingEnrollmentContext`/
// `fetchPlanDashboardData` for the plan) — zero calculation reimplemented,
// only a new packaging of already-real data for a client fetch (the "Meu
// ritmo" card is a client component, unlike `/meu-plano` which is SSR).
//
// JRN-D (Hugo 2026-07-24) — o "combinado" (coluna MINHA JORNADA) passa a vir da
// JORNADA PERSISTIDA: quando existe study_plan ativa, o `cumulativeExpected`
// (esperado até agora) é REANCORADO em `plan.moduleDurations` via
// `computeJourneyCumulativeExpected` (os prazos que o ALUNO definiu), não mais
// no ritmo semanal `DEFAULT_STUDY_PLAN_CHOICE`. Sem jornada → `hasJourney:false`
// e o painel mostra o estado-convite honesto (nunca um número fake). `courseId`
// opcional (self-view): ancora tudo NAQUELE curso; ausente → curso líder.
//
// Self-view only: student id is ALWAYS auth.uid() (never a client param), the
// same LGPD contract `manager-groups?view=student` already follows.
// ---------------------------------------------------------------------------

import { computeStudentComparison } from "@/lib/analytics/area-gestor"
import {
  type PlanComparisonResponse,
  buildStudyPlanDiagnostic,
  fetchLeadingEnrollmentContext,
  fetchPlanDashboardData,
} from "@/lib/analytics/plan-dashboard-data"
import { computeJourneyCumulativeExpected } from "@/lib/analytics/study-plan-dashboard"
import { DEFAULT_STUDY_PLAN_CHOICE } from "@/lib/analytics/study-plan-projection"
import { getAuthProfile } from "@/lib/auth"
import { fetchJourneyState } from "@/lib/journey/journey-plan-data"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { user, profile, error: profileError, supabase } = await getAuthProfile()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (profileError) {
    console.error("Failed to fetch user profile:", profileError.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = profile.tenant_id
  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  // JRN-D — self-view: courseId opcional ancora TUDO naquele curso. undefined →
  // curso líder (comportamento original, byte-idêntico sem o param).
  const courseId = new URL(request.url).searchParams.get("courseId") ?? undefined

  try {
    // computeStudentComparison needs org-wide reference reads (RLS would
    // block a student from reading other students' rows) — same service
    // client `/meu-plano` and `manager-groups?view=student` both use.
    const { createServiceClient } = await import("@/lib/supabase/service")
    const db = createServiceClient()
    const comparison = await computeStudentComparison(db, tenantId, user.id)

    const subject = comparison.indicators?.subject ?? null
    if (!subject) {
      const empty: PlanComparisonResponse = {
        diagnostic: null,
        planDashboardData: null,
        classAvgProgressPct: null,
        hasJourney: false,
        journeyCourseId: null,
      }
      return NextResponse.json(empty)
    }

    const leading = await fetchLeadingEnrollmentContext(supabase, user.id, courseId)
    const diagnostic = buildStudyPlanDiagnostic(subject, leading)
    const planDashboardData = await fetchPlanDashboardData(
      supabase,
      user.id,
      leading,
      DEFAULT_STUDY_PLAN_CHOICE,
    )

    // JRN-D — reancora o esperado cumulativo na JORNADA persistida. Fallback
    // gracioso embutido em fetchJourneyState (tabela ausente → plan:null).
    const { plan, context } = await fetchJourneyState(supabase, user.id, courseId)
    const hasJourney = plan != null && plan.status === "active"
    if (hasJourney && plan != null && context != null) {
      planDashboardData.cumulativeExpected = computeJourneyCumulativeExpected(
        plan.moduleDurations,
        context.modules,
        plan.startDate,
        Date.now(),
      )
    }

    const body: PlanComparisonResponse = {
      diagnostic,
      planDashboardData,
      classAvgProgressPct: comparison.indicators?.reference.progressAvgPct ?? null,
      hasJourney,
      journeyCourseId: context?.courseId ?? leading?.courseId ?? null,
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error("plan-dashboard analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
