import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Determine which user's data to export
  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("userId")

  // Fetch caller's profile
  const { data: callerProfile } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!callerProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 })
  }

  let exportUserId = user.id

  // If admin is exporting on behalf of another user
  if (targetUserId && targetUserId !== user.id) {
    if (callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem exportar dados de outros usuários." },
        { status: 403 },
      )
    }

    // Verify target user belongs to the same tenant
    const { data: targetProfile } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("id", targetUserId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Usuário alvo não encontrado." }, { status: 404 })
    }

    if (targetProfile.tenant_id !== callerProfile.tenant_id) {
      return NextResponse.json(
        { error: "Usuário alvo não pertence ao mesmo tenant." },
        { status: 403 },
      )
    }

    exportUserId = targetUserId
  }

  // Fetch all user data for LGPD export
  const [userResult, enrollmentsResult, sessionsResult] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, tenant_id, email, full_name, role, status, avatar_url, profile, onboarding_completed, created_at, updated_at",
      )
      .eq("id", exportUserId)
      .single(),
    supabase
      .from("enrollments")
      .select("id, course_id, tenant_id, status, progress, created_at, updated_at")
      .eq("student_id", exportUserId),
    supabase
      .from("sessions")
      .select(
        "id, chapter_id, question_id, tenant_id, status, interactions_remaining, turn_number, created_at, updated_at",
      )
      .eq("student_id", exportUserId),
  ])

  // Fetch messages and analyses linked to the user's sessions
  const sessionIds = (sessionsResult.data ?? []).map((s) => s.id)

  let messagesData: Array<Record<string, unknown>> = []
  let analysesData: Array<Record<string, unknown>> = []

  if (sessionIds.length > 0) {
    const [messagesResult, analysesResult] = await Promise.all([
      supabase
        .from("messages")
        .select("id, session_id, tenant_id, role, content, turn_number, created_at")
        .in("session_id", sessionIds),
      supabase
        .from("analyses")
        .select("id, message_id, session_id, tenant_id, ai_detection, metrics, flags, created_at")
        .in("session_id", sessionIds),
    ])

    messagesData = (messagesResult.data ?? []) as Array<Record<string, unknown>>
    analysesData = (analysesResult.data ?? []) as Array<Record<string, unknown>>
  }

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user: userResult.data,
    enrollments: enrollmentsResult.data ?? [],
    sessions: sessionsResult.data ?? [],
    messages: messagesData,
    analyses: analysesData,
  }

  // Audit log — durable trail for LGPD compliance
  await supabase.from("platform_audit_log").insert({
    actor_id: user.id,
    action: "privacy_export",
    target_type: "user",
    target_id: exportUserId,
    details: {
      caller_id: user.id,
      tenant_id: callerProfile.tenant_id,
    },
  }).then(({ error }) => {
    if (error) {
      console.error("[audit] Failed to log privacy export:", error.message)
    }
  })

  return NextResponse.json(exportPayload)
}
