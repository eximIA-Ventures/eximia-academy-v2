import {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  forwardRef,
} from "react"
import { cn } from "../lib/utils"

/* --------------------------------- Table --------------------------------- */

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm border-collapse", className)}
        {...props}
      />
    </div>
  ),
)
Table.displayName = "Table"

/* ------------------------------ TableHeader ------------------------------ */

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("border-b border-border-subtle", className)} {...props} />
  ),
)
TableHeader.displayName = "TableHeader"

/* ------------------------------- TableBody ------------------------------- */

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
)
TableBody.displayName = "TableBody"

/* ------------------------------- TableRow -------------------------------- */

const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border-subtle transition-colors hover:bg-bg-surface",
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

/* ------------------------------- TableHead ------------------------------- */

const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-10 px-4 text-left align-middle text-xs font-medium text-text-muted uppercase tracking-wider",
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = "TableHead"

/* ------------------------------- TableCell ------------------------------- */

const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("px-4 py-3 align-middle text-text-primary", className)}
      {...props}
    />
  ),
)
TableCell.displayName = "TableCell"

/* ----------------------------- TableCaption ------------------------------ */

const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-text-muted", className)} {...props} />
  ),
)
TableCaption.displayName = "TableCaption"

/* ------------------------------ TableFooter ------------------------------ */

const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t border-border-subtle bg-bg-surface font-medium", className)}
      {...props}
    />
  ),
)
TableFooter.displayName = "TableFooter"

/* -------------------------------- Exports -------------------------------- */

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, TableFooter }
