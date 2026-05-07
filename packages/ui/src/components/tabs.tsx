"use client"

import { type HTMLAttributes, type ReactNode, createContext, forwardRef, useContext } from "react"
import { cn } from "../lib/utils"

/* -------------------------------- Context -------------------------------- */

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx) {
    throw new Error("Tabs compound components must be used within <Tabs>")
  }
  return ctx
}

/* --------------------------------- Tabs ---------------------------------- */

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ value, onValueChange, className, children, ...props }, ref) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div ref={ref} className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  ),
)
Tabs.displayName = "Tabs"

/* -------------------------------- TabsList -------------------------------- */

const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn("inline-flex items-center gap-1 bg-bg-card p-1.5 rounded-xl ring-1 ring-white/[0.06]", className)}
      {...props}
    />
  ),
)
TabsList.displayName = "TabsList"

/* ------------------------------ TabsTrigger ------------------------------ */

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string
  disabled?: boolean
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled = false, onClick, ...props }, ref) => {
    const ctx = useTabsContext()
    const isActive = ctx.value === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        disabled={disabled}
        className={cn(
          "px-4 py-2 text-sm font-semibold rounded-lg transition-all",
          isActive
            ? "bg-cerrado-600/10 text-cerrado-600 ring-1 ring-cerrado-600/30 shadow-sm"
            : "text-text-muted hover:text-text-secondary hover:bg-bg-hover",
          disabled && "opacity-40 cursor-not-allowed",
          className,
        )}
        onClick={(e) => {
          if (!disabled) {
            ctx.onValueChange(value)
          }
          onClick?.(e)
        }}
        {...props}
      />
    )
  },
)
TabsTrigger.displayName = "TabsTrigger"

/* ------------------------------ TabsContent ------------------------------ */

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = useTabsContext()

    if (ctx.value !== value) return null

    return (
      <div ref={ref} role="tabpanel" className={cn("mt-3", className)} {...props}>
        {children}
      </div>
    )
  },
)
TabsContent.displayName = "TabsContent"

/* -------------------------------- Exports -------------------------------- */

export { Tabs, TabsList, TabsTrigger, TabsContent }
export type { TabsProps, TabsTriggerProps, TabsContentProps }
