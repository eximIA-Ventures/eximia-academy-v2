import { requireAdmin } from "@/lib/api-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { signPayload } from "@/lib/webhooks"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { webhookId } = await params
  const serviceClient = createServiceClient()

  const { data: webhook } = await serviceClient
    .from("webhooks")
    .select("id, url, secret")
    .eq("id", webhookId)
    .eq("tenant_id", profile.tenant_id)
    .single()

  if (!webhook) return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 })

  const testPayload = JSON.stringify({
    event: "test.ping",
    timestamp: new Date().toISOString(),
    data: { message: "Test delivery from exímIA Academy" },
  })

  const signature = await signPayload(testPayload, webhook.secret)

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "test.ping",
      },
      body: testPayload,
      signal: AbortSignal.timeout(10000),
    })

    return NextResponse.json({
      success: response.ok,
      status_code: response.status,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Falha na conexão",
    })
  }
}
