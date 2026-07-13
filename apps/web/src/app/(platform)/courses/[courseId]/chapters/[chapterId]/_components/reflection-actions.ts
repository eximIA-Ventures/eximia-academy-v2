"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function getReflection(slideId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data } = await service
    .from("slide_reflections")
    .select("id, response, ai_response, updated_at")
    .eq("student_id", user.id)
    .eq("slide_id", slideId)
    .limit(1)

  return data?.[0] ?? null
}

export async function saveReflection(slideId: string, tenantId: string, response: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const service = createServiceClient()
  const { error } = await service
    .from("slide_reflections")
    .upsert(
      {
        student_id: user.id,
        slide_id: slideId,
        tenant_id: tenantId,
        response,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,slide_id" }
    )

  if (error) return { error: error.message }
  return { success: true }
}

export async function saveAiResponse(slideId: string, aiResponse: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const service = createServiceClient()
  const { error } = await service
    .from("slide_reflections")
    .update({ ai_response: aiResponse })
    .eq("student_id", user.id)
    .eq("slide_id", slideId)

  if (error) return { error: error.message }
  return { success: true }
}
