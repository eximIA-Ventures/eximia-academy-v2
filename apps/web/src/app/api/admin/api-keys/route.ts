import { generateApiKey, hashApiKey, requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createApiKeySchema } from "@eximia/shared"
import { NextResponse } from "next/server"

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
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, cors_origins, expires_at, last_used_at, is_active, created_by, created_at, updated_at",
    )
    .eq("tenant_id", profile.tenant_id)
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

/* ---------------------------------- POST ---------------------------------- */

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = createApiKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { rawKey, prefix } = generateApiKey()
  const keyHash = await hashApiKey(rawKey)

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from("api_keys")
    .insert({
      tenant_id: profile.tenant_id,
      name: parsed.data.name,
      key_prefix: prefix,
      key_hash: keyHash,
      scopes: parsed.data.scopes,
      rate_limit_rpm: parsed.data.rate_limit_rpm,
      rate_limit_rpd: parsed.data.rate_limit_rpd,
      cors_origins: parsed.data.cors_origins,
      expires_at: parsed.data.expires_at ?? null,
      created_by: profile.id,
    })
    .select(
      "id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, cors_origins, expires_at, is_active, created_at",
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return raw key ONCE — it's never stored
  return NextResponse.json({ data: { ...data, raw_key: rawKey } }, { status: 201 })
}
