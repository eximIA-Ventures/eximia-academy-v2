"use client"

// ---------------------------------------------------------------------------
// StudentComparison — FETCH WRAPPER for the "Meu desempenho" card
// ---------------------------------------------------------------------------
// This wrapper owns the DATA lifecycle only: it fetches the student-vs-unit
// comparison, resolves loading / error / empty / data states, and hands ready
// props to the PURE presentational layer in student-comparison-view.tsx.
//
// The split keeps zero behavior change on the real page while letting the
// dev-only preview (/dev/preview-desempenho) render the presentation with the
// exact mockup numbers — so the pixel can be verified without a live session.
//
// DATA: GET /api/analytics/manager-groups?view=student → StudentComparison.
//   The endpoint resolves studentId from auth.uid() server-side; this component
//   sends NO identifying params. Read-only. No PII of other students.
//
// STATES: loading skeleton (mirrors the layout) | fetch error (same message) |
//   no-unit empty (OwnMetricsOnly) | data (StudentComparisonView).
// ---------------------------------------------------------------------------

import type { StudentComparison as StudentComparisonType } from "@/types/analytics"
import { AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, DEFAULT_CONTINUE_HREF, OwnMetricsOnly } from "./student-comparison-view"
import { StudentHomeCard } from "./student-home-card"

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchStudentComparison(): Promise<StudentComparisonType> {
  const res = await fetch("/api/analytics/manager-groups?view=student", {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<StudentComparisonType>
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the real layout (header, hero, 4 rows, next-step)
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <Card>
      <div className="animate-pulse space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-bg-elevated" />
            <div className="h-3.5 w-72 rounded bg-bg-elevated" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-bg-elevated" />
            <div className="h-6 w-24 rounded-full bg-bg-elevated" />
          </div>
        </div>
        {/* Hero */}
        <div className="h-28 w-full rounded-2xl bg-bg-elevated" />
        {/* Rows */}
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-bg-elevated" />
          <div className="space-y-4 pt-2">
            {["r1", "r2", "r3", "r4"].map((k) => (
              <div key={`skeleton-row-${k}`} className="flex items-center gap-6">
                <div className="h-4 w-44 shrink-0 rounded bg-bg-elevated" />
                <div className="h-5 flex-1 rounded bg-bg-elevated" />
                <div className="hidden w-48 shrink-0 space-y-1.5 sm:block">
                  <div className="h-1.5 w-full rounded-full bg-bg-elevated" />
                  <div className="h-1.5 w-2/3 rounded-full bg-bg-elevated" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Next-step */}
        <div className="h-14 w-full rounded-2xl bg-bg-elevated" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Error state — SAME message contract as before (do not change copy).
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-semantic-warning" />
        <p className="text-xs text-text-muted">
          Não foi possível carregar seu desempenho. {message}
        </p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Root export — fetch wrapper
// ---------------------------------------------------------------------------

/**
 * StudentComparison — renders the student's "Meu desempenho" card: their own
 * metrics next to their UNIDADE average, with a graded verdict hero and a
 * next-step CTA. Fetches from /api/analytics/manager-groups?view=student and
 * delegates all rendering to StudentComparisonView (pure presentation).
 *
 * `continueHref` is the destination for the next-step button (same target as
 * the dashboard's top "Continuar" banner). Defaults to /courses.
 *
 * Read-only. No PII of other students is ever displayed.
 */
export function StudentComparison({
  continueHref = DEFAULT_CONTINUE_HREF,
  studentFirstName,
  showNextStep = true,
}: {
  continueHref?: string
  /** PONTO 1 (Hugo 2026-07-14) — primeiro nome do aluno p/ a linha "Eu (Nome)". */
  studentFirstName?: string | null
  /** Minha Jornada v6.1: false suprime a NextStepBar (o dashboard usa o card
   *  Próximo passo provocativo como CTA único). Default true. */
  showNextStep?: boolean
} = {}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: StudentComparisonType }
  >({ status: "loading" })

  useEffect(() => {
    let cancelled = false

    fetchStudentComparison()
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erro desconhecido"
          setState({ status: "error", message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === "loading") return <Skeleton />
  if (state.status === "error") return <ErrorState message={state.message} />

  const { student, unit, indicators } = state.data

  // No org reference to compare against — show the student's own numbers only.
  if (!unit || !indicators) return <OwnMetricsOnly block={student} continueHref={continueHref} />

  return (
    <StudentHomeCard
      student={student}
      unit={unit}
      indicators={indicators}
      continueHref={continueHref}
      studentFirstName={studentFirstName}
      showNextStep={showNextStep}
    />
  )
}
