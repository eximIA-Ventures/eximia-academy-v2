"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Shell client que roteia entre o
// CONSTRUTOR (Trilha B), o hub "Minhas jornadas" e o dashboard, a partir dos
// dados que o page.tsx (SSR) já computou.
// ---------------------------------------------------------------------------
// §Fronteira B — INTEGRADO (não mock): monta o `JourneyBuilder` real da Trilha
// B (`../builder/journey-builder`, interface `JourneyBuilderProps` estável +
// testada) e liga o `onConfirm` às server actions da Trilha A
// (`saveJourneyPlan`/`updateJourneyPlan`) com o enrollmentId-alvo. `router.refresh()`
// re-busca o SSR após confirmar. O diff-review dedicado (B: `_components/review`)
// entra na integração final; aqui "Revisar jornada" reusa o builder semeado com
// as durações persistidas (edição funcional que salva via updateJourneyPlan).
// ---------------------------------------------------------------------------

import type { JourneyCourseContext, JourneyPreferences } from "@/lib/journey/types"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { saveJourneyPlan, updateJourneyPlan } from "../../actions"
import { type BuilderSubmit, JourneyBuilder } from "../builder/journey-builder"
import { type CourseOption, CourseSwitcher } from "../course-switcher"
import type { DashboardModel } from "../dashboard/dashboard-model"
import { JourneyDashboard, type JourneyDashboardHrefs } from "../dashboard/journey-dashboard"
import type { HubCard } from "./hub-model"
import { JourneyHub } from "./journey-hub"

export interface JourneyDashboardPayload {
  model: DashboardModel
  hrefs: JourneyDashboardHrefs
}

type View = "hub" | "dashboard" | "builder"
type BuilderMode = "create" | "revise"

export function JourneyShell({
  initialView,
  hubCards,
  courseOptions,
  selectedCourseId,
  dashboard,
  builderContext,
  builderEnrollmentId,
  reviseInitial,
}: {
  /** "builder"/"dashboard" quando um curso está selecionado; "hub" no topo. */
  initialView: View
  hubCards: HubCard[]
  /** JRN-D — cursos do aluno p/ o seletor (só aparece com 2+). */
  courseOptions: CourseOption[]
  /** JRN-D — curso ancorado nesta renderização (null no hub). */
  selectedCourseId: string | null
  /** payload da jornada ativa; null quando não há jornada persistida. */
  dashboard: JourneyDashboardPayload | null
  /** contexto do curso-alvo do construtor (criar ou revisar). */
  builderContext: JourneyCourseContext | null
  /** matrícula-alvo do save/update. */
  builderEnrollmentId: string | null
  /** durações/preferências da jornada ativa, para o modo revisar. */
  reviseInitial: { durations: number[]; preferences: JourneyPreferences } | null
}) {
  const router = useRouter()
  const [view, setView] = useState<View>(initialView)
  // "create" quando abre sem jornada; "revise" quando vem do dashboard.
  const [mode, setMode] = useState<BuilderMode>("create")
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(submit: BuilderSubmit, builderMode: BuilderMode) {
    if (!builderEnrollmentId) {
      setError("Matrícula-alvo indisponível.")
      return
    }
    setConfirming(true)
    setError(null)
    const input = { enrollmentId: builderEnrollmentId, ...submit }
    const res =
      builderMode === "revise" ? await updateJourneyPlan(input) : await saveJourneyPlan(input)
    setConfirming(false)
    if (res.ok) {
      router.refresh()
      setView("hub")
    } else {
      setError(res.error)
    }
  }

  // JRN-D — troca de curso: navega para /jornada?curso=, o SSR reancorra tudo.
  const goToCourse = (courseId: string) =>
    router.push(`/jornada?curso=${encodeURIComponent(courseId)}`)

  if (view === "builder") {
    if (!builderContext) {
      return <EmptyBuilder onBack={() => setView("hub")} />
    }
    const builderMode: BuilderMode = mode === "revise" && reviseInitial ? "revise" : "create"
    return (
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {dashboard ? (
            <BackRow label="Minhas jornadas" onClick={() => setView("hub")} />
          ) : (
            <span />
          )}
          <CourseSwitcher options={courseOptions} selectedCourseId={selectedCourseId} />
        </div>
        {error && (
          <p className="mb-3 rounded-lg border border-semantic-error/30 bg-semantic-error/10 px-3 py-2 text-sm text-semantic-error">
            {error}
          </p>
        )}
        <JourneyBuilder
          context={builderContext}
          initialDurations={builderMode === "revise" ? reviseInitial?.durations : undefined}
          initialPreferences={builderMode === "revise" ? reviseInitial?.preferences : undefined}
          confirming={confirming}
          onConfirm={(submit) => handleConfirm(submit, builderMode)}
        />
      </div>
    )
  }

  if (view === "dashboard" && dashboard) {
    return (
      <>
        {courseOptions.length > 1 && (
          <div className="mx-auto flex max-w-5xl justify-end px-4 pt-6 sm:px-6">
            <CourseSwitcher options={courseOptions} selectedCourseId={selectedCourseId} />
          </div>
        )}
        <JourneyDashboard
          model={dashboard.model}
          hrefs={dashboard.hrefs}
          onBackToHub={() => setView("hub")}
          onRevisar={() => {
            setMode("revise")
            setView("builder")
          }}
        />
      </>
    )
  }

  // Hub: cada card navega para o SEU curso (ativa → dashboard, sem jornada →
  // construtor). O roteador SSR decide o destino a partir do ?curso=.
  return <JourneyHub cards={hubCards} onOpen={goToCourse} />
}

function BackRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-cerrado-500"
    >
      ‹ {label}
    </button>
  )
}

function EmptyBuilder({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:px-6">
      <div className="rounded-2xl border border-dashed border-border-medium bg-bg-card p-8 text-center shadow-card">
        <h2 className="font-display text-lg font-bold text-text-primary">Jornada indisponível</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          Não foi possível montar o contexto do curso agora. Tente novamente em instantes.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border-medium px-5 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-cerrado-500/40 hover:bg-cerrado-500/10"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
