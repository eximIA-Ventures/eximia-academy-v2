// GET /api/engagement/overview
// Engagement Center v2 (E3) — the Manager's contextual overview. Returns, ALL
// scoped to the manager's CURRENT recorte (context cookies), two blocks:
//   • cards   — the CANONICAL triage (No ritmo / Sem acesso / Atenção, exactly
//               the dashboard's three buckets) + Mensagens enviadas.
//   • suggestions — live-computed nudge suggestions for the current scope
//
// E12 Rodada 5 (item 1, achado Malouf): this route USED to reimplement its own
// risk logic (a local `SEM_ACESSO_DAYS = 14` + an "atenção" defined as `!hasSession`
// only, ignoring behind-teaching-plan) — so the SAME student could land in a
// different bucket here vs the main dashboard. It now delegates to the shared
// `computeEngagementTriage` (which reuses student-triage.ts verbatim), the ONE
// path both surfaces call. `acoesPendentes` and `taxaLeituraPct` were removed
// from the top cards (items 2 + 3); the suggestion count still drives Campanhas,
// and read-count moves into per-message detail (never a top card labelled "lido").
//
// Security trava (same order as api/analytics/manager/nudge/route.ts):
//   1. AUTH     — getAuthProfile; only admin/manager/instructor may read.
//   2. RE-SCOPE — resolveEngagementScope with the AUTHENTICATED client resolves
//                 allowedStudentIds (null=admin tenant-wide, []=fail-closed).
//   3. QUERY    — every read is intersected with allowedStudentIds; a student
//                 outside the scope can never appear in a card count or a
//                 suggestion.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { readFocusParam, resolveEngagementScope } from "@/lib/notifications/engagement-scope"
import { computeEngagementTriage } from "@/lib/notifications/engagement-triage"
import { generateNudgeSuggestions } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

// `request` is REQUIRED: Next 15.5's route-type check demands the exported
// handler's first arg be `Request | NextRequest`. An optional OR defaulted param
// types as `Request | undefined` and is rejected at build time. Production passes
// the real Request; the scope unit tests pass a synthetic Request explicitly.
export async function GET(request: Request) {
  // 1. AUTH — staff only. tenant resolved server-side.
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  // 2. RE-SCOPE — resolve the current recorte with the AUTHENTICATED client.
  // Rodada 3: honour the drill-down `?focus=` node so the cards + suggestions
  // reflect the SAME node the /engagement page shows (page and API can never
  // disagree). A forged focus can only narrow (resolveEngagementScope gate).
  const { supabase } = await getAuthProfile()
  const focus = request ? readFocusParam(request) : null
  const allowedStudentIds = await resolveEngagementScope(supabase, tenantId, user.id, roles, focus)

  const svc = createServiceClient()
  const now = Date.now()

  // Helper: scope a recipient/student id against allowedStudentIds.
  const inScope = (id: string | null | undefined): boolean =>
    allowedStudentIds === null || (id != null && new Set(allowedStudentIds).has(id))
  const scopeSet = allowedStudentIds === null ? null : new Set(allowedStudentIds)

  // --- CARDS ---------------------------------------------------------------
  // CANONICAL triage (No ritmo / Sem acesso / Atenção) via the SHARED helper —
  // the SAME taxonomy the dashboard uses (item 1). "Mensagens enviadas" is the
  // channel metric the dashboard doesn't have, kept as an extra card (item 3).
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

  // --- SUGGESTIONS (live-computed for the current scope) -------------------
  // Passing managerId enables the per-manager 7-day dismissal suppression (E2).
  // For an admin (null scope) no manager stamp is applied.
  // E12 item 2 (achado Taleb): the suggestion engine degrades to empty on
  // failure. That is INTENTIONAL (the cards must still render), but the failure
  // must NOT be silent — the console.error below preserves the error signal even
  // now that the "Ações pendentes" top card (which was the only place it leaked)
  // has been removed. A monitor/log picks it up instead of a reassuring green 0.
  let suggestions: Awaited<ReturnType<typeof generateNudgeSuggestions>>["created"] = []
  try {
    const managerId = roles.includes("manager") ? user.id : null
    const result = await generateNudgeSuggestions(tenantId, allowedStudentIds, managerId)
    suggestions = result.created
  } catch (err) {
    console.error("[engagement/overview] suggestion generation failed:", err)
    // Cards still return; suggestions degrade to empty rather than failing the page.
  }

  return NextResponse.json({
    scope: {
      tenantWide: allowedStudentIds === null,
      studentCount: scopeSet === null ? null : scopeSet.size,
    },
    cards: {
      analisados: triage.summary.analisados,
      noRitmo: triage.summary.noRitmo,
      semAcesso: triage.summary.semAcesso,
      atencao: triage.summary.atencao,
      noRitmoPct: triage.summary.noRitmoPct,
      semAcessoPct: triage.summary.semAcessoPct,
      atencaoPct: triage.summary.atencaoPct,
      mensagensEnviadas,
    },
    suggestions,
  })
}
