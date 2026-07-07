// GET  /api/admin/engagement/templates — list all templates for the tenant.
// PATCH /api/admin/engagement/templates — update a template (id in body).
// Auth: admin | manager (templates são config do tenant; instrutores ficam fora).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type { NotificationTemplateRow } from "@/types/notifications"
import type { Role } from "@eximia/shared"
import { NextResponse } from "next/server"

const TEMPLATE_MANAGEMENT_ROLES: Role[] = ["admin", "manager"]

async function requireAdminOrManager() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return { user: null, profile: null, tenantId: null }
  // Templates (GET e PATCH) são config do tenant — admin/manager apenas.
  // Instrutores operam o fluxo de sugestões, não templates (ver canManageCampaigns
  // em admin/notifications/page.tsx). Esconder a aba na UI não basta — a rota
  // (service client, RLS bypass) é o único gate, então restringimos aqui.
  if (!hasAnyRole({ roles }, TEMPLATE_MANAGEMENT_ROLES))
    return { user: null, profile: null, tenantId: null }
  const tenantId = await resolveTenantId(profile.tenant_id)
  return { user, profile, tenantId }
}

export async function GET() {
  const { user, tenantId } = await requireAdminOrManager()
  if (!user || !tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("category")
    .order("name")

  if (error) {
    console.error("[engagement/templates GET]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// PATCH — partial update of an existing template (admin/manager write).
export async function PATCH(request: Request) {
  const { user, profile, tenantId } = await requireAdminOrManager()
  if (!user || !profile || !tenantId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Only allow safe columns — never let the client touch tenant_id, key, created_by.
  const allowed: Partial<
    Pick<
      NotificationTemplateRow,
      | "name"
      | "category"
      | "channel_inapp"
      | "channel_email"
      | "title"
      | "body_inapp"
      | "email_subject"
      | "email_html"
      | "variables"
      | "is_active"
    >
  > = {}
  if (typeof body.name === "string") allowed.name = body.name.trim()
  if (body.category) allowed.category = body.category
  if (typeof body.channel_inapp === "boolean") allowed.channel_inapp = body.channel_inapp
  if (typeof body.channel_email === "boolean") allowed.channel_email = body.channel_email
  if (typeof body.title === "string") allowed.title = body.title
  if (typeof body.body_inapp === "string") allowed.body_inapp = body.body_inapp
  if (typeof body.email_subject === "string") allowed.email_subject = body.email_subject
  if (typeof body.email_html === "string") allowed.email_html = body.email_html
  if (Array.isArray(body.variables)) allowed.variables = body.variables
  if (typeof body.is_active === "boolean") allowed.is_active = body.is_active

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from("notification_templates")
    .update(allowed)
    .eq("id", body.id)
    .eq("tenant_id", tenantId) // Never touch another tenant's template.
    .select("*")
    .single()

  if (error) {
    console.error("[engagement/templates PATCH]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
