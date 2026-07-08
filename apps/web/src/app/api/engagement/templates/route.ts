// GET /api/engagement/templates
// Engagement Center v2 (E3) — list the tenant's active templates with the human
// intent/tone/name fields (never the raw technical key as primary info). No
// student-scope applies (templates are tenant-level, not per-student), but the
// read is tenant-scoped and role-gated (admin/manager, mirroring nt_write RLS).

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { createServiceClient } from "@/lib/supabase/service"
import type { NotificationTemplateRow } from "@/types/notifications"
import { NextResponse } from "next/server"

export async function GET() {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Read allowed for admin/manager (nt_select also allows instructor/teacher, but
  // template EDIT is admin/manager; keep the read aligned to the manager surface).
  if (!hasAnyRole({ roles }, ["admin", "manager", "super_admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from("notification_templates")
    .select(
      "id, key, name, category, channel_inapp, channel_email, title, body_inapp, email_subject, email_html, variables, intent, tone, is_active",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("intent", { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const templates = ((data ?? []) as Partial<NotificationTemplateRow>[]).map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    category: t.category,
    channelInapp: t.channel_inapp,
    channelEmail: t.channel_email,
    title: t.title,
    bodyInapp: t.body_inapp,
    emailSubject: t.email_subject,
    emailHtml: t.email_html,
    variables: t.variables,
    intent: t.intent ?? null,
    tone: t.tone ?? null,
  }))

  return NextResponse.json({ templates })
}
