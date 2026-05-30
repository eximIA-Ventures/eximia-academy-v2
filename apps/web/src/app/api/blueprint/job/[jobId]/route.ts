/**
 * API Route: GET /api/blueprint/job/[jobId]
 * Proxy to Blueprint Microservice
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const MICROSERVICE_URL = process.env.BLUEPRINT_MICROSERVICE_URL ?? "http://localhost:8000"

if (!process.env.BLUEPRINT_MICROSERVICE_URL && process.env.NODE_ENV === "production") {
  console.warn("[blueprint/job] BLUEPRINT_MICROSERVICE_URL not set — using localhost fallback")
}

interface RouteContext {
  params: Promise<{ jobId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params

    // Validate jobId as a UUID (prevents IDOR enumeration + path injection)
    const parsedJobId = z.string().uuid().safeParse(jobId)
    if (!parsedJobId.success) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 })
    }

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

    // Confirm the job belongs to the caller's tenant before proxying
    const { data: job } = await supabase
      .from("blueprint_generation_jobs")
      .select("id, tenant_id")
      .eq("id", parsedJobId.data)
      .single()

    if (!job || job.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Call microservice
    const response = await fetch(`${MICROSERVICE_URL}/blueprint/job/${parsedJobId.data}`)

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 })
      }
      return NextResponse.json(
        { error: "Microservice error" },
        { status: response.status },
      )
    }

    const data = await response.json()

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error("Job status error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
