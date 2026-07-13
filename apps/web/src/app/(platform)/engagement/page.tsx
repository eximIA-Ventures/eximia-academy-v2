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
import { computeEngagementTriage } from "@/lib/notifications/engagement-triage"
import { generateNudgeSuggestions } from "@/lib/notifications/engine"
import { resolveDrilldownNav } from "@/lib/org-tree"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import { getTeamViewMode } from "@/lib/team-view-context"
import type { Role } from "@eximia/shared"
import { redirect } from "next/navigation"
import { EngagementShell } from "./_components/engagement-shell"
import type {
  EngagementContext,
  EngagementContextKind,
  EngagementDeepLinkAction,
  EngagementOverviewCards,
  EngagementSuggestion,
  EngagementTeamScope,
} from "./_components/types"

const ENGAGEMENT_ACCESS_ROLES: Role[] = ["admin", "manager", "instructor", "super_admin"]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    // `activeContext` is no longer read here — the sub-mode comes from the SAME
    // x-team-view cookie that resolveEngagementScope reads, unconditionally.
    void activeContext
    if (active.type === "team") {
      // Sub-mode mirrors resolveEngagementScope's team branch EXACTLY so the
      // label matches the scope actually computed. RODADA 3 FIX (Hugo 2026-07-09):
      // the fresh state (no x-team-view cookie) now means DIRETOS/"Meu Time", NOT
      // Hierarquia — getTeamViewMode() already defaults to "direct", so we simply
      // honour it in every case. The old code forced "hierarchy" whenever the
      // active-context cookie was absent, which is exactly why a manager landing
      // fresh fell into the flattened whole-subtree by default.
      const { getTeamViewMode } = await import("@/lib/team-view-context")
      const submode = await getTeamViewMode()
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

  // DRILL-DOWN focus (Rodada 3, 2026-07-09): `?focus=<uuid>` is the node the
  // manager has drilled INTO within the Hierarquia tree. Only a well-formed UUID
  // is passed downstream; resolveEngagementScope gates it against the caller's
  // own subtree (a forged/out-of-scope node collapses to the manager's root and
  // can only narrow — never widen). Mirrors analytics/page.tsx's E9 wiring.
  const requestedFocus =
    typeof params.focus === "string" && UUID_RE.test(params.focus) ? params.focus : null

  // SCOPE — resolved with the AUTHENTICATED client, the SAME function the
  // overview route uses. null = tenant-wide (admin); [] = fail-closed; [ids] =
  // the exact recorte. Header pill + cards both derive from THIS single value.
  // The `?focus=` node flows in so the page recorte matches the tab refetches
  // (which now carry `?focus=` too) — page and API can never disagree (AC2).
  const allowedStudentIds = await resolveEngagementScope(
    supabase,
    tenantId,
    user.id,
    roles,
    requestedFocus,
  )
  const tenantWide = allowedStudentIds === null
  const scopeSet = allowedStudentIds === null ? null : new Set(allowedStudentIds)
  const inScope = (id: string | null | undefined): boolean =>
    scopeSet === null || (id != null && scopeSet.has(id))

  // CARDS — computed server-side exactly like GET /api/engagement/overview, so
  // the first paint is instant and consistent with the API (which the tabs
  // refetch from). No client-side tenant-wide math (AC3/AC8).
  //
  // E12 Rodada 5 (item 1): the triage buckets come from the SHARED
  // computeEngagementTriage helper (canonical student-triage.ts taxonomy), the
  // SAME path the overview route uses — page and API can never disagree, and the
  // /engagement cards match the dashboard's cards for the same student.
  const svc = createServiceClient()
  const now = Date.now()

  const [triage, notificationsRes] = await Promise.all([
    computeEngagementTriage(svc, tenantId, allowedStudentIds, now),
    svc
      .from("notifications")
      .select("recipient_id, sent_at")
      .eq("tenant_id", tenantId)
      .eq("channel", "inapp"),
  ])

  const notifications = (
    (notificationsRes.data ?? []) as { recipient_id: string; sent_at: string | null }[]
  ).filter((n) => inScope(n.recipient_id))
  const mensagensEnviadas = notifications.filter((n) => n.sent_at != null).length

  // SUGGESTIONS — the current scope's PENDING cohorts.
  //
  // BUG FIX (2026-07-09, dado real Cory): the page used to render ONLY the rows
  // `generateNudgeSuggestions` CREATED in THIS call (`result.created`). But that
  // generator is idempotent-by-design: a 24h cadence window SKIPS every cohort
  // already generated in the last 24h, so `created` is `[]` the moment the
  // manager (or a seed) has generated once today — leaving Campanhas showing
  // "Nenhuma lista para acionar" while 5 real pending cohorts (never_accessed,
  // inactive, no_reflection, top_performer, behind_teaching_plan) sat unused in
  // the table. The generator's job is to KEEP the pending set fresh; the page's
  // job is to DISPLAY the pending set — coupling display to `created` conflated
  // the two. We now (1) run the generator for its side-effect (fill/refresh the
  // pending set), then (2) READ the current pending cohorts of this recorte and
  // render THOSE.
  const suggestions: EngagementSuggestion[] = []
  try {
    const managerId = roles.includes("manager") ? user.id : null
    // (1) Keep the pending set fresh (idempotent; may create nothing).
    await generateNudgeSuggestions(tenantId, allowedStudentIds, managerId)

    // (2) Read the PENDING cohorts for the current recorte. A manager sees the
    // suggestions stamped with THEIR manager_id plus the legacy tenant-wide
    // (manager_id IS NULL) rows; an admin (tenant-wide) sees all pending rows.
    // Newest-first so the dedup-by-type below keeps the freshest cohort.
    let pendingQuery = svc
      .from("nudge_suggestions")
      .select(
        "id, type, target_student_ids, template_key, rationale, status, manager_id, suggested_at",
      )
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("suggested_at", { ascending: false })
    if (managerId) {
      // Manager: own + legacy tenant-wide suggestions only.
      pendingQuery = pendingQuery.or(`manager_id.eq.${managerId},manager_id.is.null`)
    }
    const { data: pendingRows, error: pendingErr } = await pendingQuery
    if (pendingErr) throw pendingErr

    // Keep the freshest cohort per type (rows already newest-first).
    const seenTypes = new Set<string>()
    for (const row of (pendingRows ?? []) as {
      id: string
      type: EngagementSuggestion["type"]
      target_student_ids: string[] | null
      template_key: string | null
      rationale: string | null
      status: EngagementSuggestion["status"]
      manager_id: string | null
    }[]) {
      if (seenTypes.has(row.type)) continue
      // Re-scope the stored target ids to the CURRENT recorte — a stored cohort
      // must never surface a student who is no longer in this caller's reach
      // (defence in depth; the campaign send re-scopes again server-side).
      const scopedTargets = (row.target_student_ids ?? []).filter((id) => inScope(id))
      if (scopedTargets.length === 0) continue // empty after re-scope → hide (AC2).
      seenTypes.add(row.type)
      suggestions.push({
        id: row.id,
        type: row.type,
        targetStudentIds: scopedTargets,
        templateKey: row.template_key ?? null,
        rationale: row.rationale ?? null,
        status: row.status,
        managerId: row.manager_id ?? null,
      })
    }
  } catch (err) {
    console.error("[engagement/page] suggestion resolution failed:", err)
  }

  const cards: EngagementOverviewCards = {
    analisados: triage.summary.analisados,
    noRitmo: triage.summary.noRitmo,
    semAcesso: triage.summary.semAcesso,
    atencao: triage.summary.atencao,
    noRitmoPct: triage.summary.noRitmoPct,
    semAcessoPct: triage.summary.semAcessoPct,
    atencaoPct: triage.summary.atencaoPct,
    mensagensEnviadas,
  }

  const { kind, contextLabel, recorteLabel } = await resolveContextLabels(roles, tenantWide)
  const context: EngagementContext = {
    kind,
    contextLabel,
    recorteLabel,
    analyzedCount: scopeSet === null ? null : scopeSet.size,
    tenantWide,
  }

  // TEAM-SCOPE MODEL (Rodada 3, 2026-07-09): for a manager scoped to a team, build
  // the SAME drill-down navigation the analytics dashboard renders (TeamScopeControl):
  //   • mode      — Diretos/Hierarquia (x-team-view; the toggle the pills become)
  //   • trail     — breadcrumb root→focus (each segment sets ?focus=), gated to the
  //                 caller's own subtree via resolveDrilldownNav (auth_subtree_user_ids)
  //   • rootId    — the manager's own user id (focusing it clears ?focus)
  //   • isRoot / focusedLabel — for the breadcrumb's active-node summary
  // Only computed when the manager is genuinely in a team recorte (team-direct /
  // team-hierarchy kind). For admin tenant-wide / instructor / organization the
  // shell renders no team control (teamScope stays null), byte-for-byte unchanged.
  let teamScope: EngagementTeamScope | null = null
  if (roles.includes("manager") && (kind === "team-direct" || kind === "team-hierarchy")) {
    const teamViewMode = await getTeamViewMode()
    const nav = await resolveDrilldownNav(supabase, tenantId, user.id, requestedFocus)
    const isRoot = nav.focusUserId === user.id
    const focusedLabel = isRoot
      ? "Meu Time"
      : nav.trail[nav.trail.length - 1]?.fullName || "Subtime"
    teamScope = {
      mode: teamViewMode,
      trail: nav.trail.map((n) => ({ id: n.id, fullName: n.fullName })),
      rootId: user.id,
      isRoot,
      focusedLabel,
      subteams: nav.subteams.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        studentCount: s.studentCount,
      })),
    }
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
      teamScope={teamScope}
    />
  )
}
