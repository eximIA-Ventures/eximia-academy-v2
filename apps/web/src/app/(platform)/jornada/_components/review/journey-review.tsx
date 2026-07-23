"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Revisar jornada (Trilha B, fluxo ACTIVE). Mesma mecânica do
// construtor, com diff "fim antigo riscado → novo" na tabela e no banner
// ("Sua conclusão: X → Y"), CTA "Salvar alterações" habilitado SÓ com mudança
// real vs o snapshot de entrada, e "Voltar" que descarta restaurando o snapshot
// (SPEC §3 Ato 2, AC15). Reusa os componentes de ../builder. Portado de
// openPlan(active)/goRevisar/voltar/updateSaveState da demo.
// ---------------------------------------------------------------------------

import { moduleEndDates } from "@/lib/journey/plan-math"
import { applyBump } from "@/lib/journey/timeline-engine"
import { suggestionBase } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext, JourneyPlan, JourneyUnit } from "@/lib/journey/types"
import { useMemo, useRef, useState } from "react"
import { AutoSwitch, SuggestDropdown, UnitSegmented } from "../builder/builder-controls"
import { ConsequenceBanner } from "../builder/consequence-banner"
import s from "../builder/journey.module.css"
import { ModuleTable } from "../builder/module-table"
import { TimelineCanvas } from "../builder/timeline-canvas"

export interface ReviewSubmit {
  moduleDurations: number[]
  preset: number | null
  preferences: { cascade: boolean; unit: JourneyUnit }
}

interface JourneyReviewProps {
  context: JourneyCourseContext
  plan: JourneyPlan
  /** hoje relativo a T0 (dias desde plan.startDate); a Trilha C calcula no SSR. */
  nowDayOffset?: number
  onSave?: (submit: ReviewSubmit) => void
  onBack?: () => void
  saving?: boolean
}

export function JourneyReview({
  context,
  plan,
  nowDayOffset = 0,
  onSave,
  onBack,
  saving = false,
}: JourneyReviewProps) {
  const { modules, finalDeadlineDays } = context
  // snapshot IMUTÁVEL de entrada — base do diff e do "Voltar" (descarta)
  const snapshot = useRef<number[]>(plan.moduleDurations.slice())
  const [durations, setDurations] = useState<number[]>(plan.moduleDurations.slice())
  const [preset, setPreset] = useState<number | null>(plan.preset)
  const [cascade, setCascade] = useState(plan.preferences.cascade)
  const [unit, setUnit] = useState<JourneyUnit>(plan.preferences.unit)

  const compareEnds = useMemo(
    () => moduleEndDates(context.startDate, snapshot.current),
    [context.startDate],
  )
  const dirty = JSON.stringify(durations) !== JSON.stringify(snapshot.current)

  const base = useMemo(
    () =>
      suggestionBase(
        modules.length,
        finalDeadlineDays,
        modules.map((m) => m.interactionsExpected + m.reflectionsExpected),
      ),
    [modules, finalDeadlineDays],
  )

  function onBump(i: number, delta: 1 | -1) {
    const r = applyBump(durations, i, delta, { cascade, unit, finalDeadlineDays })
    if (!r.changed) return
    setDurations(r.durations)
    setPreset(null)
  }

  function discard() {
    setDurations(snapshot.current.slice())
    setPreset(plan.preset)
    onBack?.()
  }

  return (
    <div className={s.root}>
      <div className={s.planHead}>
        <div>
          <span className={s.badge}>Jornada ativa</span>
          <h2 className={`${s.planTitle} ${s.reviewTitle}`}>Revisar jornada</h2>
          <p className={s.planSub}>Ajuste seus prazos, o resto se reorganiza sozinho.</p>
        </div>
        <div className={s.planBtns}>
          <button type="button" className={s.btn} onClick={discard}>
            Voltar
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            disabled={!dirty || saving}
            onClick={() =>
              onSave?.({
                moduleDurations: durations,
                preset,
                preferences: { cascade, unit },
              })
            }
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
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
            onApply={(next, factor) => {
              setDurations(next)
              setPreset(factor)
            }}
          />
        </div>
      </div>

      <ConsequenceBanner
        context={context}
        durations={durations}
        nowDayOffset={nowDayOffset}
        compareEnds={compareEnds}
        dirty={dirty}
      />

      <TimelineCanvas
        context={context}
        durations={durations}
        unit={unit}
        cascade={cascade}
        nowDayOffset={nowDayOffset}
        onChange={(next) => {
          setDurations(next)
          setPreset(null)
        }}
      />

      <ModuleTable
        context={context}
        durations={durations}
        unit={unit}
        onBump={onBump}
        compareEnds={compareEnds}
        nowDayOffset={nowDayOffset}
      />
    </div>
  )
}
