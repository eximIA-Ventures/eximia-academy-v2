"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Construtor da jornada (Trilha B, fluxo DRAFT). Compõe a
// timeline arrastável + banner de consequência + tabela sincronizada + controles
// (Auto-ajuste, Semanas|Dias, Sugerir jornada, Voltar ao ponto de partida) e o
// CTA "Começar minha jornada". Estado 100% local até o confirm chamar a action
// `saveJourneyPlan` de A (via `onConfirm`, injetado pela Trilha C no page.tsx).
// Terminologia: SEMPRE "jornada" (SPEC round 16). Portado de openPlan/bumpDays/
// applyDays/reset da demo.
//
// JRN-E (Trilha E2) — o construtor deixa de tratar todo aluno como se estivesse
// na linha de partida. Quando o contexto traz progresso, os módulos concluídos
// entram TRAVADOS (0 dias, sem alça, sem stepper) e só a janela que RESTA, a
// partir de hoje, é distribuída sobre o que falta. O teto duro continua sendo o
// teto de COORTE (matrícula + deadline_days, commit d60ec27): nenhum arraste,
// preset ou redistribuição o move. Modo criar × revisar é derivado de
// `initialDurations !== undefined` (AC-E2.9) — o shell não muda.
// ---------------------------------------------------------------------------

import { fitRemainingToDeadline, progressAwareNeutralDurations } from "@/lib/journey/plan-math"
import { applyBump, suggestionBase } from "@/lib/journey/timeline-engine"
import type {
  JourneyCourseContext,
  JourneyModuleProgress,
  JourneyPreferences,
  JourneyUnit,
} from "@/lib/journey/types"
import { useMemo, useState } from "react"
import { AutoSwitch, SuggestDropdown, UnitSegmented } from "./builder-controls"
import { ConsequenceBanner } from "./consequence-banner"
import { IconClock } from "./icons"
import { type JourneyWindow, fmtDay, journeyWindow, progressModules } from "./journey-format"
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

  // Janela restante: âncora HOJE, teto de coorte imutável, quem trava e quem
  // ainda consome dia. Sem progresso no contexto, `hasProgress` é false e todo
  // o caminho JRN-E fica inerte (comportamento pré-JRN-E, idêntico).
  const win = useMemo(() => journeyWindow(context), [context])

  const [durations, setDurations] = useState<number[]>(() =>
    seedDurations(initialDurations, progressModules(modules), win),
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
        win,
      ),
    [modules, finalDeadlineDays, win],
  )

  const totalInteractions = modules.reduce((a, m) => a + m.interactionsExpected, 0)
  const totalReflections = modules.reduce((a, m) => a + m.reflectionsExpected, 0)
  const doneCount = win.frozenIndices.length
  const liveCount = win.remainingIndices.length

  function onTimelineChange(next: number[]) {
    setDurations(next)
    setPreset(null)
  }

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
    setHintDone(true)
  }

  function onApplyPreset(next: number[], factor: number) {
    setDurations(next)
    setPreset(factor)
    setHintDone(true)
  }

  // AC-E2.4 — "Voltar ao ponto de partida" respeita o progresso: os concluídos
  // continuam travados em 0 e só o que falta volta ao neutro. O `neutralDurations`
  // cego (que redistribuía a janela cheia sobre TODOS os módulos) saiu daqui.
  function onReset() {
    setDurations(seedDurations(undefined, progressModules(modules), win))
    setPreset(null)
  }

  return (
    <div className={s.root}>
      <div className={s.planHead}>
        <div>
          <h2 className={s.planTitle}>Monte sua jornada</h2>
          <p className={s.planSub}>
            {win.hasProgress ? (
              <>
                Você já concluiu <b>{doneCount}</b> de {modules.length} módulos: eles ficam
                travados, não consomem prazo e não entram no arraste.{" "}
                {win.expired
                  ? `O prazo do curso já venceu, então os ${liveCount} módulos que faltam entram no mínimo — ajuste do seu jeito.`
                  : `Distribuímos os ${win.remainingDays} dias que restam até ${fmtDay(win.cohortDeadlineDate)} só sobre os ${liveCount} que faltam.`}
              </>
            ) : (
              <>
                Ponto de partida neutro: {modules.length} módulos, {totalInteractions} interações e{" "}
                {totalReflections} reflexões distribuídos por igual até o prazo. A jornada é sua,
                molde do seu jeito.
              </>
            )}
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

      <div className={`${s.deadlineChip}${win.expired ? ` ${s.deadlineChipOver}` : ""}`}>
        <IconClock />
        Disponível até <b>{fmtDay(win.cohortDeadlineDate)}</b>
        {win.expired && <span className={s.chipWarn}>· prazo vencido</span>}
      </div>

      <div className={s.tlHelp}>
        <span className={s.tlGuide}>
          {win.hasProgress
            ? "Arraste os módulos que faltam para definir seu tempo"
            : "Arraste cada módulo para definir seu tempo"}
        </span>
        <div className={s.tlTools}>
          <AutoSwitch checked={cascade} onChange={setCascade} />
          <UnitSegmented unit={unit} onChange={setUnit} />
          <SuggestDropdown
            base={base}
            finalDeadlineDays={finalDeadlineDays}
            activePreset={preset}
            window={win}
            onApply={onApplyPreset}
          />
        </div>
      </div>

      <ConsequenceBanner context={context} durations={durations} window={win} />

      <TimelineCanvas
        context={context}
        durations={durations}
        unit={unit}
        cascade={cascade}
        window={win}
        hintActive={!hintDone}
        onChange={onTimelineChange}
        onFirstAdjust={() => setHintDone(true)}
      />

      <div className={s.resetRow}>
        <button type="button" className={s.reset} onClick={onReset}>
          ↺ Voltar ao ponto de partida
        </button>
      </div>

      <ModuleTable
        context={context}
        durations={durations}
        unit={unit}
        window={win}
        onBump={onBump}
      />
    </div>
  )
}

/**
 * Semeadura das durações.
 *
 * - **Criar** (`initial` ausente): partida consciente do progresso — concluído
 *   em 0, parcial proporcional ao que resta (D4), intocado com a fatia cheia.
 * - **Revisar** (`initial` presente, AC-E2.9): o que foi concluído DESDE a
 *   montagem trava em 0 e só o restante é redistribuído; o que já estava
 *   combinado para os módulos vivos é PRESERVADO (clampado à janela), nunca
 *   inflado com os dias liberados — o aluno termina antes, não "ganha" prazo.
 *   O teto duro não se move em nenhum dos dois caminhos (D5).
 */
function seedDurations(
  initial: number[] | undefined,
  modules: Array<{ progress: JourneyModuleProgress }>,
  win: JourneyWindow,
): number[] {
  if (initial && initial.length === modules.length) return fitRemainingToDeadline(initial, win)
  return progressAwareNeutralDurations(modules, win)
}
