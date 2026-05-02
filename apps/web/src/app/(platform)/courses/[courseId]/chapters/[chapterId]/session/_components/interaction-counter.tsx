interface InteractionCounterProps {
  remaining: number
  total: number
}

export function InteractionCounter({ remaining, total }: InteractionCounterProps) {
  const used = total - remaining
  const percentage = total > 0 ? (used / total) * 100 : 0

  return (
    <div className="flex items-center gap-2.5">
      {/* Mini progress ring */}
      <div className="relative h-7 w-7">
        <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-bg-elevated" />
          <circle
            cx="14"
            cy="14"
            r="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={`${(percentage / 100) * 69.1} 69.1`}
            strokeLinecap="round"
            className="text-accent-blue-mid transition-all duration-500"
          />
        </svg>
      </div>
      <span className="text-xs font-medium tabular-nums text-text-muted">
        {remaining}/{total}
      </span>
    </div>
  )
}
