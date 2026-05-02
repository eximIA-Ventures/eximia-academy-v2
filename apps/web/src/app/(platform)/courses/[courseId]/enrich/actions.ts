"use server"

import { applyApprovedSources } from "@/lib/course-enrichment"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

type ActionResult = { error: string } | { success: true }

async function guardManagerAccess(): Promise<
  { error: string } | { user: { id: string }; profile: { role: string } }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || !["manager", "admin"].includes(profile.role)) {
    return { error: "Permissão negada" }
  }

  return { user, profile }
}

export async function approveSource(
  sourceId: string,
  action: "incorporate" | "reference",
  courseId: string,
  jobId: string,
): Promise<ActionResult> {
  const guard = await guardManagerAccess()
  if ("error" in guard) return guard

  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from("enrichment_sources")
    .update({
      status: "approved",
      action,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourceId)

  if (error) {
    return { error: "Erro ao aprovar fonte" }
  }

  revalidatePath(`/courses/${courseId}/enrich/${jobId}`)
  return { success: true }
}

export async function rejectSource(
  sourceId: string,
  courseId: string,
  jobId: string,
): Promise<ActionResult> {
  const guard = await guardManagerAccess()
  if ("error" in guard) return guard

  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from("enrichment_sources")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourceId)

  if (error) {
    return { error: "Erro ao rejeitar fonte" }
  }

  // Update job rejected count
  const { data: job } = await serviceClient
    .from("enrichment_jobs")
    .select("sources_rejected")
    .eq("id", jobId)
    .single()

  if (job) {
    await serviceClient
      .from("enrichment_jobs")
      .update({
        sources_rejected: (job.sources_rejected ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
  }

  revalidatePath(`/courses/${courseId}/enrich/${jobId}`)
  return { success: true }
}

export async function applyAllApproved(jobId: string, courseId: string): Promise<ActionResult> {
  const guard = await guardManagerAccess()
  if ("error" in guard) return guard

  try {
    await applyApprovedSources(jobId)
    revalidatePath(`/courses/${courseId}/enrich/${jobId}`)
    revalidatePath(`/courses/${courseId}`)
    return { success: true }
  } catch (err) {
    console.error("Failed to apply approved sources:", err)
    return { error: "Erro ao aplicar fontes aprovadas" }
  }
}
