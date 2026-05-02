"use client"

import { useState, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { Input, Badge, Skeleton, useToast, cn } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { Search, BookOpen, Loader2, CheckCircle2 } from "lucide-react"

interface CourseItem {
  id: string
  title: string
  description: string | null
  status: string
  chapters_count: number
  questions_count: number
  created_at: string
}

interface AuditPreview {
  quality_score: number
  topics: string[]
  total_duration_hours: number
  experience_level: string
  assessment_preference: string
}

export function CourseSelector() {
  const { setValue, watch } = useFormContext<CourseDesignerInput>()
  const { toast } = useToast()

  const selectedCourseId = watch("source_course_id")

  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [auditing, setAuditing] = useState(false)
  const [auditPreview, setAuditPreview] = useState<AuditPreview | null>(null)

  // Fetch courses on mount
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/courses?forDesigner=true")
        if (res.ok) {
          const data = await res.json()
          setCourses(data.courses || [])
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchCourses()
  }, [])

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelectCourse = async (course: CourseItem) => {
    setValue("source_course_id", course.id)
    setAuditing(true)
    setAuditPreview(null)

    try {
      const res = await fetch("/api/course-designer/audit-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      })

      if (!res.ok) throw new Error("Falha na auditoria")

      const audit = await res.json()

      // Pre-fill wizard fields from enriched_input
      if (audit.enriched_input) {
        const ei = audit.enriched_input
        if (ei.course_title) setValue("course_title", ei.course_title)
        if (ei.business_goal) setValue("business_goal", ei.business_goal)
        if (ei.behavior_change) setValue("behavior_change", ei.behavior_change)
        if (ei.topics_outline?.length) setValue("topics_outline", ei.topics_outline)
        if (ei.total_duration_hours) setValue("total_duration_hours", ei.total_duration_hours)
        if (ei.experience_level) {
          setValue(
            "target_audience.experience_level",
            ei.experience_level as "iniciante" | "intermediario" | "avancado" | "especialista",
          )
        }
        if (ei.assessment_preference) {
          setValue(
            "assessment_preference",
            ei.assessment_preference as "formativa" | "somativa" | "mista",
          )
        }
      }

      setAuditPreview({
        quality_score: audit.quality_audit?.overall_score ?? 0,
        topics: audit.content_analysis?.topics ?? [],
        total_duration_hours: audit.enriched_input?.total_duration_hours ?? 0,
        experience_level: audit.enriched_input?.experience_level ?? "",
        assessment_preference: audit.enriched_input?.assessment_preference ?? "",
      })

      toast({ variant: "success", title: "Curso analisado — campos pré-preenchidos" })
    } catch {
      toast({
        variant: "error",
        title: "Erro na auditoria. Você pode continuar sem pré-preenchimento.",
      })
    } finally {
      setAuditing(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar curso por título..."
          className="pl-9"
        />
      </div>

      {/* Course List */}
      <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-md border border-border-subtle p-2">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-text-muted">
            Nenhum curso encontrado
          </p>
        )}
        {!loading &&
          filtered.map((course) => {
            const isSelected = selectedCourseId === course.id
            return (
              <button
                key={course.id}
                type="button"
                onClick={() => handleSelectCourse(course)}
                disabled={auditing}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
                  isSelected
                    ? "border-accent-blue-mid bg-accent-blue-mid/5"
                    : "border-border-subtle bg-bg-surface hover:border-border-medium",
                )}
              >
                <BookOpen className="h-4 w-4 shrink-0 text-text-muted" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {course.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                    <span>{course.chapters_count} capítulos</span>
                    <span>{course.questions_count} perguntas</span>
                    <Badge variant="default" className="text-[10px]">
                      {course.status}
                    </Badge>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-accent-blue-mid" />}
              </button>
            )
          })}
      </div>

      {/* Auditing State */}
      {auditing && (
        <div className="flex items-center gap-2 rounded-md bg-accent-blue-mid/10 px-3 py-2 text-sm text-accent-blue-mid">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisando curso... Isso pode levar até 60 segundos
        </div>
      )}

      {/* Audit Preview */}
      {auditPreview && !auditing && (
        <div className="rounded-md border border-border-subtle bg-bg-elevated p-3 text-sm">
          <p className="mb-2 font-medium text-text-primary">
            Resultado da Auditoria
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-text-muted">Score de Qualidade:</span>{" "}
              <span className="font-medium text-text-primary">
                {auditPreview.quality_score}/100
              </span>
            </div>
            <div>
              <span className="text-text-muted">Duração estimada:</span>{" "}
              <span className="font-medium text-text-primary">
                {auditPreview.total_duration_hours}h
              </span>
            </div>
          </div>
          {auditPreview.topics.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-text-muted">Tópicos extraídos:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {auditPreview.topics.slice(0, 8).map((t, i) => (
                  <Badge key={i} variant="default" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
