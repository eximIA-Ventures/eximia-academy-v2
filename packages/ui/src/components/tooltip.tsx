import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"

/* ── Tooltip (wrapper) ─────────────────────────────── */

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {}

const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative inline-flex group", className)} {...props}>
      {children}
    </div>
  ),
)

Tooltip.displayName = "Tooltip"

/* ── TooltipTrigger ────────────────────────────────── */

export interface TooltipTriggerProps extends HTMLAttributes<HTMLDivElement> {}

const TooltipTrigger = forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ className, children, ...props }, ref) => (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Tooltip trigger needs tabIndex for keyboard accessibility
    <div ref={ref} tabIndex={0} className={cn("outline-none", className)} {...props}>
      {children}
    </div>
  ),
)

TooltipTrigger.displayName = "TooltipTrigger"

/* ── TooltipContent ────────────────────────────────── */

const sideClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
} as const

export interface TooltipContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Which side the tooltip appears on */
  side?: "top" | "bottom" | "left" | "right"
  children?: ReactNode
}

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", children, ...props }, ref) => (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "absolute z-[60] invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-200",
        "bg-bg-elevated text-text-primary text-xs px-3 py-1.5 rounded-md shadow-elevated whitespace-nowrap",
        sideClasses[side],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)

TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent }
