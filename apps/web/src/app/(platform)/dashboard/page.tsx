import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
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

  // If no tenant slug in URL, redirect to user's tenant
  // Tenant slug comes from static config now
  if (!currentSlug && profile.role !== "super_admin") {
    const service = createServiceClient()
    const { data: userTenant } = await service
      .from("tenants")
      .select("slug")
      .eq("id", profile.tenant_id)
      .single()

    if (userTenant?.slug) {
      redirect(`/${userTenant.slug}/dashboard`)
    }
  }

  // "View as student" mode — show student dashboard regardless of actual role
  const viewAsStudent = (await cookies()).get("x-view-as-student")?.value === "true"
  if (viewAsStudent && (profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin")) {
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

  // Admin dashboard (super_admin uses admin view when in tenant context)
  if (profile.role === "admin" || profile.role === "super_admin") {
    // For super_admin accessing via /{slug}/dashboard, resolve tenant from URL slug
    let resolvedTenantId = profile.tenant_id
    if (profile.role === "super_admin" && !resolvedTenantId && currentSlug) {
      const service = createServiceClient()
      const { data: slugTenant } = await service
        .from("tenants")
        .select("id")
        .eq("slug", currentSlug)
        .single()
      if (slugTenant) {
        resolvedTenantId = slugTenant.id
      }
    }

    if (!resolvedTenantId && profile.role === "super_admin") {
      redirect("/super-admin/tenants")
    }

    return (
      <AdminDashboardPage
        supabase={supabase}
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

  // Unknown role — redirect to login
  console.error(`Unknown user role: ${profile.role}`)
  return redirect("/login")
}
