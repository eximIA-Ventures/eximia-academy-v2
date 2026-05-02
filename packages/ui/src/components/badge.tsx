import { type VariantProps, cva } from "class-variance-authority"
import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

const badgeVariants = cva("inline-flex items-center gap-1 rounded-lg font-semibold ring-1", {
  variants: {
    variant: {
      default: "bg-white/[0.06] text-text-secondary ring-white/[0.08]",
      success: "bg-semantic-success/10 text-semantic-success ring-semantic-success/20",
      warning: "bg-semantic-warning/10 text-semantic-warning ring-semantic-warning/20",
      error: "bg-semantic-error/10 text-semantic-error ring-semantic-error/20",
      info: "bg-accent-blue-mid/10 text-accent-blue-light ring-accent-blue-mid/20",
      draft: "bg-white/[0.04] text-text-muted ring-white/[0.06]",
      archived: "bg-white/[0.03] text-text-muted ring-white/[0.04]",
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
