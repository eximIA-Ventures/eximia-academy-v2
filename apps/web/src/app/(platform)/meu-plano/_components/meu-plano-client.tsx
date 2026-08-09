"use client"

// ---------------------------------------------------------------------------
// MeuPlanoClient — "Meu plano de estudo" (SH-3.1 → SH-3.2 → SH-3.3, Hugo)
// ---------------------------------------------------------------------------
// SH-3.3 pivot (2026-07-21, direto do Hugo depois de testar): o dashboard
// ("Meu Plano", `PlanDashboardScreen`) é agora a tela PADRÃO/inicial de
// /meu-plano — não existe mais uma tela de configuração de tela cheia atrás
// de um "Confirmar meu plano". Os controles de ajuste (dias, sessões,
// reflexão) vivem DENTRO do painel "Seu plano sugerido" do próprio
// dashboard, revelados inline pelo botão "Ajustar plano" (mesmo espírito de
// revelação progressiva que a Disclosure antiga usava, agora controlado por
// `adjustOpen` em vez de `<details>` nativo, porque o toggle é acionado por
// um botão dentro de `PlanDashboardScreen`). Ver Change Log da story.
//
// SCOPE BOUNDARY (ainda, herdado do SH-3.1/SH-3.2): `screen`/`choice`/
// `adjustOpen` são 100% estado local React — NO POST/fetch em lugar nenhum
// desta árvore. Recarregar a página sempre remonta em `choice` default
// (nenhum ajuste é lido do servidor) — essa é a prova de que ainda não há
// persistência (SH-3.3 AC7).
// ---------------------------------------------------------------------------

import {
  computeWeeklyComparison,
  getCalendarWeekRange,
  recalculateWeeklyChoice,
} from "@/lib/analytics/study-plan-dashboard"
import {
  DEFAULT_STUDY_PLAN_CHOICE,
  type StudyPlanChoice,
  type StudyPlanDiagnostic,
  computeStudyPlanProjection,
} from "@/lib/analytics/study-plan-projection"
import { useToast } from "@eximia/ui"
import { useMemo, useState } from "react"
import type { PlanDashboardData } from "../page"
import { PlanDashboardScreen } from "./plan-dashboard-screen"
import { PlanRecalcScreen } from "./plan-recalc-screen"

type Screen = "dashboard" | "recalc"

/** SH-3.3 audit fix — real navigation targets for the "Sua semana" checklist
 *  and the "Continuar jornada" CTA, threaded from `computeStudentComparison`
 *  in page.tsx. `continueHref` is always a live route (degrades to /courses,
 *  never a dead href); the two deep-links are null when nothing is pending. */
export interface PlanHrefs {
  continueHref: string
  interactionHref: string | null
  reflectionHref: string | null
}

export function MeuPlanoClient({
  diagnostic,
  studentFirstName,
  classAvgProgressPct,
  planDashboardData,
  planHrefs,
}: {
  diagnostic: StudyPlanDiagnostic
  studentFirstName: string | null
  classAvgProgressPct: number | null
  planDashboardData: PlanDashboardData
  planHrefs: PlanHrefs
}) {
  const [choice, setChoice] = useState<StudyPlanChoice>(DEFAULT_STUDY_PLAN_CHOICE)
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [adjustOpen, setAdjustOpen] = useState(false)
  // SH-3.3 audit fix — "Manter como está" no dashboard dispensa o aviso "abaixo
  // do combinado" localmente (mesmo espírito do dismiss do card "Próximo ajuste"
  // do toggle da home): estado React puro, remonta no reload (AC4/AC7 intactos).
  const [warningDismissed, setWarningDismissed] = useState(false)
  const { toast } = useToast()

  const projection = useMemo(
    () => computeStudyPlanProjection(diagnostic, choice),
    [diagnostic, choice],
  )

  // "Seu plano x seu realizado" (Tela 1) / comparativo (Tela 2): `realized` is
  // real server data for THIS calendar week (fixed); `planned` is recomputed
  // live from the CURRENT choice, so adjusting days/sessions on the config
  // screen (or recalculating) is reflected without a new server round-trip.
  const weeklyComparison = useMemo(() => {
    if (!planDashboardData.weeklyComparison) return null
    const { weekStart, weekEnd } = getCalendarWeekRange(new Date())
    return computeWeeklyComparison(
      choice,
      planDashboardData.weeklyComparison.realized.sessions,
      planDashboardData.weeklyComparison.realized.reflections,
      weekStart,
      weekEnd,
    )
  }, [choice, planDashboardData.weeklyComparison])

  function toggleDay(index: number) {
    setChoice((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === index ? !d : d)),
    }))
  }

  function setSessionsPerDay(next: number) {
    setChoice((prev) => ({ ...prev, sessionsPerDay: Math.min(5, Math.max(1, next)) }))
  }

  function setReflFocus(next: boolean) {
    setChoice((prev) => ({ ...prev, reflFocus: next }))
  }

  function reset() {
    setChoice({ ...DEFAULT_STUDY_PLAN_CHOICE, days: [...DEFAULT_STUDY_PLAN_CHOICE.days] })
  }

  // SH-3.3 pivot: não existe mais "confirmar" como transição de tela — o
  // dashboard já É a tela ativa, e os setters acima (toggleDay/
  // setSessionsPerDay/setReflFocus) já aplicam ao vivo (os stat cards e o
  // painel "Seu plano sugerido" recomputam na hora). `closeAdjust` só fecha
  // o painel inline e dá o affordance leve de "aplicado" (toast), sem
  // bloquear nada — ver Change Log da story para a decisão completa.
  function closeAdjust() {
    setAdjustOpen(false)
    toast({
      variant: "success",
      title: "Plano atualizado",
      description: `${projection.sessionsPerWeek} sessões por semana no seu ritmo agora.`,
    })
  }

  function recalcAuto() {
    if (weeklyComparison) {
      const nextChoice = recalculateWeeklyChoice(choice, weeklyComparison, diagnostic.weeksLeft)
      setChoice(nextChoice)
      const nextSessions = nextChoice.days.filter(Boolean).length * nextChoice.sessionsPerDay
      toast({
        variant: "success",
        title: "Plano recalculado",
        description: `Ajustamos seu ritmo para ${nextSessions} sessões por semana, mantendo sua data de conclusão.`,
      })
    }
    setScreen("dashboard")
  }

  // Reused by BOTH the Tela 2 "Manter como está" card AND the dashboard's new
  // outline button (audit fix) — one handler, never two. Also dismisses the
  // weekly "abaixo do combinado" warning locally.
  function recalcKeep() {
    setWarningDismissed(true)
    toast({
      variant: "default",
      title: "Plano mantido",
      description: "Nada mudou na distribuição — você pode recalcular quando quiser.",
    })
    setScreen("dashboard")
  }

  const firstName = studentFirstName ?? "Você"

  if (screen === "recalc") {
    return (
      <PlanRecalcScreen
        weeklyComparison={weeklyComparison}
        onBack={() => setScreen("dashboard")}
        onRecalcAuto={recalcAuto}
        onKeep={recalcKeep}
      />
    )
  }

  return (
    <PlanDashboardScreen
      firstName={firstName}
      diagnostic={diagnostic}
      choice={choice}
      projection={projection}
      classAvgProgressPct={classAvgProgressPct}
      planDashboardData={planDashboardData}
      weeklyComparison={weeklyComparison}
      planHrefs={planHrefs}
      warningDismissed={warningDismissed}
      adjustOpen={adjustOpen}
      onRecalc={() => setScreen("recalc")}
      onKeep={recalcKeep}
      onToggleAdjust={() => setAdjustOpen((open) => !open)}
      onToggleDay={toggleDay}
      onSetSessionsPerDay={setSessionsPerDay}
      onSetReflFocus={setReflFocus}
      onReset={reset}
      onCloseAdjust={closeAdjust}
    />
  )
}
