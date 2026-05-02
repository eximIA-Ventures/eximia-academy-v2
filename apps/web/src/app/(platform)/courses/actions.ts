"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { dispatchEvent } from "@/lib/webhooks"
import { createCourseSchema, updateCourseSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

async function requireContentRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ role: string; tenantId: string; error?: never } | { error: string; role?: never; tenantId?: never }> {
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", userId)
    .single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (profile.role !== "manager" && profile.role !== "admin" && profile.role !== "instructor") {
    return { error: "Permissão negada" }
  }
  return { role: profile.role, tenantId: profile.tenant_id }
}

export async function createCourse(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    type: (formData.get("type") as string) || "regular",
  }

  const result = createCourseSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  // Auto-assign first area for managers so the course appears in their filtered list
  let areaId: string | undefined
  if (roleCheck.role === "manager") {
    const { data: userAreas } = await supabase
      .from("user_areas")
      .select("area_id")
      .eq("user_id", user.id)
      .limit(1)
      .single()
    areaId = userAreas?.area_id ?? undefined
  }

  const coverImageUrl = (formData.get("cover_image_url") as string) || null
  const deadlineDaysRaw = formData.get("deadline_days") as string
  const deadlineDays = deadlineDaysRaw ? Number.parseInt(deadlineDaysRaw, 10) : null

  const { data: newCourse, error } = await supabase
    .from("courses")
    .insert({
      ...result.data,
      tenant_id: roleCheck.tenantId,
      created_by: user.id,
      ...(areaId ? { area_id: areaId } : {}),
      ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
      ...(deadlineDays ? { deadline_days: deadlineDays } : {}),
    })
    .select("id, title, type, status")
    .single()

  if (error) return { error: `Erro ao criar curso: ${error.message}` }

  // Webhook: course.created
  if (newCourse && roleCheck.tenantId) {
    dispatchEvent(roleCheck.tenantId, "course.created", {
      id: newCourse.id,
      title: newCourse.title,
      type: newCourse.type,
      status: newCourse.status,
    }).catch(() => {})
  }

  revalidatePath("/courses")
  return { success: true }
}

export async function updateCourse(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const raw = {
    id: formData.get("id") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    type: (formData.get("type") as string) || undefined,
  }

  const result = updateCourseSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { id, ...data } = result.data
  const coverUrl = (formData.get("cover_image_url") as string) || null
  const dlRaw = formData.get("deadline_days") as string
  const dlDays = dlRaw ? Number.parseInt(dlRaw, 10) : null

  const { data: updated, error } = await supabase
    .from("courses")
    .update({
      ...data,
      cover_image_url: coverUrl,
      deadline_days: dlDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, title, type, status")
    .single()

  if (error) return { error: `Erro ao atualizar curso: ${error.message}` }

  // Webhook: course.updated
  if (updated && roleCheck.tenantId) {
    dispatchEvent(roleCheck.tenantId, "course.updated", {
      id: updated.id,
      title: updated.title,
      type: updated.type,
      status: updated.status,
    }).catch(() => {})
  }

  revalidatePath("/courses")
  revalidatePath(`/courses/${id}`)
  return { success: true }
}

export async function deleteCourse(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  if (roleCheck.role === "admin") {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.from("courses").delete().eq("id", courseId)
    if (error) return { error: `Erro ao excluir curso: ${error.message}` }
  } else if (roleCheck.role === "manager" || roleCheck.role === "instructor") {
    const { data: course } = await supabase
      .from("courses")
      .select("status")
      .eq("id", courseId)
      .single()

    if (!course) return { error: "Curso não encontrado" }
    if (course.status !== "draft") {
      return { error: "Apenas cursos em rascunho podem ser excluidos" }
    }

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from("courses")
      .delete()
      .eq("id", courseId)
      .eq("status", "draft")
    if (error) return { error: `Erro ao excluir curso: ${error.message}` }
  }

  revalidatePath("/courses")
  return { success: true }
}

export async function archiveCourse(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const { error } = await supabase
    .from("courses")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", courseId)

  if (error) return { error: `Erro ao arquivar curso: ${error.message}` }

  revalidatePath("/courses")
  return { success: true }
}

export async function publishCourse(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  // Check published chapters
  const { data: publishedChapters } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("course_id", courseId)
    .eq("status", "published")

  if (!publishedChapters || publishedChapters.length === 0) {
    return { error: "Publique pelo menos 1 capítulo antes de publicar o curso" }
  }

  // Check each published chapter has active questions
  const chaptersWithoutQuestions: string[] = []
  for (const chapter of publishedChapters) {
    const { count } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("chapter_id", chapter.id)
      .eq("status", "active")

    if (!count || count === 0) {
      chaptersWithoutQuestions.push(chapter.title)
    }
  }

  if (chaptersWithoutQuestions.length > 0) {
    return {
      error: `Os seguintes capítulos nao tem perguntas ativas: ${chaptersWithoutQuestions.join(", ")}`,
    }
  }

  // Check onboarding conflict before publishing
  const { data: courseData } = await supabase
    .from("courses")
    .select("type, tenant_id")
    .eq("id", courseId)
    .single()

  if (courseData?.type === "onboarding") {
    const { data: existing } = await supabase
      .from("courses")
      .select("id, title")
      .eq("tenant_id", courseData.tenant_id)
      .eq("type", "onboarding")
      .eq("status", "published")
      .neq("id", courseId)
      .single()

    if (existing) {
      return {
        conflict: true,
        existingTitle: existing.title,
        existingId: existing.id,
      }
    }
  }

  // Publish
  const { error } = await supabase
    .from("courses")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", courseId)

  if (error) return { error: `Erro ao publicar curso: ${error.message}` }

  revalidatePath("/courses")
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function enrollInCourse(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  // Check tenant enrollment mode — block self-enrollment in assigned mode
  const { data: userProfile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single()

  if (userProfile?.tenant_id) {
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", userProfile.tenant_id)
      .single()
    const settings = (tenantData?.settings as Record<string, unknown>) ?? {}
    if (settings.enrollment_mode === "assigned") {
      return { error: "Inscrição não permitida. Os cursos são atribuídos pelo gestor." }
    }
  }

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      student_id: user.id,
      course_id: courseId,
      tenant_id: userProfile?.tenant_id,
    })
    .select("id, tenant_id")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "Você já esta inscrito neste curso" }
    }
    return { error: `Erro ao inscrever: ${error.message}` }
  }

  // Webhook: enrollment.created
  if (enrollment?.tenant_id) {
    dispatchEvent(enrollment.tenant_id, "enrollment.created", {
      enrollment_id: enrollment.id,
      student_id: user.id,
      course_id: courseId,
    }).catch(() => {})
  }

  revalidatePath("/courses")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function assignCourseToUsers(courseId: string, studentIds: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const service = createServiceClient()

  let assigned = 0
  let skipped = 0

  for (const studentId of studentIds) {
    const { error } = await service.from("enrollments").insert({
      student_id: studentId,
      course_id: courseId,
      tenant_id: roleCheck.tenantId,
      status: "active",
    })

    if (error) {
      if (error.code === "23505") {
        skipped++
      } else {
        return { error: `Erro ao atribuir curso: ${error.message}` }
      }
    } else {
      assigned++

      // Webhook per enrollment
      if (roleCheck.tenantId) {
        dispatchEvent(roleCheck.tenantId, "enrollment.created", {
          student_id: studentId,
          course_id: courseId,
        }).catch(() => {})
      }
    }
  }

  revalidatePath("/courses")
  return { success: true, assigned, skipped }
}

export async function publishCourseWithSwap(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const { data: courseData } = await supabase
    .from("courses")
    .select("type, tenant_id")
    .eq("id", courseId)
    .single()

  if (!courseData) return { error: "Curso não encontrado" }

  // Atomic swap via RPC — demotes existing onboarding + publishes new in single transaction
  const { error } = await supabase.rpc("swap_onboarding_course", {
    p_new_course_id: courseId,
    p_tenant_id: courseData.tenant_id,
  })

  if (error) return { error: `Erro ao publicar curso com swap: ${error.message}` }

  revalidatePath("/courses")
  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function restartCourse(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // 1. Verify enrollment exists and is completed
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .single()

  if (!enrollment) return { error: "Matrícula não encontrada" }
  if (enrollment.status !== "completed") return { error: "O curso ainda não foi concluído" }

  // 2. Get all chapter IDs for this course
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)
    .eq("status", "published")

  const chapterIds = (chapters ?? []).map((c) => c.id)

  // 3. Archive completed sessions and reset interaction data (data preserved, RPC won't count them)
  if (chapterIds.length > 0) {
    const service = createServiceClient()
    await Promise.all([
      service
        .from("sessions")
        .update({ status: "abandoned" })
        .eq("student_id", user.id)
        .in("chapter_id", chapterIds)
        .eq("status", "completed"),
      // Reset scenario attempts and assignment submissions so student can redo
      service
        .from("scenario_attempts")
        .delete()
        .eq("student_id", user.id)
        .in("chapter_id", chapterIds),
      service
        .from("assignment_submissions")
        .delete()
        .eq("student_id", user.id)
        .in("chapter_id", chapterIds),
    ])
  }

  // 4. Reset enrollment to active with zero progress
  const totalChapters = chapterIds.length
  await supabase
    .from("enrollments")
    .update({
      status: "active",
      progress: { percentage: 0, completed_chapters: 0, total_chapters: totalChapters },
    })
    .eq("id", enrollment.id)

  revalidatePath(`/courses/${courseId}`)
  revalidatePath("/courses")
  return { success: true }
}
