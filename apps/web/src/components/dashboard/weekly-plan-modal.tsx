"use client"

import { type SaveWeeklyPlanInput, saveWeeklyPlan } from "@/app/(platform)/dashboard/actions"
import type { WeeklyPlan } from "@/components/dashboard/types"
import {
  Button,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Switch,
} from "@eximia/ui"
import { Minus, Plus } from "lucide-react"
import { useState, useTransition } from "react"

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const TIME_OPTIONS = ["07h", "08h", "12h", "19h", "21h"]

interface WeeklyPlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: WeeklyPlan | null
}

/**
 * "Montar meu plano da semana" modal (design v6.1).
 * Persists goal, available days and email reminder preference.
 * Email sending itself is phase 2, only the preference is saved.
 */
export function WeeklyPlanModal({ open, onOpenChange, currentPlan }: WeeklyPlanModalProps) {
  const [isPending, startTransition] = useTransition()

  const [goal, setGoal] = useState(currentPlan?.goal ?? 3)
  const [days, setDays] = useState<number[]>(currentPlan?.days ?? [0, 1, 2, 4])
  const [reminderEnabled, setReminderEnabled] = useState(currentPlan?.reminder.enabled ?? true)
  const [reminderTime, setReminderTime] = useState(currentPlan?.reminder.time ?? "08h")
  const [error, setError] = useState<string | null>(null)

  const stepGoal = (delta: number) => {
    setGoal((g) => Math.max(1, Math.min(7, g + delta)))
  }

  const toggleDay = (day: number) => {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]))
  }

  const handleSave = () => {
    setError(null)
    if (days.length === 0) {
      setError("Escolha pelo menos um dia da semana")
      return
    }
    const input: SaveWeeklyPlanInput = {
      goal,
      days,
      reminderEnabled,
      reminderTime,
    }
    startTransition(async () => {
      const result = await saveWeeklyPlan(input)
      if (result.error) {
        setError(result.error)
        return
      }
      // revalidatePath in the server action refreshes the dashboard RSC payload
      onOpenChange(false)
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent size="lg">
        <ModalHeader>
          <span className="inline-flex w-fit items-center rounded-full bg-cerrado-600/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-cerrado-600">
            Plano da semana
          </span>
          <ModalTitle className="mt-2">Montar meu plano da semana</ModalTitle>
          <ModalDescription>
            Defina sua meta, escolha seus dias e deixe a plataforma te lembrar por e-mail.
          </ModalDescription>
        </ModalHeader>

        <div className="mt-5 flex flex-col gap-6">
          {/* Meta da semana */}
          <div>
            <Label>Minha meta desta semana</Label>
            <div className="mt-2 inline-flex items-center overflow-hidden rounded-full border border-border-subtle">
              <button
                type="button"
                onClick={() => stepGoal(-1)}
                aria-label="Diminuir meta"
                className="flex h-10 w-10 items-center justify-center bg-bg-elevated text-cerrado-600 transition-colors hover:bg-cerrado-600/10"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-[130px] px-3 text-center text-sm font-semibold text-text-primary">
                {goal} {goal === 1 ? "sessão" : "sessões"}
              </span>
              <button
                type="button"
                onClick={() => stepGoal(1)}
                aria-label="Aumentar meta"
                className="flex h-10 w-10 items-center justify-center bg-bg-elevated text-cerrado-600 transition-colors hover:bg-cerrado-600/10"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Dias disponiveis */}
          <div>
            <Label>Dias disponíveis na semana</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAY_LABELS.map((label, index) => {
                const active = days.includes(index)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(index)}
                    aria-pressed={active}
                    className={`h-11 w-11 rounded-full border text-xs font-bold transition-all ${
                      active
                        ? "border-cerrado-600 bg-cerrado-600 text-white shadow-sm"
                        : "border-border-subtle bg-bg-card text-text-muted hover:border-cerrado-600 hover:text-cerrado-600"
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              A plataforma distribui as tarefas e os lembretes nos dias escolhidos.
            </p>
          </div>

          {/* Lembrete por e-mail */}
          <div>
            <Label>Lembretes por e-mail</Label>
            <div className="mt-2 flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3.5">
              <div className="text-sm text-text-primary">
                Receber lembrete nos dias com tarefa
                <p className="mt-0.5 text-xs text-text-muted">
                  O envio será ativado em breve; sua preferência fica salva.
                </p>
              </div>
              <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
            </div>
          </div>

          {/* Horario preferido */}
          <div>
            <Label>Horário preferido do lembrete</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIME_OPTIONS.map((time) => {
                const active = reminderTime === time
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setReminderTime(time)}
                    aria-pressed={active}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "border-cerrado-600/40 bg-cerrado-600/10 text-cerrado-600"
                        : "border-border-subtle bg-bg-card text-text-secondary hover:border-cerrado-600/40"
                    }`}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-sm text-semantic-error">{error}</p>}
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isPending}>
            Salvar plano
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
