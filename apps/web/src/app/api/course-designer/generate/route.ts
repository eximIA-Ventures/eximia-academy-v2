export const maxDuration = 300 // 5 min

import { courseDesignerGenerateLimiter } from "@/lib/rate-limit"
import { setSentryContext } from "@/lib/sentry"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { dispatchEvent } from "@/lib/webhooks"
import { getModelWithFallback } from "@eximia/agents"
import {
  type DesignCourseResult,
  DesignOrchestratorAbortError,
  DesignOrchestratorTimeoutError,
  type PhaseProgress,
  designCourse,
} from "@eximia/agents/course-designer"
import { courseDesignerInputSchema } from "@eximia/course-designer"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

/**
 * POST /api/course-designer/generate
 * Starts the 5-phase Course Designer pipeline with SSE streaming.
 * Events: { phase: 1-5, status: "running"|"completed"|"failed", progress_pct: 0-100 }
 * Final: { status: "completed", blueprint_id: "uuid" } or { status: "failed", error: "..." }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  setSentryContext(user.id, profile.tenant_id, "/api/course-designer/generate")

  // Rate limit: max 3 req/10min per tenant (sliding window)
  if (courseDesignerGenerateLimiter) {
    const { success } = await courseDesignerGenerateLimiter.limit(profile.tenant_id)
    if (!success) {
      return NextResponse.json(
        { error: "Limite de geracoes atingido (max 3 a cada 10 min)" },
        { status: 429 },
      )
    }
  }

  // Validate input
  let input: ReturnType<typeof courseDesignerInputSchema.parse>
  try {
    input = courseDesignerInputSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { error: "Input inválido", details: String(err) },
      { status: 400 },
    )
  }

  // Create generation job
  const serviceClient = createServiceClient()
  const { data: job, error: jobError } = await serviceClient
    .from("blueprint_generation_jobs")
    .insert({
      tenant_id: profile.tenant_id,
      requested_by: user.id,
      status: "processing",
      current_phase: 1,
      phase_results: {},
      progress: { progress_pct: 0 },
    })
    .select("id")
    .single()

  if (jobError || !job) {
    console.error("Failed to create job:", jobError?.message)
    return NextResponse.json({ error: "Erro ao criar job de geração" }, { status: 500 })
  }

  const jobId = job.id
  const encoder = new TextEncoder()

  // Abort controller — signals pipeline to stop between phases on client disconnect
  const abortController = new AbortController()

  // SSE Stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Stream may have been closed by client disconnect
        }
      }

      // Heartbeat: keep connection alive every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15_000)

      // Send initial event with job_id
      send({ job_id: jobId, phase: 0, status: "started", progress_pct: 0 })

      try {
        const model = getModelWithFallback({
          agentRole: "mestre",
          tenantPlan: "standard",
        })

        const onProgress = (progress: PhaseProgress) => {
          send(progress)

          // Update job in DB (fire-and-forget)
          serviceClient
            .from("blueprint_generation_jobs")
            .update({
              current_phase: progress.phase,
              progress: { progress_pct: progress.progress_pct, status: progress.status },
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId)
            .then(() => {})
        }

        const result: DesignCourseResult = await designCourse({
          input,
          model,
          tenantId: profile.tenant_id,
          onProgress,
          abortSignal: abortController.signal,
        })

        // Save blueprint to DB
        const { data: blueprint, error: bpError } = await serviceClient
          .from("course_blueprints")
          .insert({
            tenant_id: profile.tenant_id,
            blueprint_data: result.blueprint,
            framework: result.blueprint.metadata.primary_framework,
            primary_framework: result.blueprint.metadata.primary_framework,
            complementary_frameworks: result.blueprint.metadata.complementary_frameworks,
            quality_score: result.blueprint.metadata.quality_score,
            neuroscience_score: result.blueprint.metadata.neuroscience_score,
            quality_verdict: result.blueprint.quality_scorecard.verdict,
            audience_profile: result.blueprint.audience,
            evaluation_plan: result.blueprint.evaluation_plan,
            interaction_strategy: result.blueprint.metadata.interaction_strategy,
            version: result.blueprint.metadata.version,
            total_objectives: result.blueprint.modules.reduce(
              (sum, m) => sum + m.objectives.length,
              0,
            ),
            total_assessments: result.blueprint.modules.reduce(
              (sum, m) => sum + m.assessments.length,
              0,
            ),
            bloom_progression: result.blueprint.course_architecture.bloom_progression,
            status: "draft",
          })
          .select("id")
          .single()

        if (bpError || !blueprint) {
          throw new Error(`Failed to save blueprint: ${bpError?.message}`)
        }

        // Save modules
        if (result.blueprint.modules.length > 0) {
          const modulesToInsert = result.blueprint.modules.map((m) => ({
            blueprint_id: blueprint.id,
            tenant_id: profile.tenant_id,
            order: m.order,
            title: m.title,
            description: m.description,
            duration_minutes: m.duration_minutes,
            spiral_level: m.spiral_level,
            interaction_type: m.interaction_type,
            framework_stages: m.framework_stages,
            problema_motor: m.problema_motor,
            chunks: m.chunks,
            rubrics: m.rubrics ? { text: m.rubrics } : null,
          }))

          await serviceClient.from("blueprint_modules").insert(modulesToInsert)
        }

        // Update job as completed
        await serviceClient
          .from("blueprint_generation_jobs")
          .update({
            status: "completed",
            blueprint_id: blueprint.id,
            current_phase: 5,
            phase_results: result.phaseResults,
            progress: { progress_pct: 100, status: "completed" },
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId)

        // Webhook: blueprint.generated
        dispatchEvent(profile.tenant_id, "blueprint.generated", {
          blueprint_id: blueprint.id,
          quality_score: result.blueprint.metadata.quality_score,
          primary_framework: result.blueprint.metadata.primary_framework,
          modules_count: result.blueprint.modules.length,
        }).catch(() => {})

        send({
          status: "completed",
          blueprint_id: blueprint.id,
          quality_score: result.blueprint.metadata.quality_score,
          retry_count: result.retryCount,
          duration_ms: result.totalDurationMs,
        })
      } catch (err) {
        // Client disconnect — no need to send SSE or report to Sentry
        if (err instanceof DesignOrchestratorAbortError) {
          await serviceClient
            .from("blueprint_generation_jobs")
            .update({
              status: "failed",
              error_message: "Pipeline cancelado — cliente desconectou",
              progress: { status: "cancelled" },
              phase_results: err.phaseResults,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId)
          return
        }

        const errorMessage =
          err instanceof DesignOrchestratorTimeoutError
            ? "Pipeline excedeu timeout de 5 minutos"
            : err instanceof Error
              ? err.message
              : "Erro desconhecido"

        // Update job as failed
        await serviceClient
          .from("blueprint_generation_jobs")
          .update({
            status: "failed",
            error_message: errorMessage,
            progress: { status: "failed" },
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(err instanceof DesignOrchestratorTimeoutError
              ? { phase_results: err.phaseResults }
              : {}),
          })
          .eq("id", jobId)

        Sentry.captureException(err, {
          tags: { job_id: jobId, route: "course-designer-generate" },
        })

        send({ status: "failed", error: errorMessage, job_id: jobId })
      } finally {
        clearInterval(heartbeat)
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Job-Id": jobId,
    },
  })
}
