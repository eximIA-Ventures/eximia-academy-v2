import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"
import { buttonVariants } from "./button"

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon or illustration element rendered at top */
  icon?: ReactNode
  /** Main title text */
  title: string
  /** Description text below title */
  description?: string
  /** CTA button label */
  actionLabel?: string
  /** CTA button click handler */
  onAction?: () => void
  /** CTA button href (renders as link instead of button) */
  actionHref?: string
}

const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, actionLabel, onAction, actionHref, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col items-center py-12", className)} {...props}>
      {icon && <div className="text-text-muted mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-text-primary">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary text-center max-w-sm mt-1">{description}</p>
      )}
      {actionLabel && actionHref && (
        <a href={actionHref} className={cn(buttonVariants({ variant: "default" }), "mt-4")}>
          {actionLabel}
        </a>
      )}
      {actionLabel && !actionHref && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn(buttonVariants({ variant: "default" }), "mt-4")}
        >
          {actionLabel}
        </button>
      )}
    </div>
  ),
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
