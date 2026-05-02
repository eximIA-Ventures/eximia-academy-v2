"use client"

import { type VariantProps, cva } from "class-variance-authority"
import { type HTMLAttributes, forwardRef, useState } from "react"
import { cn } from "../lib/utils"

const avatarVariants = cva(
  "inline-flex items-center justify-center overflow-hidden rounded-full bg-bg-elevated text-text-secondary font-medium",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        default: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
)

export interface AvatarProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  /** Image source URL */
  src?: string
  /** Alt text for the avatar image */
  alt?: string
  /** Fallback text (initials) displayed when no image or image fails to load */
  fallback: string
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, src, alt = "", fallback, ...props }, ref) => {
    const [imgError, setImgError] = useState(false)

    return (
      <div ref={ref} className={cn(avatarVariants({ size, className }))} {...props}>
        {src && !imgError ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover rounded-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <span>{fallback}</span>
        )}
      </div>
    )
  },
)
Avatar.displayName = "Avatar"

export { Avatar, avatarVariants }
