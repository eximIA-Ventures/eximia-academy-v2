"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { BookOpen, CheckCircle2, Clock, Loader2 } from "lucide-react"

export interface TrailCourseProgress {
  course_id: string
  course_title: string
  order: number
  status: "completed" | "in_progress" | "active" | "pending"
}

export interface TrailProgressProps {
  trailTitle: string
  courses: TrailCourseProgress[]
}

const STATUS_COLORS: Record<
  TrailCourseProgress["status"],
  { bg: string; label: string; icon: typeof CheckCircle2 }
> = {
  completed: { bg: "bg-semantic-success", label: "Concluido", icon: CheckCircle2 },
  in_progress: { bg: "bg-accent-blue-mid", label: "Em andamento", icon: Loader2 },
  active: { bg: "bg-accent-blue-mid", label: "Em andamento", icon: Loader2 },
  pending: { bg: "bg-bg-elevated", label: "Pendente", icon: Clock },
}

export function TrailProgress({ trailTitle, courses }: TrailProgressProps) {
  if (courses.length === 0) return null

  const totalCourses = courses.length
  const completedCount = courses.filter((c) => c.status === "completed").length
  const inProgressCount = courses.filter(
    (c) => c.status === "in_progress" || c.status === "active",
  ).length
  const percentage = totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{trailTitle}</CardTitle>
          <span className="text-sm font-semibold text-text-primary">{percentage}%</span>
        </div>
        <p className="text-xs text-text-secondary">
          {completedCount} de {totalCourses} curso{totalCourses !== 1 ? "s" : ""} concluido
          {completedCount !== 1 ? "s" : ""}
          {inProgressCount > 0 && ` \u00B7 ${inProgressCount} em andamento`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Segmented progress bar */}
        <div className="flex gap-1" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso da trilha: ${percentage}%`}>
          {courses.map((course) => {
            const config = STATUS_COLORS[course.status] ?? STATUS_COLORS.pending
            return (
              <div
                key={course.course_id}
                className="group relative flex-1"
              >
                <div
                  className={`h-2.5 rounded-full ${config.bg} transition-colors`}
                  title={`${course.course_title} - ${config.label}`}
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-bg-card px-2.5 py-1.5 text-xs shadow-elevated group-hover:block">
                  <p className="font-medium text-text-primary">{course.course_title}</p>
                  <p className="text-text-secondary">{config.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-semantic-success" />
            Concluido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-blue-mid" />
            Em andamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-bg-elevated" />
            Pendente
          </span>
        </div>

        {/* Course list */}
        <div className="space-y-1.5">
          {courses.map((course) => {
            const config = STATUS_COLORS[course.status] ?? STATUS_COLORS.pending
            const Icon = config.icon
            return (
              <div
                key={course.course_id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-bg-hover"
              >
                <span className="text-xs font-medium text-text-muted w-5 text-right shrink-0">
                  {course.order}
                </span>
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    course.status === "completed"
                      ? "text-semantic-success"
                      : course.status === "in_progress" || course.status === "active"
                        ? "text-accent-blue-mid"
                        : "text-text-muted"
                  }`}
                />
                <span
                  className={`flex-1 truncate ${
                    course.status === "completed"
                      ? "text-text-secondary line-through"
                      : "text-text-primary"
                  }`}
                >
                  {course.course_title}
                </span>
                <span className="text-xs text-text-muted shrink-0">{config.label}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
