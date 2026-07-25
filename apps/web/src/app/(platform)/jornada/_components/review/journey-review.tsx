"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Revisar jornada (Trilha B, fluxo ACTIVE). Mesma mecânica do
// construtor, com diff "fim antigo riscado → novo" na tabela e no banner
// ("Sua conclusão: X → Y"), CTA "Salvar alterações" habilitado SÓ com mudança
// real vs o snapshot de entrada, e "Voltar" que descarta restaurando o snapshot
// (SPEC §3 Ato 2, AC15). Reusa os componentes de ../builder. Portado de
// openPlan(active)/goRevisar/voltar/updateSaveState da demo.
//
// JRN-E (AC-E2.6) — revisar HERDA tudo: o que foi concluído entre a montagem e
// a revisão entra travado (0 dias), só o restante é redistribuído, e o teto duro
// exibido NÃO se move (ele é de coorte: matrícula + deadline_days). O snapshot
// de comparação também é reancorado, senão o diff compararia datas de relógios
// diferentes.
// ---------------------------------------------------------------------------

import { fitRemainingToDeadline } from "@/lib/journey/plan-math"
import { applyBump, suggestionBase } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext, JourneyPlan, JourneyUnit } from "@/lib/journey/types"
import { useMemo, useRef, useState } from "react"
import { AutoSwitch, SuggestDropdown, UnitSegmented } from "../builder/builder-controls"
import { ConsequenceBanner } from "../builder/consequence-banner"
import { anchoredDates, journeyWindow } from "../builder/journey-format"
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
  /** hoje relativo a T0 (dias desde plan.startDate); a Trilha C calcula no SSR.
   *  Com janela restante (JRN-E), hoje É a âncora e este offset é ignorado. */
  nowDayOffset?: number
  onSave?: (submit: ReviewSubmit) => void
  onBack?: () => void
  saving?: boolean
}

export function JourneyReview({
  context,
  plan,
  onSave,
  onBack,
  saving = false,
}: JourneyReviewProps) {
  const { modules, finalDeadlineDays } = context

  const win = useMemo(() => journeyWindow(context), [context])

  // snapshot IMUTÁVEL de entrada — base do diff e do "Voltar" (descarta). Já
  // reprojetado na janela: o que concluiu desde a montagem entra travado em 0 e
  // a soma dos vivos é clampada, nunca inflada com os dias liberados.
  const snapshot = useRef<number[]>(fitRemainingToDeadline(plan.moduleDurations, win))
  const [durations, setDurations] = useState<number[]>(snapshot.current.slice())
  const [preset, setPreset] = useState<number | null>(plan.preset)
  const [cascade, setCascade] = useState(plan.preferences.cascade)
  const [unit, setUnit] = useState<JourneyUnit>(plan.preferences.unit)

  const compareEnds = useMemo(() => anchoredDates(snapshot.current, win).ends, [win])
  const dirty = JSON.stringify(durations) !== JSON.stringify(snapshot.current)

  const base = useMemo(
    () =>
      suggestionBase(
        modules.length,
        finalDeadlineDays,
        modules.map((m) => m.interactionsExpected + m.reflectionsExpected),
        win,
      ),
    [modules, finalDeadlineDays, win],
  )

  function onBump(i: number, delta: 1 | -1) {
    const r = applyBump(durations, i, delta, {
      cascade,
      unit,
      finalDeadlineDays,
      window: win,
    })
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
          <p className={s.planSub}>
            {win.hasProgress
              ? `Os ${win.frozenIndices.length} módulos concluídos ficam travados. Ajuste os que faltam: o resto se reorganiza sozinho, dentro do mesmo prazo final.`
              : "Ajuste seus prazos, o resto se reorganiza sozinho."}
          </p>
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
            window={win}
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
        window={win}
        compareEnds={compareEnds}
        dirty={dirty}
      />

      <TimelineCanvas
        context={context}
        durations={durations}
        unit={unit}
        cascade={cascade}
        window={win}
        onChange={(next) => {
          setDurations(next)
          setPreset(null)
        }}
      />

      <ModuleTable
        context={context}
        durations={durations}
        unit={unit}
        window={win}
        onBump={onBump}
        compareEnds={compareEnds}
      />
    </div>
  )
}
