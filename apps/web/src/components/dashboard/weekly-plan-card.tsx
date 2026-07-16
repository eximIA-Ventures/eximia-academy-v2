"use client"

import type { WeekDayCell, WeeklyPlan } from "@/components/dashboard/types"
import { WeeklyPlanModal } from "@/components/dashboard/weekly-plan-modal"
import { Button } from "@eximia/ui"
import { CalendarDays, Check, Flame, Link2, Mail, Play } from "lucide-react"
import { useState } from "react"

interface WeeklyPlanCardProps {
  plan: WeeklyPlan | null
  weekDays: WeekDayCell[]
  sessionsThisWeek: number
  streakDays: number
}

/**
 * "Meu plano da semana" card (design v6.1): Seg-Dom training-style grid,
 * student-defined goal, streak and email reminder footer.
 */
export function WeeklyPlanCard({
  plan,
  weekDays,
  sessionsThisWeek,
  streakDays,
}: WeeklyPlanCardProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="px-6">
      <section className="rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-card">
        {plan ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-text-primary">
                  Meu plano da semana
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Minha meta:{" "}
                  <span className="font-display text-lg font-extrabold text-text-primary">
                    <span className="text-cerrado-600">{sessionsThisWeek}</span> de {plan.goal}{" "}
                    {plan.goal === 1 ? "sessão" : "sessões"}
                  </span>{" "}
                  esta semana
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {streakDays > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-3 py-1.5 text-xs font-semibold text-cerrado-600">
                    <Flame size={13} className="shrink-0" />
                    {streakDays} {streakDays === 1 ? "dia" : "dias"} no ritmo
                  </span>
                )}
                <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
                  Ajustar minha meta
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <DayCell key={day.dow} day={day} />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
              <Mail size={14} className="shrink-0 text-cerrado-600" />
              {plan.reminder.enabled ? (
                <span>
                  Lembretes por e-mail ativados às {plan.reminder.time} nos dias com tarefa.{" "}
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="font-semibold text-cerrado-600 hover:underline"
                  >
                    Editar lembretes
                  </button>
                </span>
              ) : (
                <span>
                  Lembretes por e-mail desativados.{" "}
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="font-semibold text-cerrado-600 hover:underline"
                  >
                    Ativar lembretes
                  </button>
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cerrado-600/10">
              <CalendarDays size={22} className="text-cerrado-600" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold tracking-tight text-text-primary">
                Meu plano da semana
              </h2>
              <p className="mt-1 max-w-md text-sm text-text-secondary">
                Defina sua meta de sessões, escolha seus dias e transforme a jornada em ritmo
                semanal.
              </p>
            </div>
            <Button onClick={() => setModalOpen(true)}>Montar meu plano</Button>
          </div>
        )}
      </section>

      <WeeklyPlanModal open={modalOpen} onOpenChange={setModalOpen} currentPlan={plan} />
    </div>
  )
}

function DayCell({ day }: { day: WeekDayCell }) {
  const ringStyles: Record<WeekDayCell["state"], string> = {
    done: "border-semantic-success bg-semantic-success text-white",
    today: "border-cerrado-600 bg-cerrado-600 text-white ring-4 ring-cerrado-600/15",
    scheduled: "border-dashed border-semantic-info text-semantic-info",
    missed: "border-border-medium text-text-muted",
    rest: "border-dotted border-border-medium text-text-muted opacity-60",
  }

  const badge =
    day.state === "done" ? (
      <span className="rounded-full bg-semantic-success/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-semantic-success">
        Feito
      </span>
    ) : day.state === "today" ? (
      <span className="rounded-full bg-cerrado-600/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cerrado-600">
        Hoje
      </span>
    ) : day.state === "scheduled" ? (
      <span className="rounded-full bg-semantic-info/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-semantic-info">
        Agendado
      </span>
    ) : null

  return (
    <div
      className={`flex min-h-[108px] flex-col items-center gap-2 rounded-xl border bg-bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-card ${
        day.state === "today" ? "border-cerrado-600/50" : "border-border-subtle"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {day.dow}
      </span>
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${ringStyles[day.state]}`}
      >
        {day.state === "done" ? (
          <Check size={15} strokeWidth={3} />
        ) : day.state === "today" ? (
          <Play size={13} />
        ) : day.state === "scheduled" ? (
          <Link2 size={13} />
        ) : (
          <span className="text-xs">·</span>
        )}
      </span>
      <span
        className={`text-[11px] font-medium leading-snug ${
          day.state === "rest"
            ? "italic text-text-muted"
            : day.state === "today"
              ? "font-semibold text-text-primary"
              : "text-text-secondary"
        }`}
      >
        {day.task}
      </span>
      {badge}
    </div>
  )
}
