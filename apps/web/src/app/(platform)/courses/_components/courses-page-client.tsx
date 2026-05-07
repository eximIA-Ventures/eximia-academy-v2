"use client"

import { analytics } from "@/lib/analytics"
import { Button, useToast } from "@eximia/ui"
import { Grid3X3, List, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { enrollInCourse } from "../actions"
import { CourseFormDialog } from "./course-form-dialog"
import { CourseGrid } from "./course-grid"
import { CourseTable } from "./course-table"
import { ImportCourseDialog } from "./import-course-dialog"

interface Course {
  id: string
  title: string
  description: string | null
  cover_image_url: string | null
  enrolled_count: number
  type: string
  status: string
  created_at: string
  chapter_count: number
}

interface CoursesPageClientProps {
  role: string
  courses: Course[]
  enrollments: Record<string, "active" | "completed">
  enrollmentMode?: string
  isViewingAsStudent?: boolean
}

export function CoursesPageClient({ role, courses, enrollments, enrollmentMode = "open", isViewingAsStudent }: CoursesPageClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const isManager = role === "manager" || role === "admin" || role === "instructor"

  // When viewing as student, treat all courses as enrolled (instructor has access to all)
  const effectiveEnrollments = isViewingAsStudent
    ? Object.fromEntries(courses.map((c) => [c.id, "active" as const]))
    : enrollments
  const [viewMode, setViewMode] = useState<"grid" | "list">(isManager ? "list" : "grid")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleEnroll(courseId: string) {
    startTransition(async () => {
      const result = await enrollInCourse(courseId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      analytics.courseEnrolled(courseId)
      toast({ variant: "success", title: "Inscrição realizada com sucesso!" })
      router.refresh()
    })
  }

  return (
    <>
      {/* Toolbar */}
      {isManager && (
        <div className="flex items-center justify-end gap-2 sm:gap-3 mb-4">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar
          </Button>
          <div className="flex rounded-xl bg-bg-card p-1 shadow-card">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-cerrado-600/10 text-cerrado-600 ring-1 ring-cerrado-600/30"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              aria-label="Visualização em grade"
            >
              <Grid3X3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-cerrado-600/10 text-cerrado-600 ring-1 ring-cerrado-600/30"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              aria-label="Visualização em lista"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      )}

      {isManager && viewMode === "list" ? (
        <CourseTable courses={courses} onCreateCourse={() => setShowCreate(true)} />
      ) : (
        <CourseGrid
          courses={courses}
          enrollments={effectiveEnrollments}
          onEnroll={enrollmentMode === "open" && !isManager && !isViewingAsStudent ? handleEnroll : undefined}
        />
      )}

      <CourseFormDialog open={showCreate} onOpenChange={setShowCreate} />
      <ImportCourseDialog open={showImport} onOpenChange={setShowImport} />
    </>
  )
}
