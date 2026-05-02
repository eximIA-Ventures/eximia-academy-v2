"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"

async function requireInstructor() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "manager", "instructor"].includes(profile.role))
    throw new Error("Forbidden")

  return { supabase, userId: user.id, tenantId: profile.tenant_id as string }
}

export async function updateSlideText(slideId: string, text: string) {
  const { supabase } = await requireInstructor()
  const { error } = await supabase
    .from("chapter_slides")
    .update({ text_content: text, text_status: "review" })
    .eq("id", slideId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function reorderSlides(
  chapterId: string,
  slideOrder: Array<{ id: string; order: number }>,
) {
  await requireInstructor()
  const service = createServiceClient()

  for (const item of slideOrder) {
    await service
      .from("chapter_slides")
      .update({ order: item.order })
      .eq("id", item.id)
      .eq("chapter_id", chapterId)
  }

  return { success: true }
}

export async function deleteSlide(slideId: string, chapterId: string) {
  const { tenantId } = await requireInstructor()
  const service = createServiceClient()

  // Get slide to clean up storage
  const { data: slide } = await service
    .from("chapter_slides")
    .select("id, image_storage_path")
    .eq("id", slideId)
    .single()

  if (!slide) return { error: "Slide not found" }

  // Delete from storage
  if (slide.image_storage_path) {
    await service.storage
      .from("chapter-assets")
      .remove([slide.image_storage_path])
      .catch(() => {})
  }

  // Delete from DB
  const { error } = await service
    .from("chapter_slides")
    .delete()
    .eq("id", slideId)

  if (error) return { error: error.message }

  // Recompute order for remaining slides
  const { data: remaining } = await service
    .from("chapter_slides")
    .select("id")
    .eq("chapter_id", chapterId)
    .order("order", { ascending: true })

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await service
        .from("chapter_slides")
        .update({ order: i })
        .eq("id", remaining[i].id)
    }
  }

  revalidatePath(`/courses`)
  return { success: true }
}

export async function approveSlideTexts(chapterId: string) {
  await requireInstructor()
  const service = createServiceClient()

  const { error } = await service
    .from("chapter_slides")
    .update({ text_status: "approved" })
    .eq("chapter_id", chapterId)
    .eq("text_status", "review")

  if (error) return { error: error.message }
  return { success: true }
}

export async function generateSlideTexts(chapterId: string) {
  await requireInstructor()

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/chapters/${chapterId}/slides/generate-text`,
    { method: "POST" },
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: data.error ?? "Failed to generate texts" }
  }

  const result = await response.json()
  return { success: true, processed: result.processed, errors: result.errors }
}

export async function syncSlideAudio(chapterId: string, totalDurationMs: number) {
  await requireInstructor()

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/chapters/${chapterId}/slides/sync-audio`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalDurationMs }),
    },
  )

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: data.error ?? "Failed to sync audio" }
  }

  const result = await response.json()
  return { success: true, slidesUpdated: result.slidesUpdated }
}

export async function updateSlideAudioUrl(chapterId: string, audioUrl: string | null) {
  const { supabase } = await requireInstructor()
  const { error } = await supabase
    .from("chapters")
    .update({ slide_audio_url: audioUrl })
    .eq("id", chapterId)

  if (error) return { error: error.message }
  return { success: true }
}
