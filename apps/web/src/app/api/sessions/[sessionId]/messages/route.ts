import { analyticsServer } from "@/lib/analytics-server"
import { DEFAULT_CHAT_MODEL, MODEL_PRICING } from "@/lib/constants/models"
import { triggerProfiling } from "@/lib/profiling"
import { setSentryContext } from "@/lib/sentry"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { orchestrateSocraticDialogue, runAnalyst, executeShadowPipeline, type OrchestratorInput } from "@eximia/agents"
import { createShadowPersistence } from "@/lib/shadow-persistence"
import { sanitizeStudentMessage } from "@eximia/shared"
import * as Sentry from "@sentry/nextjs"
import { z } from "zod"

const requestBodySchema = z.object({
  content: z.string().min(1).max(10000),
  response_time_seconds: z.number().min(0).max(3600).default(0),
})

const sessionIdSchema = z.string().uuid()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const rawSessionId = (await params).sessionId
  const parsedSessionId = sessionIdSchema.safeParse(rawSessionId)
  if (!parsedSessionId.success) {
    return new Response("Invalid session ID", { status: 400 })
  }
  const sessionId = parsedSessionId.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  setSentryContext(user.id, "", `/api/sessions/${sessionId}/messages`)

  // Parse and validate body
  let body: z.infer<typeof requestBodySchema>
  try {
    const raw = await request.json()
    body = requestBodySchema.parse(raw)
  } catch {
    return new Response("Invalid request body", { status: 400 })
  }

  // 1. Atomic claim
  const { data: turn, error: claimError } = await supabase.rpc("claim_session_turn", {
    p_session_id: sessionId,
    p_user_id: user.id,
  })
  if (claimError || !turn || turn.length === 0) {
    return new Response("Session not available", { status: 409 })
  }

  const turnData = turn[0]

  try {
    // 2. Load session context
    const { data: session } = await supabase
      .from("sessions")
      .select(
        "*, chapter:chapters(id, title, content, course_id, interaction_type, bloom_target), question:questions(id, text, skill, intention, expected_depth)",
      )
      .eq("id", sessionId)
      .single()

    if (!session) {
      throw new Error("Session not found")
    }

    Sentry.setTag("tenant_id", session.tenant_id)
    Sentry.setTag("session_id", sessionId)

    // 3. Load conversation history
    const { data: previousMessages } = await supabase
      .from("messages")
      .select("role, content, turn_number")
      .eq("session_id", sessionId)
      .order("turn_number", { ascending: true })
      .order("created_at", { ascending: true })

    // 4. Sanitize student message
    const sanitizedContent = sanitizeStudentMessage(body.content)

    // 5. Save student message — capture id for analyses/qa_reports FK
    const serviceClient = createServiceClient()
    const { data: studentMsg } = await serviceClient
      .from("messages")
      .insert({
        session_id: sessionId,
        role: "user",
        content: sanitizedContent,
        turn_number: turnData.turn_number,
        tenant_id: session.tenant_id,
      })
      .select()
      .single()

    if (!studentMsg) throw new Error("Failed to save student message")

    // 6. Run analyst in parallel (non-blocking)
    const chapter = session.chapter as {
      id: string
      title: string
      content: string
      course_id: string
      interaction_type?: string | null
      bloom_target?: string | null
    }
    const question = session.question as {
      id: string
      text: string
      skill?: string
      intention?: string
      expected_depth?: string
    }

    const analystPromise = Sentry.startSpan(
      { name: "agent.Analyst", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Analyst")
        span.setAttribute("session_id", sessionId)
        return await runAnalyst({
          student_message: sanitizedContent,
          context: {
            chapter_id: chapter.id,
            chapter_title: chapter.title,
            turn_number: turnData.turn_number,
          },
          interaction_metadata: {
            session_id: sessionId,
            timestamp: new Date().toISOString(),
            response_time_seconds: body.response_time_seconds,
          },
        })
      },
    )

    // 7a. Load student profile for personalization
    const { data: studentData } = await supabase
      .from("users")
      .select("profile")
      .eq("id", user.id)
      .single()
    const studentProfileData = (studentData?.profile as Record<string, unknown>) || {}
    const aiProfileData = studentProfileData.ai_profile as Record<string, unknown> | undefined

    const studentProfile: Record<string, unknown> = {}
    if (studentProfileData.big_five) studentProfile.big_five = studentProfileData.big_five
    if (studentProfileData.enneagram) studentProfile.enneagram = studentProfileData.enneagram
    if (studentProfileData.disc) studentProfile.disc = studentProfileData.disc
    if (studentProfileData.multiple_intelligences)
      studentProfile.multiple_intelligences = studentProfileData.multiple_intelligences
    if (aiProfileData?.learning_style) studentProfile.learning_style = aiProfileData.learning_style
    if (aiProfileData) studentProfile.ai_profile = aiProfileData
    if (studentProfileData.ai_learning_profile)
      studentProfile.ai_learning_profile = studentProfileData.ai_learning_profile

    // 7. Run pipeline
    let result: Awaited<ReturnType<typeof orchestrateSocraticDialogue>>
    try {
    result = await orchestrateSocraticDialogue({
      sessionId,
      studentMessage: sanitizedContent,
      chapterContent: chapter.content ?? "",
      question: {
        text: question.text,
        skill: question.skill ?? undefined,
        intention: question.intention ?? undefined,
        expected_depth: question.expected_depth ?? undefined,
      },
      conversationHistory: previousMessages ?? [],
      turnNumber: turnData.turn_number,
      interactionsRemaining: turnData.interactions_remaining,
      // WS2 fields (D13) — optional, backward-compatible
      ...(chapter.interaction_type ? { interactionType: chapter.interaction_type as OrchestratorInput["interactionType"] } : {}),
      ...(chapter.bloom_target ? { bloomTarget: chapter.bloom_target as OrchestratorInput["bloomTarget"] } : {}),
      ...(Object.keys(studentProfile).length > 0
        ? {
            studentProfile: studentProfile as Parameters<
              typeof orchestrateSocraticDialogue
            >[0]["studentProfile"],
          }
        : {}),
    })
    } catch (pipelineError) {
      const msg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError)
      const stack = pipelineError instanceof Error ? pipelineError.stack?.split("\n").slice(0, 8).join("\n") : undefined
      console.error("[PIPELINE STEP 7 FAILED]", msg, pipelineError)
      throw new Error(`Pipeline orchestration failed: ${msg}`)
    }

    // 7.5 Track pipeline analytics
    if (result.usage) {
      const pricing = MODEL_PRICING[DEFAULT_CHAT_MODEL as keyof typeof MODEL_PRICING] ?? MODEL_PRICING["claude-sonnet-4-5-20250929"]
      analyticsServer.pipelineCompleted(user.id, {
        total_input_tokens: result.usage.inputTokens,
        total_output_tokens: result.usage.outputTokens,
        model: DEFAULT_CHAT_MODEL,
        retry_count: result.retryCount,
        estimated_cost_usd:
          result.usage.inputTokens * pricing.inputTokenCost +
          result.usage.outputTokens * pricing.outputTokenCost,
      })
    }

    // 8. Await analyst + persist all
    const analysisResult = await analystPromise
    await Promise.all([
      serviceClient.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: result.response,
        turn_number: turnData.turn_number,
        tenant_id: session.tenant_id,
      }),
      serviceClient.from("analyses").insert({
        message_id: studentMsg.id,
        session_id: sessionId,
        ai_detection: analysisResult.aiDetection,
        metrics: analysisResult.metrics,
        flags: analysisResult.flags,
        observations: analysisResult.observations,
        tenant_id: session.tenant_id,
      }),
      serviceClient.from("qa_reports").insert({
        message_id: studentMsg.id,
        session_id: sessionId,
        verdict: result.qaReport.verdict,
        score: result.qaReport.score,
        criteria_results: result.qaReport.criteriaResults,
        recommendation: result.qaReport.recommendation,
        tenant_id: session.tenant_id,
      }),
    ])

    // 9. Determine session status after this turn
    const sessionStatus = turnData.interactions_remaining === 0 ? "completed" : "active"

    // 9.1 Persist session completion in database
    if (sessionStatus === "completed") {
      await serviceClient
        .from("sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId)
    }

    // 9.5 Fire-and-forget profiling (non-blocking, only on session completion with enough turns)
    if (sessionStatus === "completed" && turnData.turn_number >= 2) {
      triggerProfiling(sessionId, user.id, session.tenant_id).catch((err) => {
        Sentry.captureException(err, {
          tags: { agent: "Profiler", session_id: sessionId },
        })
      })
    }

    // 9.6 Fire-and-forget shadow pipeline (Detector + Perfilador, non-blocking)
    executeShadowPipeline(
      {
        sessionId,
        studentId: user.id,
        tenantId: session.tenant_id,
        studentMessage: sanitizedContent,
        tutorResponse: result.response,
        conversationHistory: previousMessages ?? [],
        chapterContent: chapter.content ?? "",
        turnNumber: turnData.turn_number,
      },
      createShadowPersistence(serviceClient),
    ).catch((err) => {
      Sentry.captureException(err, {
        tags: { pipeline: "shadow", session_id: sessionId },
      })
    })

    // 10. Stream response via DataStream protocol
    const words = result.response.split(/(\s+)/)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send data annotation first (session metadata)
        const metadata = {
          session_status: sessionStatus,
          interactions_remaining: turnData.interactions_remaining,
          turn_number: turnData.turn_number,
        }
        controller.enqueue(encoder.encode(`2:${JSON.stringify([metadata])}\n`))

        // Stream words with delay
        for (const word of words) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(word)}\n`))
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    })
  } catch (error) {
    // Error recovery: release session turn
    await supabase.rpc("release_session_turn", {
      p_session_id: sessionId,
      p_user_id: user.id,
    })
    Sentry.captureException(error, {
      tags: { session_id: sessionId, route: "sessions/messages" },
    })
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined
    console.error("Pipeline error:", errorMessage, error)
    return Response.json({ error: "Pipeline error", detail: errorMessage, stack: errorStack }, { status: 500 })
  }
}
