import { requireRole } from "@/lib/api-role-guard"
import { createClient } from "@/lib/supabase/server"

/**
 * Lista de papéis PRÓPRIA desta rota: acompanhar o processamento de um PDF é
 * leitura, e `manager` sempre pôde. As rotas de escrita do acervo
 * (`_guard-do-acervo`) exigem `admin`/`super_admin`. A divergência é anterior a
 * esta correção e foi preservada: apertar aqui seria mudança de autorização
 * disfarçada de correção de defeito.
 */
const PAPEIS_DO_ACOMPANHAMENTO = ["manager", "admin", "super_admin"] as const

interface RouteContext {
  params: Promise<{ bookId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { bookId } = await context.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { recusa } = await requireRole(supabase, user.id, PAPEIS_DO_ACOMPANHAMENTO)
  if (recusa) return recusa

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let attempts = 0
      const maxAttempts = 150 // 5 min max (2s * 150)

      const interval = setInterval(async () => {
        attempts++

        try {
          const { data: book } = await supabase
            .from("books")
            .select("processing_status, processing_error")
            .eq("id", bookId)
            .single()

          if (!book || attempts >= maxAttempts) {
            const finalEvent = `data: ${JSON.stringify({ status: "timeout", error: "Connection timeout" })}\n\n`
            controller.enqueue(encoder.encode(finalEvent))
            clearInterval(interval)
            controller.close()
            return
          }

          const event = `data: ${JSON.stringify({
            status: book.processing_status,
            error: book.processing_error,
          })}\n\n`

          controller.enqueue(encoder.encode(event))

          // Close on terminal states
          if (["completed", "failed", "idle"].includes(book.processing_status)) {
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
