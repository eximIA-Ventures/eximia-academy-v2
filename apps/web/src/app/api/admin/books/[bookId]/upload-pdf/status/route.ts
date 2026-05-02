import { createClient } from "@/lib/supabase/server"

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

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || !["manager", "admin", "super_admin"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 })
  }

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
