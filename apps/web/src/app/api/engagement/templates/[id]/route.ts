// PATCH /api/engagement/templates/[id]
// Engagement Center v2 (E3) — edit a template's editable fields (name, title,
// body, email content, tone, intent). The `key` is IMMUTABLE (it wires the
// suggestion engine → template mapping); attempts to change it are ignored.
// Role-gated admin/manager (nt_write RLS parity), tenant-scoped by id + tenant_id.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type { TemplateIntent } from "@/types/notifications"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INTENTS: ReadonlySet<TemplateIntent> = new Set<TemplateIntent>([
  "primeiro_acesso",
  "retomada",
  "atraso_plano",
  "reflexao_pendente",
  "reconhecimento",
  "manual",
])

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!hasAnyRole({ roles }, ["admin", "manager", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const src = body as Record<string, unknown>

  // Build the update from ONLY the editable, well-typed fields. `key` is never
  // accepted here (immutable). Unknown/mis-typed fields are dropped silently.
  const update: Record<string, unknown> = {}
  if (typeof src.name === "string") update.name = src.name
  if (typeof src.title === "string") update.title = src.title
  if (src.body_inapp === null || typeof src.body_inapp === "string")
    update.body_inapp = src.body_inapp
  if (src.email_subject === null || typeof src.email_subject === "string")
    update.email_subject = src.email_subject
  if (src.email_html === null || typeof src.email_html === "string")
    update.email_html = src.email_html
  if (src.tone === null || typeof src.tone === "string") update.tone = src.tone
  if (typeof src.intent === "string" && INTENTS.has(src.intent as TemplateIntent))
    update.intent = src.intent
  if (typeof src.channel_inapp === "boolean") update.channel_inapp = src.channel_inapp
  if (typeof src.channel_email === "boolean") update.channel_email = src.channel_email

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from("notification_templates")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, key, name, intent, tone")
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "Template not found or update failed" }, { status: 404 })
  }
  return NextResponse.json({ template: data })
}
