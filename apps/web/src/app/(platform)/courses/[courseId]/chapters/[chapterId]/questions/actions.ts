"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function approveQuestion(questionId: string, courseId: string, chapterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (profile.role !== "manager" && profile.role !== "admin" && profile.role !== "instructor") {
    return { error: "Permissão negada" }
  }

  const { error, count } = await supabase
    .from("questions")
    .update({
      status: "active",
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .eq("chapter_id", chapterId)

  if (error) return { error: "Erro ao aprovar pergunta" }
  if (count === 0) return { error: "Pergunta não encontrada neste capítulo" }

  revalidatePath(`/courses/${courseId}/chapters/${chapterId}/questions`)
  return { success: true }
}

export async function rejectQuestion(questionId: string, courseId: string, chapterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (profile.role !== "manager" && profile.role !== "admin" && profile.role !== "instructor") {
    return { error: "Permissão negada" }
  }

  const { error, count } = await supabase
    .from("questions")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .eq("chapter_id", chapterId)

  if (error) return { error: "Erro ao rejeitar pergunta" }
  if (count === 0) return { error: "Pergunta não encontrada neste capítulo" }

  revalidatePath(`/courses/${courseId}/chapters/${chapterId}/questions`)
  return { success: true }
}

export async function updateQuestionText(
  questionId: string,
  newText: string,
  courseId: string,
  chapterId: string,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile) return { error: "Perfil não encontrado" }
  if (profile.role !== "manager" && profile.role !== "admin" && profile.role !== "instructor") {
    return { error: "Permissão negada" }
  }

  if (newText.trim().length < 1) {
    return { error: "Texto da pergunta nao pode ser vazio" }
  }

  const { error, count } = await supabase
    .from("questions")
    .update({
      text: newText.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .eq("chapter_id", chapterId)

  if (error) return { error: "Erro ao atualizar pergunta" }
  if (count === 0) return { error: "Pergunta não encontrada neste capítulo" }

  revalidatePath(`/courses/${courseId}/chapters/${chapterId}/questions`)
  return { success: true }
}
