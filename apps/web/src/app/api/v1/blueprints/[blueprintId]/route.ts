import { getV1Context, unauthorizedResponse } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> },
) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { blueprintId } = await params

  const { data, error } = await ctx.serviceClient
    .from("course_blueprints")
    .select(
      "id, course_id, status, primary_framework, quality_score, pedagogical_approach, target_audience, estimated_duration_hours, created_at, updated_at",
    )
    .eq("id", blueprintId)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ data })
}
