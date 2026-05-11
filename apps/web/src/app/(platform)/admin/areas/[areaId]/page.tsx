import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AreaDetailClient } from "./_components/area-detail-client"

interface Props {
  params: Promise<{ areaId: string }>
}

export default async function AreaDetailPage({ params }: Props) {
  const { areaId } = await params
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin", "manager"].includes(profile.role)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  const db = !profile.tenant_id ? createServiceClient() : supabase

  const { data: area } = await db
    .from("areas")
    .select("id, name, slug, description")
    .eq("id", areaId)
    .single()

  if (!area) return notFound()

  // Users in this area
  const { data: userAreaRows } = await db.from("user_areas").select("user_id").eq("area_id", areaId)
  const userIds = (userAreaRows ?? []).map((r) => r.user_id)

  let users: Array<{ id: string; full_name: string; email: string; role: string; status: string }> = []
  if (userIds.length > 0) {
    const { data } = await db.from("users").select("id, full_name, email, role, status").in("id", userIds).order("full_name")
    users = data ?? []
  }

  // Courses assigned to this area
  const { data: areaCourses } = await db.from("courses").select("id, title, status").eq("area_id", areaId).order("title")

  // All courses in tenant (for assigning)
  const { data: allCourses } = await db.from("courses").select("id, title, status, area_id").eq("tenant_id", tenantId).order("title")

  // All users in tenant not in this area (for assigning)
  const { data: allTenantUsers } = await db
    .from("users")
    .select("id, full_name, email, role")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("full_name")

  const unassignedUsers = (allTenantUsers ?? []).filter((u) => !userIds.includes(u.id))

  // Sessions count
  let sessionCount = 0
  if (userIds.length > 0) {
    const { count } = await db.from("sessions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("student_id", userIds)
    sessionCount = count ?? 0
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Unidades"
        title={area.name}
        description={`/${area.slug}${area.description ? ` — ${area.description}` : ""}`}
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
      />

      <Link href="/admin/areas" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={14} />
        Voltar para Unidades
      </Link>

      <AreaDetailClient
        areaId={areaId}
        users={users}
        courses={areaCourses ?? []}
        allCourses={allCourses ?? []}
        unassignedUsers={unassignedUsers}
        sessionCount={sessionCount}
      />
    </div>
  )
}
