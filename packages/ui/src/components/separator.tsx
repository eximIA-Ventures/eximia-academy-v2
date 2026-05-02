import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  /** Orientation of the separator */
  orientation?: "horizontal" | "vertical"
  /** When true, the separator is purely decorative and has no semantic meaning */
  decorative?: boolean
}

const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = false, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={cn(
        "bg-border-subtle",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  ),
)
Separator.displayName = "Separator"

export { Separator }
