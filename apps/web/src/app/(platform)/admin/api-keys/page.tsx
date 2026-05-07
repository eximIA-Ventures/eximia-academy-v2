import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { Activity, Key, Shield } from "lucide-react"
import { redirect } from "next/navigation"
import { ApiKeysClient } from "./_components/api-keys-client"

export default async function AdminApiKeysPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  const serviceClient = createServiceClient()

  const { data: keys } = await serviceClient
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, cors_origins, expires_at, last_used_at, is_active, created_at, updated_at",
    )
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  const allKeys = keys ?? []
  const activeKeys = allKeys.filter((k) => k.is_active)
  const recentlyUsed = allKeys.filter(
    (k) => k.last_used_at && new Date(k.last_used_at) > new Date(Date.now() - 24 * 60 * 60 * 1000),
  )

  const stats = [
    {
      icon: Key,
      title: "Total",
      value: String(allKeys.length),
      description: "Chaves criadas",
      color: "cerrado-600",
    },
    {
      icon: Shield,
      title: "Ativas",
      value: String(activeKeys.length),
      description: "Chaves ativas",
      color: "varzea",
    },
    {
      icon: Activity,
      title: "Uso recente",
      value: String(recentlyUsed.length),
      description: "Usadas nas ultimas 24h",
      color: "accent-gold",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="API Keys"
        description="Gerencie chaves de acesso para a API pública."
        accent="purple"
        backgroundImage="https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=1200&q=80"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card"
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

      <ApiKeysClient initialKeys={allKeys} />
    </div>
  )
}
