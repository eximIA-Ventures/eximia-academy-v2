import { getAuthProfile } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AdminDashboardPage } from "./_components/admin-dashboard-page"
import { ManagerDashboardPage } from "./_components/manager-dashboard-page"
import { StudentDashboardPage } from "./_components/student-dashboard-page"
import { SuperAdminDashboardPage } from "./_components/super-admin-dashboard-page"

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

  // Super Admin — meta-level dashboard (all tenants)
  if (profile.role === "super_admin") {
    return <SuperAdminDashboardPage fullName={profile.full_name} />
  }

  // Admin dashboard (single tenant)
  if (profile.role === "admin") {
    // Admin global (null tenant) needs service client to bypass RLS
    let dbClient = supabase
    let resolvedTenantId = profile.tenant_id
    if (!profile.tenant_id) {
      const { createServiceClient } = await import("@/lib/supabase/service")
      dbClient = createServiceClient()
      const { resolveTenantId } = await import("@/lib/auth")
      resolvedTenantId = await resolveTenantId(null)
    }
    return (
      <AdminDashboardPage
        supabase={dbClient}
        role={profile.role}
        tenantId={resolvedTenantId}
        fullName={profile.full_name}
      />
    )
  }

  // Instructor has dedicated page — redirect there
  if (profile.role === "instructor") {
    return redirect("/instructor")
  }

  // Leader has dedicated page — redirect there
  if (profile.role === "leader") {
    return redirect("/leader")
  }

  // Unknown role — redirect to login
  console.error(`Unknown user role: ${profile.role}`)
  return redirect("/login")
}
