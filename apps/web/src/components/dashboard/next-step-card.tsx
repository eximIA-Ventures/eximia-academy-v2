"use client"

import type { NextStepInfo } from "@/components/dashboard/types"
import { Button } from "@eximia/ui"
import { Clock, Play } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface NextStepCardProps {
  nextStep: NextStepInfo | null
}

/**
 * Provocative "Proximo passo" card (design v6.1).
 * The activation question dominates the card; light surface with orange left border.
 */
export function NextStepCard({ nextStep }: NextStepCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const continueHref = nextStep
    ? `/courses/${nextStep.courseId}/chapters/${nextStep.chapterId}`
    : "/courses"

  return (
    <div className="px-6">
      <section className="relative overflow-hidden rounded-2xl border border-border-subtle border-l-4 border-l-cerrado-600 bg-bg-card p-7 shadow-card">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-cerrado-600/10 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="relative">
          <span className="inline-flex items-center rounded-full bg-cerrado-600/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cerrado-600">
            Próximo passo
          </span>

          <h2 className="mt-4 max-w-[640px] font-display text-2xl font-extrabold leading-tight tracking-tight text-text-primary md:text-3xl">
            {nextStep
              ? "O que você vai aplicar desta vez no seu trabalho real?"
              : "Pronto para dar o primeiro passo da sua jornada?"}
          </h2>

          {nextStep && (
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-3.5 py-1.5 text-xs font-semibold text-text-secondary">
                <Clock size={12} className="shrink-0 text-cerrado-600" />
                {nextStep.chapterTitle} · {nextStep.courseTitle}
              </span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={continueHref}
              className="inline-flex items-center gap-2 rounded-full bg-cerrado-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cerrado-700 hover:shadow-md hover:scale-[1.02] active:scale-[0.97]"
            >
              <Play size={14} className="shrink-0" />
              {nextStep ? "Continuar agora" : "Explorar trilhas"}
            </Link>
            <Button variant="secondary" className="rounded-full" onClick={() => setDismissed(true)}>
              Responder depois
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
