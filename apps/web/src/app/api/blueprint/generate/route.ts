/**
 * API Route: POST /api/blueprint/generate
 * Proxy to Blueprint Microservice
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BlueprintGenerateRequest } from "@/types/blueprint"

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
    const { data: profile } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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

    // Call microservice
    const response = await fetch(`${MICROSERVICE_URL}/blueprint/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
