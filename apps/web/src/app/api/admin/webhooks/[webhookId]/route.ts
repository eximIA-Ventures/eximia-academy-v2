import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { updateWebhookSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { webhookId } = await params
  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from("webhooks")
    .select("id, url, events, is_active, failure_count, created_at, updated_at")
    .eq("id", webhookId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 })

  return NextResponse.json({ data })
}

/* ---------------------------------- PATCH --------------------------------- */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { webhookId } = await params
  const body = await request.json()
  const parsed = updateWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from("webhooks")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", webhookId)
    .eq("tenant_id", profile.tenant_id)
    .select("id, url, events, is_active, failure_count, updated_at")
    .single()

  if (error || !data) return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 })

  return NextResponse.json({ data })
}

/* --------------------------------- DELETE --------------------------------- */

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { webhookId } = await params
  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from("webhooks")
    .delete()
    .eq("id", webhookId)
    .eq("tenant_id", profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
