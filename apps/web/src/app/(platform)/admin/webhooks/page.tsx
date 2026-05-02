import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { AlertTriangle, CheckCircle, Webhook } from "lucide-react"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { WebhooksClient } from "./_components/webhooks-client"

export default async function AdminWebhooksPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return tenantRedirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return tenantRedirect("/dashboard")

  const serviceClient = createServiceClient()

  const { data: hooks } = await serviceClient
    .from("webhooks")
    .select("id, url, events, is_active, failure_count, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  const allHooks = hooks ?? []
  const activeHooks = allHooks.filter((h) => h.is_active)
  const failingHooks = allHooks.filter((h) => h.failure_count > 0)

  const stats = [
    {
      icon: Webhook,
      title: "Total",
      value: String(allHooks.length),
      description: "Webhooks configurados",
      color: "accent-blue-mid",
    },
    {
      icon: CheckCircle,
      title: "Ativos",
      value: String(activeHooks.length),
      description: "Webhooks ativos",
      color: "accent-teal",
    },
    {
      icon: AlertTriangle,
      title: "Com falhas",
      value: String(failingHooks.length),
      description: "Webhooks com erros",
      color: "accent-gold",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Webhooks"
        description="Configure notificações automáticas para eventos da plataforma."
        accent="blue"
        backgroundImage="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
      />

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

      <WebhooksClient initialWebhooks={allHooks} />
    </div>
  )
}
