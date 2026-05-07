"use client"

import {
  enrollStudent,
  getAvailableCourses,
  getStudentEnrollments,
  removeEnrollment,
} from "@/app/(platform)/admin/users/enrollment-actions"
import {
  Badge,
  Button,
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Skeleton,
} from "@eximia/ui"
import { BookOpen, GraduationCap, Loader2, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

/* --------------------------------- Types --------------------------------- */

interface Enrollment {
  id: string
  course_id: string
  status: string
  created_at: string
  courses: { title: string } | null
}

interface AvailableCourse {
  id: string
  title: string
}

interface EnrollmentDialogProps {
  studentId: string
  studentName: string
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* -------------------------------- Helpers -------------------------------- */

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Ativo"
    case "completed":
      return "Concluido"
    case "dropped":
      return "Abandonado"
    default:
      return status
  }
}

function statusVariant(status: string) {
  switch (status) {
    case "active":
      return "success" as const
    case "completed":
      return "info" as const
    case "dropped":
      return "error" as const
    default:
      return "default" as const
  }
}

/* ------------------------------- Component ------------------------------- */

export function EnrollmentDialog({
  studentId,
  studentName,
  tenantId,
  open,
  onOpenChange,
}: EnrollmentDialogProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [available, setAvailable] = useState<AvailableCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [enr, avail] = await Promise.all([
        getStudentEnrollments(studentId, tenantId),
        getAvailableCourses(studentId, tenantId),
      ])
      setEnrollments(enr as unknown as Enrollment[])
      setAvailable(avail as unknown as AvailableCourse[])
    } catch {
      setError("Erro ao carregar dados de matricula.")
    } finally {
      setLoading(false)
    }
  }, [studentId, tenantId])

  // Fetch when dialog opens
  useEffect(() => {
    if (open) {
      setSuccess(null)
      setError(null)
      fetchData()
    }
  }, [open, fetchData])

  const handleEnroll = useCallback(
    async (courseId: string, courseTitle: string) => {
      setEnrollingId(courseId)
      setError(null)
      setSuccess(null)
      try {
        const result = await enrollStudent(studentId, courseId, tenantId)
        if (result.error) {
          setError(result.error)
        } else {
          setSuccess(`Matriculado em "${courseTitle}"`)
          await fetchData()
        }
      } catch {
        setError("Erro ao matricular aluno.")
      } finally {
        setEnrollingId(null)
      }
    },
    [studentId, tenantId, fetchData],
  )

  const handleRemove = useCallback(
    async (enrollmentId: string) => {
      if (!window.confirm("Tem certeza que deseja remover esta matricula?")) return
      setRemovingId(enrollmentId)
      setError(null)
      setSuccess(null)
      try {
        const result = await removeEnrollment(enrollmentId)
        if (result.error) {
          setError(result.error)
        } else {
          setSuccess("Matricula removida")
          await fetchData()
        }
      } catch {
        setError("Erro ao remover matricula.")
      } finally {
        setRemovingId(null)
      }
    },
    [fetchData],
  )

  // Clear success message after a few seconds
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 3000)
    return () => clearTimeout(timer)
  }, [success])

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent size="lg">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <ModalTitle className="flex items-center gap-2">
              <GraduationCap size={20} className="text-cerrado-600" />
              Matriculas
            </ModalTitle>
            <ModalClose />
          </div>
          <ModalDescription>
            Gerencie as matriculas de <span className="font-medium text-text-primary">{studentName}</span>
          </ModalDescription>
        </ModalHeader>

        <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {/* Feedback messages */}
          {error && (
            <div className="rounded-lg bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-semantic-success/10 px-4 py-3 text-sm text-semantic-success">
              {success}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-5 w-40 mt-6" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* Enrolled courses */}
          {!loading && (
            <>
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">
                  <BookOpen size={14} />
                  Cursos Matriculados ({enrollments.length})
                </h3>

                {enrollments.length === 0 ? (
                  <p className="rounded-xl bg-bg-surface px-4 py-6 text-center text-sm text-text-muted">
                    Nenhuma matricula encontrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-bg-surface px-4 py-3 shadow-card"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="truncate text-sm font-medium text-text-primary">
                            {enrollment.courses?.title ?? "Curso removido"}
                          </span>
                          <Badge variant={statusVariant(enrollment.status)} badgeSize="sm">
                            {statusLabel(enrollment.status)}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(enrollment.id)}
                          disabled={removingId === enrollment.id}
                          className="shrink-0 text-text-muted hover:text-semantic-error"
                        >
                          {removingId === enrollment.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available courses */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted">
                  <Plus size={14} />
                  Cursos Disponiveis ({available.length})
                </h3>

                {available.length === 0 ? (
                  <p className="rounded-xl bg-bg-surface px-4 py-6 text-center text-sm text-text-muted">
                    Todos os cursos publicados ja estao matriculados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {available.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-bg-surface px-4 py-3 shadow-card"
                      >
                        <span className="truncate text-sm text-text-primary">{course.title}</span>
                        <Button
                          size="sm"
                          onClick={() => handleEnroll(course.id, course.title)}
                          disabled={enrollingId === course.id}
                          className="shrink-0"
                        >
                          {enrollingId === course.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Plus size={14} />
                          )}
                          <span className="ml-1">Matricular</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
