import { requireSuperAdmin } from "@/lib/super-admin-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Use service client for cross-tenant queries
  const serviceClient = createServiceClient()

  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get("cursor")
    const limit = 50
    const actions = searchParams.get("action") // comma-separated
    const rawFrom = searchParams.get("from")
    const rawTo = searchParams.get("to")
    const targetType = searchParams.get("target_type")
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    const from = rawFrom && dateRe.test(rawFrom) ? rawFrom : null
    const to = rawTo && dateRe.test(rawTo) ? rawTo : null

    // Build audit log query
    let query = serviceClient
      .from("platform_audit_log")
      .select("id, actor_id, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt("created_at", cursor)
    }

    if (actions) {
      const actionList = actions
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
      if (actionList.length > 0) {
        query = query.in("action", actionList)
      }
    }

    if (from) {
      query = query.gte("created_at", `${from}T00:00:00.000Z`)
    }

    if (to) {
      query = query.lte("created_at", `${to}T23:59:59.999Z`)
    }

    if (targetType) {
      query = query.eq("target_type", targetType)
    }

    const { data: entries, error } = await query

    if (error) {
      console.error("Audit log query error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const hasMore = entries && entries.length > limit
    const items = hasMore ? entries.slice(0, limit) : (entries ?? [])
    const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

    // Batch-fetch actor names
    const actorIds = [...new Set(items.map((e) => e.actor_id).filter(Boolean))]
    const actorMap = new Map<string, string>()

    if (actorIds.length > 0) {
      const { data: actors } = await serviceClient
        .from("users")
        .select("id, full_name")
        .in("id", actorIds)

      for (const actor of actors ?? []) {
        actorMap.set(actor.id, actor.full_name)
      }
    }

    // Batch-fetch target names based on target_type
    const tenantTargetIds = items.filter((e) => e.target_type === "tenant").map((e) => e.target_id)
    const userTargetIds = items.filter((e) => e.target_type === "user").map((e) => e.target_id)

    const targetNameMap = new Map<string, string>()

    if (tenantTargetIds.length > 0) {
      const uniqueTenantIds = [...new Set(tenantTargetIds)]
      const { data: tenants } = await serviceClient
        .from("tenants")
        .select("id, name")
        .in("id", uniqueTenantIds)

      for (const tenant of tenants ?? []) {
        targetNameMap.set(tenant.id, tenant.name)
      }
    }

    if (userTargetIds.length > 0) {
      const uniqueUserIds = [...new Set(userTargetIds)]
      const { data: users } = await serviceClient
        .from("users")
        .select("id, full_name")
        .in("id", uniqueUserIds)

      for (const u of users ?? []) {
        targetNameMap.set(u.id, u.full_name)
      }
    }

    // Enrich entries with names
    const data = items.map((entry) => ({
      id: entry.id,
      actor_id: entry.actor_id,
      actor_name: actorMap.get(entry.actor_id) ?? "Desconhecido",
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      target_name: targetNameMap.get(entry.target_id) ?? entry.target_id,
      details: entry.details,
      created_at: entry.created_at,
    }))

    return NextResponse.json({ data, nextCursor })
  } catch (error) {
    console.error("Audit log error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
