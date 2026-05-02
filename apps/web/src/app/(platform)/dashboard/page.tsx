import { getAuthProfile } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AdminDashboardPage } from "./_components/admin-dashboard-page"
import { ManagerDashboardPage } from "./_components/manager-dashboard-page"
import { StudentDashboardPage } from "./_components/student-dashboard-page"

export default async function DashboardPage() {
  const { user, profile, error: profileError, supabase } = await getAuthProfile()

  if (!user) return redirect("/login")

  if (profileError) {
    console.error("Failed to fetch user profile:", profileError.message)
    throw new Error("Failed to load user profile")
  }

  if (!profile) return redirect("/login")

  // "View as student" mode — show student dashboard regardless of actual role
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  if (viewAsStudent && (profile.role === "instructor" || profile.role === "admin")) {
    return <StudentDashboardPage supabase={supabase} userId={user.id} fullName={profile.full_name} />
  }

  // Student dashboard
  if (profile.role === "student") {
    return <StudentDashboardPage supabase={supabase} userId={user.id} fullName={profile.full_name} />
  }

  // Manager dashboard
  if (profile.role === "manager") {
    return <ManagerDashboardPage supabase={supabase} tenantId={profile.tenant_id} fullName={profile.full_name} />
  }

  // Admin dashboard
  if (profile.role === "admin") {
    return (
      <AdminDashboardPage
        supabase={supabase}
        role={profile.role}
        tenantId={profile.tenant_id}
        fullName={profile.full_name}
      />
    )
  }

  // Instructor has dedicated page — redirect there
  if (profile.role === "instructor") {
    return redirect("/instructor")
  }

  // Unknown role — redirect to login
  console.error(`Unknown user role: ${profile.role}`)
  return redirect("/login")
}
