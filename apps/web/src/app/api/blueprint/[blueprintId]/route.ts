/**
 * API Route: GET /api/blueprint/[blueprintId]
 * Proxy to Blueprint Microservice
 */

import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { cabecalhoInternoObrigatorio } from "../_internal-auth"

const MICROSERVICE_URL = process.env.BLUEPRINT_MICROSERVICE_URL ?? "http://localhost:8000"

if (!process.env.BLUEPRINT_MICROSERVICE_URL && process.env.NODE_ENV === "production") {
  console.warn("[blueprint] BLUEPRINT_MICROSERVICE_URL not set — using localhost fallback")
}

interface RouteContext {
  params: Promise<{ blueprintId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { blueprintId } = await context.params

    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Call microservice (D15: exige X-Internal-Token)
    const response = await fetch(`${MICROSERVICE_URL}/blueprint/${blueprintId}`, {
      headers: cabecalhoInternoObrigatorio(),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Blueprint not found" }, { status: 404 })
      }
      return NextResponse.json({ error: "Microservice error" }, { status: response.status })
    }

    const data = await response.json()

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error("Get blueprint error:", err)
    const mensagem =
      err instanceof Error && err.message.includes("INTERNAL_AUTH_TOKEN")
        ? err.message
        : "Internal server error"
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
