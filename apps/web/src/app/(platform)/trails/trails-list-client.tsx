"use client"

import { Button, useToast } from "@eximia/ui"
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  Clock,
  Lock,
  Play,
  Plus,
  Route,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { selfEnrollInTrail } from "./actions"

interface Trail {
  id: string
  title: string
  description: string | null
  status: string
  estimated_hours: number | null
  is_mandatory: boolean
  target_job_role_id: string | null
  target_role_name?: string | null
  course_count: number
  is_enrolled: boolean
  progress: { total: number; completed: number } | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-black/5 text-text-muted dark:bg-white/10" },
  active: { label: "Ativa", className: "bg-semantic-success/10 text-semantic-success" },
  archived: { label: "Arquivada", className: "bg-black/5 text-text-muted/60 dark:bg-white/10" },
}

/** Máximo de dots na mini-sequência; acima disso, resume com "+N". */
const MAX_JOURNEY_STEPS = 8

function SubHeading({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">{title}</h3>
  )
}

function MandatoryBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
      Obrigatória
    </span>
  )
}

/**
 * Dot da jornada, sintetizado de progress.completed/total (listTrails não expõe
 * detalhe por curso): N checks verdes, 1 anel cerrado com o número do curso
 * atual, resto neutro — mesmo vocabulário do TrailProgressCard do dashboard.
 */
function JourneyStepDot({
  kind,
  index,
}: {
  kind: "completed" | "active" | "upcoming"
  index: number
}) {
  if (kind === "completed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-semantic-success text-white shadow-sm">
        <Check size={14} strokeWidth={3} />
      </div>
    )
  }
  if (kind === "active") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-card ring-2 ring-cerrado-600 shadow-[0_0_10px_rgba(253,121,51,0.25)]">
        <span className="text-[11px] font-bold tabular-nums text-cerrado-600">{index + 1}</span>
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-hover">
      <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
    </div>
  )
}

/** Card de JORNADA — horizontal, largura cheia, 1 trilha por linha. */
function JourneyTrailCard({ trail }: { trail: Trail }) {
  const completed = trail.progress?.completed ?? 0
  const total = trail.course_count > 0 ? trail.course_count : (trail.progress?.total ?? 0)
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
  const hasActive = completed < total

  const visibleSteps = Math.min(total, MAX_JOURNEY_STEPS)
  const overflow = total - visibleSteps
  const stepKinds: Array<"completed" | "active" | "upcoming"> = Array.from(
    { length: visibleSteps },
    (_, i) => {
      if (i < completed) return "completed"
      if (i === completed && hasActive) return "active"
      return "upcoming"
    },
  )

  return (
    <Link
      href={`/trails/${trail.id}`}
      className="group flex w-full flex-col gap-4 rounded-2xl bg-bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="min-w-0 flex-1 space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="truncate text-base font-bold text-text-primary">{trail.title}</h4>
            {trail.is_mandatory && <MandatoryBadge />}
          </div>
          {trail.description && (
            <p className="mt-0.5 truncate text-xs text-text-muted">{trail.description}</p>
          )}
        </div>

        {/* Mini-sequência dos cursos da trilha */}
        {total > 0 && (
          <div className="flex items-center">
            {stepKinds.map((kind, i) => (
              <div key={`${trail.id}-step-${i + 1}`} className="flex items-center">
                <JourneyStepDot kind={kind} index={i} />
                {i < stepKinds.length - 1 && (
                  <div
                    className={`h-0.5 w-5 rounded-full ${
                      kind === "completed" ? "bg-semantic-success/50" : "bg-bg-hover"
                    }`}
                  />
                )}
              </div>
            ))}
            {overflow > 0 && (
              <span className="ml-2 text-[10px] font-semibold text-text-muted">+{overflow}</span>
            )}
          </div>
        )}

        <div>
          <div className="flex max-w-md items-center gap-2">
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
      </div>

      <div className="shrink-0">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-cerrado-600 px-4 py-2 text-xs font-semibold text-white transition-all group-hover:bg-cerrado-500 group-hover:scale-[1.02]">
          <Play size={12} />
          Continuar
        </span>
      </div>
    </Link>
  )
}

/** Card DISCRETO de trilha disponível — outline, menor que o de jornada. */
function AvailableTrailCard({
  trail,
  isPending,
  onEnroll,
}: {
  trail: Trail
  isPending: boolean
  onEnroll: (trailId: string) => void
}) {
  return (
    <Link
      href={`/trails/${trail.id}`}
      className="group flex flex-col gap-2.5 rounded-xl border border-border-subtle p-4 transition-all hover:border-cerrado-600/30 hover:bg-bg-card"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cerrado-600/10">
          <Route size={13} className="text-cerrado-600" />
        </div>
        <h4 className="min-w-0 truncate text-[13px] font-semibold text-text-primary">
          {trail.title}
        </h4>
        {trail.is_mandatory && <MandatoryBadge />}
      </div>

      {trail.description && (
        <p className="text-[11px] leading-relaxed text-text-muted line-clamp-1">
          {trail.description}
        </p>
      )}

      <p className="text-[10px] text-text-muted">
        {trail.course_count} cursos
        {trail.estimated_hours ? ` · ${trail.estimated_hours}h` : ""}
        {trail.target_role_name ? ` · ${trail.target_role_name}` : ""}
      </p>

      <div className="mt-auto pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => {
            e.preventDefault()
            onEnroll(trail.id)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cerrado-600/30 px-3 py-1.5 text-[11px] font-semibold text-cerrado-600 transition-all hover:bg-cerrado-600/10 disabled:opacity-50"
        >
          <Sparkles size={11} className="shrink-0" />
          Inscrever-se
        </button>
      </div>
    </Link>
  )
}

export function TrailsListClient({ trails, userRole }: { trails: Trail[]; userRole: string }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()
  const canCreate = ["instructor", "admin", "super_admin"].includes(userRole)
  const isStudent = userRole === "student"

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

  return (
    <>
      {canCreate && (
        <div className="flex justify-end">
          <Link href="/trails/new">
            <Button>
              <Plus size={16} className="mr-1.5" />
              Nova Trilha
            </Button>
          </Link>
        </div>
      )}

      {trails.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-bg-card shadow-card py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cerrado-600/10">
            <Route size={28} className="text-cerrado-600/50" />
          </div>
          <p className="mt-4 text-sm font-medium text-text-secondary">
            {isStudent ? "Nenhuma trilha disponível" : "Nenhuma trilha criada"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {isStudent
              ? "Trilhas aparecerão aqui quando atribuídas."
              : "Crie sua primeira trilha de aprendizagem."}
          </p>
          {canCreate && (
            <Link href="/trails/new" className="mt-4">
              <Button variant="outline" size="sm">
                Criar primeira trilha
              </Button>
            </Link>
          )}
        </div>
      ) : isStudent ? (
        /* Visão do ALUNO — identidade de JORNADA (feedback Hugo 2026-07-15):
           trilhas inscritas em cards horizontais full-width com mini-sequência;
           disponíveis em cards outline discretos. */
        <div className="space-y-8">
          {enrolledTrails.length > 0 && (
            <section className="space-y-3">
              <SubHeading title="Minhas trilhas" />
              <div className="space-y-3">
                {enrolledTrails.map((trail) => (
                  <JourneyTrailCard key={trail.id} trail={trail} />
                ))}
              </div>
            </section>
          )}

          {availableTrails.length > 0 && (
            <section className="space-y-3">
              <SubHeading title="Disponíveis" />
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
      ) : (
        /* Visão de GESTOR/INSTRUTOR — grid único com status, como está */
        <div className="grid gap-4 md:grid-cols-2">
          {trails.map((trail) => {
            const config = STATUS_CONFIG[trail.status] ?? STATUS_CONFIG.draft

            return (
              <Link key={trail.id} href={`/trails/${trail.id}`}>
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-varzea/5 via-bg-card to-bg-card shadow-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:ring-varzea/25 hover:shadow-elevated">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-varzea/15">
                        <Route size={18} className="text-varzea" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary group-hover:text-varzea transition-colors line-clamp-1">
                          {trail.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${config.className}`}
                          >
                            {config.label}
                          </span>
                          {trail.is_mandatory && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-500">
                              <Lock size={8} />
                              Obrigatória
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-text-muted/20 group-hover:text-varzea transition-colors mt-1"
                    />
                  </div>

                  {/* Description */}
                  {trail.description && (
                    <p className="text-xs text-text-muted line-clamp-2 mb-3">{trail.description}</p>
                  )}

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-text-secondary dark:bg-white/10">
                      <BookOpen size={10} />
                      {trail.course_count} cursos
                    </span>
                    {trail.estimated_hours && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-text-secondary dark:bg-white/10">
                        <Clock size={10} />
                        {trail.estimated_hours}h
                      </span>
                    )}
                    {trail.target_role_name && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-text-secondary dark:bg-white/10">
                        <Briefcase size={10} />
                        {trail.target_role_name}
                      </span>
                    )}
                  </div>

                  {/* Decorative */}
                  <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-varzea/5 blur-2xl" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
