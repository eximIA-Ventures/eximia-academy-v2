"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Construtor da jornada (Trilha B, fluxo DRAFT). Compõe a
// timeline arrastável + banner de consequência + tabela sincronizada + controles
// (Auto-ajuste, Semanas|Dias, Sugerir jornada, Voltar ao ponto de partida) e o
// CTA "Começar minha jornada". Estado 100% local até o confirm chamar a action
// `saveJourneyPlan` de A (via `onConfirm`, injetado pela Trilha C no page.tsx).
// Terminologia: SEMPRE "jornada" (SPEC round 16). Portado de openPlan/bumpDays/
// applyDays/reset da demo.
// ---------------------------------------------------------------------------

import { neutralDurations } from "@/lib/journey/plan-math"
import { applyBump, suggestionBase } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext, JourneyPreferences, JourneyUnit } from "@/lib/journey/types"
import { useMemo, useState } from "react"
import { AutoSwitch, SuggestDropdown, UnitSegmented } from "./builder-controls"
import { ConsequenceBanner } from "./consequence-banner"
import { IconClock } from "./icons"
import s from "./journey.module.css"
import { ModuleTable } from "./module-table"
import { TimelineCanvas } from "./timeline-canvas"

export interface BuilderSubmit {
  moduleDurations: number[]
  preset: number | null
  preferences: JourneyPreferences
}

interface JourneyBuilderProps {
  context: JourneyCourseContext
  /** durações iniciais (jornada existente); default = distribuição neutra. */
  initialDurations?: number[]
  initialPreferences?: JourneyPreferences
  /** chamado ao confirmar; a Trilha C pluga com o enrollmentId + saveJourneyPlan. */
  onConfirm?: (submit: BuilderSubmit) => void
  confirming?: boolean
}

export function JourneyBuilder({
  context,
  initialDurations,
  initialPreferences,
  onConfirm,
  confirming = false,
}: JourneyBuilderProps) {
  const { modules, finalDeadlineDays } = context
  const [durations, setDurations] = useState<number[]>(
    () => initialDurations ?? neutralDurations(modules.length, finalDeadlineDays),
  )
  const [preset, setPreset] = useState<number | null>(null)
  const [cascade, setCascade] = useState(initialPreferences?.cascade ?? true)
  const [unit, setUnit] = useState<JourneyUnit>(initialPreferences?.unit ?? "w")
  const [hintDone, setHintDone] = useState(false)

  const base = useMemo(
    () =>
      suggestionBase(
        modules.length,
        finalDeadlineDays,
        modules.map((m) => m.interactionsExpected + m.reflectionsExpected),
      ),
    [modules, finalDeadlineDays],
  )

  const totalInteractions = modules.reduce((a, m) => a + m.interactionsExpected, 0)
  const totalReflections = modules.reduce((a, m) => a + m.reflectionsExpected, 0)

  function onTimelineChange(next: number[]) {
    setDurations(next)
    setPreset(null)
  }

  function onBump(i: number, delta: 1 | -1) {
    const r = applyBump(durations, i, delta, { cascade, unit, finalDeadlineDays })
    if (!r.changed) return
    setDurations(r.durations)
    setPreset(null)
    setHintDone(true)
  }

  function onApplyPreset(next: number[], factor: number) {
    setDurations(next)
    setPreset(factor)
    setHintDone(true)
  }

  function onReset() {
    setDurations(neutralDurations(modules.length, finalDeadlineDays))
    setPreset(null)
  }

  return (
    <div className={s.root}>
      <div className={s.planHead}>
        <div>
          <h2 className={s.planTitle}>Monte sua jornada</h2>
          <p className={s.planSub}>
            Ponto de partida neutro: {modules.length} módulos, {totalInteractions} interações e{" "}
            {totalReflections} reflexões distribuídos por igual até o prazo. A jornada é sua, molde
            do seu jeito.
          </p>
        </div>
        <div className={s.planBtns}>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={confirming}
            onClick={() =>
              onConfirm?.({ moduleDurations: durations, preset, preferences: { cascade, unit } })
            }
          >
            {confirming ? "Começando…" : "Começar minha jornada"}
          </button>
        </div>
      </div>

      <div className={s.deadlineChip}>
        <IconClock />
        Disponível até <b>{isoLabel(context)}</b>
      </div>

      <div className={s.tlHelp}>
        <span className={s.tlGuide}>Arraste cada módulo para definir seu tempo</span>
        <div className={s.tlTools}>
          <AutoSwitch checked={cascade} onChange={setCascade} />
          <UnitSegmented unit={unit} onChange={setUnit} />
          <SuggestDropdown
            base={base}
            finalDeadlineDays={finalDeadlineDays}
            activePreset={preset}
            onApply={onApplyPreset}
          />
        </div>
      </div>

      <ConsequenceBanner context={context} durations={durations} />

      <TimelineCanvas
        context={context}
        durations={durations}
        unit={unit}
        cascade={cascade}
        hintActive={!hintDone}
        onChange={onTimelineChange}
        onFirstAdjust={() => setHintDone(true)}
      />

      <div className={s.resetRow}>
        <button type="button" className={s.reset} onClick={onReset}>
          ↺ Voltar ao ponto de partida
        </button>
      </div>

      <ModuleTable context={context} durations={durations} unit={unit} onBump={onBump} />
    </div>
  )
}

function isoLabel(ctx: JourneyCourseContext): string {
  const base = new Date(ctx.startDate)
  const ms = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  const d = new Date(ms + ctx.finalDeadlineDays * 86_400_000)
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
