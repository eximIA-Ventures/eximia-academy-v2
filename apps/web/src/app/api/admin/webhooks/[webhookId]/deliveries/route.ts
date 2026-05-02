import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { webhookId } = await params
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200)

  const serviceClient = createServiceClient()

  // Verify ownership
  const { data: webhook } = await serviceClient
    .from("webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (!webhook) return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 })

  let query = serviceClient
    .from("webhook_deliveries")
    .select(
      "id, event_type, status, attempts, last_status_code, last_error, created_at, completed_at",
    )
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) query = query.lt("created_at", cursor)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasMore = data && data.length > limit
  const items = hasMore ? data.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  return NextResponse.json({ data: items, nextCursor })
}
