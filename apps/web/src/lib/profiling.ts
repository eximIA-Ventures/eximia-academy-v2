import { runProfiler } from "@eximia/agents"
import type { AILearningProfile } from "@eximia/shared"
import { createServiceClient } from "@/lib/supabase/service"

export async function triggerProfiling(
  sessionId: string,
  studentId: string,
  _tenantId: string,
): Promise<void> {
  const serviceClient = createServiceClient()

  // 1. Load session messages
  const { data: messages } = await serviceClient
    .from("messages")
    .select("role, content, turn_number")
    .eq("session_id", sessionId)
    .order("turn_number", { ascending: true })
    .order("created_at", { ascending: true })

  if (!messages || messages.length < 4) return // min 2 user + 2 assistant

  // 2. Load session context (question)
  const { data: session } = await serviceClient
    .from("sessions")
    .select("*, question:questions(text, skill, intention, expected_depth)")
    .eq("id", sessionId)
    .single()

  if (!session) return

  // 3. Load QA reports for this session
  const { data: qaReports } = await serviceClient
    .from("qa_reports")
    .select("score, verdict")
    .eq("session_id", sessionId)

  // 4. Load existing AI profile + session count
  const { data: userData } = await serviceClient
    .from("users")
    .select("profile")
    .eq("id", studentId)
    .single()

  const existingProfile =
    (userData?.profile as Record<string, unknown>)?.ai_learning_profile ?? null

  const { count: sessionCount } = await serviceClient
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "completed")
    .neq("id", sessionId)

  // 5. Run Profiler
  const question = session.question as {
    text: string
    skill?: "aplicacao" | "analise" | "sintese" | "reflexao"
    intention?: string
    expected_depth?: string
  }

  const profilerOutput = await runProfiler({
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      turn_number: m.turn_number,
    })),
    question,
    qaScores: (qaReports ?? []).map((r) => ({
      score: Number(r.score),
      verdict: r.verdict as "APPROVED" | "REJECTED",
    })),
    existingProfile: existingProfile as AILearningProfile | null,
    sessionCount: sessionCount ?? 0,
  })

  // 6. Merge into profile JSONB (atomic — no race condition)
  const existingAiProfile = existingProfile as AILearningProfile | null
  const profileWithMeta = {
    ...profilerOutput,
    sessions_analyzed: existingAiProfile?.sessions_analyzed
      ? existingAiProfile.sessions_analyzed + 1
      : 1,
    last_updated: new Date().toISOString(),
    version: 1,
  }

  const { error: mergeError } = await serviceClient.rpc("jsonb_profile_merge", {
    p_user_id: studentId,
    p_set_key: "ai_learning_profile",
    p_set_value: JSON.stringify(profileWithMeta),
  })

  if (mergeError) throw mergeError
}
