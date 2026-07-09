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
  EngagementOverviewCards,
  EngagementSuggestion,
} from "./_components/types"

const ENGAGEMENT_ACCESS_ROLES: Role[] = ["admin", "manager", "instructor", "super_admin"]
const SEM_ACESSO_DAYS = 14

/**
 * Resolves the human context label + recorte name for the header pill. Reads the
 * SAME cookies analytics/page.tsx uses (x-active-context + x-team-view). For a
 * manager in the team context, the pill reads "Meu Time" with a "Diretos" or
 * "Hierarquia" sub-label; admins are tenant-wide ("Todos").
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
    const { getActiveContextCookie } = await import("@/lib/context-context")
    const { getTeamViewMode } = await import("@/lib/team-view-context")
    const activeContext = await getActiveContextCookie()
    if (activeContext?.type === "team") {
      const teamViewMode = await getTeamViewMode()
      return teamViewMode === "hierarchy"
        ? { kind: "team-hierarchy", contextLabel: "Hierarquia", recorteLabel: "Meu Time" }
        : { kind: "team-direct", contextLabel: "Diretos", recorteLabel: "Meu Time" }
    }
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

  // Sheet deep-link (E6/E10): ?student=<uuid>&action=<remind|activate>. The
  // server only validates the SHAPE here; E3's action route re-scopes on
  // dispatch, so a foreign student can never actually be messaged.
  const initialStudentId =
    typeof params.student === "string" && params.student ? params.student : null
  const initialAction =
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
