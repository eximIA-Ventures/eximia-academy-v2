import { buildNotificationEmail } from "@/lib/email-template"
import { resend } from "@/lib/resend"
import { createServiceClient } from "@/lib/supabase/service"
import { createClient } from "@/lib/supabase/server"
import { getTenantConfig } from "@/lib/tenant"
import { NextResponse } from "next/server"

// GET — list sent notifications
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "manager", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from("email_notifications")
    .select("id, subject, body, deadline, course_id, trail_id, recipient_count, status, sent_at, created_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — send notification email
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, full_name")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "manager", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 503 },
    )
  }

  const body = await request.json()
  const {
    subject,
    message,
    recipientIds,
    courseId,
    trailId,
    deadline,
  } = body as {
    subject: string
    message: string
    recipientIds: string[]
    courseId?: string
    trailId?: string
    deadline?: string
  }

  if (!subject?.trim() || !message?.trim() || !recipientIds?.length) {
    return NextResponse.json(
      { error: "subject, message and recipientIds are required" },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Fetch recipient emails
  const { data: recipients, error: recipientsError } = await service
    .from("users")
    .select("id, email, full_name")
    .in("id", recipientIds)
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "active")

  if (recipientsError || !recipients?.length) {
    return NextResponse.json(
      { error: "No valid recipients found" },
      { status: 400 },
    )
  }

  // Fetch course name if linked
  let courseName: string | null = null
  if (courseId) {
    const { data: course } = await service
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single()
    courseName = course?.title ?? null
  }

  // Build HTML email
  const html = buildNotificationEmail({
    subject,
    body: message,
    deadline: deadline || null,
    courseName,
    senderName: profile.full_name,
  })

  const config = getTenantConfig()
  const fromAddress = config.settings?.supportEmail
    ? `${config.brand.name} <${config.settings.supportEmail}>`
    : `${config.brand.name} <noreply@eximiaventures.com.br>`

  // Send via Resend (batch)
  try {
    const emailPromises = recipients.map((r) =>
      resend!.emails.send({
        from: fromAddress,
        to: r.email,
        subject,
        html,
      }),
    )
    const results = await Promise.allSettled(emailPromises)

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    // Save notification record
    const { error: insertError } = await service
      .from("email_notifications")
      .insert({
        sender_id: user.id,
        tenant_id: profile.tenant_id,
        subject,
        body: message,
        course_id: courseId || null,
        trail_id: trailId || null,
        deadline: deadline || null,
        recipient_count: recipients.length,
        recipients: recipients.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.full_name,
        })),
        status: failed === recipients.length ? "failed" : "sent",
        sent_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error("[notifications] Failed to save record:", insertError)
    }

    return NextResponse.json({
      sent: succeeded,
      failed,
      total: recipients.length,
    })
  } catch (err) {
    console.error("[notifications] Resend error:", err)
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 },
    )
  }
}
