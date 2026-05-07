"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

type Theme = "dark" | "light" | "system"

interface ThemeContextValue {
  theme: Theme
  resolved: "dark" | "light"
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolve(theme: Theme): "dark" | "light" {
  return theme === "system" ? getSystemTheme() : theme
}

function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement
  root.classList.add("theme-transition")
  if (resolved === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  requestAnimationFrame(() => {
    setTimeout(() => root.classList.remove("theme-transition"), 350)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolved, setResolved] = useState<"dark" | "light">("light")

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    const t = stored && ["dark", "light", "system"].includes(stored) ? stored : "system"
    setThemeState(t)
    const r = resolve(t)
    setResolved(r)
    applyTheme(r)
  }, [])

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== "system") return

    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const r = getSystemTheme()
      setResolved(r)
      applyTheme(r)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem("theme", t)
    const r = resolve(t)
    setResolved(r)
    applyTheme(r)
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolved === "light" ? "dark" : "light")
  }, [resolved, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
