import { requireAdmin } from "@/lib/api-auth"
import { logAdminAction } from "@/lib/audit"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

function requestIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  )
}

const updateAreaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().optional().nullable(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ areaId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { areaId } = await params
  const body = await request.json()
  const parsed = updateAreaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) payload.name = parsed.data.name
  if (parsed.data.slug !== undefined) payload.slug = parsed.data.slug
  if (parsed.data.description !== undefined) payload.description = parsed.data.description

  const { data, error } = await supabase
    .from("areas")
    .update(payload)
    .eq("id", areaId)
    .eq("tenant_id", profile.tenant_id)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe uma área com este slug" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    actorId: user.id,
    tenantId: profile.tenant_id,
    action: "area.updated",
    targetType: "area",
    targetId: areaId,
    details: {
      campos_alterados: Object.keys(payload).filter((k) => k !== "updated_at"),
      ip: requestIp(request),
    },
  })

  return NextResponse.json({ data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { areaId } = await params

  const { error } = await supabase
    .from("areas")
    .delete()
    .eq("id", areaId)
    .eq("tenant_id", profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    actorId: user.id,
    tenantId: profile.tenant_id,
    action: "area.deleted",
    targetType: "area",
    targetId: areaId,
    details: { ip: requestIp(request) },
  })

  return NextResponse.json({ success: true })
}
