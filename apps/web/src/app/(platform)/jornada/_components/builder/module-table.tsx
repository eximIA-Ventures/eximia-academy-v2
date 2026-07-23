"use client"

// EPIC-JORNADA — Tabela "Seus módulos, em detalhe" (Trilha B). Fonte ÚNICA de
// verdade = `durations` (mesma da timeline): stepper move a timeline, drag move
// a tabela (sincronia bidirecional, AC14). No modo revisão, `compareEnds` traz o
// fim ANTIGO por módulo para o diff riscado→novo (AC15). Portado de
// buildModList/updateModList da demo.

import { durationLabel, weeksLabel } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext, JourneyUnit } from "@/lib/journey/types"
import { deriveDates, fmtDay } from "./journey-format"
import s from "./journey.module.css"

const DAY = 86_400_000

interface ModuleTableProps {
  context: JourneyCourseContext
  durations: number[]
  unit: JourneyUnit
  onBump: (index: number, delta: 1 | -1) => void
  /** fins ISO do snapshot de entrada (revisão) — habilita o diff. */
  compareEnds?: string[] | null
  /** hoje relativo a T0 para a linha-resumo do intervalo (construtor: 0). */
  nowDayOffset?: number
}

export function ModuleTable({
  context,
  durations,
  unit,
  onBump,
  compareEnds = null,
  nowDayOffset = 0,
}: ModuleTableProps) {
  const { modules, startDate } = context
  const derived = deriveDates(startDate, durations)
  const unitWord = unit === "w" ? "semana" : "dia"

  const remDays = derived.totalDays - nowDayOffset
  const summary =
    remDays > 0 ? (
      <>
        Jornada de <b>{weeksLabel(remDays)}</b> ({remDays} dias) · término em{" "}
        <b>{fmtDay(derived.completion)}</b>
      </>
    ) : (
      <>
        Término em <b>{fmtDay(derived.completion)}</b>
      </>
    )

  return (
    <div>
      <h3 className={s.mpHead}>Seus módulos, em detalhe</h3>
      <p className={s.mpSummary}>{summary}</p>
      <div className={s.tscroll}>
        <table className={s.mpTable}>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Módulo</th>
              <th className="num">Interações</th>
              <th className="num">Reflexões</th>
              <th>Período</th>
              <th>Duração</th>
            </tr>
          </thead>
          <tbody>
            {durations.map((dd, i) => {
              const mod = modules[i]
              const inter = mod?.interactionsExpected ?? 1
              const refl = mod?.reflectionsExpected ?? 0
              const start = derived.starts[i]
              const end = derived.ends[i]
              const oldEnd = compareEnds?.[i]
              const changed =
                oldEnd != null &&
                Math.abs(new Date(oldEnd).getTime() - new Date(end).getTime()) >= DAY / 2
              return (
                <tr key={mod?.chapterId ?? `row-${i}`}>
                  <td className="num">
                    <span className={s.mpNum}>{i + 1}</span>
                  </td>
                  <td>
                    <span className={s.mpName}>{mod?.title ?? `Módulo ${i + 1}`}</span>
                  </td>
                  <td className="num">{inter}</td>
                  <td className="num">{refl}</td>
                  <td className={s.mpPeriod}>
                    {fmtDay(start)} –{" "}
                    {changed ? (
                      <>
                        <s>{fmtDay(oldEnd as string)}</s> <b className="chg">{fmtDay(end)}</b>
                      </>
                    ) : (
                      <b>{fmtDay(end)}</b>
                    )}
                  </td>
                  <td>
                    <div className={s.mpStep}>
                      <button
                        type="button"
                        data-d="-1"
                        aria-label={`Encurtar o Módulo ${i + 1} em 1 ${unitWord}`}
                        onClick={() => onBump(i, -1)}
                      >
                        −
                      </button>
                      <span className={s.mpDays}>{durationLabel(dd, unit)}</span>
                      <button
                        type="button"
                        data-d="1"
                        aria-label={`Alongar o Módulo ${i + 1} em 1 ${unitWord}`}
                        onClick={() => onBump(i, 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
