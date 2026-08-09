import { adminWorldDeniedRedirect } from "@/lib/admin-world"
import { resolveCallerStudentScope } from "@/lib/area-context"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveAudience } from "@/lib/notifications/audiences"
import { type NudgeEfficacyByType, nudgeEfficacyByType } from "@/lib/notifications/efficacy"
import { listPendingSuggestions } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type {
  NotificationAudienceRow,
  NotificationTemplateRow,
  NudgeSuggestionRow,
} from "@/types/notifications"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"
import { EngagementCenterClient } from "./_components/engagement-center-client"

const ENGAGEMENT_READ_ROLES: Role[] = ["admin", "manager", "instructor"]
const HISTORY_SELECT =
  "id, recipient_id, template_id, channel, origin, title, status, created_at, sent_at, read_at, acted_at, returned_at"
const SCOPED_EFFICACY_MAX_ROWS = 50_000
const SCOPED_EFFICACY_PAGE_SIZE = 1000

type ServiceClient = ReturnType<typeof createServiceClient>

interface MetricRow {
  template_id: string | null
  returned_at: string | null
}

async function fetchScopedRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows: number,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  for (let page = 0; page < 100; page++) {
    const to = Math.min(from + SCOPED_EFFICACY_PAGE_SIZE - 1, maxRows - 1)
    if (to < from) break
    const { data, error } = await buildPage(from, to)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < SCOPED_EFFICACY_PAGE_SIZE || all.length >= maxRows) break
    from += SCOPED_EFFICACY_PAGE_SIZE
  }
  return all
}

async function nudgeEfficacyByTypeForRecipients(
  tenantId: string,
  recipientIds: string[],
  db: ServiceClient,
): Promise<NudgeEfficacyByType[]> {
  if (recipientIds.length === 0) return []

  const rows = await fetchScopedRows<MetricRow>(
    (from, to) =>
      db
        .from("notifications")
        .select("template_id, returned_at")
        .eq("tenant_id", tenantId)
        .eq("origin", "nudge")
        .eq("channel", "inapp")
        .not("sent_at", "is", null)
        .in("recipient_id", recipientIds)
        .range(from, to),
    SCOPED_EFFICACY_MAX_ROWS,
  )
  if (rows.length === 0) return []

  const templateIds = [...new Set(rows.map((r) => r.template_id).filter((t): t is string => !!t))]
  const keyById = new Map<string, string>()
  if (templateIds.length > 0) {
    const templates = await fetchScopedRows<{ id: string; key: string }>(
      (from, to) =>
        db
          .from("notification_templates")
          .select("id, key")
          .eq("tenant_id", tenantId)
          .in("id", templateIds)
          .range(from, to),
      templateIds.length,
    )
    for (const t of templates) keyById.set(t.id, t.key)
  }

  const agg = new Map<string, { sent: number; returned: number }>()
  for (const row of rows) {
    const key = row.template_id ? (keyById.get(row.template_id) ?? "") : ""
    const entry = agg.get(key) ?? { sent: 0, returned: 0 }
    entry.sent += 1
    if (row.returned_at) entry.returned += 1
    agg.set(key, entry)
  }

  return [...agg.entries()]
    .map(([key, { sent, returned }]) => ({
      templateKey: key === "" ? null : key,
      sent,
      returned,
      returnRatePct: sent > 0 ? Math.round((returned / sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent)
}

export default async function EngagementCenterPage() {
  const { user, profile, supabase, roles } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!hasAnyRole({ roles }, ENGAGEMENT_READ_ROLES)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  // EJEÇÃO RESIDUAL POR DADO AUSENTE (aresta 1 de `workspace-admin.md`). O
  // destino era `/dashboard` fixo, e `/dashboard` reescreve o cookie
  // `x-active-workspace` para `standard` (`middleware.ts`): um admin-tier JÁ
  // DENTRO do mundo administrativo que clicasse "Engajamento" sem nenhuma
  // empresa resolvível perdia o MUNDO por causa de um DADO ausente, não de um
  // papel. É a mesma classe corrigida em `/admin/tenants`, com gatilho
  // diferente, então reusa a MESMA função: admin-tier volta para `/admin` (a
  // home do mundo, W2), e para todos os demais o destino segue byte-idêntico
  // ao de antes (`/dashboard`) — ninguém perde nada.
  //
  // POR QUE REDIRECT E NÃO `TenantRequiredState` (o estado vazio do hub de
  // Configurações): esta rota também serve `manager` e `instructor`, que vivem
  // no mundo Padrão, e mostrar a eles um estado vazio de copy administrativa
  // seria mudança de comportamento não pedida. `/admin` renderiza sem tenant
  // (o `AdminDashboardSlot` cobre `tenant_id` nulo), então o redirect não é
  // beco nem laço.
  if (!tenantId) return redirect(adminWorldDeniedRedirect(roles))

  const db = createServiceClient()
  // Workspace-separation axis (WP5): the lens is retired. "Vendo como gestor"
  // is now: holds the `manager` hat AND the active context is `team`. Only the
  // source of `managerLens` changed; the readScope resolution is unchanged.
  const { getActiveContextCookie } = await import("@/lib/context-context")
  const roleUnion = roles as Role[]
  const activeCtx = await getActiveContextCookie()
  const managerLens = roleUnion.includes("manager") && activeCtx?.type === "team"
  const readScope = managerLens
    ? await resolveCallerStudentScope(supabase, tenantId, user.id, roles)
    : null
  const scopeSet = readScope ? new Set(readScope) : null

  let historyQuery = db
    .from("notifications")
    .select(HISTORY_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(80)

  if (readScope) {
    historyQuery = historyQuery.in("recipient_id", readScope)
  }

  const suggestionsPromise =
    readScope?.length === 0 ? Promise.resolve([]) : listPendingSuggestions(tenantId)
  const historyPromise =
    readScope?.length === 0 ? Promise.resolve({ data: [], error: null }) : historyQuery
  const efficacyPromise =
    readScope?.length === 0
      ? Promise.resolve([])
      : readScope
        ? nudgeEfficacyByTypeForRecipients(tenantId, readScope, db)
        : nudgeEfficacyByType(tenantId, db)

  const [suggestionsResult, templatesResult, historyResult, efficacyResult] =
    await Promise.allSettled([
      suggestionsPromise,
      db
        .from("notification_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("category")
        .order("name"),
      historyPromise,
      efficacyPromise,
    ])

  const loadedSuggestions: NudgeSuggestionRow[] =
    suggestionsResult.status === "fulfilled" ? suggestionsResult.value : []
  const suggestions = scopeSet
    ? loadedSuggestions.filter((s) => s.target_student_ids.every((id) => scopeSet.has(id)))
    : loadedSuggestions
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
  const rawAudiences = (audiencesData ?? []) as NotificationAudienceRow[]
  let audiences = rawAudiences
  if (readScope !== null) {
    if (readScope.length === 0) {
      audiences = []
    } else {
      const audienceScopeSet = new Set(readScope)
      const scopedAudiences = await Promise.all(
        rawAudiences.map(async (audience) => {
          const resolved = await resolveAudience(audience.criteria, tenantId, db)
          return resolved.length > 0 && resolved.every((id) => audienceScopeSet.has(id))
            ? audience
            : null
        }),
      )
      audiences = scopedAudiences.filter(
        (audience): audience is NotificationAudienceRow => audience !== null,
      )
    }
  }
  const clientAudiences = audiences.map((audience) => ({
    ...audience,
    criteria: audience.criteria as Record<string, unknown>,
  }))

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
  // Pelo eixo de CHAPÉUS, como o guard de leitura logo acima (que já usava
  // `hasAnyRole`). Conjuntos INALTERADOS; `super_admin` NÃO foi somado aqui de
  // propósito — não estava no conjunto antigo.
  const canManageSuggestions = hasAnyRole({ roles }, ["admin", "manager", "instructor"])
  const canManageCampaigns = hasAnyRole({ roles }, ["admin", "manager"])

  return (
    <EngagementCenterClient
      suggestions={suggestions}
      templates={templates}
      history={history}
      efficacy={efficacy}
      audiences={clientAudiences}
      courses={coursesData ?? []}
      areas={areasData ?? []}
      canManageSuggestions={canManageSuggestions}
      canManageCampaigns={canManageCampaigns}
    />
  )
}
