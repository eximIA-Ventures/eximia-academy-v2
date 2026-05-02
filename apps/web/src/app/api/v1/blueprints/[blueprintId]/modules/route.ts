import { getV1Context, paginatedResponse, unauthorizedResponse } from "@/lib/api-auth"
import { paginationSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> },
) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { blueprintId } = await params
  const { searchParams } = new URL(request.url)
  const parsed = paginationSchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { limit, cursor } = parsed.data

  // Verify blueprint belongs to tenant
  const { data: blueprint } = await ctx.serviceClient
    .from("course_blueprints")
    .select("id")
    .eq("id", blueprintId)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!blueprint) {
    return NextResponse.json({ error: "Blueprint não encontrado" }, { status: 404 })
  }

  let query = ctx.serviceClient
    .from("blueprint_modules")
    .select("id, title, description, order, duration_hours, learning_objectives, created_at")
    .eq("blueprint_id", blueprintId)
    .order("order", { ascending: true })
    .limit(limit + 1)

  if (cursor) query = query.gt("id", cursor)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return paginatedResponse(data ?? [], limit)
}
