"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export function NavigationProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Reset on pathname change (navigation complete)
    setLoading(false)
    setProgress(0)
  }, [pathname])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    const handleStart = () => {
      setLoading(true)
      setProgress(10)
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 200)
    }

    const handleComplete = () => {
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200)
    }

    // Listen for clicks on links to start progress
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("http")) return
      if (href === pathname) return
      handleStart()
    }

    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("click", handleClick)
      clearInterval(interval)
    }
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
      <div
        className="h-full bg-accent-blue-mid transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
