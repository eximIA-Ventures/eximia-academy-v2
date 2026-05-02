"use client"

import { useFormContext } from "react-hook-form"
import { Input, Label, Checkbox } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

const DELIVERY_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "online_sync", label: "Online Síncrono" },
  { value: "online_async", label: "Online Assíncrono" },
  { value: "hibrido", label: "Híbrido" },
]

export function ConstraintsStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CourseDesignerInput>()

  const totalHours = watch("total_duration_hours")
  const weeks = watch("constraints.weeks")
  const hoursPerWeek = watch("constraints.hours_per_week")

  // Auto-calculate total_duration_hours from weeks * hours_per_week
  useEffect(() => {
    if (weeks && hoursPerWeek && weeks > 0 && hoursPerWeek > 0) {
      setValue("total_duration_hours", weeks * hoursPerWeek)
    }
  }, [weeks, hoursPerWeek, setValue])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          4. Restrições
        </h2>
        <p className="text-sm text-text-secondary">
          Defina duração, formato de entrega e preferências de sessão
        </p>
      </div>

      {/* Duration */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="total_duration_hours">
            Duração Total (horas) <span className="text-semantic-error">*</span>
          </Label>
          <Input
            id="total_duration_hours"
            type="number"
            min={1}
            max={200}
            {...register("total_duration_hours", { valueAsNumber: true })}
          />
          {errors.total_duration_hours && (
            <p className="text-sm text-semantic-error">
              {errors.total_duration_hours.message}
            </p>
          )}
          {totalHours && totalHours < 4 && (
            <div className="flex items-center gap-2 rounded-md bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Cursos abaixo de 4h geram blueprints limitados
            </div>
          )}
        </div>

        <div className="rounded-md bg-bg-elevated p-4">
          <p className="mb-3 text-sm text-text-secondary">
            Ou calcule automaticamente:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weeks">Semanas</Label>
              <Input
                id="weeks"
                type="number"
                min={1}
                placeholder="Ex: 4"
                {...register("constraints.weeks", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours_per_week">Horas por Semana</Label>
              <Input
                id="hours_per_week"
                type="number"
                min={1}
                placeholder="Ex: 2"
                {...register("constraints.hours_per_week", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
          {weeks && hoursPerWeek && weeks > 0 && hoursPerWeek > 0 && (
            <p className="mt-2 text-sm text-accent-blue-mid">
              = {weeks * hoursPerWeek}h total
            </p>
          )}
        </div>
      </div>

      {/* Delivery & Session */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="delivery_mode">Modalidade de Entrega</Label>
          <select
            id="delivery_mode"
            className="flex h-10 w-full rounded-md border border-border-medium bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent-blue-mid focus:outline-none"
            {...register("constraints.delivery_mode")}
          >
            <option value="">Selecione...</option>
            {DELIVERY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="session_length">
            Duração Preferida da Sessão (min)
          </Label>
          <Input
            id="session_length"
            type="number"
            min={15}
            max={240}
            placeholder="Ex: 60"
            {...register("constraints.session_length_preference", {
              valueAsNumber: true,
            })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="cohort_based" {...register("constraints.cohort_based")} />
        <Label htmlFor="cohort_based" className="cursor-pointer">
          Treinamento por turma (cohort-based)
        </Label>
      </div>
    </div>
  )
}
