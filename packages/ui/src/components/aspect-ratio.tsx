import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  ratio?: number
}

const AspectRatio = forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ className, ratio = 16 / 9, style, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ paddingBottom: `${(1 / ratio) * 100}%`, ...style }}
      {...props}
    >
      <div className="absolute inset-0">{children}</div>
    </div>
  ),
)
AspectRatio.displayName = "AspectRatio"

export { AspectRatio }
