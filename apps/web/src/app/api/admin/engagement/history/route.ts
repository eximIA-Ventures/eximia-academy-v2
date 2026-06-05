// GET /api/admin/engagement/history
// Returns the last N notifications (all channels, admin view) with recipient info
// and efficacy (returned_at), plus per-type efficacy stats.
// Query params: limit (default 50, max 200), origin (optional filter).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { nudgeEfficacyByType } from "@/lib/notifications/efficacy"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "manager", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  const url = new URL(request.url)
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "50")
  const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 50 : limitRaw, 1), 200)
  const originFilter = url.searchParams.get("origin")

  const db = createServiceClient()

  // Notifications query (admin reads all channels for their tenant).
  let query = db
    .from("notifications")
    .select(
      "id, recipient_id, template_id, channel, origin, title, body, status, created_at, sent_at, read_at, acted_at, returned_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (originFilter && ["nudge", "manual", "system"].includes(originFilter)) {
    query = query.eq("origin", originFilter)
  }

  const { data: rows, error } = await query
  if (error) {
    console.error("[engagement/history GET]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with recipient display name (bulk join in memory — max 200 rows).
  const recipientIds = [
    ...new Set((rows ?? []).map((r: { recipient_id: string }) => r.recipient_id)),
  ]
  const recipientMap: Record<string, { full_name: string | null; email: string | null }> = {}
  if (recipientIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .in("id", recipientIds)
    for (const u of users ?? []) {
      recipientMap[u.id as string] = {
        full_name: u.full_name as string | null,
        email: u.email as string | null,
      }
    }
  }

  const enriched = (rows ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    recipient_name: recipientMap[r.recipient_id as string]?.full_name ?? null,
    recipient_email: recipientMap[r.recipient_id as string]?.email ?? null,
  }))

  // Per-type efficacy stats for the admin dashboard.
  const efficacy = await nudgeEfficacyByType(tenantId)

  return NextResponse.json({ notifications: enriched, efficacy })
}
