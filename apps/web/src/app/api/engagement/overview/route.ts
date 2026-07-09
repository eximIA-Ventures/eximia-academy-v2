// GET /api/engagement/overview
// Engagement Center v2 (E3) — the Manager's contextual overview. Returns, ALL
// scoped to the manager's CURRENT recorte (context cookies), two blocks:
//   • cards   — Ações pendentes, Alunos em atenção, Sem acesso recente,
//               Mensagens enviadas, Taxa de leitura
//   • suggestions — live-computed nudge suggestions for the current scope
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
import { generateNudgeSuggestions } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

const SEM_ACESSO_DAYS = 14

// `request` is optional: the route is invoked with a Request in production and
// (arg-less) directly in the scope unit tests. readFocusParam tolerates undefined.
export async function GET(request?: Request) {
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
  // Alunos em atenção / sem acesso recente derive from the scoped roster
  // (sessions recency). Mensagens enviadas / taxa de leitura from notifications.
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

  let alunosEmAtencao = 0 // never accessed (in scope) — the worst state
  let semAcessoRecente = 0 // accessed but > 14d ago
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

  // --- SUGGESTIONS (live-computed for the current scope) -------------------
  // Passing managerId enables the per-manager 7-day dismissal suppression (E2).
  // For an admin (null scope) no manager stamp is applied.
  let suggestions: Awaited<ReturnType<typeof generateNudgeSuggestions>>["created"] = []
  try {
    const managerId = roles.includes("manager") ? user.id : null
    const result = await generateNudgeSuggestions(tenantId, allowedStudentIds, managerId)
    suggestions = result.created
  } catch (err) {
    console.error("[engagement/overview] suggestion generation failed:", err)
    // Cards still return; suggestions degrade to empty rather than failing the page.
  }

  const acoesPendentes = suggestions.length

  return NextResponse.json({
    scope: {
      tenantWide: allowedStudentIds === null,
      studentCount: scopeSet === null ? null : scopeSet.size,
    },
    cards: {
      acoesPendentes,
      alunosEmAtencao,
      semAcessoRecente,
      mensagensEnviadas,
      taxaLeituraPct,
    },
    suggestions,
  })
}
