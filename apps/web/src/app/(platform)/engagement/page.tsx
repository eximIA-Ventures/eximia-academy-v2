// ---------------------------------------------------------------------------
// Engagement Center v2 — /engagement page shell (E4).
// ---------------------------------------------------------------------------
// SERVER COMPONENT. Resolves the manager's current recorte and the summary
// cards server-side, then hands typed props to the client shell. Mirrors the
// context/scope resolution of analytics/page.tsx (same cookies, same
// area-context helpers) via the SHARED resolveEngagementScope helper (E3) — the
// EXACT same scope the GET /api/engagement/overview route uses, so the page and
// the API can never disagree about who is in the recorte (AC2 single source).
//
// Guard: admin/manager/instructor may enter; admin sees its own resolved scope
// (tenant-wide). Anyone else → /dashboard.
//
// This file (page.tsx) and engagement-shell.tsx are OWNED by E4. E5–E9 only fill
// in their own tab component; they never touch this file nor the shell.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { generateNudgeSuggestions } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"
import { EngagementShell } from "./_components/engagement-shell"
import type {
  EngagementContext,
  EngagementContextKind,
  EngagementDeepLinkAction,
  EngagementOverviewCards,
  EngagementSuggestion,
} from "./_components/types"

const ENGAGEMENT_ACCESS_ROLES: Role[] = ["admin", "manager", "instructor", "super_admin"]
const SEM_ACESSO_DAYS = 14

/**
 * Resolves the human context label + recorte name for the header pill.
 *
 * BADGE COHERENCE FIX (E12 item 1): the pill must NEVER contradict the header
 * ContextSwitcher dropdown. The dropdown's active context comes from
 * `resolveContext()` (context-resolver.ts) — which applies a fresh-state default
 * (no cookie ⇒ a manager lands on "Meu Time"). The old implementation read the
 * raw `getActiveContextCookie()` here, so in that fresh state (cookie absent) the
 * badge fell into the `organization` branch and showed "Organização" while the
 * dropdown showed "Meu Time". We now derive the active context from the SAME
 * `resolveContext()` the dropdown renders, so badge and dropdown share one source
 * of truth for WHICH context is active. The team-view sub-mode (Diretos vs
 * Hierarquia) still comes from `x-team-view`, and the tenant-wide fast-path is
 * unchanged.
 */
async function resolveContextLabels(
  roles: string[],
  tenantWide: boolean,
): Promise<{ kind: EngagementContextKind; contextLabel: string; recorteLabel: string | null }> {
  if (tenantWide) {
    return { kind: "tenant", contextLabel: "Todos", recorteLabel: "Todos os alunos" }
  }
  const isManager = roles.includes("manager")
  if (isManager) {
    // SINGLE SOURCE OF TRUTH: the same resolver that renders the header dropdown.
    // Honours the fresh-state default (no cookie ⇒ "Meu Time" for a manager), so
    // the badge can never disagree with the dropdown's active context.
    const { resolveContext } = await import("@/lib/context-resolver")
    const { getActiveContextCookie } = await import("@/lib/context-context")
    const [{ active }, activeContext] = await Promise.all([
      resolveContext(),
      getActiveContextCookie(),
    ])
    if (active.type === "team") {
      // Sub-mode must mirror resolveEngagementScope's team branch EXACTLY so the
      // label matches the scope actually computed:
      //   • explicit team cookie present ⇒ x-team-view (Diretos/Hierarquia)
      //   • fresh-state default (no cookie, manager) ⇒ scope uses the whole
      //     subtree (getManagedTeamStudentIds includeSubtree) ⇒ "Hierarquia".
      let submode: "direct" | "hierarchy"
      if (activeContext?.type === "team") {
        const { getTeamViewMode } = await import("@/lib/team-view-context")
        submode = await getTeamViewMode()
      } else {
        submode = "hierarchy"
      }
      return submode === "hierarchy"
        ? { kind: "team-hierarchy", contextLabel: "Hierarquia", recorteLabel: "Meu Time" }
        : { kind: "team-direct", contextLabel: "Diretos", recorteLabel: "Meu Time" }
    }
    // Active context is organization (or personal, which a manager can't scope
    // engagement from) — the badge reads "Organização", agreeing with a dropdown
    // that shows "Minha Organização".
    return { kind: "organization", contextLabel: "Organização", recorteLabel: null }
  }
  // Instructor (or other scoped hat) — union by area, no team pill.
  return { kind: "organization", contextLabel: "Meu recorte", recorteLabel: null }
}

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")
  if (!hasAnyRole({ roles }, ENGAGEMENT_ACCESS_ROLES)) return redirect("/dashboard")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  // SCOPE — resolved with the AUTHENTICATED client, the SAME function the
  // overview route uses. null = tenant-wide (admin); [] = fail-closed; [ids] =
  // the exact recorte. Header pill + cards both derive from THIS single value.
  const allowedStudentIds = await resolveEngagementScope(supabase, tenantId, user.id, roles)
  const tenantWide = allowedStudentIds === null
  const scopeSet = allowedStudentIds === null ? null : new Set(allowedStudentIds)
  const inScope = (id: string | null | undefined): boolean =>
    scopeSet === null || (id != null && scopeSet.has(id))

  // CARDS — computed server-side exactly like GET /api/engagement/overview, so
  // the first paint is instant and consistent with the API (which the tabs
  // refetch from). No client-side tenant-wide math (AC3/AC8).
  const svc = createServiceClient()
  const now = Date.now()

  const [studentsRes, sessionsRes, notificationsRes] = await Promise.all([
    svc.from("users").select("id").eq("tenant_id", tenantId).eq("role", "student"),
    svc.from("sessions").select("student_id, created_at").eq("tenant_id", tenantId),
    svc
      .from("notifications")
      .select("recipient_id, status, sent_at, read_at")
      .eq("tenant_id", tenantId)
      .eq("channel", "inapp"),
  ])

  const students = ((studentsRes.data ?? []) as { id: string }[]).filter((s) => inScope(s.id))
  const sessions = (
    (sessionsRes.data ?? []) as { student_id: string; created_at: string }[]
  ).filter((s) => inScope(s.student_id))
  const notifications = (
    (notificationsRes.data ?? []) as {
      recipient_id: string
      status: string
      sent_at: string | null
      read_at: string | null
    }[]
  ).filter((n) => inScope(n.recipient_id))

  const latestByStudent = new Map<string, number>()
  const hasSession = new Set<string>()
  for (const s of sessions) {
    hasSession.add(s.student_id)
    const t = new Date(s.created_at).getTime()
    if (!Number.isNaN(t)) {
      const prev = latestByStudent.get(s.student_id)
      if (prev === undefined || t > prev) latestByStudent.set(s.student_id, t)
    }
  }

  let alunosEmAtencao = 0
  let semAcessoRecente = 0
  for (const stu of students) {
    if (!hasSession.has(stu.id)) {
      alunosEmAtencao++
      continue
    }
    const latest = latestByStudent.get(stu.id)
    if (latest !== undefined) {
      const days = Math.floor((now - latest) / 86_400_000)
      if (days > SEM_ACESSO_DAYS) semAcessoRecente++
    }
  }

  const mensagensEnviadas = notifications.filter((n) => n.sent_at != null).length
  const lidas = notifications.filter((n) => n.read_at != null).length
  const taxaLeituraPct = mensagensEnviadas > 0 ? Math.round((lidas / mensagensEnviadas) * 100) : 0

  // SUGGESTIONS — live-computed for the current scope (same as the overview
  // route). Degrades to empty on failure so the shell still renders (AC5).
  let suggestions: EngagementSuggestion[] = []
  try {
    const managerId = roles.includes("manager") ? user.id : null
    const result = await generateNudgeSuggestions(tenantId, allowedStudentIds, managerId)
    suggestions = (result.created ?? []).map((s) => ({
      id: s.id,
      type: s.type,
      targetStudentIds: s.target_student_ids ?? [],
      templateKey: s.template_key ?? null,
      rationale: s.rationale ?? null,
      status: s.status,
      managerId: s.manager_id ?? null,
    }))
  } catch (err) {
    console.error("[engagement/page] suggestion generation failed:", err)
  }

  const cards: EngagementOverviewCards = {
    acoesPendentes: suggestions.length,
    alunosEmAtencao,
    semAcessoRecente,
    mensagensEnviadas,
    taxaLeituraPct,
  }

  const { kind, contextLabel, recorteLabel } = await resolveContextLabels(roles, tenantWide)
  const context: EngagementContext = {
    kind,
    contextLabel,
    recorteLabel,
    analyzedCount: scopeSet === null ? null : scopeSet.size,
    tenantWide,
  }

  // Central de Envios deep-link (E10 table bridge): ?student=<uuid>&action=<remind|
  // activate|recognize>. The server only validates the SHAPE here; E3's action
  // route re-scopes on dispatch, so a foreign student can never be messaged.
  const initialStudentId =
    typeof params.student === "string" && params.student ? params.student : null
  const initialAction: EngagementDeepLinkAction | null =
    params.action === "remind" || params.action === "activate" || params.action === "recognize"
      ? params.action
      : null

  // Permission split (mirrors admin/notifications/page.tsx): individual actions
  // + dismiss are admin/manager/instructor; campaigns + template edit are
  // admin/manager only. Uses the union of hats, not the singular profile.role.
  const canAct = hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])
  const canManageCampaigns = hasAnyRole({ roles }, ["admin", "manager", "super_admin"])

  const managerName =
    roles.includes("manager") && !tenantWide
      ? ((profile as { full_name?: string | null }).full_name ?? null)
      : null

  return (
    <EngagementShell
      context={context}
      cards={cards}
      suggestions={suggestions}
      senderOptions={{
        defaultIdentity: managerName ? "manager" : "platform",
        managerName,
      }}
      canAct={canAct}
      canManageCampaigns={canManageCampaigns}
      initialStudentId={initialStudentId}
      initialAction={initialAction}
    />
  )
}
