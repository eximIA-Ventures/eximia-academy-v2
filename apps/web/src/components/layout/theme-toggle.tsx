"use client"

import { useTheme } from "@/components/providers/theme-provider"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { resolved, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
      aria-label={resolved === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      title={resolved === "dark" ? "Modo claro" : "Modo escuro"}
    >
      {resolved === "dark" ? (
        <Sun size={18} className="transition-transform hover:rotate-12" />
      ) : (
        <Moon size={18} className="transition-transform hover:-rotate-12" />
      )}
    </button>
  )
}
