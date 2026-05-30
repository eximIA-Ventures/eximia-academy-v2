"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function getStudentEnrollments(studentId: string, tenantId: string) {
  const service = createServiceClient()

  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, course_id, status, created_at, courses(title)")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  return enrollments ?? []
}

export async function getAvailableCourses(studentId: string, tenantId: string) {
  const service = createServiceClient()

  // Get all published courses for tenant
  const { data: courses } = await service
    .from("courses")
    .select("id, title")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("title", { ascending: true })

  // Get enrolled course IDs
  const { data: enrolled } = await service
    .from("enrollments")
    .select("course_id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)

  const enrolledIds = new Set((enrolled ?? []).map((e) => e.course_id))
  return (courses ?? []).filter((c) => !enrolledIds.has(c.id))
}

export async function enrollStudent(studentId: string, courseId: string, tenantId: string) {
  const supabase = await createClient()
  // Verify admin role
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nao autenticado" }

  const service = createServiceClient()
  const { data: profile } = await service
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    return { error: "Sem permissao" }
  }

  // Force tenant to caller's tenant; super_admin may target the passed tenant.
  if (profile.role !== "super_admin") {
    if (!profile.tenant_id || tenantId !== profile.tenant_id) {
      return { error: "Sem permissao" }
    }
  }

  // Validate course and student both belong to the target tenant.
  const [{ data: course }, { data: student }] = await Promise.all([
    service.from("courses").select("id, tenant_id").eq("id", courseId).single(),
    service.from("users").select("id, tenant_id").eq("id", studentId).single(),
  ])

  if (!course || course.tenant_id !== tenantId) return { error: "Curso invalido" }
  if (!student || student.tenant_id !== tenantId) return { error: "Aluno invalido" }

  const { error } = await service.from("enrollments").insert({
    student_id: studentId,
    course_id: courseId,
    tenant_id: tenantId,
    status: "active",
    progress: {},
  })

  if (error) {
    if (error.code === "23505") return { error: "Aluno ja matriculado neste curso" }
    return { error: error.message }
  }
  return { success: true }
}

export async function removeEnrollment(enrollmentId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nao autenticado" }

  const service = createServiceClient()

  const { data: profile } = await service
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin", "instructor"].includes(profile.role)) {
    return { error: "Sem permissao" }
  }

  // Load the enrollment and ensure it belongs to the caller's tenant before deleting.
  const { data: enrollment } = await service
    .from("enrollments")
    .select("id, tenant_id")
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) return { error: "Matricula nao encontrada" }
  if (profile.role !== "super_admin" && enrollment.tenant_id !== profile.tenant_id) {
    return { error: "Sem permissao" }
  }

  const { error } = await service.from("enrollments").delete().eq("id", enrollmentId)

  if (error) return { error: error.message }
  return { success: true }
}
