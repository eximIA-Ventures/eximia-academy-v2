"use client"

import { cn } from "@eximia/ui"
import { ArrowRight, BookOpen, CheckCircle, Layers, Users } from "lucide-react"
import Link from "next/link"

const gradientPalette = [
  "from-cerrado-600/80 to-cerrado-800",
  "from-varzea/60 to-cerrado-800",
  "from-accent-gold/40 to-cerrado-800/80",
  "from-cerrado-600/60 to-varzea-dark",
  "from-varzea-dark to-cerrado-600/70",
] as const

function courseGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return gradientPalette[Math.abs(hash) % gradientPalette.length]
}

interface CourseCardProps {
  id: string
  title: string
  description?: string | null
  chapterCount: number
  coverImageUrl?: string | null
  enrollmentStatus?: "active" | "completed" | null
  progressPercentage?: number
  enrolledCount?: number
  onEnroll?: (courseId: string) => void
}

export function CourseCard({
  id,
  title,
  description,
  chapterCount,
  coverImageUrl,
  enrollmentStatus,
  progressPercentage = 0,
  enrolledCount = 0,
  onEnroll,
}: CourseCardProps) {
  const isEnrolled = enrollmentStatus === "active" || enrollmentStatus === "completed"

  const cardContent = (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated"
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "relative aspect-[2/1] overflow-hidden",
          !coverImageUrl && `bg-gradient-to-br ${courseGradient(id)}`,
        )}
      >
        {coverImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen size={32} className="text-white/10" />
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-2xs font-medium text-white/90 backdrop-blur-md">
              <Layers size={10} />
              {chapterCount} cap.
            </span>
            {enrolledCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-2xs font-medium text-white/90 backdrop-blur-md">
                <Users size={10} />
                {enrolledCount}
              </span>
            )}
          </div>
          {enrollmentStatus === "completed" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-semantic-success/20 px-2 py-0.5 text-2xs font-medium text-semantic-success backdrop-blur-md">
              <CheckCircle size={10} />
              Concluído
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-[13px] font-semibold leading-snug text-text-primary line-clamp-2 group-hover:text-cerrado-400 transition-colors">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-text-muted line-clamp-2">
            {description}
          </p>
        )}

        {/* Progress bar */}
        {enrollmentStatus === "active" && progressPercentage > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-2xs font-medium tabular-nums text-text-muted">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        )}

        <div className="mt-auto pt-2.5">
          {(enrollmentStatus === null || enrollmentStatus === undefined) && onEnroll ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                onEnroll(id)
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-cerrado-600/15 py-2.5 text-xs font-medium text-cerrado-400 transition-colors hover:bg-cerrado-600/25"
            >
              Inscrever-se
            </button>
          ) : enrollmentStatus === "active" ? (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-bg-elevated py-2 text-xs font-medium text-text-secondary transition-colors group-hover:bg-cerrado-600/15 group-hover:text-cerrado-400">
              Continuar
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : !onEnroll && !isEnrolled ? (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-bg-elevated py-2 text-xs font-medium text-text-secondary transition-colors group-hover:bg-cerrado-600/15 group-hover:text-cerrado-400">
              Acessar
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (isEnrolled || !onEnroll) {
    return (
      <Link href={`/courses/${id}`} className="block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
