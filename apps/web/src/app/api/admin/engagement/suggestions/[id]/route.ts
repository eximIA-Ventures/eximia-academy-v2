// PATCH /api/admin/engagement/suggestions/[id]
// Body: { action: "approve" | "dismiss" }
// Approves or dismisses a pending nudge suggestion.

import { resolveCallerStudentScope } from "@/lib/area-context"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { approveSuggestion, dismissSuggestion } from "@/lib/notifications/engine"
import { hasAnyRole } from "@/lib/role-helpers"
import { NextResponse } from "next/server"

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: suggestionId } = await params

  const { user, profile, roles, supabase } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Aprovação/dispensa de sugestões liberada para instrutores e gestores (além
  // de admin) — eles conhecem os alunos e decidem quais nudges disparar.
  if (!hasAnyRole({ roles }, ["admin", "manager", "instructor", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  const body = await request.json().catch(() => null)
  const action = body?.action as string | undefined
  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be 'approve' or 'dismiss'" }, { status: 400 })
  }

  try {
    if (action === "approve") {
      // NON-LEAKAGE TRAVA (app-layer): approve DISPATCHES notifications/emails to
      // the suggestion's target students — a tenant-wide cohort. Scope the dispatch
      // to the caller's own reach so a manager/instructor cannot notify students
      // outside their team/area; out-of-scope targets become recipientsSkipped.
      // admin/super_admin → null (tenant-wide, unchanged). The subtree branch reads
      // auth.uid(), so the AUTHENTICATED `supabase` client is required here.
      const scope = await resolveCallerStudentScope(supabase, tenantId, user.id, roles)
      const result = await approveSuggestion({
        tenantId,
        suggestionId,
        approvedBy: user.id,
        allowedStudentIds: scope,
      })
      return NextResponse.json(result)
    }
    // dismiss does NOT dispatch — no scope filter needed (the engine only flips
    // the suggestion status, tenant-scoped, without reaching any student).
    const result = await dismissSuggestion({
      tenantId,
      suggestionId,
      dismissedBy: user.id,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error(`[engagement/suggestions/${suggestionId} PATCH]`, err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
