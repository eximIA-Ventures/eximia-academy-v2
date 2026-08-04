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
import { fetchActiveJourneyEnrollmentIds, fetchJourneyState } from "@/lib/journey/journey-plan-data"
import { previewArtifactFor } from "@/lib/onboarding/preview"
import { resolveOnboarding } from "@/lib/onboarding/resolve"
import type { PendingArtifact } from "@/lib/onboarding/types"
import { Compass } from "lucide-react"
import { cookies } from "next/headers"
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

// JRN-D (Hugo 2026-07-24) — /jornada opera POR CURSO. O curso selecionado vem do
// query param `?curso=<courseId>` (idiomático no App Router: searchParams no
// server component, sem reestruturar a rota num segmento [courseId]). Sem param:
// SEMPRE o hub "Minhas jornadas" (curso a selecionar), mesmo com 1 matrícula
// (D11 — Hugo removeu o atalho antigo "1 matrícula → abre direto": entrar por
// aqui deve sempre mostrar a tela de seleção de curso). Com `?curso=` válido, o
// SSR ancora todo o motor naquele curso em vez de fixar a matrícula líder.
export default async function JornadaPage({
  searchParams,
}: {
  // `?onboarding=tour` é o modo demonstração do guia do construtor
  // (`PREVIEW_PARAM`): não consulta o banco e não grava linha, então funciona
  // com a migration ainda NÃO aplicada — e nenhuma pessoa real vê nada.
  searchParams: Promise<{ curso?: string; onboarding?: string }>
}) {
  const { user, profile, error: profileError, supabase } = await getAuthProfile()

  if (!user) return redirect("/login")
  if (profileError) {
    console.error("Failed to fetch user profile:", profileError.message)
    throw new Error("Failed to load user profile")
  }
  if (!profile) return redirect("/login")
  const tenantId = profile.tenant_id
  if (!tenantId) return redirect("/dashboard")

  const { curso: cursoParam, onboarding: onboardingParam } = await searchParams

  // Modo demonstração do tour. O artefato sai de uma tabela em memória
  // (`previewArtifactFor`), nunca do banco.
  const previewArtifact = onboardingParam ? previewArtifactFor(onboardingParam) : null
  const previewTour = previewArtifact?.kind === "product_onboarding"

  // Matrículas reais do aluno → cards do hub "Minhas jornadas" + seletor de curso.
  const { data: enrollmentRows } = await supabase
    .from("enrollments")
    .select("id, course_id, progress, courses!inner(id, title, status)")
    .eq("student_id", user.id)
    .in("status", ["active", "completed"])
    .is("deleted_at", null)
    .neq("courses.status", "archived")

  // Conjunto de matrículas com jornada ativa (marca CADA card corretamente mesmo
  // com jornadas em múltiplos cursos; fallback gracioso → Set vazio).
  const activeJourneyEnrollmentIds = await fetchActiveJourneyEnrollmentIds(supabase, user.id)

  const enrollments: HubEnrollment[] = (enrollmentRows ?? []).map((row) => {
    const course = row.courses as unknown as { id: string; title: string }
    return {
      enrollmentId: row.id as string,
      courseId: course?.id ?? (row.course_id as string),
      courseTitle: course?.title ?? "Curso",
      progressPct: progressPctOf(row.progress),
      hasActiveJourney: activeJourneyEnrollmentIds.has(row.id as string),
    }
  })
  const hubCards = buildHubCards(enrollments)

  // Lista de cursos p/ o seletor (ordem do hub: ativa → em andamento → concluída).
  const courseOptions = hubCards.map((c) => ({ courseId: c.courseId, courseTitle: c.courseTitle }))

  // JRN-D (D11) — curso selecionado vem SOMENTE do param válido. Sem `?curso=`,
  // NUNCA auto-rota: null aqui → sempre o hub "Minhas jornadas" abaixo (mesmo com
  // 1 matrícula). O atalho antigo "1 matrícula → abre direto" foi removido a
  // pedido do Hugo. Navegação com `?curso=` explícito (CourseSwitcher, link
  // direto, card do hub) segue direta pro dashboard/construtor daquele curso.
  const selectedCourseId =
    cursoParam && enrollments.some((e) => e.courseId === cursoParam)
      ? cursoParam
      : // Demonstração do tour SEM `?curso=`: o hub não tem nenhum dos 6
        // controles que o guia ensina, então a demonstração cairia numa tela
        // vazia. Aqui — e SÓ aqui, dentro do preview — ancoramos no primeiro
        // curso do aluno para o construtor montar. A regra D11 (entrar pela
        // faixa sempre mostra o hub) permanece intacta para o fluxo real.
        previewTour
        ? (enrollments[0]?.courseId ?? null)
        : null

  // Sem curso selecionado → hub (lista de jornadas), sem carregar dashboard.
  if (!selectedCourseId) {
    if (enrollments.length === 0) return <JornadaEmptyState />
    return (
      <JourneyShell
        initialView="hub"
        hubCards={hubCards}
        courseOptions={courseOptions}
        selectedCourseId={null}
        dashboard={null}
        builderContext={null}
        builderEnrollmentId={null}
        reviseInitial={null}
      />
    )
  }

  // Jornada persistida + contexto DAQUELE curso (fallback gracioso embutido).
  const { plan, context } = await fetchJourneyState(supabase, user.id, selectedCourseId)

  // ---- Estado: SEM contexto computável → vazio amigável --------------------
  if (!context && !plan) {
    return <JornadaEmptyState />
  }

  // Motores reais compartilhados (deep-links + diagnóstico), padrão meu-plano,
  // ANCORADOS no curso selecionado (deadline/esperado por-curso).
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()
  // JRN-D — subject/deep-links ancorados no curso selecionado (dashboard por-curso).
  const comparison = await computeStudentComparison(db, tenantId, user.id, {
    courseId: selectedCourseId,
  })
  const subject = comparison.indicators?.subject ?? null

  const leading = await fetchLeadingEnrollmentContext(supabase, user.id, selectedCourseId)
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

  // Matrícula-alvo do construtor: a da jornada ativa (revisar) ou a do curso
  // selecionado (criar), casando context.courseId.
  const builderEnrollmentId =
    plan?.enrollmentId ??
    enrollments.find((e) => e.courseId === (context?.courseId ?? selectedCourseId))?.enrollmentId ??
    null

  // Sem jornada ativa → abre no CONSTRUTOR (criar) DAQUELE curso; com jornada →
  // no dashboard do curso (a escolha do curso já foi feita ao entrar aqui).
  // Na demonstração do tour, o construtor vence: é ele que o guia ensina.
  const initialView: "hub" | "dashboard" | "builder" =
    previewTour && context != null ? "builder" : hasActivePlan ? "dashboard" : "builder"
  const reviseInitial =
    hasActivePlan && plan != null
      ? { durations: plan.moduleDurations, preferences: plan.preferences }
      : null

  // O tour é resolvido com `surface: "builder"` — o gatilho é o MOUNT do
  // construtor, nunca esta rota (story §0.2: a faixa da home leva a `/jornada`
  // sem `?curso=`, e isso SEMPRE cai no hub, onde nenhum dos 6 controles
  // existe). O artefato é só entregue aqui; quem o dispara é o
  // `JourneyTourMount` dentro do `JourneyBuilder`.
  const tourArtifact = previewTour
    ? previewArtifact
    : await resolveBuilderTour(supabase, user.id, tenantId, Boolean(profile.onboarding_completed))

  return (
    <JourneyShell
      initialView={initialView}
      hubCards={hubCards}
      courseOptions={courseOptions}
      selectedCourseId={selectedCourseId}
      dashboard={dashboardPayload}
      builderContext={context}
      builderEnrollmentId={builderEnrollmentId}
      reviseInitial={reviseInitial}
      tour={tourArtifact}
      tourPreview={previewTour}
    />
  )
}

/**
 * Resolução server-side do guia do construtor. Fail-open duro: as tabelas do
 * onboarding ainda NÃO existem neste banco, e a tela da jornada não pode
 * quebrar por causa disso. `resolveOnboarding()` já degrada para `null`
 * internamente; o `catch` aqui cobre `cookies()` e o resto do caminho.
 */
async function resolveBuilderTour(
  supabase: Parameters<typeof resolveOnboarding>[0],
  userId: string,
  tenantId: string,
  onboardingCompleted: boolean,
): Promise<PendingArtifact | null> {
  try {
    const cookieStore = await cookies()
    return await resolveOnboarding(supabase, {
      userId,
      tenantId,
      onboardingCompleted,
      surface: "builder",
      pathname: "/jornada",
      viewAsStudent: cookieStore.get("x-view-as-student")?.value === "true",
      isPreview: false,
      // Irrelevante para o tour (que dispara por LUGAR, nunca por sessão),
      // mas o contrato exige o campo — declarado explicitamente para não
      // parecer esquecimento.
      modalShownThisSession: false,
    })
  } catch (error) {
    console.error("Failed to resolve builder tour (degrading to none):", error)
    return null
  }
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
