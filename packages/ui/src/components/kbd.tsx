import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface KbdProps extends HTMLAttributes<HTMLElement> {}

const Kbd = forwardRef<HTMLElement, KbdProps>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1 rounded-md border border-border-medium bg-bg-surface px-1.5 py-0.5 font-mono text-2xs font-medium text-text-secondary shadow-sm",
      className,
    )}
    {...props}
  />
))
Kbd.displayName = "Kbd"

export { Kbd }
