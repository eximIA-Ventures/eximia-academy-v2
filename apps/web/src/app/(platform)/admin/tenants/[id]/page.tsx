import { PageHeader } from "@/components/layout/page-header"
import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { adminWorldDeniedRedirect } from "@/lib/admin-world"
import { hostCanonico } from "@/lib/admin/host-canonico"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { PainelDeMarca } from "./_components/painel-de-marca"
import { TenantManagementClient } from "./_components/tenant-management-client"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO. Só super_admin. Rodada 5: recusa da ROTA não pode
  // custar o MUNDO — ver `adminWorldDeniedRedirect`.
  if (!canOpenAdminRoute("/admin/tenants", roles)) return redirect(adminWorldDeniedRedirect(roles))

  const supabase = createServiceClient()

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, plan, brand, modules, created_at")
    .eq("id", id)
    .single()

  if (!tenant) return notFound()

  // Parallel fetch
  const [
    { data: users },
    { data: areas },
    { data: courses },
    { count: sessionCount },
    // Domínios PRÓPRIOS. O host canônico não mora aqui: ele é `{slug}.{base}`,
    // derivado por string (D1). Um erro de leitura (tabela ainda não migrada,
    // por exemplo) não derruba a tela — vira lista vazia.
    { data: dominios },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, role, status, created_at")
      .eq("tenant_id", id)
      .order("full_name"),
    supabase.from("areas").select("id, name, slug, description").eq("tenant_id", id).order("name"),
    supabase
      .from("courses")
      .select("id, title, status, area_id")
      .eq("tenant_id", id)
      .order("title"),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("tenant_id", id),
    supabase
      .from("tenant_domains")
      .select("host, is_primary, verified_at")
      .eq("tenant_id", id)
      .order("is_primary", { ascending: false }),
  ])

  // User counts per area
  const areaIds = (areas ?? []).map((a) => a.id)
  const userAreaCounts: Record<string, number> = {}
  const courseAreaCounts: Record<string, number> = {}

  if (areaIds.length > 0) {
    const [{ data: userAreaRows }, { data: courseRows }] = await Promise.all([
      supabase.from("user_areas").select("area_id").in("area_id", areaIds),
      supabase.from("courses").select("area_id").in("area_id", areaIds),
    ])
    for (const r of userAreaRows ?? []) {
      userAreaCounts[r.area_id] = (userAreaCounts[r.area_id] ?? 0) + 1
    }
    for (const r of courseRows ?? []) {
      if (r.area_id) courseAreaCounts[r.area_id] = (courseAreaCounts[r.area_id] ?? 0) + 1
    }
  }

  const areasWithCounts = (areas ?? []).map((a) => ({
    ...a,
    user_count: userAreaCounts[a.id] ?? 0,
    course_count: courseAreaCounts[a.id] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        section="Super Admin"
        title={tenant.name}
        description={`/${tenant.slug} — Criado em ${new Date(tenant.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`}
        backgroundImage="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
      />

      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar para Empresas
      </Link>

      <PainelDeMarca
        tenantId={id}
        slug={tenant.slug}
        plan={tenant.plan}
        brand={(tenant.brand ?? {}) as Record<string, unknown>}
        modules={tenant.modules ?? []}
        host={hostCanonico(tenant.slug)}
        dominiosProprios={dominios ?? []}
      />

      <TenantManagementClient
        tenantId={id}
        tenantName={tenant.name}
        stats={{
          users: users?.length ?? 0,
          areas: areas?.length ?? 0,
          courses: courses?.length ?? 0,
          sessions: sessionCount ?? 0,
        }}
        initialUsers={users ?? []}
        initialAreas={areasWithCounts}
        initialCourses={(courses ?? []).map((c) => ({
          ...c,
          area_name: areas?.find((a) => a.id === c.area_id)?.name ?? null,
        }))}
      />
    </div>
  )
}
