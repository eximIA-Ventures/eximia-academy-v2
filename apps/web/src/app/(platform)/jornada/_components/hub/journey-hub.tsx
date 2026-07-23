"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Hub "Minhas jornadas" (SPEC round 15).
// ---------------------------------------------------------------------------
// Tela MÍNIMA de seleção: título curto + cards grandes das matrículas reais.
// Jornada ativa → dashboard; sem jornada → convite; concluída → estado
// celebrado. Entrada em stagger (60ms). Terminologia SEMPRE "jornada".
// ---------------------------------------------------------------------------

import { ArrowRight, CheckCircle2, Compass, Sparkles } from "lucide-react"
import { useState } from "react"
import styles from "../dashboard/motion.module.css"
import type { HubCard } from "./hub-model"

export function JourneyHub({
  cards,
  onOpen,
}: {
  cards: HubCard[]
  /** abre o dashboard da jornada ativa (enrollmentId). */
  onOpen: (enrollmentId: string) => void
}) {
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div
      data-mo="enter"
      data-testid="journey-hub"
      className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6"
    >
      <header className={styles.rise}>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          Minhas jornadas
        </h1>
        <p className="mt-1.5 text-sm text-text-muted">Escolha qual jornada acompanhar.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4">
        {cards.map((card, i) => (
          <HubCardView
            key={card.enrollmentId}
            card={card}
            delay={i * 60}
            onClick={() => {
              if (card.status === "active") {
                onOpen(card.enrollmentId)
              } else if (card.status === "completed") {
                setToast(`"${card.courseTitle}" já está concluída. Continue na sua jornada ativa.`)
              } else {
                // sem jornada (SPEC round 15): toast honesto direcionando à ativa.
                setToast(
                  `"${card.courseTitle}" ainda não tem jornada. Comece pela sua jornada ativa.`,
                )
              }
            }}
          />
        ))}
        {cards.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border-medium bg-bg-elevated/40 px-5 py-8 text-center text-sm text-text-muted">
            Você ainda não tem uma jornada. Assim que for inscrito em um curso, ela aparece aqui.
          </p>
        )}
      </div>

      {toast && (
        <output
          className="fixed inset-x-0 bottom-6 z-50 mx-auto block w-fit max-w-[90vw] rounded-full border border-border-medium bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-elevated"
          onAnimationEnd={() => setTimeout(() => setToast(null), 2600)}
        >
          {toast}
        </output>
      )}
    </div>
  )
}

function HubCardView({
  card,
  delay,
  onClick,
}: {
  card: HubCard
  delay: number
  onClick: () => void
}) {
  const done = card.status === "completed"
  const active = card.status === "active"
  return (
    <button
      type="button"
      data-testid="hub-card"
      data-status={card.status}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`${styles.rise} ${styles.lift} ${styles.press} group flex items-center gap-4 rounded-2xl border bg-bg-card p-5 text-left shadow-card ${
        done
          ? "border-semantic-success/30"
          : active
            ? "border-cerrado-600/30"
            : "border-border-subtle"
      }`}
    >
      <span
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl ${
          done
            ? "bg-semantic-success/12 text-semantic-success"
            : active
              ? "bg-cerrado-600/12 text-cerrado-500"
              : "bg-bg-elevated text-text-muted"
        }`}
      >
        {done ? (
          <CheckCircle2 size={22} aria-hidden="true" />
        ) : active ? (
          <Sparkles size={22} aria-hidden="true" />
        ) : (
          <Compass size={22} aria-hidden="true" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-bold text-text-primary">
            {card.courseTitle}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              done
                ? "bg-semantic-success/14 text-semantic-success"
                : active
                  ? "bg-cerrado-600/13 text-cerrado-500"
                  : "bg-text-muted/12 text-text-secondary"
            }`}
          >
            {card.chipLabel}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated">
          <span
            className={`${styles.barFill} block h-full rounded-full ${done ? "bg-semantic-success" : "bg-cerrado-600"}`}
            style={{ transform: `scaleX(${card.progressPct / 100})` }}
          />
        </div>
        <div className="mt-1.5 text-[11.5px] font-medium text-text-secondary">
          {card.progressPct}% concluído
        </div>
      </div>

      <ArrowRight
        size={18}
        aria-hidden="true"
        className="flex-none text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-cerrado-500"
      />
    </button>
  )
}
