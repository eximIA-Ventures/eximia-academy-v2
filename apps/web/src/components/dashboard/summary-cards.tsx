import type { ReactNode } from "react"

interface SummaryCardItem {
  icon: ReactNode
  label: string
  value: number | string
  trend?: string
  iconBg?: string
  iconColor?: string
}

interface SummaryCardsProps {
  items: SummaryCardItem[]
}

export function SummaryCards({ items }: SummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="group rounded-2xl bg-bg-card shadow-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <div className="flex items-center gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg ?? "bg-cerrado-600/15"} ${item.iconColor ?? "text-cerrado-400"}`}
              aria-hidden="true"
            >
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted truncate">
                {item.label}
              </p>
              <p className="text-2xl font-bold text-text-primary">{item.value}</p>
              {item.trend && <p className="text-[10px] text-text-muted">{item.trend}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
