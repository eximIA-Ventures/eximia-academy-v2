// POST /api/admin/engagement/campaign
// Manual campaign: choose an audience (criteria or saved audience_id) + template_key,
// resolve recipients server-side, and dispatch in-app + optional email.
// Body: { audienceId?: string, criteria?: NotificationAudienceCriteria, templateKey: string }
// Auth: admin | manager.

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { buildNotificationEmail } from "@/lib/email-template"
import { resolveAudience } from "@/lib/notifications/audiences"
import { firstNameOf, renderTemplate, renderTemplateString } from "@/lib/notifications/engine"
import { createServiceClient } from "@/lib/supabase/service"
import type { NotificationAudienceCriteria, NotificationTemplateRow } from "@/types/notifications"
import { NextResponse } from "next/server"

const RESEND_FROM = "eximIA Academy <noreply@eximiaventures.com.br>"

async function sendEmailViaResend(params: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

  const body = await request.json().catch(() => null)
  const { audienceId, criteria, templateKey } = body ?? {}

  if (!templateKey || typeof templateKey !== "string") {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 })
  }

  const db = createServiceClient()

  // Resolve criteria: either from a saved audience_id or from the passed criteria object.
  let effectiveCriteria: NotificationAudienceCriteria = {}
  if (audienceId && typeof audienceId === "string") {
    const { data: aud } = await db
      .from("notification_audiences")
      .select("criteria")
      .eq("id", audienceId)
      .eq("tenant_id", tenantId)
      .single()
    if (!aud) return NextResponse.json({ error: "Audience not found" }, { status: 404 })
    effectiveCriteria = (aud.criteria as NotificationAudienceCriteria) ?? {}
  } else if (criteria && typeof criteria === "object" && !Array.isArray(criteria)) {
    effectiveCriteria = criteria as NotificationAudienceCriteria
  } else {
    return NextResponse.json({ error: "Provide audienceId or criteria" }, { status: 400 })
  }

  // Resolve recipient ids (server-side, tenant-scoped, role=student only).
  const recipientIds = await resolveAudience(effectiveCriteria, tenantId)
  if (recipientIds.length === 0) {
    return NextResponse.json({ error: "No eligible recipients for this audience" }, { status: 400 })
  }

  // Load + validate the template.
  const { data: tplRow, error: tplErr } = await db
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("key", templateKey)
    .single()
  if (tplErr || !tplRow) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }
  const template = tplRow as NotificationTemplateRow
  if (!template.is_active) {
    return NextResponse.json({ error: "Template is inactive" }, { status: 400 })
  }

  // Re-fetch recipients scoped to tenant (students only — same guard as engine.ts).
  const { data: students } = await db
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
    .in("id", recipientIds)
  const validStudents = (students ?? []) as {
    id: string
    full_name: string | null
    email: string | null
  }[]

  // Resolve {{curso}} if template uses it.
  let courseName: string | null = null
  if (template.variables.includes("curso")) {
    const { data: c } = await db
      .from("courses")
      .select("title")
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .order("created_at", { ascending: true })
      .limit(1)
    courseName = (c?.[0]?.title as string | undefined) ?? null
  }

  const nowIso = new Date().toISOString()
  let inAppCreated = 0
  let emailsSent = 0
  let emailsFailed = 0
  let emailRowsFailed = 0

  for (const student of validStudents) {
    const vars = {
      primeiro_nome: firstNameOf(student.full_name),
      ...(courseName ? { curso: courseName } : {}),
    }
    const rendered = renderTemplate(template, vars)

    // In-app row.
    const { error: inErr } = await db.from("notifications").insert({
      tenant_id: tenantId,
      recipient_id: student.id,
      template_id: template.id,
      channel: "inapp",
      origin: "manual",
      title: rendered.title,
      body: rendered.bodyInapp,
      cta_url: null,
      context: { campaign_audience_id: audienceId ?? null },
      status: "sent",
      sent_at: nowIso,
    })
    if (!inErr) inAppCreated++

    // Email mirror.
    if (template.channel_email && student.email) {
      const fallbackHtml = buildNotificationEmail({
        subject: rendered.emailSubject || rendered.title,
        body: renderTemplateString(template.body_inapp, vars) || "",
        senderName: template.name,
      })
      const ok = await sendEmailViaResend({
        to: student.email,
        subject: rendered.emailSubject || rendered.title,
        html: rendered.emailHtml || fallbackHtml,
      })
      if (ok) emailsSent++
      else emailsFailed++

      const { error: emailRowErr } = await db.from("notifications").insert({
        tenant_id: tenantId,
        recipient_id: student.id,
        template_id: template.id,
        channel: "email",
        origin: "manual",
        title: rendered.emailSubject || rendered.title,
        body: rendered.emailHtml || fallbackHtml,
        cta_url: null,
        context: { campaign_audience_id: audienceId ?? null },
        status: ok ? "sent" : "queued",
        sent_at: ok ? nowIso : null,
      })
      if (emailRowErr) emailRowsFailed++
    }
  }

  return NextResponse.json({
    inAppCreated,
    emailsSent,
    emailsFailed,
    emailRowsFailed,
    recipientsSkipped: validStudents.length - inAppCreated,
    total: validStudents.length,
  })
}
