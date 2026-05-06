import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/service"
import { NotificationsClient } from "./_components/notifications-client"

export default async function NotificationsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!["admin", "manager", "instructor"].includes(profile.role)) return redirect("/dashboard")

  const service = createServiceClient()

  // Fetch students for recipient selector
  const { data: students } = await service
    .from("users")
    .select("id, email, full_name, role")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active")
    .in("role", ["student", "manager", "instructor"])
    .order("full_name")

  // Fetch courses for deadline linking
  const { data: courses } = await service
    .from("courses")
    .select("id, title")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "published")
    .order("title")

  // Fetch trails
  const { data: trails } = await service
    .from("learning_trails")
    .select("id, title")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "published")
    .order("title")

  // Fetch sent history
  const { data: history } = await service
    .from("email_notifications")
    .select("id, subject, recipient_count, status, sent_at, deadline, course_id")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(20)

  return (
    <NotificationsClient
      students={students ?? []}
      courses={courses ?? []}
      trails={trails ?? []}
      history={history ?? []}
    />
  )
}
