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
import { AlertCircle, Compass } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, DEFAULT_CONTINUE_HREF, OwnMetricsOnly } from "./student-comparison-view"
import { StudentHomeCard } from "./student-home-card"
import { StudyPlanInviteStrip } from "./study-plan-invite-strip"

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

// JRN-D (Hugo 2026-07-24) — curso do aluno p/ o seletor do card "Meu ritmo".
export interface StudentCourseOption {
  courseId: string
  courseTitle: string
}

/**
 * RODADA 11 (R2) — SENTINELA DE ESTADO VAZIO, NÃO DE FALHA.
 *
 * A API responde 400 `{"error":"Nenhum tenant ativo"}` quando quem pergunta não
 * tem matrícula nem empresa ativa (o caso do `super_admin` no mundo Padrão, que
 * não é aluno de ninguém). Nada quebrou: simplesmente ainda não há desempenho a
 * mostrar. Antes isso caía no mesmo `catch` de um 500 e chegava ao usuário como
 * "Não foi possível carregar seu desempenho. Nenhum tenant ativo", com ícone de
 * alerta — uma promessa de estado vazio entregue como tela vermelha.
 *
 * A sentinela separa as duas causas SEM tocar na rota (que é de outra frente):
 * este caso vira convite, e erro de verdade (rede, 500, 403) continua erro.
 */
const NO_ACTIVE_SCOPE = "no-active-scope"

async function fetchStudentComparison(courseId?: string | null): Promise<StudentComparisonType> {
  // JRN-D — courseId opcional escopa o SUJEITO àquele curso (self-view, sempre
  // auth.uid() no servidor). Ausente → agregado (comportamento original).
  const url = courseId
    ? `/api/analytics/manager-groups?view=student&courseId=${encodeURIComponent(courseId)}`
    : "/api/analytics/manager-groups?view=student"
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    // R2 — só o 400 de escopo ausente vira convite; qualquer outro status é erro.
    if (res.status === 400 && /nenhum tenant ativo/i.test(body.error ?? "")) {
      throw new Error(NO_ACTIVE_SCOPE)
    }
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
// Empty state (R2) — CONVITE, não falha: sem ícone de alerta, sem "não foi
// possível", sem cor semântica de erro. Mesma moldura <Card> e mesma anatomia
// de título do OwnMetricsOnly, para o card não mudar de peso na tela.
// ---------------------------------------------------------------------------

function NoScopeInvite() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Compass size={18} className="mt-0.5 shrink-0 text-text-muted" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-primary">Meu desempenho</h2>
          <p className="text-sm text-text-muted">
            Seu ritmo aparece aqui assim que você entrar em uma empresa e começar um curso.
          </p>
        </div>
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
  courseOptions = [],
}: {
  continueHref?: string
  /** PONTO 1 (Hugo 2026-07-14) — primeiro nome do aluno p/ a linha "Eu (Nome)". */
  studentFirstName?: string | null
  /** Minha Jornada v6.1: false suprime a NextStepBar (o dashboard usa o card
   *  Próximo passo provocativo como CTA único). Default true. */
  showNextStep?: boolean
  /** JRN-D — cursos do aluno p/ o seletor do card (só aparece com 2+). */
  courseOptions?: StudentCourseOption[]
} = {}) {
  // JRN-D — curso selecionado (null = líder/agregado, default = zero interação).
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  // Mantém os últimos dados durante a troca de curso (o card e o seletor NÃO
  // somem para um skeleton a cada clique — só o load inicial mostra skeleton).
  const [data, setData] = useState<StudentComparisonType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetchStudentComparison(selectedCourseId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro desconhecido")
      })
    return () => {
      cancelled = true
    }
  }, [selectedCourseId])

  // R2 — o estado vazio vem ANTES do erro: sem escopo é convite, não falha.
  if (error === NO_ACTIVE_SCOPE && !data) return <NoScopeInvite />
  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Skeleton />

  const { student, unit, indicators } = data

  // No org reference to compare against — show the student's own numbers only.
  if (!unit || !indicators) return <OwnMetricsOnly block={student} continueHref={continueHref} />

  return (
    <div className="space-y-4">
      {/* SH-3.3 R3 (Hugo 2026-07-21) — "Linha de Convite": faixa independente,
          full-width, ACIMA do card "Meu ritmo" inteiro (fora da moldura do
          <Card>, irmã de StudentHomeCard, não filha). */}
      <StudyPlanInviteStrip />
      <StudentHomeCard
        student={student}
        unit={unit}
        indicators={indicators}
        continueHref={continueHref}
        interactionHref={data.nextPendingInteractionHref}
        reflectionHref={data.nextPendingReflectionHref}
        studentFirstName={studentFirstName}
        showNextStep={showNextStep}
        courseOptions={courseOptions}
        selectedCourseId={selectedCourseId}
        onSelectCourse={setSelectedCourseId}
      />
    </div>
  )
}
