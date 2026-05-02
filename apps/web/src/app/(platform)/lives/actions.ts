"use server"

import { getAuthProfile } from "@/lib/auth"
import { revalidatePath } from "next/cache"

interface CreateLiveData {
  title: string
  description?: string
  hostName: string
  scheduledAt: string
  meetingUrl?: string
  maxParticipants?: number
}

export async function createLiveEvent(data: CreateLiveData) {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return { error: "Não autenticado" }
  if (!["admin", "manager"].includes(profile.role)) return { error: "Sem permissão" }

  const { error } = await supabase.from("live_events").insert({
    tenant_id: profile.tenant_id,
    title: data.title,
    description: data.description || null,
    host_name: data.hostName,
    scheduled_at: data.scheduledAt,
    meeting_url: data.meetingUrl || null,
    max_participants: data.maxParticipants || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath("/lives")
  return { error: null }
}

export async function registerForLive(liveEventId: string) {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return { error: "Não autenticado" }

  const { error } = await supabase.from("live_registrations").insert({
    live_event_id: liveEventId,
    user_id: user.id,
    tenant_id: profile.tenant_id,
  })

  if (error) {
    if (error.code === "23505") return { error: "Você já está inscrito nesta live" }
    return { error: error.message }
  }

  revalidatePath("/lives")
  return { error: null }
}

export async function cancelRegistration(liveEventId: string) {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return { error: "Não autenticado" }

  const { error } = await supabase
    .from("live_registrations")
    .delete()
    .eq("live_event_id", liveEventId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/lives")
  return { error: null }
}

export async function updateLiveStatus(
  liveEventId: string,
  status: "scheduled" | "live" | "ended" | "cancelled",
) {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return { error: "Não autenticado" }
  if (!["admin", "manager"].includes(profile.role)) return { error: "Sem permissão" }

  const updateData: Record<string, unknown> = { status }
  if (status === "live") updateData.started_at = new Date().toISOString()
  if (status === "ended") updateData.ended_at = new Date().toISOString()

  const { error } = await supabase
    .from("live_events")
    .update(updateData)
    .eq("id", liveEventId)

  if (error) return { error: error.message }

  revalidatePath("/lives")
  return { error: null }
}
