import { type VariantProps, cva } from "class-variance-authority"
import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

const badgeVariants = cva("inline-flex items-center gap-1 rounded-lg font-semibold ring-1", {
  variants: {
    variant: {
      default: "bg-bg-elevated text-text-secondary ring-border-subtle",
      success: "bg-semantic-success/10 text-semantic-success ring-semantic-success/20",
      warning: "bg-semantic-warning/10 text-semantic-warning ring-semantic-warning/20",
      error: "bg-semantic-error/10 text-semantic-error ring-semantic-error/20",
      info: "bg-cerrado-600/10 text-cerrado-400 ring-cerrado-600/20",
      draft: "bg-bg-surface text-text-muted ring-border-subtle",
      archived: "bg-bg-surface text-text-muted ring-border-subtle",
    },
    badgeSize: {
      sm: "text-2xs px-2 py-0.5",
      default: "text-xs px-3 py-1",
    },
  },
  defaultVariants: {
    variant: "default",
    badgeSize: "default",
  },
})

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, badgeSize, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(badgeVariants({ variant, badgeSize, className }))} {...props} />
    )
  },
)

Badge.displayName = "Badge"

export { Badge, badgeVariants }
