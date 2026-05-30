import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/service"
import { NotificationsClient } from "./_components/notifications-client"

interface PageProps {
  searchParams: Promise<{ ids?: string; subject?: string; message?: string }>
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!["admin", "manager", "instructor"].includes(profile.role)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  const service = createServiceClient()

  // Fetch students for recipient selector
  const { data: students } = await service
    .from("users")
    .select("id, email, full_name, role")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("role", ["student", "manager", "instructor"])
    .order("full_name")

  // Fetch session stats per user for risk classification
  const { data: sessionStats } = await service
    .from("sessions")
    .select("user_id, created_at")
    .eq("tenant_id", tenantId)

  // Compute risk per student
  const now = Date.now()
  const userSessionMap = new Map<string, { count: number; lastDate: number }>()
  for (const s of sessionStats ?? []) {
    const existing = userSessionMap.get(s.user_id)
    const ts = new Date(s.created_at).getTime()
    if (!existing) {
      userSessionMap.set(s.user_id, { count: 1, lastDate: ts })
    } else {
      existing.count++
      if (ts > existing.lastDate) existing.lastDate = ts
    }
  }

  const enrichedStudents = (students ?? []).map((s) => {
    const stats = userSessionMap.get(s.id)
    let risk: "on_track" | "at_risk" | "inactive" | "never_accessed" = "on_track"
    let daysSinceLastActivity: number | null = null

    if (!stats) {
      risk = "never_accessed"
    } else {
      daysSinceLastActivity = Math.floor((now - stats.lastDate) / (1000 * 60 * 60 * 24))
      if (daysSinceLastActivity > 14) risk = "inactive"
      else if (daysSinceLastActivity > 7) risk = "at_risk"
    }

    return { ...s, risk, daysSinceLastActivity, sessionCount: stats?.count ?? 0 }
  })

  // Fetch reflection stats per user
  const { data: reflectionStats } = await service
    .from("slide_reflections")
    .select("user_id")
    .eq("tenant_id", tenantId)

  const reflCountMap = new Map<string, number>()
  for (const r of reflectionStats ?? []) {
    reflCountMap.set(r.user_id, (reflCountMap.get(r.user_id) ?? 0) + 1)
  }

  const fullyEnrichedStudents = enrichedStudents.map((s) => ({
    ...s,
    reflectionCount: reflCountMap.get(s.id) ?? 0,
  }))

  // Fetch courses for deadline linking
  const { data: courses } = await service
    .from("courses")
    .select("id, title")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("title")

  // Fetch trails
  const { data: trails } = await service
    .from("learning_trails")
    .select("id, title")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("title")

  // Fetch sent history
  const { data: history } = await service
    .from("email_notifications")
    .select("id, subject, recipient_count, status, sent_at, deadline, course_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20)

  // Pre-selection from analytics
  const preselectedIds = params.ids ? params.ids.split(",") : undefined
  const prefillSubject = params.subject ?? undefined
  const prefillMessage = params.message ?? undefined

  return (
    <NotificationsClient
      students={fullyEnrichedStudents}
      courses={courses ?? []}
      trails={trails ?? []}
      history={history ?? []}
      preselectedIds={preselectedIds}
      prefillSubject={prefillSubject}
      prefillMessage={prefillMessage}
    />
  )
}
