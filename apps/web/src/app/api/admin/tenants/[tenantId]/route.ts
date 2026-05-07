import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { profile } = await getAuthProfile()
  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("tenants")
    .update(parsed.data)
    .eq("id", tenantId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { profile } = await getAuthProfile()
  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params
  const supabase = createServiceClient()

  // Check if tenant has users
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Nao e possivel excluir: tenant possui ${count} usuario(s). Remova os usuarios primeiro.` },
      { status: 409 },
    )
  }

  const { error } = await supabase.from("tenants").delete().eq("id", tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
