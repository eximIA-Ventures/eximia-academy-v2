import { getStudentDetails } from "@/app/(platform)/instructor/actions"
import { PageHeader } from "@/components/layout/page-header"
import { TenantDetailTabs } from "@/components/super-admin/tenant-detail-tabs"
import { TenantDetailHeader } from "@/components/super-admin/tenant-detail-header"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { redirect } from "next/navigation"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params

  // Verify auth + role
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "super_admin") {
    redirect("/dashboard")
  }

  const serviceClient = createServiceClient()

  // Fetch tenant
  const { data: tenant, error } = await serviceClient
    .from("tenants")
    .select("id, name, slug, plan, status, branding, settings, whitelabel_enabled, whitelabel_config, created_at, updated_at")
    .eq("id", tenantId)
    .single()

  if (error || !tenant) {
    redirect("/super-admin/tenants")
  }

  // Fetch stats
  const [
    { count: userCount },
    { count: sessionCount },
    { count: courseCount },
    { count: enrollmentCount },
    { count: reflectionCount },
  ] = await Promise.all([
    serviceClient
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    serviceClient
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    serviceClient
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    serviceClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    serviceClient
      .from("slide_reflections")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ])

  // Fetch initial users + student details in parallel
  const [{ data: users }, studentDetails] = await Promise.all([
    serviceClient
      .from("users")
      .select("id, full_name, email, role, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    getStudentDetails(tenantId),
  ])

  // Build a lookup map of student metrics keyed by user id
  const userMetricsMap: Record<string, {
    totalSessions: number
    completedSessions: number
    coursesEnrolled: number
    lastSessionDate: string | null
  }> = {}
  for (const s of studentDetails) {
    userMetricsMap[s.id] = {
      totalSessions: s.totalSessions,
      completedSessions: s.completedSessions,
      coursesEnrolled: s.coursesEnrolled,
      lastSessionDate: s.lastSessionDate,
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Super Admin"
        title={tenant.name}
        description={`Gerencie configurações, usuários e métricas de ${tenant.name}.`}
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80"
      >
        <TenantDetailHeader slug={tenant.slug} tenantId={tenant.id} status={tenant.status} />
      </PageHeader>
      <TenantDetailTabs
        tenant={tenant}
        stats={{
          user_count: userCount ?? 0,
          session_count: sessionCount ?? 0,
          course_count: courseCount ?? 0,
          enrollment_count: enrollmentCount ?? 0,
          reflection_count: reflectionCount ?? 0,
        }}
        initialUsers={users ?? []}
        userMetrics={userMetricsMap}
      />
    </div>
  )
}
