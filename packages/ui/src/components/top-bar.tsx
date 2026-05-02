import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

/* --------------------------------- TopBar -------------------------------- */

const TopBar = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-[30] h-14 bg-bg-card border-b border-border-subtle flex items-center px-4 gap-4",
        className,
      )}
      {...props}
    />
  ),
)
TopBar.displayName = "TopBar"

/* ------------------------------- TopBarLeft ------------------------------ */

const TopBarLeft = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3", className)} {...props} />
  ),
)
TopBarLeft.displayName = "TopBarLeft"

/* ------------------------------ TopBarCenter ----------------------------- */

const TopBarCenter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 flex items-center justify-center", className)}
      {...props}
    />
  ),
)
TopBarCenter.displayName = "TopBarCenter"

/* ------------------------------ TopBarRight ------------------------------ */

const TopBarRight = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 ml-auto", className)} {...props} />
  ),
)
TopBarRight.displayName = "TopBarRight"

/* -------------------------------- Exports -------------------------------- */

export { TopBar, TopBarLeft, TopBarCenter, TopBarRight }
