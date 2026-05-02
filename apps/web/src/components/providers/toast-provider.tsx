"use client"

import { ToastProvider as UIToastProvider } from "@eximia/ui"
import type { ReactNode } from "react"

export function ToastProvider({ children }: { children: ReactNode }) {
  return <UIToastProvider>{children}</UIToastProvider>
}
