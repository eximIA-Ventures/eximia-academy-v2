import { type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("animate-pulse rounded-md bg-bg-elevated", className)} {...props} />
))

Skeleton.displayName = "Skeleton"

export { Skeleton }
