import { getV1Context, paginatedResponse, unauthorizedResponse } from "@/lib/api-auth"
import { blueprintFiltersSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const parsed = blueprintFiltersSchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { limit, cursor, status, primary_framework } = parsed.data

  let query = ctx.serviceClient
    .from("course_blueprints")
    .select("id, course_id, status, primary_framework, quality_score, created_at, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) query = query.lt("id", cursor)
  if (status) query = query.eq("status", status)
  if (primary_framework) query = query.eq("primary_framework", primary_framework)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return paginatedResponse(data ?? [], limit)
}
