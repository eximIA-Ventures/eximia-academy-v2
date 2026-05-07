import { type ButtonHTMLAttributes, type HTMLAttributes, forwardRef } from "react"
import { cn } from "../lib/utils"

/* ------------------------------ Pagination -------------------------------- */

const Pagination = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  ),
)
Pagination.displayName = "Pagination"

/* -------------------------- PaginationContent ----------------------------- */

const PaginationContent = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex items-center gap-1", className)} {...props} />
  ),
)
PaginationContent.displayName = "PaginationContent"

/* ----------------------------- PaginationItem ----------------------------- */

const PaginationItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />,
)
PaginationItem.displayName = "PaginationItem"

/* ----------------------------- PaginationLink ----------------------------- */

interface PaginationLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean
}

const PaginationLink = forwardRef<HTMLButtonElement, PaginationLinkProps>(
  ({ className, isActive, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "h-9 w-9 inline-flex items-center justify-center rounded-sm text-sm transition-colors",
        isActive && "bg-cerrado-600 text-white",
        !isActive && "text-text-secondary hover:bg-bg-surface hover:text-text-primary",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    />
  ),
)
PaginationLink.displayName = "PaginationLink"

/* -------------------------- PaginationPrevious ---------------------------- */

const PaginationPrevious = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <PaginationLink
      ref={ref}
      aria-label="Go to previous page"
      className={cn("w-auto gap-1 px-2.5", className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>Previous</span>
    </PaginationLink>
  ),
)
PaginationPrevious.displayName = "PaginationPrevious"

/* ----------------------------- PaginationNext ----------------------------- */

const PaginationNext = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <PaginationLink
      ref={ref}
      aria-label="Go to next page"
      className={cn("w-auto gap-1 px-2.5", className)}
      {...props}
    >
      <span>Next</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </PaginationLink>
  ),
)
PaginationNext.displayName = "PaginationNext"

/* -------------------------- PaginationEllipsis ---------------------------- */

const PaginationEllipsis = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn("h-9 w-9 inline-flex items-center justify-center text-text-muted", className)}
      {...props}
    >
      ...
    </span>
  ),
)
PaginationEllipsis.displayName = "PaginationEllipsis"

/* -------------------------------- Exports -------------------------------- */

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
}
export type { PaginationLinkProps }
