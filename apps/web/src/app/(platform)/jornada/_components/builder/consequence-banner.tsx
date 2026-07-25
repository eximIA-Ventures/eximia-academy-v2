"use client"

// EPIC-JORNADA — Resumo-consequência (Trilha B). Banner grande sempre visível
// com cor semântica pelas 3 zonas (meta do gestor + prazo final, AC38) e o
// intervalo de conclusão "você terá N semanas (M dias) para concluir" (AC37).
// No modo revisão, mostra o diff "Sua conclusão: {antiga} → {nova}" (AC15).
// Zona vem de `zoneOf` (plan-math, dono A). Portado de layout()/zoneOf da demo.
//
// JRN-E (Trilha E2) — com progresso, tudo é medido contra a JANELA RESTANTE
// (hoje → teto de coorte) e só os módulos vivos somam. `zoneOf` é reusado, não
// reescrito, e continua degradando para verde quando a meta do gestor é null (o
// caso REAL nos dois tenants). Teto vencido tem estado próprio e honesto: o
// banner diz que venceu, não finge um prazo que não existe (AC-E2.7).

import { zoneOf } from "@/lib/journey/plan-math"
import { weeksLabel } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext } from "@/lib/journey/types"
import { type JourneyWindow, anchoredDates, fmtDay } from "./journey-format"
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
  /** JRN-E — janela restante (âncora, teto de coorte, quem trava). */
  window: JourneyWindow
  /** fins ISO do snapshot de entrada (revisão) — habilita o diff. */
  compareEnds?: (string | null)[] | null
  /** true quando há mudança não salva (revisão) — mostra a nota. */
  dirty?: boolean
}

export function ConsequenceBanner({
  context,
  durations,
  window: win,
  compareEnds = null,
  dirty = false,
}: ConsequenceBannerProps) {
  const derived = anchoredDates(durations, win)

  // O orçamento é o que RESTA a partir de hoje — e só os vivos consomem.
  const budget = win.remainingDays
  const goal = win.managerRemainingDays
  const zone = zoneOf(derived.totalDays, goal, budget)
  const overDays = derived.totalDays - budget

  const remDays = derived.totalDays

  // diff da revisão: conclusão antiga → nova (último fim VIVO do snapshot)
  const oldFinal = lastNonNull(compareEnds)
  const finalChanged =
    oldFinal != null &&
    Math.abs(new Date(oldFinal).getTime() - new Date(derived.completion).getTime()) >= DAY / 2

  const deadlineIso = win.cohortDeadlineDate
  const metaIso = win.cohortManagerDeadlineDate

  const zoneText = win.expired
    ? `o prazo do curso venceu em ${fmtDay(deadlineIso)}`
    : zone === "red"
      ? `estoura o prazo final em ${overDays} ${overDays === 1 ? "dia" : "dias"}`
      : zone === "green" && goal == null
        ? "dentro do prazo"
        : ZONE_TEXT[zone]

  return (
    <div
      className={`${s.summary} ${ZONE_CLASS[win.expired ? "red" : zone]}`}
      data-testid="jornada-summary"
    >
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
          concluir {win.hasProgress ? "o que falta" : ""}
        </span>
      )}
      {finalChanged && dirty && <span className={s.sNote}>· alterações não salvas</span>}
      <span className={s.sDl}>
        {metaIso != null && <>Meta do gestor: {fmtDay(metaIso)} · </>}
        disponível até {fmtDay(deadlineIso)}
      </span>
    </div>
  )
}

/** Último fim não-nulo do snapshot: o módulo VIVO que fecha a jornada antiga. */
function lastNonNull(list: (string | null)[] | null): string | null {
  if (!list) return null
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] != null) return list[i]
  }
  return null
}
