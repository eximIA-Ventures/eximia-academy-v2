"use server"

import { generateQuestionsForChapter } from "@/lib/generate-questions-for-chapter"
import { startBatchGeneration } from "@/lib/question-generation"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createChapterSchema, reorderChaptersSchema, updateChapterSchema } from "@eximia/shared"
import { revalidatePath } from "next/cache"

async function requireContentRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ role: string; error?: never } | { error: string; role?: never }> {
  const { data: profile } = await supabase.from("users").select("role").eq("id", userId).single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (profile.role !== "manager" && profile.role !== "admin" && profile.role !== "instructor") {
    return { error: "Permissão negada" }
  }
  return { role: profile.role }
}

export async function createChapter(courseId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const contentBlocksRaw = formData.get("content_blocks") as string | null
  const contentBlocks = contentBlocksRaw ? JSON.parse(contentBlocksRaw) : undefined

  const raw = {
    title: formData.get("title") as string,
    content: (formData.get("content") as string) || undefined,
    content_blocks: contentBlocks,
    learning_objective: (formData.get("learning_objective") as string) || undefined,
    video_url: (formData.get("video_url") as string) || undefined,
    audio_url: (formData.get("audio_url") as string) || undefined,
  }

  const result = createChapterSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { data: maxOrder } = await supabase
    .from("chapters")
    .select("order")
    .eq("course_id", courseId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxOrder?.order ?? -1) + 1

  // Convert empty strings to null for DB
  const videoUrl = result.data.video_url || null
  const audioUrl = result.data.audio_url || null

  const { data: inserted, error } = await supabase
    .from("chapters")
    .insert({
      ...result.data,
      created_by: user.id,
      content_blocks: result.data.content_blocks ?? null,
      video_url: videoUrl,
      audio_url: audioUrl,
      course_id: courseId,
      order: nextOrder,
    })
    .select("id, tenant_id")
    .single()

  if (error) return { error: `Erro ao criar capítulo: ${error.message}` }

  // Auto-generate questions if content is long enough
  const content = result.data.content
  if (inserted && content && content.length >= 100) {
    generateQuestionsForChapter({
      chapterId: inserted.id,
      title: result.data.title,
      content,
      learningObjective: result.data.learning_objective ?? undefined,
      tenantId: inserted.tenant_id,
    }).catch((err) => {
      console.error("Auto question generation on chapter create failed:", err)
    })
  }

  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function updateChapter(chapterId: string, courseId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const contentBlocksRaw = formData.get("content_blocks") as string | null
  const contentBlocks = contentBlocksRaw ? JSON.parse(contentBlocksRaw) : undefined

  const raw = {
    id: chapterId,
    title: formData.get("title") as string,
    content: (formData.get("content") as string) || undefined,
    content_blocks: contentBlocks,
    learning_objective: (formData.get("learning_objective") as string) || undefined,
    video_url: (formData.get("video_url") as string) || undefined,
    audio_url: (formData.get("audio_url") as string) || undefined,
  }

  const result = updateChapterSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { id, ...data } = result.data

  // Convert empty strings to null for DB
  const videoUrl = data.video_url || null
  const audioUrl = data.audio_url || null

  const { error } = await supabase
    .from("chapters")
    .update({
      ...data,
      content_blocks: data.content_blocks ?? null,
      video_url: videoUrl,
      audio_url: audioUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return { error: `Erro ao atualizar capítulo: ${error.message}` }

  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function deleteChapter(chapterId: string, courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  // Verify chapter belongs to the course
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, course_id")
    .eq("id", chapterId)
    .single()

  if (!chapter) return { error: "Capítulo não encontrado" }
  if (chapter.course_id !== courseId) return { error: "Capítulo não pertence a este curso" }

  // chapters_delete is admin-only RLS, use service role
  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from("chapters")
    .delete()
    .eq("id", chapterId)
    .eq("course_id", courseId)

  if (error) return { error: `Erro ao excluir capítulo: ${error.message}` }

  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function reorderChapters(
  courseId: string,
  chapters: Array<{ id: string; order: number }>,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const result = reorderChaptersSchema.safeParse(chapters)
  if (!result.success) {
    return { error: "Dados de reordenação inválidos" }
  }

  for (const chapter of result.data) {
    const { error } = await supabase
      .from("chapters")
      .update({ order: chapter.order, updated_at: new Date().toISOString() })
      .eq("id", chapter.id)

    if (error) return { error: `Erro ao reordenar: ${error.message}` }
  }

  revalidatePath(`/courses/${courseId}`)
  return { success: true }
}

export async function toggleChapterStatus(chapterId: string, courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const roleCheck = await requireContentRole(supabase, user.id)
  if (roleCheck.error) return { error: roleCheck.error }

  const { data: chapter } = await supabase
    .from("chapters")
    .select("status")
    .eq("id", chapterId)
    .single()

  if (!chapter) return { error: "Capítulo não encontrado" }

  const newStatus = chapter.status === "published" ? "draft" : "published"

  const { error } = await supabase
    .from("chapters")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", chapterId)

  if (error) return { error: `Erro ao alterar status: ${error.message}` }

  // Auto-trigger question generation on publish
  if (newStatus === "published") {
    triggerAutoQuestionGeneration(courseId, supabase, user.id).catch((err) => {
      console.error("Auto-trigger question generation failed:", err)
    })
  }

  revalidatePath(`/courses/${courseId}`)
  return { success: true, status: newStatus }
}

async function triggerAutoQuestionGeneration(
  courseId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  // Check auto-generate setting
  const { data: course } = await supabase
    .from("courses")
    .select("settings, tenant_id")
    .eq("id", courseId)
    .single()

  if (!course) return

  const settings = course.settings as Record<string, unknown> | null
  if (settings?.auto_generate_questions === false) return

  // Call shared generation logic directly (no HTTP, no auth issues)
  await startBatchGeneration({
    courseId,
    tenantId: course.tenant_id,
    triggeredBy: userId,
  })
}
