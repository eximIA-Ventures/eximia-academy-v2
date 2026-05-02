"use client"

import { Button } from "@eximia/ui"
import { ArrowRight, GripVertical } from "lucide-react"
import { useCallback, useState } from "react"
import { KOLB_ITEMS, type KolbMode } from "@/lib/assessments/kolb-items"
import { type KolbResult, scoreKolb } from "@/lib/assessments/kolb-scoring"

interface KolbQuestionnaireProps {
  onComplete: (result: KolbResult, rawAnswers: Record<number, Record<KolbMode, number>>) => void
  onBack?: () => void
}

type Ranking = Record<KolbMode, number>

const MODE_ORDER: KolbMode[] = ["ce", "ro", "ac", "ae"]

export function KolbQuestionnaire({ onComplete, onBack }: KolbQuestionnaireProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, Ranking>>({})
  const [currentRanking, setCurrentRanking] = useState<KolbMode[]>([...MODE_ORDER])

  const item = KOLB_ITEMS[currentIndex]
  const total = KOLB_ITEMS.length
  const progress = ((currentIndex) / total) * 100

  const handleSelect = useCallback((mode: KolbMode, rank: number) => {
    setCurrentRanking((prev) => {
      // Remove mode from current position
      const without = prev.filter((m) => m !== mode)
      // Insert at new rank position (rank is 1-4, index is 0-3)
      without.splice(rank - 1, 0, mode)
      return without
    })
  }, [])

  const confirmAndNext = useCallback(() => {
    // Convert ranking array to score object (position 0 = rank 4 = most like me)
    const ranking: Ranking = { ce: 0, ro: 0, ac: 0, ae: 0 }
    currentRanking.forEach((mode, index) => {
      ranking[mode] = 4 - index // First = 4 (most), Last = 1 (least)
    })

    const newAnswers = { ...answers, [item.id]: ranking }
    setAnswers(newAnswers)

    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1)
      setCurrentRanking([...MODE_ORDER]) // Reset for next
    } else {
      // Score and complete
      const result = scoreKolb(newAnswers)
      onComplete(result, newAnswers)
    }
  }, [currentRanking, answers, item, currentIndex, total, onComplete])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Questão {currentIndex + 1} de {total}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div className="h-full rounded-full bg-accent-teal transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-2xl bg-bg-card ring-1 ring-white/[0.06] p-6 space-y-5">
        <h3 className="text-lg font-semibold text-text-primary leading-relaxed">
          {item.situation}
        </h3>
        <p className="text-xs text-text-muted">
          Ordene as opções: arraste a que mais combina com você para o topo (4 = mais parecido).
        </p>

        {/* Ranking list */}
        <div className="space-y-2">
          {currentRanking.map((mode, index) => {
            const rank = 4 - index
            const text = item.options[mode]

            return (
              <div
                key={mode}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-bg-primary p-4 transition-all hover:border-accent-teal/20"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  rank === 4
                    ? "bg-accent-teal text-white"
                    : rank === 3
                      ? "bg-accent-teal/30 text-accent-teal"
                      : rank === 2
                        ? "bg-white/[0.06] text-text-muted"
                        : "bg-white/[0.03] text-text-muted/50"
                }`}>
                  {rank}
                </span>
                <span className="flex-1 text-sm text-text-primary">{text}</span>
                <div className="flex gap-1">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentRanking((prev) => {
                          const next = [...prev]
                          ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                          return next
                        })
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-white/[0.06] hover:text-text-primary transition-colors"
                      aria-label="Mover para cima"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9V3M6 3L3 6M6 3L9 6" /></svg>
                    </button>
                  )}
                  {index < 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentRanking((prev) => {
                          const next = [...prev]
                          ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                          return next
                        })
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-white/[0.06] hover:text-text-primary transition-colors"
                      aria-label="Mover para baixo"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 3V9M6 9L3 6M6 9L9 6" /></svg>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button onClick={confirmAndNext}>
            {currentIndex < total - 1 ? "Próxima" : "Ver Resultado"}
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
