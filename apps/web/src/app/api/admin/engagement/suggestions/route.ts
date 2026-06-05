// GET /api/admin/engagement/suggestions — list pending nudge_suggestions for the tenant.
// Auth: admin | manager | instructor (role-gated server-side).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { listPendingSuggestions } from "@/lib/notifications/engine"
import { NextResponse } from "next/server"

export async function GET() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "manager", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  try {
    const suggestions = await listPendingSuggestions(tenantId)
    return NextResponse.json(suggestions)
  } catch (err) {
    console.error("[engagement/suggestions GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
