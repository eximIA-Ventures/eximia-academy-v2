import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("s")
  if (secret !== "eximia-health-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const steps: Record<string, unknown> = { timestamp: new Date().toISOString() }

  // Step 1: Test import
  try {
    const agents = await import("@eximia/agents")
    steps.import = { status: "ok", exports: Object.keys(agents).length }
  } catch (err) {
    steps.import = { status: "error", error: (err as Error).message }
    return NextResponse.json(steps, { status: 503 })
  }

  // Step 2: Test model router
  try {
    const { getModelWithFallback } = await import("@eximia/agents")
    const model = getModelWithFallback({ agentRole: "mestre" })
    steps.modelRouter = { status: "ok", model: String(model) }
  } catch (err) {
    steps.modelRouter = { status: "error", error: (err as Error).message }
    return NextResponse.json(steps, { status: 503 })
  }

  // Step 3: Test generateObject with the actual socrates schema
  try {
    const { getModelWithFallback } = await import("@eximia/agents")
    const { generateObject } = await import("ai")
    const { z } = await import("zod")

    const model = getModelWithFallback({ agentRole: "polidor" })
    const result = await generateObject({
      model,
      system: "You are a test. Respond in the exact schema.",
      prompt: "Say hello to the student.",
      schema: z.object({
        edited_response: z.object({
          content: z.string(),
          changes_made: z.array(z.string()),
        }),
      }),
    })
    steps.generateObject = { status: "ok", result: result.object }
  } catch (err) {
    steps.generateObject = { status: "error", error: (err as Error).message, stack: (err as Error).stack?.split("\n").slice(0, 5) }
    return NextResponse.json(steps, { status: 503 })
  }

  // Step 4: Test mini pipeline (Socrates only, minimal input)
  try {
    const { orchestrateSocraticDialogue } = await import("@eximia/agents")
    const result = await orchestrateSocraticDialogue({
      sessionId: "test-health-check",
      studentMessage: "O que é um problema?",
      chapterContent: "Um problema é uma situação indesejada que precisa ser resolvida.",
      question: { text: "O que você entende por problema?" },
      conversationHistory: [],
      turnNumber: 1,
      interactionsRemaining: 3,
    })
    steps.pipeline = {
      status: "ok",
      responseLength: result.response.length,
      verdict: result.qaReport.verdict,
      retryCount: result.retryCount,
    }
  } catch (err) {
    steps.pipeline = {
      status: "error",
      error: (err as Error).message,
      stack: (err as Error).stack?.split("\n").slice(0, 8),
    }
    return NextResponse.json(steps, { status: 503 })
  }

  return NextResponse.json(steps)
}
