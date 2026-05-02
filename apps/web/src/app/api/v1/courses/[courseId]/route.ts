import { getV1Context, unauthorizedResponse } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = getV1Context(request)
  if (!ctx) return unauthorizedResponse()

  const { courseId } = await params

  const { data, error } = await ctx.serviceClient
    .from("courses")
    .select("id, title, description, type, status, area_id, created_at, updated_at")
    .eq("id", courseId)
    .eq("tenant_id", ctx.tenantId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ data })
}
