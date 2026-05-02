import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const secret = request.headers.get("x-admin-secret") || new URL(request.url).searchParams.get("s")
  if (secret !== "eximia-health-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.slice(0, 12)}...)` : "MISSING",
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "set" : "MISSING",
      GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "set" : "MISSING",
      CHAT_MODEL: process.env.CHAT_MODEL || "not set",
    },
  }

  // Test OpenAI connection via fetch (no SDK dependency needed)
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY not set")

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: "Say ok" }],
        max_tokens: 5,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      checks.openai = {
        status: "error",
        http_status: res.status,
        error: err.error?.message || JSON.stringify(err),
      }
    } else {
      const data = await res.json()
      checks.openai = {
        status: "ok",
        model: data.model,
        response: data.choices?.[0]?.message?.content,
      }
    }
  } catch (err) {
    checks.openai = { status: "error", error: (err as Error).message }
  }

  const isOk = (checks.openai as Record<string, unknown>)?.status === "ok"
  return NextResponse.json(checks, { status: isOk ? 200 : 503 })
}
