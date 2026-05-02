import { getAuthProfile } from "@/lib/auth"
import { PageHeader } from "@/components/layout/page-header"
import { redirect } from "next/navigation"
import { LivesPageClient } from "./lives-page-client"

export const metadata = {
  title: "Lives",
}

interface LiveEventRow {
  id: string
  title: string
  description: string | null
  host_name: string
  status: "scheduled" | "live" | "ended" | "cancelled"
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  meeting_url: string | null
  recording_url: string | null
  max_participants: number | null
  tags: string[] | null
  created_by: string | null
  registration_count: { count: number }[]
}

export default async function LivesPage() {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")

  const isManager = ["admin", "manager"].includes(profile.role)

  // Fetch live events — upcoming + live + ended with recordings
  const { data: events } = await supabase
    .from("live_events")
    .select(
      "id, title, description, host_name, status, scheduled_at, started_at, ended_at, meeting_url, recording_url, max_participants, tags, created_by, registration_count:live_registrations(count)",
    )
    .in("status", ["scheduled", "live", "ended"])
    .order("scheduled_at", { ascending: true })

  // Fetch user's registrations
  const { data: registrations } = await supabase
    .from("live_registrations")
    .select("live_event_id")
    .eq("user_id", user.id)

  const registeredIds = new Set(
    (registrations ?? []).map((r: { live_event_id: string }) => r.live_event_id),
  )

  const serializedEvents = ((events ?? []) as unknown as LiveEventRow[]).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    hostName: e.host_name,
    status: e.status,
    scheduledAt: e.scheduled_at,
    startedAt: e.started_at,
    endedAt: e.ended_at,
    meetingUrl: e.meeting_url,
    recordingUrl: e.recording_url,
    maxParticipants: e.max_participants,
    tags: e.tags,
    registrationCount: e.registration_count?.[0]?.count ?? 0,
    isRegistered: registeredIds.has(e.id),
  }))

  return (
    <div className="space-y-8">
      <PageHeader
        section="Eventos"
        title="Lives"
        description="Acompanhe eventos ao vivo e gravacoes."
        accent="gold"
        backgroundImage="https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80"
      />

      <LivesPageClient
        events={serializedEvents}
        isManager={isManager}
      />
    </div>
  )
}
