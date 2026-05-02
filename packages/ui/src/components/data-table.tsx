"use client"

import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Skeleton } from "./skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

/* ----------------------------- Types -------------------------------- */

export interface DataTableColumn<T> {
  /** Unique key for the column */
  key: string
  /** Header label */
  header: string
  /** Render function for cell content */
  render: (row: T) => ReactNode
  /** Optional className for the column */
  className?: string
}

export interface DataTableProps<T> extends HTMLAttributes<HTMLDivElement> {
  /** Column definitions */
  columns: DataTableColumn<T>[]
  /** Row data */
  data: T[]
  /** Unique key extractor for each row */
  rowKey: (row: T) => string
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Current search value (controlled) */
  searchValue?: string
  /** Search change handler */
  onSearchChange?: (value: string) => void
  /** Slot for filter controls rendered between search and table */
  filterSlot?: ReactNode
  /** Slot for action buttons rendered in header (e.g., "Add User" button) */
  actionSlot?: ReactNode
  /** Current page (1-based) */
  currentPage?: number
  /** Total pages */
  totalPages?: number
  /** Page change handler */
  onPageChange?: (page: number) => void
  /** Whether data is loading */
  loading?: boolean
  /** Empty state message */
  emptyMessage?: string
}

/* ----------------------------- Search Icon ----------------------------- */

const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

/* ----------------------------- DataTable ------------------------------- */

function DataTable<T>({
  columns,
  data,
  rowKey,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filterSlot,
  actionSlot,
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  emptyMessage = "No results found.",
  className,
  ...props
}: DataTableProps<T>) {
  const showPagination = totalPages != null && totalPages > 1

  return (
    <div className={cn("w-full", className)} {...props}>
      {/* Header bar: search + filters + actions */}
      {(onSearchChange || filterSlot || actionSlot) && (
        <div className="flex items-center gap-3 mb-4">
          {onSearchChange && (
            <div className="flex-1 max-w-sm">
              <Input
                leadingIcon={<SearchIcon />}
                placeholder={searchPlaceholder}
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                inputSize="sm"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {filterSlot}
          {actionSlot && <div className="ml-auto">{actionSlot}</div>}
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-text-muted">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      {showPagination && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange?.(Math.max(1, (currentPage ?? 1) - 1))}
            aria-label="Previous page"
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
            Previous
          </Button>
          <span className="text-sm text-text-secondary px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange?.(Math.min(totalPages ?? 1, (currentPage ?? 1) + 1))}
            aria-label="Next page"
          >
            Next
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
          </Button>
        </div>
      )}
    </div>
  )
}

DataTable.displayName = "DataTable"

/* -------------------------------- Exports -------------------------------- */

export { DataTable }
