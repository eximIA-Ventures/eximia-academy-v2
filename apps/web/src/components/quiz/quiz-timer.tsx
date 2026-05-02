"use client"

import { Clock } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface QuizTimerProps {
  timeLimitMinutes: number
  startedAt: string
  onTimeUp: () => void
}

export function QuizTimer({ timeLimitMinutes, startedAt, onTimeUp }: QuizTimerProps) {
  const calculateRemaining = useCallback(() => {
    const startMs = new Date(startedAt).getTime()
    const limitMs = timeLimitMinutes * 60 * 1000
    const elapsed = Date.now() - startMs
    return Math.max(0, Math.floor((limitMs - elapsed) / 1000))
  }, [timeLimitMinutes, startedAt])

  const [remaining, setRemaining] = useState(calculateRemaining)

  useEffect(() => {
    const interval = setInterval(() => {
      const newRemaining = calculateRemaining()
      setRemaining(newRemaining)
      if (newRemaining <= 0) {
        clearInterval(interval)
        onTimeUp()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [calculateRemaining, onTimeUp])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const isLow = remaining <= 300 // 5 minutes

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-mono font-medium ${
        isLow
          ? "bg-semantic-error/10 text-semantic-error"
          : "bg-bg-surface text-text-primary"
      }`}
    >
      <Clock size={14} />
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  )
}
