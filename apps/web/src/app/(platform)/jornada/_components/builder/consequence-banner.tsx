"use client"

// EPIC-JORNADA — Resumo-consequência (Trilha B). Banner grande sempre visível
// com cor semântica pelas 3 zonas (meta do gestor + prazo final, AC38) e o
// intervalo de conclusão "você terá N semanas (M dias) para concluir" (AC37).
// No modo revisão, mostra o diff "Sua conclusão: {antiga} → {nova}" (AC15).
// Zona vem de `zoneOf` (plan-math, dono A). Portado de layout()/zoneOf da demo.

import { zoneOf } from "@/lib/journey/plan-math"
import { weeksLabel } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext } from "@/lib/journey/types"
import { deriveDates, fmtDay } from "./journey-format"
import s from "./journey.module.css"

const DAY = 86_400_000

const ZONE_CLASS = { green: s.ok, amber: s.tight, red: s.over } as const
const ZONE_TEXT = {
  green: "dentro da meta do gestor",
  amber: "passa da meta do gestor · ainda dentro do prazo final",
  red: "", // preenchido com o nº de dias abaixo (guarda defensiva)
} as const

interface ConsequenceBannerProps {
  context: JourneyCourseContext
  durations: number[]
  /** hoje relativo a T0 (construtor: 0; revisão: dias desde T0). */
  nowDayOffset?: number
  /** fins ISO do snapshot de entrada (revisão) — habilita o diff. */
  compareEnds?: string[] | null
  /** true quando há mudança não salva (revisão) — mostra a nota. */
  dirty?: boolean
}

export function ConsequenceBanner({
  context,
  durations,
  nowDayOffset = 0,
  compareEnds = null,
  dirty = false,
}: ConsequenceBannerProps) {
  const { startDate, managerDeadlineDays, finalDeadlineDays } = context
  const derived = deriveDates(startDate, durations)
  const zone = zoneOf(derived.totalDays, managerDeadlineDays, finalDeadlineDays)
  const overDays = derived.totalDays - finalDeadlineDays

  const remDays = derived.totalDays - nowDayOffset

  // diff da revisão: conclusão antiga → nova
  const oldFinal = compareEnds?.[compareEnds.length - 1]
  const finalChanged =
    oldFinal != null &&
    Math.abs(new Date(oldFinal).getTime() - new Date(derived.completion).getTime()) >= DAY / 2

  const zoneText =
    zone === "red"
      ? `estoura o prazo final em ${overDays} ${overDays === 1 ? "dia" : "dias"}`
      : zone === "green" && managerDeadlineDays == null
        ? "dentro do prazo"
        : ZONE_TEXT[zone]

  return (
    <div className={`${s.summary} ${ZONE_CLASS[zone]}`} data-testid="jornada-summary">
      <span className={s.sMain}>
        {finalChanged ? (
          <>
            Sua conclusão: <s>{fmtDay(oldFinal as string)}</s> → <b>{fmtDay(derived.completion)}</b>
          </>
        ) : (
          <>
            Você termina em <b>{fmtDay(derived.completion)}</b>
          </>
        )}
      </span>
      <span>· {zoneText}</span>
      {remDays > 0 && (
        <span>
          · você terá {weeksLabel(remDays)} ({remDays} {remDays === 1 ? "dia" : "dias"}) para
          concluir
        </span>
      )}
      {finalChanged && dirty && <span className={s.sNote}>· alterações não salvas</span>}
      <span className={s.sDl}>
        {managerDeadlineDays != null && (
          <>Meta do gestor: {fmtDay(isoAt(startDate, managerDeadlineDays))} · </>
        )}
        disponível até {fmtDay(isoAt(startDate, finalDeadlineDays))}
      </span>
    </div>
  )
}

function isoAt(startDate: string, offset: number | null): string {
  if (offset == null) return startDate
  const base = new Date(startDate)
  const ms = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  return new Date(ms + offset * DAY).toISOString().slice(0, 10)
}
