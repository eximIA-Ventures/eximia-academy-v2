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
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? "bg-cerrado-600 text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
