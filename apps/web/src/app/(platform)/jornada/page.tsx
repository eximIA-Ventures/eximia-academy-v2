// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — /jornada, roteador SSR por estado.
// ---------------------------------------------------------------------------
// Mesma disciplina SSR das outras telas do aluno (meu-plano/page.tsx): auth via
// getAuthProfile, motores REUSADOS (fetchLeadingEnrollmentContext,
// fetchPlanDashboardData, computeStudentComparison para deep-links + diagnóstico).
// A jornada persistida vem de fetchJourneyState (Trilha A) — com fallback
// gracioso: tabela study_plans ausente → plan:null, e a UI degrada para o
// construtor sem quebrar. Roteia:
//   • jornada ativa → JourneyShell (hub "Minhas jornadas" → dashboard rico)
//   • sem jornada, com contexto → construtor (Trilha B, montado no shell)
//   • sem contexto computável → estado vazio amigável
//
// §Fronteira B: o construtor real (`_components/builder/*`) é da Trilha B;
// aqui ele é alcançado via JourneyShell, que ancora o mount tipado (placeholder
// até B plugar). Ver hub/journey-shell.tsx §Fronteira B.
// ---------------------------------------------------------------------------

import { computeStudentComparison } from "@/lib/analytics/area-gestor"
import {
  buildStudyPlanDiagnostic,
  fetchLeadingEnrollmentContext,
  fetchPlanDashboardData,
} from "@/lib/analytics/plan-dashboard-data"
import { DEFAULT_STUDY_PLAN_CHOICE } from "@/lib/analytics/study-plan-projection"
import { getAuthProfile } from "@/lib/auth"
import { fetchJourneyState } from "@/lib/journey/journey-plan-data"
import { Compass } from "lucide-react"
import { redirect } from "next/navigation"
import { buildDashboardModel } from "./_components/dashboard/dashboard-model"
import { type HubEnrollment, buildHubCards } from "./_components/hub/hub-model"
import { JourneyShell } from "./_components/hub/journey-shell"

/** Parse enrollments.progress (número ou {percentage}) → % simples. */
function progressPctOf(raw: unknown): number {
  if (typeof raw === "number") return raw
  if (typeof raw === "object" && raw !== null && "percentage" in raw) {
    return (raw as { percentage: number }).percentage
  }
  return 0
}

export default async function JornadaPage() {
  const { user, profile, error: profileError, supabase } = await getAuthProfile()

  if (!user) return redirect("/login")
  if (profileError) {
    console.error("Failed to fetch user profile:", profileError.message)
    throw new Error("Failed to load user profile")
  }
  if (!profile) return redirect("/login")
  const tenantId = profile.tenant_id
  if (!tenantId) return redirect("/dashboard")

  // Jornada persistida + contexto do curso (Trilha A; fallback gracioso embutido).
  const { plan, context } = await fetchJourneyState(supabase, user.id)

  // Matrículas reais do aluno → cards do hub "Minhas jornadas".
  const { data: enrollmentRows } = await supabase
    .from("enrollments")
    .select("id, course_id, progress, courses!inner(id, title, status)")
    .eq("student_id", user.id)
    .in("status", ["active", "completed"])
    .is("deleted_at", null)
    .neq("courses.status", "archived")

  const enrollments: HubEnrollment[] = (enrollmentRows ?? []).map((row) => {
    const course = row.courses as unknown as { id: string; title: string }
    return {
      enrollmentId: row.id as string,
      courseId: course?.id ?? (row.course_id as string),
      courseTitle: course?.title ?? "Curso",
      progressPct: progressPctOf(row.progress),
      hasActiveJourney: plan != null && plan.enrollmentId === row.id,
    }
  })
  const hubCards = buildHubCards(enrollments)

  // ---- Estado: SEM contexto computável → vazio amigável --------------------
  if (!context && !plan) {
    return <JornadaEmptyState />
  }

  // Motores reais compartilhados (deep-links + diagnóstico), padrão meu-plano.
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()
  const comparison = await computeStudentComparison(db, tenantId, user.id)
  const subject = comparison.indicators?.subject ?? null

  const leading = await fetchLeadingEnrollmentContext(supabase, user.id)
  const diagnostic = subject ? buildStudyPlanDiagnostic(subject, leading) : null
  const planDashboardData = await fetchPlanDashboardData(
    supabase,
    user.id,
    leading,
    DEFAULT_STUDY_PLAN_CHOICE,
  )

  const interactionHref = comparison.nextPendingInteractionHref ?? null
  const reflectionHref = comparison.nextPendingReflectionHref ?? null
  const continueHref = interactionHref ?? "/courses"

  // Payload do dashboard só quando há jornada ativa E dados para reancorar.
  const hasActivePlan = plan != null && plan.status === "active"
  const dashboardPayload =
    hasActivePlan && context != null && diagnostic != null
      ? {
          model: buildDashboardModel({
            plan,
            context,
            planDashboardData,
            diagnostic,
            nowMs: Date.now(),
          }),
          hrefs: { continueHref, interactionHref, reflectionHref },
        }
      : null

  // Matrícula-alvo do construtor: a da jornada ativa (revisar) ou a matrícula
  // líder (criar), casando context.courseId.
  const builderEnrollmentId =
    plan?.enrollmentId ??
    enrollments.find((e) => e.courseId === context?.courseId)?.enrollmentId ??
    null

  // Sem jornada ativa → abre no CONSTRUTOR (criar); com jornada → no hub.
  const initialView: "hub" | "builder" = hasActivePlan ? "hub" : "builder"
  const reviseInitial =
    hasActivePlan && plan != null
      ? { durations: plan.moduleDurations, preferences: plan.preferences }
      : null

  return (
    <JourneyShell
      initialView={initialView}
      hubCards={hubCards}
      dashboard={dashboardPayload}
      activeEnrollmentId={plan?.enrollmentId ?? null}
      builderContext={context}
      builderEnrollmentId={builderEnrollmentId}
      reviseInitial={reviseInitial}
    />
  )
}

function JornadaEmptyState() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:px-6">
      <div className="rounded-2xl border border-dashed border-border-medium bg-bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cerrado-600/12 text-cerrado-500">
          <Compass size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-lg font-bold text-text-primary">Minhas jornadas</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          Você ainda não tem uma jornada com prazo definido. Assim que for inscrito em um curso com
          prazo, sua jornada aparece aqui.
        </p>
      </div>
    </div>
  )
}
