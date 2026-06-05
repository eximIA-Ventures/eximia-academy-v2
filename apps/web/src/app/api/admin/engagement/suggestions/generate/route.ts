// POST /api/admin/engagement/suggestions/generate
// Triggers suggestion generation (re-runs risk classification for the tenant
// and upserts new pending suggestions). Idempotent: already-pending cohorts
// are skipped. Returns { created, skipped }.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { generateNudgeSuggestions } from "@/lib/notifications/engine"
import { NextResponse } from "next/server"

export async function POST() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Instrutores e gestores (além de admin) operam o fluxo de sugestões: gerar,
  // aprovar e dispensar. Diretiva de produto — a aprovação de nudges é dos
  // instrutores e gestores que conhecem os alunos.
  if (!["admin", "manager", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  try {
    const result = await generateNudgeSuggestions(tenantId)
    return NextResponse.json({ created: result.created.length, skipped: result.skipped })
  } catch (err) {
    console.error("[engagement/suggestions/generate POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
