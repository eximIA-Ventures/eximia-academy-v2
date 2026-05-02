import { Flame } from "lucide-react"

interface StreakCardProps {
  days: number
}

export function StreakCard({ days }: StreakCardProps) {
  const isHot = days >= 7

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5">
      {/* Glare sutil quando streak alto */}
      {isHot && (
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-cerrado/20 blur-2xl"
          aria-hidden="true"
        />
      )}

      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Sequência de estudos
          </p>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-bold text-foreground leading-none tabular-nums">
              {days}
            </span>
            <span className="mb-0.5 text-sm text-muted-foreground">
              {days === 1 ? "dia" : "dias"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {days === 0
              ? "Estude hoje para começar sua sequência!"
              : days < 7
              ? `Faltam ${7 - days} dias para a marca de 7!`
              : "Sequência incrível! Continue assim."}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            isHot
              ? "bg-brand-cerrado/15"
              : "bg-muted"
          }`}
        >
          <Flame
            className={`h-6 w-6 ${
              isHot ? "text-brand-cerrado" : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Barra de progresso até 7 dias */}
      {days < 7 && (
        <div className="mt-4">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-cerrado transition-all duration-500"
              style={{ width: `${Math.min((days / 7) * 100, 100)}%` }}
              role="progressbar"
              aria-valuenow={days}
              aria-valuemin={0}
              aria-valuemax={7}
            />
          </div>
        </div>
      )}
    </div>
  )
}
