"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function batchApproveQuestions(questionIds: string[], courseId: string) {
  if (questionIds.length === 0) return { error: "Nenhuma pergunta selecionada" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }

  const { data: updated, error } = await supabase
    .from("questions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .in("id", questionIds)
    .eq("status", "pending")
    .select("id, job_id")

  if (error) return { error: `Erro ao aprovar: ${error.message}` }

  const jobIds = [...new Set(updated?.map((q) => q.job_id).filter(Boolean))]
  for (const jobId of jobIds) {
    await recalculateJobCounters(jobId as string, supabase)
  }

  revalidatePath(`/courses/${courseId}/questions`)
  return { success: true, count: updated?.length ?? 0 }
}

export async function batchRejectQuestions(questionIds: string[], courseId: string) {
  if (questionIds.length === 0) return { error: "Nenhuma pergunta selecionada" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }

  const { data: updated, error } = await supabase
    .from("questions")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .in("id", questionIds)
    .eq("status", "pending")
    .select("id, job_id")

  if (error) return { error: `Erro ao rejeitar: ${error.message}` }

  const jobIds = [...new Set(updated?.map((q) => q.job_id).filter(Boolean))]
  for (const jobId of jobIds) {
    await recalculateJobCounters(jobId as string, supabase)
  }

  revalidatePath(`/courses/${courseId}/questions`)
  return { success: true, count: updated?.length ?? 0 }
}

export async function approveAllPending(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: chapters } = await supabase.from("chapters").select("id").eq("course_id", courseId)

  if (!chapters?.length) return { error: "Curso sem capítulos" }

  const { data: pending } = await supabase
    .from("questions")
    .select("id")
    .in(
      "chapter_id",
      chapters.map((c) => c.id),
    )
    .eq("status", "pending")

  if (!pending?.length) return { error: "Nenhuma pergunta pendente" }

  return batchApproveQuestions(
    pending.map((q) => q.id),
    courseId,
  )
}

async function recalculateJobCounters(
  jobId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: questions } = await supabase.from("questions").select("status").eq("job_id", jobId)

  if (!questions) return

  const approved = questions.filter((q) => q.status === "active").length
  const rejected = questions.filter((q) => q.status === "archived").length
  const pending = questions.filter((q) => q.status === "pending").length

  const status = pending === 0 ? "completed" : "review"

  await supabase
    .from("question_generation_jobs")
    .update({
      questions_approved: approved,
      questions_rejected: rejected,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}
