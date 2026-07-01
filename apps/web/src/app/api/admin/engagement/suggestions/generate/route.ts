// POST /api/admin/engagement/suggestions/generate
// Triggers suggestion generation (re-runs risk classification for the tenant
// and upserts new pending suggestions). Idempotent: already-pending cohorts
// are skipped. Returns { created, skipped }.

import { resolveCallerStudentScope } from "@/lib/area-context"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { generateNudgeSuggestions } from "@/lib/notifications/engine"
import { NextResponse } from "next/server"

export async function POST() {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Instrutores e gestores (além de admin) operam o fluxo de sugestões: gerar,
  // aprovar e dispensar. Diretiva de produto — a aprovação de nudges é dos
  // instrutores e gestores que conhecem os alunos.
  if (!["admin", "manager", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  // NON-LEAKAGE TRAVA (app-layer, same philosophy as campaign / manager-nudge):
  // generation classifies the tenant ROSTER into cohorts, which is tenant-wide.
  // For a manager/instructor that would surface — and let them approve+dispatch —
  // suggestions for students OUTSIDE their reach. Resolve the caller's student
  // universe and pass it as the intersection filter. admin/super_admin → null
  // (tenant-wide, unchanged). Non-admin with no team/area → [] (fail-closed:
  // zero cohorts). The subtree branch reads auth.uid(), so the AUTHENTICATED
  // `supabase` client (not the service client) is required here.
  const scope = await resolveCallerStudentScope(supabase, tenantId, user.id, profile.role)

  try {
    const result = await generateNudgeSuggestions(tenantId, scope)
    return NextResponse.json({ created: result.created.length, skipped: result.skipped })
  } catch (err) {
    console.error("[engagement/suggestions/generate POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
