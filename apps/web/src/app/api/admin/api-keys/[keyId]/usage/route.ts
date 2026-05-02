import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { keyId } = await params
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200)

  const serviceClient = createServiceClient()

  // Verify ownership
  const { data: key } = await serviceClient
    .from("api_keys")
    .select("id")
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (!key) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 })

  let query = serviceClient
    .from("api_key_usage_log")
    .select("id, method, path, status_code, response_time_ms, ip_address, created_at")
    .eq("api_key_id", keyId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hasMore = data && data.length > limit
  const items = hasMore ? data.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

  return NextResponse.json({ data: items, nextCursor })
}
