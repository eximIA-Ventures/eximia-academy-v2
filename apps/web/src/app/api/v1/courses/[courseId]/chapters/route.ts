import { getV1Context, paginatedResponse, unauthorizedResponse } from "@/lib/api-auth"
import { paginationSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { courseId } = await params
  const { searchParams } = new URL(request.url)
  const parsed = paginationSchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { limit, cursor } = parsed.data

  // Verify course belongs to tenant
  const { data: course } = await ctx.serviceClient
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (!course) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  let query = ctx.serviceClient
    .from("chapters")
    .select("id, title, order, status, created_at, updated_at")
    .eq("course_id", courseId)
    .order("order", { ascending: true })
    .limit(limit + 1)

  if (cursor) query = query.gt("id", cursor)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return paginatedResponse(data ?? [], limit)
}
