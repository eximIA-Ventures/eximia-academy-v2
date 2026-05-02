import { type VariantProps, cva } from "class-variance-authority"
import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

const trackVariants = cva("relative overflow-hidden rounded-full bg-bg-surface", {
  variants: {
    size: {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

const fillVariants = cva("absolute left-0 top-0 h-full rounded-full transition-all duration-slow", {
  variants: {
    variant: {
      default: "bg-accent-blue-mid",
      success: "bg-semantic-success",
      warning: "bg-semantic-warning",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface ProgressBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "role">,
    VariantProps<typeof trackVariants>,
    VariantProps<typeof fillVariants> {
  /** Current progress value */
  value: number
  /** Maximum value (default 100) */
  max?: number
  /** Optional label displayed above the bar */
  label?: string
  /** Whether to show the percentage text */
  showValue?: boolean
}

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, variant, size, label, showValue, ...props }, ref) => {
    const clampedValue = Math.min(Math.max(value, 0), max)
    const percentage = max > 0 ? Math.round((clampedValue / max) * 100) : 0

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {(label || showValue) && (
          <div className="mb-1 flex items-center justify-between">
            {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
            {showValue && (
              <span className="text-xs font-medium text-text-secondary">{percentage}%</span>
            )}
          </div>
        )}
        <div
          className={cn(trackVariants({ size }))}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label || `Progress: ${percentage}%`}
        >
          <div className={cn(fillVariants({ variant }))} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    )
  },
)

ProgressBar.displayName = "ProgressBar"

export { ProgressBar }
