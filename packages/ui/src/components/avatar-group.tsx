import { Children, type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"

/* ------------------------------ AvatarGroup ------------------------------ */

interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Maximum number of visible avatars before showing overflow indicator */
  max?: number
  children: ReactNode
}

const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 3, children, ...props }, ref) => {
    const childArray = Children.toArray(children)
    const visibleChildren = childArray.slice(0, max)
    const remaining = childArray.length - max

    return (
      <div ref={ref} className={cn("flex -space-x-2", className)} {...props}>
        {visibleChildren.map((child, index) => (
          <div key={index} className="ring-2 ring-bg-app rounded-full">
            {child}
          </div>
        ))}
        {remaining > 0 && (
          <div className="ring-2 ring-bg-app inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-text-secondary text-xs font-medium">
            +{remaining}
          </div>
        )}
      </div>
    )
  },
)
AvatarGroup.displayName = "AvatarGroup"

/* -------------------------------- Exports -------------------------------- */

export { AvatarGroup }
export type { AvatarGroupProps }
