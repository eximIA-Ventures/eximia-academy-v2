import { ArrowRight, Check, Lock, Play, Route, Sparkles } from "lucide-react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// TrailProgressCard + CompactTrailCard — Fases 1A/1B da experiência "Minha
// Trilha" (Hugo 2026-07-15, oficialização do protótipo /dev/preview-trilha,
// Seções A e C).
//
// TrailProgressCard (1 trilha): card COMPLETO do dashboard — nome, barra de
// progresso geral (cursos concluídos / total) e a mini-sequência horizontal dos
// cursos — check verde (concluído), anel cerrado com % (atual), cadeado
// (bloqueado em trilha sequencial) ou número neutro (disponível em trilha
// livre) — mais o link "Ver trilha completa" → /trails/{trailId}.
//
// CompactTrailCard (2+ trilhas, Fase 1B): o card do GRID "Minhas Trilhas" —
// nome + badge âmbar Obrigatória, barra geral com fração de cursos, mini-steps
// REDUZIDOS (24px, sem rótulos) e CTA Continuar; a trilha com atividade mais
// recente recebe leve destaque (`highlight`).
//
// Pure presentation: os dados chegam prontos do fetch server
// (student-dashboard-page.tsx). Renderizado APENAS quando o aluno tem trilha.
// ---------------------------------------------------------------------------

export interface TrailCourseStep {
  courseId: string
  title: string
  /** "locked" só em trilha sequencial; trilha livre usa "available". */
  state: "completed" | "active" | "locked" | "available"
  progressPct: number
}

export interface StudentTrailData {
  trailId: string
  title: string
  description: string | null
  /** Trilha obrigatória → badge âmbar no card compacto (Fase 1B). */
  isMandatory: boolean
  /** % geral da trilha = cursos concluídos / total. */
  progressPct: number
  /** Índice 0-based do curso atual (primeiro não concluído); null = trilha concluída. */
  currentIndex: number | null
  /** Curso atual, para a linha dinâmica do hero. */
  currentCourseTitle: string | null
  currentCoursePct: number
  /** Destino inteligente: capítulo de continuação do curso atual da trilha. */
  continueHref: string
  /** ISO da atividade mais recente nos cursos da trilha — ordenação (Fase 1B). */
  lastActivityAt: string
  courses: TrailCourseStep[]
}

function StepDot({ step, index }: { step: TrailCourseStep; index: number }) {
  if (step.state === "completed") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-semantic-success text-white shadow-sm">
        <Check size={16} strokeWidth={3} />
      </div>
    )
  }
  if (step.state === "active") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card ring-2 ring-cerrado-600 shadow-[0_0_10px_rgba(253,121,51,0.25)]">
        <span className="text-[10px] font-bold tabular-nums text-cerrado-600">
          {step.progressPct}%
        </span>
      </div>
    )
  }
  if (step.state === "locked") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-hover text-text-muted/50">
        <Lock size={13} />
      </div>
    )
  }
  // "available" — trilha não-sequencial: acessível, ainda não iniciado.
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card text-text-muted shadow-card">
      <span className="text-xs font-bold">{index + 1}</span>
    </div>
  )
}

export function TrailProgressCard({ trail }: { trail: StudentTrailData }) {
  return (
    <div className="rounded-2xl bg-bg-card p-5 shadow-card" data-testid="trail-progress-card">
      <div className="flex flex-col gap-4">
        {/* Header: nome + link para a trilha completa */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
              <Route size={18} className="text-cerrado-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Minha Trilha
              </p>
              <h3 className="truncate text-base font-bold text-text-primary">{trail.title}</h3>
            </div>
          </div>
          <Link
            href={`/trails/${trail.trailId}`}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cerrado-600 transition-colors hover:text-cerrado-500"
          >
            Ver trilha completa
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Barra geral da trilha */}
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-cerrado-600 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, trail.progressPct))}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-text-primary">
            {trail.progressPct}%
          </span>
        </div>

        {/* Mini-sequência horizontal dos cursos */}
        <div className="flex items-start">
          {trail.courses.map((step, i) => (
            <div key={step.courseId} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-24 flex-col items-center gap-1.5 sm:w-32">
                <StepDot step={step} index={i} />
                <span
                  className={`w-full truncate text-center text-[10px] leading-tight ${
                    step.state === "locked"
                      ? "text-text-muted/50"
                      : step.state === "active"
                        ? "font-semibold text-text-primary"
                        : "text-text-muted"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {i < trail.courses.length - 1 && (
                <div
                  className={`mt-[17px] h-0.5 flex-1 rounded-full ${
                    step.state === "completed" ? "bg-semantic-success/50" : "bg-bg-hover"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mini-step REDUZIDO do card compacto (24px, sem rótulo). */
function MiniStepDot({ step }: { step: TrailCourseStep }) {
  if (step.state === "completed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-semantic-success text-white">
        <Check size={11} strokeWidth={3} />
      </div>
    )
  }
  if (step.state === "active") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-card ring-2 ring-cerrado-600">
        <span className="text-[8px] font-bold tabular-nums text-cerrado-600">
          {step.progressPct}%
        </span>
      </div>
    )
  }
  if (step.state === "locked") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-hover text-text-muted/50">
        <Lock size={10} />
      </div>
    )
  }
  // "available" — trilha não-sequencial: acessível, ainda não iniciado.
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-card text-text-muted shadow-card">
      <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
    </div>
  )
}

/**
 * Fase 1B — o card COMPACTO do grid "Minhas Trilhas" (2+ trilhas). Visual da
 * Seção C do preview aprovado: nome + badge Obrigatória, barra geral + fração,
 * mini-steps reduzidos e CTA Continuar (destino inteligente da trilha).
 * `highlight` = trilha com atividade mais recente (leve destaque + "Recente").
 */
export function CompactTrailCard({
  trail,
  highlight = false,
}: {
  trail: StudentTrailData
  highlight?: boolean
}) {
  const completedCourses = trail.courses.filter((c) => c.state === "completed").length

  return (
    <div
      data-testid="compact-trail-card"
      className={`flex flex-col gap-3 rounded-2xl bg-bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
        highlight ? "ring-1 ring-cerrado-600/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/trails/${trail.trailId}`}
              className="truncate text-sm font-bold text-text-primary transition-colors hover:text-cerrado-600"
            >
              {trail.title}
            </Link>
            {trail.isMandatory && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                Obrigatória
              </span>
            )}
          </div>
          {trail.description && (
            <p className="mt-0.5 truncate text-[11px] text-text-muted">{trail.description}</p>
          )}
        </div>
        {highlight && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cerrado-600/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cerrado-600">
            <Sparkles size={9} className="shrink-0" />
            Recente
          </span>
        )}
      </div>

      {/* Barra geral + fração de cursos */}
      <div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-cerrado-600"
              style={{ width: `${Math.min(100, Math.max(0, trail.progressPct))}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-text-primary">
            {trail.progressPct}%
          </span>
        </div>
        <p className="mt-1 text-[10px] text-text-muted">
          {completedCourses} de {trail.courses.length} cursos concluídos
        </p>
      </div>

      {/* Mini-steps reduzidos + CTA */}
      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center">
          {trail.courses.map((step, i) => (
            <div key={step.courseId} className="flex items-center">
              <MiniStepDot step={step} />
              {i < trail.courses.length - 1 && (
                <div
                  className={`h-0.5 w-3 rounded-full ${
                    step.state === "completed" ? "bg-semantic-success/50" : "bg-bg-hover"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <Link
          href={trail.continueHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cerrado-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-cerrado-500"
        >
          <Play size={10} />
          Continuar
        </Link>
      </div>
    </div>
  )
}
