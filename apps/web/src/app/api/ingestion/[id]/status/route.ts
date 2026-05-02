import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: ingestionId } = await context.params

  // Auth guard
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

  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  // SSE response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = ""
      let attempts = 0
      const maxAttempts = 120 // 2 minutes at 1s intervals

      const poll = async () => {
        if (attempts >= maxAttempts) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "timeout", error: "Tempo limite excedido." })}\n\n`,
            ),
          )
          controller.close()
          return
        }

        attempts++

        const { data: ingestion } = await serviceClient
          .from("content_ingestions")
          .select("status, error_message, ai_output, processing_metadata")
          .eq("id", ingestionId)
          .eq("tenant_id", profile.tenant_id)
          .single()

        if (!ingestion) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "error", error: "Ingestao não encontrada." })}\n\n`,
            ),
          )
          controller.close()
          return
        }

        // Only send updates when status or step changes
        const metadata = ingestion.processing_metadata as Record<string, unknown> | null
        const currentStep = (metadata?.step as string) || ingestion.status
        const statusKey = `${ingestion.status}:${currentStep}`

        if (statusKey !== lastStatus) {
          lastStatus = statusKey
          const payload: Record<string, unknown> = {
            status: ingestion.status,
            step: currentStep,
          }

          if (ingestion.status === "review" && ingestion.ai_output) {
            payload.ai_output = ingestion.ai_output
          }

          if (ingestion.status === "failed") {
            payload.error = ingestion.error_message
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }

        // Terminal states — close stream
        if (["review", "approved", "failed"].includes(ingestion.status)) {
          controller.close()
          return
        }

        // Continue polling
        setTimeout(poll, 1000)
      }

      await poll()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
