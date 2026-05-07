"use client"

import { Button, buttonVariants, cn, EmptyState } from "@eximia/ui"
import { ArrowRight, BookOpen, CheckCircle, Layers, Search, Users } from "lucide-react"
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
      {/* Image */}
      <div
        className={cn(
          "relative aspect-[16/9] overflow-hidden md:aspect-auto md:w-1/2",
          !course.cover_image_url && `bg-gradient-to-br ${courseGradient(course.id)}`,
        )}
      >
        {course.cover_image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.cover_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20 md:bg-gradient-to-l md:from-bg-card/80 md:to-transparent" />
          </>
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <BookOpen size={48} className="text-white/10" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
        <div className="flex items-center gap-2 text-text-muted">
          <Layers size={14} />
          <span className="text-xs font-medium">
            {course.chapter_count} capítulo{course.chapter_count !== 1 ? "s" : ""}
          </span>
          {course.enrolled_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Users size={12} />
              {course.enrolled_count} aluno{course.enrolled_count !== 1 ? "s" : ""}
            </span>
          )}
          {enrollmentStatus === "completed" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-semantic-success">
              <CheckCircle size={12} />
              Concluído
            </span>
          )}
        </div>

        <h3 className="mt-2 text-xl font-bold text-text-primary md:text-2xl">{course.title}</h3>

        {course.description && (
          <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-3">
            {course.description}
          </p>
        )}

        {/* Progress bar */}
        {enrollmentStatus === "active" && progressPercentage > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-text-muted">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        )}

        <div className="mt-4">
          {(enrollmentStatus === null || enrollmentStatus === undefined) && onEnroll ? (
            <Button onClick={() => onEnroll(course.id)}>Inscrever-se</Button>
          ) : enrollmentStatus === "active" ? (
            <Link
              href={`/courses/${course.id}`}
              className={cn(buttonVariants(), "inline-flex items-center gap-2")}
            >
              Continuar
              <ArrowRight size={16} />
            </Link>
          ) : enrollmentStatus === "completed" ? (
            <Button variant="ghost" disabled>
              Concluído
            </Button>
          ) : !onEnroll ? (
            <Link
              href={`/courses/${course.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")}
            >
              Acessar
              <ArrowRight size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CourseGrid({ courses, enrollments, enrollmentProgress = {}, onEnroll }: CourseGridProps) {
  const [search, setSearch] = useState("")

  const filtered = search
    ? courses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : courses

  return (
    <div className="space-y-5">
      {courses.length > 4 && (
        <div className="relative max-w-[260px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
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
