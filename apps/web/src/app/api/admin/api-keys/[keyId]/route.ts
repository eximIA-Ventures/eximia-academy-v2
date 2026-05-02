import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { updateApiKeySchema } from "@eximia/shared"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { keyId } = await params
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, cors_origins, expires_at, last_used_at, is_active, created_by, created_at, updated_at",
    )
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 })

  return NextResponse.json({ data })
}

/* ---------------------------------- PATCH --------------------------------- */

export async function PATCH(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { keyId } = await params
  const body = await request.json()
  const parsed = updateApiKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from("api_keys")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .select(
      "id, name, key_prefix, scopes, rate_limit_rpm, rate_limit_rpd, cors_origins, expires_at, is_active, updated_at",
    )
    .single()

  if (error || !data) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 })

  return NextResponse.json({ data })
}

/* --------------------------------- DELETE --------------------------------- */

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { keyId } = await params
  const serviceClient = createServiceClient()

  // Soft revoke: deactivate instead of hard delete
  const { data, error } = await serviceClient
    .from("api_keys")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("tenant_id", profile.tenant_id)
    .select("id, name, is_active")
    .single()

  if (error || !data) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404 })

  return NextResponse.json({ data })
}
