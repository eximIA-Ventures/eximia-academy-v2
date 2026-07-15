"use client"

import { Button, cn } from "@eximia/ui"
import {
  Archive,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Check,
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

type CourseState = "completed" | "active" | "locked" | "available"

function getCourseState(
  course: TrailCourse,
  index: number,
  courses: TrailCourse[],
  isSequential: boolean,
): CourseState {
  if (course.enrollment_status === "completed") return "completed"
  if (!isSequential) return course.enrollment_status === "active" ? "active" : "available"

  // Sequential: check if previous is completed
  if (index === 0) return course.enrollment_status === "active" ? "active" : "available"
  const prev = courses[index - 1]
  if (prev.enrollment_status === "completed")
    return course.enrollment_status === "active" ? "active" : "available"
  return "locked"
}

/** Chip tonal de estado do curso — padrão "Meu ritmo" (fundo suave + texto na cor semântica). */
function StateChip({ state }: { state: CourseState }) {
  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/10 px-2.5 py-1 text-[11px] font-semibold text-semantic-success">
        <Check size={12} className="shrink-0" />
        Concluído
      </span>
    )
  }
  if (state === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[11px] font-semibold text-cerrado-600">
        <Sparkles size={12} className="shrink-0" />
        Em andamento
      </span>
    )
  }
  if (state === "locked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-muted dark:bg-white/10">
        <Lock size={12} className="shrink-0" />
        Bloqueado
      </span>
    )
  }
  return null
}

function TimelineDot({ state, index }: { state: CourseState; index: number }) {
  if (state === "completed") {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-semantic-success text-white ring-4 ring-bg-app">
        <Check size={14} strokeWidth={3} />
      </div>
    )
  }
  if (state === "active") {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-cerrado-600 text-white ring-4 ring-bg-app shadow-[0_0_12px_rgba(253,121,51,0.35)]">
        <span className="text-xs font-bold">{index + 1}</span>
      </div>
    )
  }
  if (state === "locked") {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-bg-card text-text-muted/40 ring-4 ring-bg-app shadow-card">
        <Lock size={12} />
      </div>
    )
  }
  return (
    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-bg-card text-text-muted ring-4 ring-bg-app shadow-card">
      <span className="text-xs font-bold">{index + 1}</span>
    </div>
  )
}

export function TrailDetailClient({ trail, userRole }: { trail: TrailDetail; userRole: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const canManage = ["instructor", "admin", "super_admin"].includes(userRole)
  const [error, setError] = useState<string | null>(null)

  const totalHours = trail.courses.reduce((s, c) => s + (c.estimated_hours ?? 0), 0)
  const completedCount = trail.courses.filter((c) => c.enrollment_status === "completed").length
  const progress =
    trail.courses.length > 0 ? Math.round((completedCount / trail.courses.length) * 100) : 0
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
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      {error && (
        <div className="rounded-xl bg-semantic-error/10 border border-semantic-error/20 px-4 py-3 text-sm text-semantic-error">
          {error}
        </div>
      )}

      {/* Hero — enxuto, no estilo da casa (Seção B do preview aprovado) */}
      <div className="rounded-2xl bg-bg-card p-6 shadow-card sm:p-7">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cerrado-600/10">
                <Route size={18} className="text-cerrado-600" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cerrado-600">
                {canManage ? "Trilha" : "Minha Trilha"}
              </span>
            </div>

            {canManage && (
              <div className="flex shrink-0 gap-2">
                {trail.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange("active")}
                    disabled={isPending || trail.courses.length === 0}
                  >
                    <Play size={14} className="mr-1.5" /> Ativar
                  </Button>
                )}
                {trail.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("archived")}
                    disabled={isPending}
                  >
                    <Archive size={14} className="mr-1.5" /> Arquivar
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">{trail.title}</h1>
            {trail.description && (
              <p className="mt-1 text-sm text-text-secondary">{trail.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {trail.is_sequential && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[11px] font-semibold text-cerrado-600">
                <Lock size={12} className="shrink-0" />
                Sequencial
              </span>
            )}
            {trail.is_mandatory && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-500">
                Obrigatória
              </span>
            )}
            {trail.target_role_name && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
                <Briefcase size={12} className="shrink-0" />
                {trail.target_role_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
              <BookOpen size={12} className="shrink-0" />
              {trail.courses.length} cursos
            </span>
            {totalHours > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
                <Clock size={12} className="shrink-0" />
                {totalHours}h estimadas
              </span>
            )}
          </div>

          {/* Barra de progresso geral da trilha */}
          {trail.courses.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-hover">
                <div
                  className="h-full rounded-full bg-cerrado-600 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums text-text-primary">
                {progress}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline vertical */}
      <div className="relative pl-10">
        <div className="absolute bottom-24 left-[19px] top-1 w-0.5 bg-gradient-to-b from-semantic-success via-cerrado-600/40 to-transparent" />

        <div className="space-y-4">
          {trail.courses.map((course, index) => {
            const state = getCourseState(course, index, trail.courses, trail.is_sequential)
            const isLocked = state === "locked"
            const isActive = state === "active"

            const Wrapper = isLocked ? "div" : Link
            const wrapperProps = isLocked ? {} : { href: `/courses/${course.course_id}` }

            return (
              <div key={course.id} className="relative">
                <div className="absolute -left-10 top-5">
                  <TimelineDot state={state} index={index} />
                </div>

                {/* @ts-expect-error conditional Link/div */}
                <Wrapper
                  {...wrapperProps}
                  className={cn(
                    "group block rounded-2xl bg-bg-card p-5 shadow-card transition-all",
                    isLocked
                      ? "opacity-55 cursor-not-allowed"
                      : "hover:-translate-y-0.5 hover:shadow-elevated",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StateChip state={state} />
                    {course.is_required && state === "available" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[11px] font-semibold text-cerrado-600">
                        Obrigatório
                      </span>
                    )}
                    {course.estimated_hours && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                        <Clock size={11} className="shrink-0" />
                        {course.estimated_hours}h
                      </span>
                    )}
                  </div>

                  <h3
                    className={cn(
                      "mt-2 text-base font-semibold",
                      isLocked ? "text-text-muted/60" : "text-text-primary",
                    )}
                  >
                    {course.course_title}
                  </h3>
                  <p
                    className={cn(
                      "mt-0.5 text-sm",
                      isLocked ? "text-text-muted/40" : "text-text-muted",
                    )}
                  >
                    {isLocked
                      ? "Complete o curso anterior para desbloquear"
                      : (course.course_description ?? "")}
                  </p>

                  {isActive && (
                    <div className="mt-4 flex items-center justify-end">
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cerrado-600 px-4 py-2 text-xs font-semibold text-white transition-all group-hover:bg-cerrado-500 group-hover:scale-[1.02]">
                        <Play size={12} />
                        Continuar
                      </span>
                    </div>
                  )}
                </Wrapper>
              </div>
            )
          })}

          {/* Linha de chegada */}
          <div className="relative">
            <div
              className={cn(
                "absolute -left-10 top-5 flex h-[30px] w-[30px] items-center justify-center rounded-full ring-4 ring-bg-app",
                allCompleted
                  ? "bg-accent-gold text-white shadow-[0_0_14px_rgba(196,168,130,0.5)]"
                  : "bg-bg-card text-text-muted/30 shadow-card",
              )}
            >
              <Award size={14} />
            </div>

            {allCompleted ? (
              <div className="rounded-2xl bg-accent-gold/10 p-6 text-center ring-1 ring-accent-gold/25">
                <div className="space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gold/15">
                    <Award size={32} className="text-accent-gold" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary">Trilha Concluída!</h3>
                  <p className="mx-auto max-w-sm text-sm text-text-secondary">
                    Parabéns! Você completou todos os cursos da trilha{" "}
                    <strong>{trail.title}</strong>.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gold/10 px-3 py-1.5 text-xs font-semibold text-accent-gold ring-1 ring-accent-gold/20">
                      <Award size={12} />
                      {trail.courses.length} cursos concluídos
                    </span>
                    {totalHours > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-text-secondary dark:bg-white/10">
                        <Clock size={12} />
                        {totalHours}h investidas
                      </span>
                    )}
                  </div>
                  {trail.target_role_name && (
                    <p className="pt-1 text-xs text-accent-gold/80">
                      Cargo qualificado: <strong>{trail.target_role_name}</strong>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-bg-card/40 p-6 text-center shadow-card">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent-gold/10">
                  <Award size={22} className="text-accent-gold/40" />
                </div>
                <h3 className="mt-2 text-sm font-semibold text-text-secondary">
                  Certificado da trilha
                </h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  Complete os {trail.courses.length} cursos para emitir o certificado de{" "}
                  <span className="font-medium">{trail.title}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
