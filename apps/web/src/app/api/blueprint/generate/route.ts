/**
 * API Route: POST /api/blueprint/generate
 * Proxy to Blueprint Microservice
 */

import { requireRole } from "@/lib/api-role-guard"
import { PAPEIS_CONTEUDO } from "@/lib/papeis-de-conteudo"
import { createClient } from "@/lib/supabase/server"
import type { BlueprintGenerateRequest } from "@/types/blueprint"
import { type NextRequest, NextResponse } from "next/server"
import { cabecalhoInternoObrigatorio } from "../_internal-auth"

const MICROSERVICE_URL = process.env.BLUEPRINT_MICROSERVICE_URL ?? "http://localhost:8000"

if (!process.env.BLUEPRINT_MICROSERVICE_URL && process.env.NODE_ENV === "production") {
  console.warn("[blueprint/generate] BLUEPRINT_MICROSERVICE_URL not set — using localhost fallback")
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role check
    const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_CONTEUDO)
    if (recusa) return recusa

    // Parse request
    const body: BlueprintGenerateRequest = await request.json()

    // Validate tenant access
    if (body.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Add user ID to request
    const requestData = {
      ...body,
      requested_by: user.id,
      tenant_id: profile.tenant_id,
    }

    // Call microservice (D15: exige X-Internal-Token; ausência da env é erro claro, não 401 opaco)
    const response = await fetch(`${MICROSERVICE_URL}/blueprint/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cabecalhoInternoObrigatorio() },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: error.detail || "Microservice error" },
        { status: response.status },
      )
    }

    const data = await response.json()

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error("Blueprint generation error:", err)
    // Erro de configuração (env ausente) sai com a mensagem real — é o
    // operador do serviço quem lê isto, não um usuário final, e "Internal
    // server error" esconderia exatamente o que precisa ser corrigido.
    const mensagem =
      err instanceof Error && err.message.includes("INTERNAL_AUTH_TOKEN")
        ? err.message
        : "Internal server error"
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
