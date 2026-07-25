"use client"

// EPIC-JORNADA — Tabela "Seus módulos, em detalhe" (Trilha B). Fonte ÚNICA de
// verdade = `durations` (mesma da timeline): stepper move a timeline, drag move
// a tabela (sincronia bidirecional, AC14). No modo revisão, `compareEnds` traz o
// fim ANTIGO por módulo para o diff riscado→novo (AC15). Portado de
// buildModList/updateModList da demo.
//
// JRN-E (Trilha E2) — módulo concluído perde o stepper e o período (não tem
// prazo futuro: está feito). As colunas Interações/Reflexões passam a mostrar
// "feito/esperado" quando há progresso, DE PROPÓSITO: é onde o estado esquisito
// fica visível em vez de maquiado. O aluno real tem um módulo com 4/4 reflexões
// e 0/1 interações que o motor classifica como "não iniciado" — ele continua
// editável e a tabela mostra o número de verdade, sem inventar dado para
// suavizar. Ver contrato-progresso §7 e riscos R2/R3 da story.

import { durationLabel, weeksLabel } from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext, JourneyUnit } from "@/lib/journey/types"
import { type JourneyWindow, anchoredDates, fmtDay, progressOf } from "./journey-format"
import s from "./journey.module.css"

const DAY = 86_400_000

interface ModuleTableProps {
  context: JourneyCourseContext
  durations: number[]
  unit: JourneyUnit
  onBump: (index: number, delta: 1 | -1) => void
  /** JRN-E — janela restante (âncora, teto de coorte, quem trava). */
  window: JourneyWindow
  /** fins ISO do snapshot de entrada (revisão) — habilita o diff. */
  compareEnds?: (string | null)[] | null
}

export function ModuleTable({
  context,
  durations,
  unit,
  onBump,
  window: win,
  compareEnds = null,
}: ModuleTableProps) {
  const { modules } = context
  const derived = anchoredDates(durations, win)
  const unitWord = unit === "w" ? "semana" : "dia"

  const remDays = derived.totalDays
  const doneCount = win.frozenIndices.length
  const summary =
    remDays > 0 ? (
      <>
        {doneCount > 0 && (
          <>
            <b>{doneCount}</b> de {modules.length} módulos já concluídos ·{" "}
          </>
        )}
        {doneCount > 0 ? "restam " : "Jornada de "}
        <b>{weeksLabel(remDays)}</b> ({remDays} dias) · término em{" "}
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
              const prog = progressOf(mod)
              const isFrozen = win.frozen[i] === true
              const inter = mod?.interactionsExpected ?? 1
              const refl = mod?.reflectionsExpected ?? 0
              const start = derived.starts[i]
              const end = derived.ends[i]
              const oldEnd = compareEnds?.[i]
              const changed =
                !isFrozen &&
                oldEnd != null &&
                end != null &&
                Math.abs(new Date(oldEnd).getTime() - new Date(end).getTime()) >= DAY / 2
              return (
                <tr
                  key={mod?.chapterId ?? `row-${i}`}
                  className={isFrozen ? s.mpRowDone : undefined}
                  data-frozen={isFrozen ? "true" : undefined}
                >
                  <td className="num">
                    <span className={`${s.mpNum}${isFrozen ? ` ${s.mpNumDone}` : ""}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td>
                    <span className={s.mpName}>{mod?.title ?? `Módulo ${i + 1}`}</span>
                  </td>
                  <td className="num">{prog ? `${prog.sessionsDone}/${inter}` : inter}</td>
                  <td className="num">{prog ? `${prog.reflectionsDone}/${refl}` : refl}</td>
                  <td className={s.mpPeriod}>
                    {isFrozen ? (
                      <span className={s.mpDone}>concluído</span>
                    ) : (
                      <>
                        {fmtDay(start as string)} –{" "}
                        {changed ? (
                          <>
                            <s>{fmtDay(oldEnd as string)}</s>{" "}
                            <b className="chg">{fmtDay(end as string)}</b>
                          </>
                        ) : (
                          <b>{fmtDay(end as string)}</b>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    {isFrozen ? (
                      <span className={s.mpDone}>não consome prazo</span>
                    ) : (
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
                    )}
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
