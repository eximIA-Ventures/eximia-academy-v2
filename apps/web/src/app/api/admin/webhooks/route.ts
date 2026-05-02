import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createWebhookSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

function generateSecret(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100)

  const serviceClient = createServiceClient()
  let query = serviceClient
    .from("webhooks")
    .select("id, url, events, is_active, failure_count, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
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

/* ---------------------------------- POST ---------------------------------- */

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = createWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const secret = generateSecret()
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from("webhooks")
    .insert({
      tenant_id: profile.tenant_id,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
      created_by: profile.id,
    })
    .select("id, url, events, is_active, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return secret ONCE
  return NextResponse.json({ data: { ...data, secret } }, { status: 201 })
}
