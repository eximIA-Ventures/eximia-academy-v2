"use client"

import { Button, cn } from "@eximia/ui"
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle,
  Clock,
  Lock,
  Play,
  Route,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { updateTrailStatus } from "../actions"

interface TrailCourse {
  id: string
  course_id: string
  order: number
  is_required: boolean
  estimated_hours: number | null
  course_title: string
  course_description: string | null
  course_status: string
  course_cover_url: string | null
  enrollment_status: string | null
}

interface TrailDetail {
  id: string
  title: string
  description: string | null
  status: string
  estimated_hours: number | null
  is_mandatory: boolean
  is_sequential: boolean
  target_job_role_id: string | null
  target_role_name: string | null
  courses: TrailCourse[]
  created_at: string
}

function getCourseState(
  course: TrailCourse,
  index: number,
  courses: TrailCourse[],
  isSequential: boolean,
): "completed" | "active" | "locked" | "available" {
  if (course.enrollment_status === "completed") return "completed"
  if (!isSequential) return course.enrollment_status === "active" ? "active" : "available"

  // Sequential: check if previous is completed
  if (index === 0) return course.enrollment_status === "active" ? "active" : "available"
  const prev = courses[index - 1]
  if (prev.enrollment_status === "completed") return course.enrollment_status === "active" ? "active" : "available"
  return "locked"
}

export function TrailDetailClient({ trail, userRole }: { trail: TrailDetail; userRole: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const canManage = ["instructor", "admin", "super_admin"].includes(userRole)
  const [error, setError] = useState<string | null>(null)

  const totalHours = trail.courses.reduce((s, c) => s + (c.estimated_hours ?? 0), 0)
  const completedCount = trail.courses.filter((c) => c.enrollment_status === "completed").length
  const progress = trail.courses.length > 0 ? Math.round((completedCount / trail.courses.length) * 100) : 0
  const allCompleted = completedCount === trail.courses.length && trail.courses.length > 0

  function handleStatusChange(newStatus: "active" | "archived") {
    startTransition(async () => {
      const result = await updateTrailStatus(trail.id, newStatus)
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        Voltar
      </Link>

      {error && (
        <div className="rounded-xl bg-semantic-error/10 border border-semantic-error/20 px-4 py-3 text-sm text-semantic-error">{error}</div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-varzea/15 via-bg-card to-cerrado-800/10 ring-1 ring-varzea/20 p-6 sm:p-8">
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-varzea/15">
                  <Route size={18} className="text-varzea" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-varzea">Trilha</span>
              </div>
              <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">{trail.title}</h1>
              {trail.description && <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">{trail.description}</p>}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {trail.is_sequential && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[10px] font-semibold text-cerrado-600 ring-1 ring-cerrado-600/20">
                    <Lock size={10} />
                    Sequencial
                  </span>
                )}
                {trail.is_mandatory && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-500 ring-1 ring-amber-500/20">Obrigatória</span>
                )}
                {trail.target_role_name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold text-purple-400 ring-1 ring-purple-500/20">
                    <Briefcase size={10} />
                    {trail.target_role_name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] font-semibold text-text-muted shadow-card">
                  <BookOpen size={10} /> {trail.courses.length} cursos
                </span>
                {totalHours > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg-elevated px-2.5 py-1 text-[10px] font-semibold text-text-muted shadow-card">
                    <Clock size={10} /> {totalHours}h
                  </span>
                )}
              </div>
            </div>

            {canManage && (
              <div className="flex gap-2 shrink-0">
                {trail.status === "draft" && (
                  <Button size="sm" onClick={() => handleStatusChange("active")} disabled={isPending || trail.courses.length === 0}>
                    <Play size={14} className="mr-1.5" /> Ativar
                  </Button>
                )}
                {trail.status === "active" && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange("archived")} disabled={isPending}>
                    <Archive size={14} className="mr-1.5" /> Arquivar
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {completedCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                <div className="h-full rounded-full bg-varzea transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-semibold tabular-nums text-varzea">{progress}%</span>
            </div>
          )}
        </div>
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-varzea/5 blur-3xl" />
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-0 bottom-20 w-0.5 bg-gradient-to-b from-varzea via-cerrado-600/40 to-transparent" />

        <div className="space-y-4">
          {trail.courses.map((course, index) => {
            const state = getCourseState(course, index, trail.courses, trail.is_sequential)
            const isLocked = state === "locked"
            const isCompleted = state === "completed"
            const isActive = state === "active"

            const Wrapper = isLocked ? "div" : Link
            const wrapperProps = isLocked ? {} : { href: `/courses/${course.course_id}` }

            return (
              <div key={course.id} className="relative">
                {/* Timeline dot */}
                <div className={cn(
                  "absolute -left-8 top-5 flex h-[30px] w-[30px] items-center justify-center rounded-full ring-4 ring-bg-primary transition-all",
                  isCompleted && "bg-varzea text-white",
                  isActive && "bg-cerrado-600 text-white shadow-[0_0_12px_rgba(42,106,176,0.4)]",
                  !isCompleted && !isActive && !isLocked && "bg-bg-card text-text-muted shadow-card",
                  isLocked && "bg-bg-card/50 text-text-muted/40",
                )}>
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : isLocked ? (
                    <Lock size={12} />
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>

                {/* @ts-expect-error conditional Link/div */}
                <Wrapper
                  {...wrapperProps}
                  className={cn(
                    "group flex items-stretch rounded-xl overflow-hidden transition-all",
                    isLocked
                      ? "opacity-50 cursor-not-allowed shadow-card bg-bg-card/30"
                      : "shadow-card bg-bg-card hover:-translate-y-0.5 hover:shadow-elevated",
                    isCompleted && "ring-varzea/20 hover:ring-varzea/40",
                    isActive && "ring-cerrado-600/30 hover:ring-cerrado-600/50",
                  )}
                >
                  {/* Cover */}
                  <div className={cn(
                    "relative w-24 sm:w-32 shrink-0 overflow-hidden",
                    isLocked ? "grayscale" : "",
                  )}>
                    {course.course_cover_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={course.course_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg-card/60" />
                      </>
                    ) : (
                      <div className="flex h-full min-h-[80px] items-center justify-center bg-gradient-to-br from-varzea/20 to-cerrado-600/20">
                        <BookOpen size={20} className="text-white/10" />
                      </div>
                    )}

                    {/* Completed overlay */}
                    {isCompleted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-varzea/20 backdrop-blur-[1px]">
                        <CheckCircle size={24} className="text-varzea drop-shadow-lg" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col justify-center py-3.5 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-varzea/10 px-1.5 py-0.5 text-[9px] font-semibold text-varzea">
                          <Check size={8} /> Concluído
                        </span>
                      )}
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-cerrado-600/10 px-1.5 py-0.5 text-[9px] font-semibold text-cerrado-600">
                          <Sparkles size={8} /> Em andamento
                        </span>
                      )}
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-1.5 py-0.5 text-[9px] font-medium text-text-muted/60">
                          <Lock size={8} /> Bloqueado
                        </span>
                      )}
                      {course.is_required && !isCompleted && !isActive && !isLocked && (
                        <span className="inline-flex rounded-md bg-varzea/10 px-1.5 py-0.5 text-[9px] font-semibold text-varzea ring-1 ring-varzea/20">Obrigatório</span>
                      )}
                      {course.estimated_hours && (
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <Clock size={9} /> {course.estimated_hours}h
                        </span>
                      )}
                    </div>

                    <h3 className={cn(
                      "text-sm font-semibold transition-colors",
                      isLocked ? "text-text-muted/60" : "text-text-primary group-hover:text-varzea",
                      isCompleted && "text-text-secondary",
                    )}>
                      {course.course_title}
                    </h3>

                    {course.course_description && !isLocked && (
                      <p className="mt-0.5 text-xs text-text-muted line-clamp-1">{course.course_description}</p>
                    )}

                    {isLocked && (
                      <p className="mt-0.5 text-[10px] text-text-muted/40 italic">Complete o curso anterior para desbloquear</p>
                    )}
                  </div>

                  {/* Arrow */}
                  {!isLocked && (
                    <div className="flex items-center pr-4 text-text-muted/20 group-hover:text-varzea transition-colors">
                      <ArrowRight size={16} />
                    </div>
                  )}
                </Wrapper>
              </div>
            )
          })}

          {/* Finish line */}
          <div className="relative">
            {/* Timeline dot — finish */}
            <div className={cn(
              "absolute -left-8 top-5 flex h-[30px] w-[30px] items-center justify-center rounded-full ring-4 ring-bg-primary transition-all",
              allCompleted
                ? "bg-gradient-to-br from-accent-gold to-amber-500 text-white shadow-[0_0_16px_rgba(245,158,11,0.4)]"
                : "bg-bg-card/30 text-text-muted/30",
            )}>
              <Award size={14} />
            </div>

            <div className={cn(
              "overflow-hidden rounded-2xl p-6 text-center transition-all",
              allCompleted
                ? "bg-gradient-to-br from-accent-gold/15 via-amber-500/10 to-bg-card ring-1 ring-accent-gold/30"
                : "bg-bg-card/20 shadow-card opacity-40",
            )}>
              {allCompleted ? (
                <div className="space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gold/15">
                    <Award size={32} className="text-accent-gold" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">Trilha Concluída!</h3>
                  <p className="text-sm text-text-secondary max-w-sm mx-auto">
                    Parabéns! Você completou todos os cursos da trilha <strong>{trail.title}</strong>.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gold/10 px-3 py-1.5 text-xs font-semibold text-accent-gold ring-1 ring-accent-gold/20">
                      <Award size={12} />
                      {trail.courses.length} cursos concluídos
                    </span>
                    {totalHours > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-text-muted shadow-card">
                        <Clock size={12} />
                        {totalHours}h investidas
                      </span>
                    )}
                  </div>
                  {trail.target_role_name && (
                    <p className="text-xs text-accent-gold/80 pt-1">
                      Cargo qualificado: <strong>{trail.target_role_name}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-bg-surface">
                    <Award size={24} className="text-text-muted/30" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-muted/50">Conclusão da Trilha</h3>
                  <p className="text-xs text-text-muted/30">
                    Complete todos os {trail.courses.length} cursos para desbloquear
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
