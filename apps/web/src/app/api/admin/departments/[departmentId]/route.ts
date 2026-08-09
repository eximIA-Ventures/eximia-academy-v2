import { logAdminAction } from "@/lib/audit"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireDepartmentContext } from "../_context"

// =============================================================================
// PATCH /api/admin/departments/[departmentId] — renomear / editar o cadastro.
//
// Não existe DELETE aqui de propósito: a saída de cena de um departamento é
// ARQUIVAR (`/presence` com op `archive`), que preserva pessoas e histórico e é
// reversível. Excluir de verdade levaria junto, por CASCATA, os vínculos de
// `user_departments` — perda silenciosa que nenhum AC pediu.
// =============================================================================

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> },
) {
  const ctx = await requireDepartmentContext()
  if (!ctx.ok) return ctx.response

  const { departmentId } = await params
  const parsed = updateDepartmentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) payload.name = parsed.data.name
  if (parsed.data.slug !== undefined) payload.slug = parsed.data.slug
  if (parsed.data.description !== undefined) payload.description = parsed.data.description

  const { data, error } = await ctx.client
    .from("departments")
    .update(payload)
    .eq("id", departmentId)
    // Recorte explícito: um id válido de OUTRA empresa não pode ser editado
    // daqui, nem pelo super_admin, que passa pelo bypass de RLS.
    .eq("tenant_id", ctx.tenantId)
    .select("id, name, slug, description")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe uma área com este slug" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Área não encontrada" }, { status: 404 })

  await logAdminAction({
    actorId: ctx.userId,
    tenantId: ctx.tenantId,
    action: "department.updated",
    targetType: "department",
    targetId: departmentId,
    details: { campos_alterados: Object.keys(payload).filter((k) => k !== "updated_at") },
  })

  return NextResponse.json({ data })
}
