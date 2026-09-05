import { requireRole } from "@/lib/api-role-guard"
import { createClient } from "@/lib/supabase/server"

interface RouteContext {
  params: Promise<{ jobId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Role guard: manager/admin only.
  // A recusa passa a ser JSON, e não mais o texto puro "Forbidden": o `onerror` do
  // EventSource nunca lê o corpo (`hooks/use-sse.ts` só reconecta), mas quem observa
  // esta rota fora do navegador passa a distinguir "não pode" de "não deu para saber".
  const { recusa } = await requireRole(supabase, user.id, ["manager", "admin", "instructor"])
  if (recusa) return recusa

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let attempts = 0
      const maxAttempts = 150 // 5 min max (2s * 150)

      const interval = setInterval(async () => {
        attempts++

        try {
          const { data: job } = await supabase
            .from("question_generation_jobs")
            .select("status, progress, questions_generated, error_message")
            .eq("id", jobId)
            .single()

          if (!job || attempts >= maxAttempts) {
            const finalEvent = `data: ${JSON.stringify({ status: "timeout", error: "Connection timeout" })}\n\n`
            controller.enqueue(encoder.encode(finalEvent))
            clearInterval(interval)
            controller.close()
            return
          }

          const event = `data: ${JSON.stringify({
            status: job.status,
            progress: job.progress,
            questionsGenerated: job.questions_generated,
            errorMessage: job.error_message,
          })}\n\n`

          controller.enqueue(encoder.encode(event))

          // Close on terminal states
          if (["review", "completed", "failed"].includes(job.status)) {
            clearInterval(interval)
            controller.close()
          }
        } catch {
          // Silently continue on polling errors
        }
      }, 2000)

      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // Stream may already be closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
