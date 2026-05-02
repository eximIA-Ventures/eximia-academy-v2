import { type HTMLAttributes, type ReactNode, forwardRef } from "react"
import { cn } from "../lib/utils"

/* ------------------------------- Breadcrumb ------------------------------ */

const Breadcrumb = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav ref={ref} aria-label="Breadcrumb" className={cn(className)} {...props} />
  ),
)
Breadcrumb.displayName = "Breadcrumb"

/* ----------------------------- BreadcrumbList ---------------------------- */

const BreadcrumbList = forwardRef<HTMLOListElement, HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn("inline-flex items-center gap-1.5 text-sm text-text-muted", className)}
      {...props}
    />
  ),
)
BreadcrumbList.displayName = "BreadcrumbList"

/* ----------------------------- BreadcrumbItem ---------------------------- */

const BreadcrumbItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />
  ),
)
BreadcrumbItem.displayName = "BreadcrumbItem"

/* ----------------------------- BreadcrumbLink ---------------------------- */

interface BreadcrumbLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href?: string
}

const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        "text-text-secondary hover:text-text-primary transition-colors underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    />
  ),
)
BreadcrumbLink.displayName = "BreadcrumbLink"

/* -------------------------- BreadcrumbSeparator -------------------------- */

interface BreadcrumbSeparatorProps extends HTMLAttributes<HTMLLIElement> {
  children?: ReactNode
}

const BreadcrumbSeparator = forwardRef<HTMLLIElement, BreadcrumbSeparatorProps>(
  ({ className, children, ...props }, ref) => (
    <li
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn("text-text-muted", className)}
      {...props}
    >
      {children ?? "/"}
    </li>
  ),
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

/* ----------------------------- BreadcrumbPage ---------------------------- */

const BreadcrumbPage = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-current="page"
      className={cn("text-text-primary font-medium", className)}
      {...props}
    />
  ),
)
BreadcrumbPage.displayName = "BreadcrumbPage"

/* -------------------------------- Exports -------------------------------- */

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
}
export type { BreadcrumbLinkProps, BreadcrumbSeparatorProps }
