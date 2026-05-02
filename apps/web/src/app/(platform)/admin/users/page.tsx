import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile } from "@/lib/auth"
import { ShieldCheck, UserCheck, Users } from "lucide-react"
import { redirect } from "next/navigation"
import { UserManagementClient } from "./user-management-client"
import type { AreaData } from "@/components/providers/area-provider"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : undefined
  const roleFilter = typeof params.role === "string" ? params.role : undefined

  const areaFilter = typeof params.area_id === "string" ? params.area_id : undefined

  // Fetch tenant areas for the area filter dropdown
  const { data: areasRaw } = await supabase
    .from("areas")
    .select("id, name, slug")
    .eq("tenant_id", profile.tenant_id)
    .order("name")
  const areas: AreaData[] = (areasRaw ?? []).map((a) => ({ id: a.id, name: a.name, slug: a.slug }))

  // Fetch initial page of users
  let query = supabase
    .from("users")
    .select("id, full_name, email, role, status, avatar_url, created_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(21) // 20 + 1 to detect next page

  if (roleFilter) {
    query = query.eq("role", roleFilter)
  }
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  // Area-scoped filtering at SSR level
  if (areaFilter) {
    const { data: areaUsers } = await supabase
      .from("user_areas")
      .select("user_id")
      .eq("area_id", areaFilter)
    const userIds = (areaUsers ?? []).map((u) => u.user_id)
    if (userIds.length > 0) {
      query = query.in("id", userIds)
    } else {
      // No users in this area — skip query, return empty
      const emptyUsers: typeof initialUsers = []
      return (
        <div className="space-y-6">
          <PageHeader
            section="Administração"
            title="Usuários"
            description="Gerencie usuários, convites e permissões."
            accent="blue"
            backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
          />
          <UserManagementClient
            initialData={emptyUsers}
            initialCursor={null}
            currentUserId={user.id}
            initialSearch={search ?? ""}
            initialRoleFilter={roleFilter ?? ""}
            areas={areas}
            initialAreaFilter={areaFilter ?? ""}
          />
        </div>
      )
    }
  }

  const { data: usersRaw } = await query

  const allUsers = (usersRaw ?? []).map((u) => ({
    ...u,
    last_sign_in_at: null as string | null,
  }))
  const hasMore = allUsers.length > 20
  const initialUsers = hasMore ? allUsers.slice(0, 20) : allUsers
  const initialCursor = hasMore ? initialUsers[initialUsers.length - 1]?.created_at : null

  // Stats (count queries within same tenant)
  const { count: totalCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)

  const { count: activeCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active")

  const { count: adminCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("role", "admin")

  const stats = [
    {
      icon: Users,
      title: "Usuários",
      value: String(totalCount ?? 0),
      description: "Total de usuários",
      color: "accent-blue-mid",
    },
    {
      icon: UserCheck,
      title: "Ativos",
      value: String(activeCount ?? 0),
      description: "Usuários ativos",
      color: "accent-gold",
    },
    {
      icon: ShieldCheck,
      title: "Administradores",
      value: String(adminCount ?? 0),
      description: "Com acesso total",
      color: "accent-teal",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Usuários"
        description="Gerencie usuários, convites e permissões."
        accent="blue"
        backgroundImage="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="flex items-center gap-4 rounded-2xl bg-bg-card p-4 ring-1 ring-white/[0.06]"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${stat.color}/15`}
              >
                <Icon size={20} className={`text-${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.description}</p>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Client-side interactive section: search, filter, invite, user list */}
      <UserManagementClient
        initialData={initialUsers}
        initialCursor={initialCursor}
        currentUserId={user.id}
        initialSearch={search ?? ""}
        initialRoleFilter={roleFilter ?? ""}
        areas={areas}
        initialAreaFilter={areaFilter ?? ""}
      />
    </div>
  )
}
