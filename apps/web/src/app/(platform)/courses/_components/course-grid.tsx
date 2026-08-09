"use client"

import { EmptyState } from "@eximia/ui"
import { ArrowRight, BookOpen, Check, Layers, RotateCcw, Search, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { CourseCard } from "./course-card"

interface Course {
  id: string
  title: string
  description: string | null
  cover_image_url: string | null
  chapter_count: number
  enrolled_count: number
}

interface CourseGridProps {
  courses: Course[]
  enrollments: Record<string, "active" | "completed">
  enrollmentProgress?: Record<string, number>
  onEnroll?: (courseId: string) => void
}

// Mesma gramática do CourseCard redesenhado (Hugo 2026-07-15): chips tonais no
// corpo, fallback de capa NEUTRO, CTAs coerentes (sólido cerrado / outlines).
const FEATURED_CTA_BASE =
  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
const FEATURED_CTA_SOLID = `${FEATURED_CTA_BASE} bg-cerrado-600 text-white hover:bg-cerrado-500`
const FEATURED_CTA_OUTLINE_NEUTRAL = `${FEATURED_CTA_BASE} border border-black/10 text-text-secondary hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10`
const FEATURED_CTA_OUTLINE_CERRADO = `${FEATURED_CTA_BASE} border border-cerrado-600/30 text-cerrado-600 hover:bg-cerrado-600/10`

const FEATURED_CHIP_NEUTRAL =
  "inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10"
const FEATURED_CHIP_SUCCESS =
  "inline-flex items-center gap-1.5 rounded-full bg-semantic-success/10 px-2.5 py-1 text-[11px] font-semibold text-semantic-success"

/** Featured card layout for when there's only 1 course */
function FeaturedCourseCard({
  course,
  enrollmentStatus,
  progressPercentage = 0,
  onEnroll,
}: {
  course: Course
  enrollmentStatus: "active" | "completed" | null
  progressPercentage?: number
  onEnroll?: (courseId: string) => void
}) {
  return (
    <div className="group overflow-hidden rounded-2xl bg-bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated md:flex">
      {/* Capa — imagem real ou fallback neutro discreto */}
      <div className="relative aspect-[16/6] overflow-hidden bg-bg-elevated md:aspect-auto md:w-2/5">
        {course.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-[140px] items-center justify-center">
            <BookOpen size={36} className="text-text-muted/30" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
        {/* Meta como chips tonais */}
        <div className="flex flex-wrap items-center gap-1.5">
          {course.chapter_count > 0 && (
            <span className={FEATURED_CHIP_NEUTRAL}>
              <Layers size={12} className="shrink-0" />
              {course.chapter_count} capítulo{course.chapter_count !== 1 ? "s" : ""}
            </span>
          )}
          {course.enrolled_count > 0 && (
            <span className={FEATURED_CHIP_NEUTRAL}>
              <Users size={12} className="shrink-0" />
              {course.enrolled_count} aluno{course.enrolled_count !== 1 ? "s" : ""}
            </span>
          )}
          {enrollmentStatus === "completed" && (
            <span className={FEATURED_CHIP_SUCCESS}>
              <Check size={12} className="shrink-0" />
              Concluído
            </span>
          )}
        </div>

        <h3 className="mt-3 text-xl font-bold tracking-tight text-text-primary md:text-2xl">
          {course.title}
        </h3>

        {course.description && (
          <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-3">
            {course.description}
          </p>
        )}

        {/* Progress bar */}
        {enrollmentStatus === "active" && progressPercentage > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
              <div
                className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-text-muted">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        )}

        <div className="mt-5">
          {(enrollmentStatus === null || enrollmentStatus === undefined) && onEnroll ? (
            <button
              type="button"
              onClick={() => onEnroll(course.id)}
              className={FEATURED_CTA_OUTLINE_CERRADO}
            >
              Inscrever-se
            </button>
          ) : enrollmentStatus === "active" ? (
            <Link href={`/courses/${course.id}`} className={FEATURED_CTA_SOLID}>
              Continuar
              <ArrowRight size={16} />
            </Link>
          ) : enrollmentStatus === "completed" ? (
            <Link href={`/courses/${course.id}`} className={FEATURED_CTA_OUTLINE_NEUTRAL}>
              <RotateCcw size={16} />
              Revisar curso
            </Link>
          ) : !onEnroll ? (
            <Link href={`/courses/${course.id}`} className={FEATURED_CTA_OUTLINE_NEUTRAL}>
              Acessar
              <ArrowRight size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CourseGrid({
  courses,
  enrollments,
  enrollmentProgress = {},
  onEnroll,
}: CourseGridProps) {
  const [search, setSearch] = useState("")

  const filtered = search
    ? courses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : courses

  return (
    <div className="space-y-5">
      {courses.length > 4 && (
        <div className="relative max-w-[260px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-lg bg-bg-card shadow-card pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cerrado-600/30"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum curso encontrado"
          description={
            search
              ? "Tente outro termo de busca."
              : "Nenhum curso disponível no momento. Volte em breve!"
          }
        />
      ) : filtered.length === 1 ? (
        <FeaturedCourseCard
          course={filtered[0]}
          enrollmentStatus={enrollments[filtered[0].id] ?? null}
          progressPercentage={enrollmentProgress[filtered[0].id] ?? 0}
          onEnroll={onEnroll}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              id={course.id}
              title={course.title}
              description={course.description}
              chapterCount={course.chapter_count}
              coverImageUrl={course.cover_image_url}
              enrollmentStatus={enrollments[course.id] ?? null}
              progressPercentage={enrollmentProgress[course.id] ?? 0}
              enrolledCount={course.enrolled_count}
              onEnroll={onEnroll}
            />
          ))}
        </div>
      )}
    </div>
  )
}
