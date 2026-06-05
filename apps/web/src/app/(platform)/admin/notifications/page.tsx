import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { nudgeEfficacyByType } from "@/lib/notifications/efficacy"
import { listPendingSuggestions } from "@/lib/notifications/engine"
import { createServiceClient } from "@/lib/supabase/service"
import type { NotificationTemplateRow, NudgeSuggestionRow } from "@/types/notifications"
import { redirect } from "next/navigation"
import { EngagementCenterClient } from "./_components/engagement-center-client"

export default async function EngagementCenterPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!["admin", "manager", "instructor"].includes(profile.role)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  const db = createServiceClient()

  // Parallel data load.
  const [suggestionsResult, templatesResult, historyResult, efficacyResult] =
    await Promise.allSettled([
      listPendingSuggestions(tenantId),
      db
        .from("notification_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("category")
        .order("name"),
      db
        .from("notifications")
        .select(
          "id, recipient_id, template_id, channel, origin, title, status, created_at, sent_at, read_at, acted_at, returned_at",
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(80),
      nudgeEfficacyByType(tenantId),
    ])

  const suggestions: NudgeSuggestionRow[] =
    suggestionsResult.status === "fulfilled" ? suggestionsResult.value : []
  const templates: NotificationTemplateRow[] =
    templatesResult.status === "fulfilled"
      ? ((templatesResult.value.data ?? []) as NotificationTemplateRow[])
      : []
  const historyRows = historyResult.status === "fulfilled" ? (historyResult.value.data ?? []) : []
  const efficacy = efficacyResult.status === "fulfilled" ? efficacyResult.value : []

  // Enrich history with recipient names (bulk).
  const recipientIds = [
    ...new Set((historyRows as Array<{ recipient_id: string }>).map((r) => r.recipient_id)),
  ]
  const recipientMap: Record<string, { full_name: string | null; email: string | null }> = {}
  if (recipientIds.length > 0) {
    const { data: usersData } = await db
      .from("users")
      .select("id, full_name, email")
      .in("id", recipientIds)
    for (const u of usersData ?? []) {
      recipientMap[u.id as string] = {
        full_name: u.full_name as string | null,
        email: u.email as string | null,
      }
    }
  }

  type HistoryRowEnriched = Record<string, unknown> & {
    recipient_name: string | null
    recipient_email: string | null
  }
  const history = (historyRows as Array<Record<string, unknown>>).map(
    (r): HistoryRowEnriched => ({
      ...r,
      recipient_name: recipientMap[r.recipient_id as string]?.full_name ?? null,
      recipient_email: recipientMap[r.recipient_id as string]?.email ?? null,
    }),
  )

  // Audiences for campaign tab.
  const { data: audiencesData } = await db
    .from("notification_audiences")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  // Courses + areas for campaign criteria builder.
  const { data: coursesData } = await db
    .from("courses")
    .select("id, title")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("title")

  const { data: areasData } = await db
    .from("areas")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name")

  // Permissões granulares (diretiva 2026-06-04):
  // • Sugestões (gerar/aprovar/dispensar) → admin, manager E instructor.
  // • Campanhas manuais e edição de templates → admin/manager (config sensível
  //   do tenant; instrutores ficam de fora dessas duas).
  const canManageSuggestions = ["admin", "manager", "instructor"].includes(profile.role)
  const canManageCampaigns = ["admin", "manager"].includes(profile.role)

  return (
    <EngagementCenterClient
      suggestions={suggestions}
      templates={templates}
      history={history}
      efficacy={efficacy}
      audiences={audiencesData ?? []}
      courses={coursesData ?? []}
      areas={areasData ?? []}
      canManageSuggestions={canManageSuggestions}
      canManageCampaigns={canManageCampaigns}
    />
  )
}
