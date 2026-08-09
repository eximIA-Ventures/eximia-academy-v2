"use client"

interface PeriodOption {
  label: string
  value: string
}

interface PeriodFilterProps {
  value: string
  onChange: (value: string) => void
  options: PeriodOption[]
}

export function PeriodFilter({ value, onChange, options }: PeriodFilterProps) {
  return (
    <div className="flex gap-1 rounded-md bg-bg-surface p-1" role="group" aria-label="Periodo">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          // RODADA 12 (E4) — a pílula ATIVA do controle segmentado ("30 dias")
          // é marcador de ESTADO, logo identidade do mundo. Saía
          // `bg-cerrado-600` sólido, medido `rgb(222,97,41)` no Estúdio
          // (`/analytics`). O par de tinta também muda: `text-text-primary`
          // andava no MESMO sentido do fundo e já reprovava AA antes desta
          // rodada (4.22:1 no claro, 3.16:1 no escuro). `--world-accent-fg` é o
          // par legível — >= 6.25:1 no pior caso dos 4 mundos x 2 temas.
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? "bg-[var(--world-accent)] text-[var(--world-accent-fg)]"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
