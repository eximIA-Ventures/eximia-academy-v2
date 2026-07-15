"use client"

import { selfEnrollInTrail } from "@/app/(platform)/trails/actions"
import { useToast } from "@eximia/ui"
import { ArrowRight, BookOpen, Clock, Play, Route, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export interface TrailSummary {
  id: string
  title: string
  description: string | null
  estimated_hours: number | null
  is_mandatory: boolean
  course_count: number
  is_enrolled: boolean
  progress: { total: number; completed: number } | null
}

function SubHeading({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">{title}</h2>
  )
}

function MandatoryBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
      Obrigatória
    </span>
  )
}

/** Card compacto de trilha inscrita — barra cerrado + fração de cursos. */
function EnrolledTrailCard({ trail }: { trail: TrailSummary }) {
  const completed = trail.progress?.completed ?? 0
  const total = trail.course_count > 0 ? trail.course_count : (trail.progress?.total ?? 0)
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Link
      href={`/trails/${trail.id}`}
      className="group flex flex-col gap-3 rounded-2xl bg-bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate text-sm font-bold text-text-primary">{trail.title}</h3>
          {trail.is_mandatory && <MandatoryBadge />}
        </div>
        {trail.description && (
          <p className="mt-0.5 truncate text-[11px] text-text-muted">{trail.description}</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-text-primary">
            {progressPct}%
          </span>
        </div>
        <p className="mt-1 text-[10px] text-text-muted">
          {completed} de {total} cursos concluídos
        </p>
      </div>

      <div className="mt-auto flex items-center justify-end">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cerrado-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all group-hover:bg-cerrado-500">
          <Play size={10} />
          Continuar
        </span>
      </div>
    </Link>
  )
}

/** Card de trilha disponível — chips neutros + Inscrever-se (self-enroll). */
function AvailableTrailCard({
  trail,
  isPending,
  onEnroll,
}: {
  trail: TrailSummary
  isPending: boolean
  onEnroll: (trailId: string) => void
}) {
  return (
    <Link
      href={`/trails/${trail.id}`}
      className="group flex flex-col gap-3 rounded-2xl bg-bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cerrado-600/10">
          <Route size={15} className="text-cerrado-600" />
        </div>
        <h3 className="min-w-0 truncate text-sm font-bold text-text-primary">{trail.title}</h3>
        {trail.is_mandatory && <MandatoryBadge />}
      </div>

      {trail.description && (
        <p className="text-xs leading-relaxed text-text-muted line-clamp-2">{trail.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
          <BookOpen size={12} className="shrink-0" />
          {trail.course_count} cursos
        </span>
        {trail.estimated_hours && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
            <Clock size={12} className="shrink-0" />
            {trail.estimated_hours}h
          </span>
        )}
      </div>

      <div className="mt-auto pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => {
            e.preventDefault()
            onEnroll(trail.id)
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-cerrado-600/30 px-4 py-2 text-xs font-semibold text-cerrado-600 transition-all hover:bg-cerrado-600/10 disabled:opacity-50"
        >
          <Sparkles size={12} className="shrink-0" />
          Inscrever-se
        </button>
      </div>
    </Link>
  )
}

/**
 * Camadas de trilha da página unificada "Cursos e Trilhas" do aluno
 * (decisão Hugo 2026-07-15): Minhas Trilhas (progresso) antes, Trilhas
 * Disponíveis (Inscrever-se) depois; sub-seção vazia não renderiza.
 */
export function TrailsSectionClient({ trails }: { trails: TrailSummary[] }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleSelfEnroll(trailId: string) {
    startTransition(async () => {
      const result = await selfEnrollInTrail(trailId)
      if ("error" in result && result.error) {
        toast({ variant: "error", title: "Erro", description: result.error })
        return
      }
      router.refresh()
    })
  }

  const enrolledTrails = trails.filter((t) => t.is_enrolled)
  const availableTrails = trails.filter((t) => !t.is_enrolled)

  if (trails.length === 0) return null

  return (
    <div className="space-y-6">
      {enrolledTrails.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <SubHeading title="Minhas Trilhas" />
            <Link
              href="/trails"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cerrado-600 px-3 py-1 text-[11px] font-semibold text-white transition-all hover:bg-cerrado-500"
            >
              Ver mais trilhas
              <ArrowRight size={12} className="shrink-0" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolledTrails.map((trail) => (
              <EnrolledTrailCard key={trail.id} trail={trail} />
            ))}
          </div>
        </section>
      )}

      {availableTrails.length > 0 && (
        <section className="space-y-3">
          <SubHeading title="Trilhas Disponíveis" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableTrails.map((trail) => (
              <AvailableTrailCard
                key={trail.id}
                trail={trail}
                isPending={isPending}
                onEnroll={handleSelfEnroll}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
