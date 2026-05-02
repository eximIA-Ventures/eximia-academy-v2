"use server"

import { createClient } from "@/lib/supabase/server"
import { createTrailSchema, reorderTrailCoursesSchema, updateTrailSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const uuidSchema = z.string().uuid()

async function requireTrailRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ role: string; tenantId: string; error?: never } | { error: string }> {
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", userId)
    .single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (!["instructor", "admin", "super_admin"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }
  return { role: profile.role, tenantId: profile.tenant_id }
}

export async function listTrails() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado", data: [] }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, job_role_id")
    .eq("id", user.id)
    .single()

  if (!profile) return { error: "Perfil não encontrado", data: [] }

  // Students see active trails + their enrolled trails
  if (profile.role === "student") {
    const { data: enrolledTrailIds } = await supabase
      .from("enrollments")
      .select("trail_id")
      .eq("student_id", user.id)
      .not("trail_id", "is", null)

    const myTrailIds = [...new Set((enrolledTrailIds ?? []).map((e) => e.trail_id).filter(Boolean))]

    const { data: trails } = await supabase
      .from("learning_trails")
      .select(
        "id, title, description, status, estimated_hours, is_mandatory, target_job_role_id, created_at",
      )
      .eq("status", "active")
      .order("title", { ascending: true })

    // Fetch trail_courses count for each trail
    const trailIds = (trails ?? []).map((t) => t.id)
    const { data: courseCounts } = trailIds.length
      ? await supabase.from("trail_courses").select("trail_id").in("trail_id", trailIds)
      : { data: [] }

    const countMap = new Map<string, number>()
    for (const tc of courseCounts ?? []) {
      countMap.set(tc.trail_id, (countMap.get(tc.trail_id) ?? 0) + 1)
    }

    // Fetch student progress per trail
    const { data: enrollments } = myTrailIds.length
      ? await supabase
          .from("enrollments")
          .select("trail_id, status")
          .eq("student_id", user.id)
          .in("trail_id", myTrailIds)
      : { data: [] }

    const progressMap = new Map<string, { total: number; completed: number }>()
    for (const e of enrollments ?? []) {
      if (!e.trail_id) continue
      const curr = progressMap.get(e.trail_id) ?? { total: 0, completed: 0 }
      curr.total++
      if (e.status === "completed") curr.completed++
      progressMap.set(e.trail_id, curr)
    }

    const enriched = (trails ?? []).map((t) => ({
      ...t,
      course_count: countMap.get(t.id) ?? 0,
      is_enrolled: myTrailIds.includes(t.id),
      progress: progressMap.get(t.id) ?? null,
    }))

    return { data: enriched }
  }

  // Admin/instructor/manager see all trails
  const { data: trails, error } = await supabase
    .from("learning_trails")
    .select(
      "id, title, description, status, estimated_hours, is_mandatory, target_job_role_id, created_at",
    )
    .order("created_at", { ascending: false })

  if (error) return { error: "Erro ao carregar trilhas", data: [] }

  const trailIds = (trails ?? []).map((t) => t.id)
  const { data: courseCounts } = trailIds.length
    ? await supabase.from("trail_courses").select("trail_id").in("trail_id", trailIds)
    : { data: [] }

  const countMap = new Map<string, number>()
  for (const tc of courseCounts ?? []) {
    countMap.set(tc.trail_id, (countMap.get(tc.trail_id) ?? 0) + 1)
  }

  // Get job role names
  const roleIds = [
    ...new Set(
      (trails ?? [])
        .filter((t): t is typeof t & { target_job_role_id: string } => !!t.target_job_role_id)
        .map((t) => t.target_job_role_id),
    ),
  ]
  const { data: roles } = roleIds.length
    ? await supabase.from("job_roles").select("id, name").in("id", roleIds)
    : { data: [] }

  const roleMap = new Map((roles ?? []).map((r) => [r.id, r.name]))

  const enriched = (trails ?? []).map((t) => ({
    ...t,
    course_count: countMap.get(t.id) ?? 0,
    target_role_name: t.target_job_role_id ? (roleMap.get(t.target_job_role_id) ?? null) : null,
    is_enrolled: false,
    progress: null,
  }))

  return { data: enriched }
}

export async function getTrailDetail(trailId: string) {
  if (!uuidSchema.safeParse(trailId).success) return { error: "ID inválido" }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: trail } = await supabase
    .from("learning_trails")
    .select(
      "id, title, description, status, estimated_hours, is_mandatory, is_sequential, target_job_role_id, created_by, created_at",
    )
    .eq("id", trailId)
    .single()

  if (!trail) return { error: "Trilha não encontrada" }

  // Get courses in order
  const { data: trailCourses } = await supabase
    .from("trail_courses")
    .select("id, course_id, order, is_required, estimated_hours")
    .eq("trail_id", trailId)
    .order("order", { ascending: true })

  const courseIds = (trailCourses ?? []).map((tc) => tc.course_id)
  const { data: courses } = courseIds.length
    ? await supabase.from("courses").select("id, title, status, description, cover_image_url").in("id", courseIds)
    : { data: [] }

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))

  const enrichedCourses = (trailCourses ?? []).map((tc) => ({
    ...tc,
    course_title: courseMap.get(tc.course_id)?.title ?? "Curso desconhecido",
    course_description: courseMap.get(tc.course_id)?.description ?? null,
    course_status: courseMap.get(tc.course_id)?.status ?? "draft",
    course_cover_url: courseMap.get(tc.course_id)?.cover_image_url ?? null,
  }))

  // Get student enrollment status per course
  const { data: studentEnrollments } = courseIds.length
    ? await supabase
        .from("enrollments")
        .select("course_id, status")
        .eq("student_id", user.id)
        .in("course_id", courseIds)
    : { data: [] }

  const enrollStatusMap = new Map(
    (studentEnrollments ?? []).map((e) => [e.course_id, e.status as string]),
  )

  const coursesWithProgress = enrichedCourses.map((tc) => ({
    ...tc,
    enrollment_status: enrollStatusMap.get(tc.course_id) ?? null,
  }))

  // Get target role name
  let targetRoleName: string | null = null
  if (trail.target_job_role_id) {
    const { data: role } = await supabase
      .from("job_roles")
      .select("name")
      .eq("id", trail.target_job_role_id)
      .single()
    targetRoleName = role?.name ?? null
  }

  return { data: { ...trail, courses: coursesWithProgress, target_role_name: targetRoleName } }
}

export async function createTrail(raw: unknown) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireTrailRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const result = createTrailSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  const { courses: trailCourses, ...trailData } = result.data

  // Calculate total estimated hours
  const computedHours = trailCourses.reduce((sum, c) => sum + (c.estimated_hours ?? 0), 0)
  const totalHours = trailData.estimated_hours ?? (computedHours || null)

  const { data: trail, error } = await supabase
    .from("learning_trails")
    .insert({
      tenant_id: roleCheck.tenantId,
      title: trailData.title,
      description: trailData.description ?? null,
      target_job_role_id: trailData.target_job_role_id ?? null,
      estimated_hours: totalHours,
      is_mandatory: trailData.is_mandatory,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !trail) return { error: "Erro ao criar trilha" }

  // Insert trail courses
  if (trailCourses.length > 0) {
    const courseRows = trailCourses.map((c) => ({
      trail_id: trail.id,
      course_id: c.course_id,
      order: c.order,
      is_required: c.is_required,
      estimated_hours: c.estimated_hours ?? null,
    }))

    const { error: courseError } = await supabase.from("trail_courses").insert(courseRows)
    if (courseError) return { error: "Erro ao vincular cursos" }
  }

  revalidatePath("/trails")
  return { data: trail }
}

export async function updateTrail(trailId: string, raw: unknown) {
  if (!uuidSchema.safeParse(trailId).success) return { error: "ID inválido" }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireTrailRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const result = updateTrailSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  const { error } = await supabase
    .from("learning_trails")
    .update({ ...result.data, updated_at: new Date().toISOString() })
    .eq("id", trailId)

  if (error) return { error: "Erro ao atualizar trilha" }

  revalidatePath("/trails")
  revalidatePath(`/trails/${trailId}`)
  return { success: true }
}

export async function updateTrailStatus(trailId: string, status: "draft" | "active" | "archived") {
  if (!uuidSchema.safeParse(trailId).success) return { error: "ID inválido" }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireTrailRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const { error } = await supabase
    .from("learning_trails")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", trailId)

  if (error) return { error: "Erro ao atualizar status" }

  // Auto-enroll users when activating trail (Story 27.4)
  if (status === "active") {
    await autoEnrollTrailUsers(supabase, trailId, roleCheck.tenantId)
  }

  revalidatePath("/trails")
  revalidatePath(`/trails/${trailId}`)
  return { success: true }
}

async function autoEnrollTrailUsers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trailId: string,
  tenantId: string,
) {
  // Get trail with target role
  const { data: trail } = await supabase
    .from("learning_trails")
    .select("target_job_role_id")
    .eq("id", trailId)
    .single()

  if (!trail?.target_job_role_id) return

  // Get trail courses in order
  const { data: trailCourses } = await supabase
    .from("trail_courses")
    .select("course_id, order")
    .eq("trail_id", trailId)
    .order("order", { ascending: true })

  if (!trailCourses || trailCourses.length === 0) return

  // Get users with target job role
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("job_role_id", trail.target_job_role_id)
    .eq("role", "student")

  if (!users || users.length === 0) return

  // Batch enroll (max 500 at a time)
  const enrollments: Array<{
    student_id: string
    course_id: string
    tenant_id: string
    trail_id: string
    trail_course_order: number
    status: string
  }> = []

  for (const user of users) {
    for (const tc of trailCourses) {
      enrollments.push({
        student_id: user.id,
        course_id: tc.course_id,
        tenant_id: tenantId,
        trail_id: trailId,
        trail_course_order: tc.order,
        status: "active",
      })
    }
  }

  // Insert in batches of 500 — idempotent via upsert with ON CONFLICT DO NOTHING.
  // Safe to re-execute: already-enrolled users are not duplicated.
  for (let i = 0; i < enrollments.length; i += 500) {
    const batch = enrollments.slice(i, i + 500)
    const { error: upsertError } = await supabase.from("enrollments").upsert(batch, {
      onConflict: "student_id,course_id",
      ignoreDuplicates: true,
    })
    if (upsertError) {
      console.error("[autoEnrollTrailUsers] batch upsert error", upsertError)
    }
  }
}

export async function reorderTrailCourses(trailId: string, raw: unknown) {
  if (!uuidSchema.safeParse(trailId).success) return { error: "ID inválido" }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireTrailRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const result = reorderTrailCoursesSchema.safeParse(raw)
  if (!result.success) return { error: result.error.errors[0].message }

  // Update each course order
  for (const item of result.data.courses) {
    await supabase
      .from("trail_courses")
      .update({ order: item.order })
      .eq("trail_id", trailId)
      .eq("course_id", item.course_id)
  }

  revalidatePath(`/trails/${trailId}`)
  return { success: true }
}

export async function addCourseToTrail(
  trailId: string,
  courseId: string,
  order: number,
  isRequired = true,
) {
  if (!uuidSchema.safeParse(trailId).success || !uuidSchema.safeParse(courseId).success) {
    return { error: "ID inválido" }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireTrailRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const { error } = await supabase.from("trail_courses").insert({
    trail_id: trailId,
    course_id: courseId,
    order,
    is_required: isRequired,
  })

  if (error) return { error: "Erro ao adicionar curso" }

  revalidatePath(`/trails/${trailId}`)
  return { success: true }
}

export async function removeCourseFromTrail(trailId: string, courseId: string) {
  if (!uuidSchema.safeParse(trailId).success || !uuidSchema.safeParse(courseId).success) {
    return { error: "ID inválido" }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireTrailRole(supabase, user.id)
  if ("error" in roleCheck) return { error: roleCheck.error }

  const { error } = await supabase
    .from("trail_courses")
    .delete()
    .eq("trail_id", trailId)
    .eq("course_id", courseId)

  if (error) return { error: "Erro ao remover curso" }

  revalidatePath(`/trails/${trailId}`)
  return { success: true }
}

export async function listAvailableCourses() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data } = await supabase
    .from("courses")
    .select("id, title, status")
    .order("title", { ascending: true })

  return { data: data ?? [] }
}

export async function listJobRolesForTrails() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data } = await supabase
    .from("job_roles")
    .select("id, name, seniority_level")
    .order("name", { ascending: true })

  return { data: data ?? [] }
}

export async function selfEnrollInTrail(trailId: string) {
  if (!uuidSchema.safeParse(trailId).success) return { error: "ID inválido" }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "student") return { error: "Apenas alunos podem se inscrever" }

  // Get trail courses
  const { data: trailCourses } = await supabase
    .from("trail_courses")
    .select("course_id, order")
    .eq("trail_id", trailId)
    .order("order", { ascending: true })

  if (!trailCourses || trailCourses.length === 0) return { error: "Trilha sem cursos" }

  const enrollments = trailCourses.map((tc) => ({
    student_id: user.id,
    course_id: tc.course_id,
    tenant_id: profile.tenant_id,
    trail_id: trailId,
    trail_course_order: tc.order,
    status: "active" as const,
  }))

  const { error } = await supabase.from("enrollments").upsert(enrollments, {
    onConflict: "student_id,course_id",
    ignoreDuplicates: true,
  })

  if (error) return { error: "Erro ao realizar inscrição" }

  revalidatePath("/trails")
  return { success: true }
}
