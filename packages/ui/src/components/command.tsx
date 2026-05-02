"use client"

import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  createContext,
  forwardRef,
  useContext,
  useState,
} from "react"
import { cn } from "../lib/utils"

/* -------------------------------- Context -------------------------------- */

interface CommandContextValue {
  search: string
  setSearch: (value: string) => void
  filter: (value: string, search: string) => boolean
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined)

function useCommandContext() {
  const ctx = useContext(CommandContext)
  if (!ctx) {
    throw new Error("Command compound components must be used within <Command>")
  }
  return ctx
}

/* -------------------------------- Command -------------------------------- */

interface CommandProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  filter?: (value: string, search: string) => boolean
}

const defaultFilter = (value: string, search: string) =>
  value.toLowerCase().includes(search.toLowerCase())

const Command = forwardRef<HTMLDivElement, CommandProps>(
  ({ className, children, filter, ...props }, ref) => {
    const [search, setSearch] = useState("")

    return (
      <CommandContext.Provider value={{ search, setSearch, filter: filter ?? defaultFilter }}>
        <div
          ref={ref}
          className={cn(
            "bg-bg-card rounded-md border border-border-subtle shadow-elevated overflow-hidden",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </CommandContext.Provider>
    )
  },
)
Command.displayName = "Command"

/* ----------------------------- CommandInput ------------------------------ */

const CommandInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">
>(({ className, ...props }, ref) => {
  const { search, setSearch } = useCommandContext()

  return (
    <div className="flex items-center border-b border-border-subtle px-4">
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
        className="mr-2 shrink-0 text-text-muted"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={ref}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(
          "w-full bg-transparent py-3 text-sm text-text-primary placeholder:text-text-muted outline-none",
          className,
        )}
        {...props}
      />
    </div>
  )
})
CommandInput.displayName = "CommandInput"

/* ------------------------------ CommandList ------------------------------ */

const CommandList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="listbox"
      className={cn("max-h-72 overflow-y-auto p-1", className)}
      {...props}
    />
  ),
)
CommandList.displayName = "CommandList"

/* ----------------------------- CommandEmpty ------------------------------ */

const CommandEmpty = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("py-6 text-center text-sm text-text-muted", className)}
      {...props}
    />
  ),
)
CommandEmpty.displayName = "CommandEmpty"

/* ----------------------------- CommandGroup ------------------------------ */

interface CommandGroupProps extends HTMLAttributes<HTMLDivElement> {
  heading?: string
}

const CommandGroup = forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, heading, children, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      aria-label={heading}
      className={cn("overflow-hidden", className)}
      {...props}
    >
      {heading && <div className="px-3 py-1.5 text-xs font-medium text-text-muted">{heading}</div>}
      {children}
    </div>
  ),
)
CommandGroup.displayName = "CommandGroup"

/* ------------------------------ CommandItem ------------------------------ */

interface CommandItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string
  onSelect?: () => void
}

const CommandItem = forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ className, value, onSelect, disabled, children, ...props }, ref) => {
    const { search, filter } = useCommandContext()

    if (value && search && !filter(value, search)) {
      return null
    }

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={false}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 text-sm text-text-primary rounded-sm transition-colors hover:bg-bg-surface cursor-pointer",
          disabled && "opacity-40 cursor-not-allowed",
          className,
        )}
        onClick={() => {
          if (!disabled && onSelect) {
            onSelect()
          }
        }}
        {...props}
      >
        {children}
      </button>
    )
  },
)
CommandItem.displayName = "CommandItem"

/* --------------------------- CommandSeparator ---------------------------- */

const CommandSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("h-px bg-border-subtle my-1", className)} {...props} />
  ),
)
CommandSeparator.displayName = "CommandSeparator"

/* -------------------------------- Exports -------------------------------- */

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
}
