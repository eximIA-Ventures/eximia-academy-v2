import { logAdminAction } from "@/lib/audit"
import { NextResponse } from "next/server"
import { z } from "zod"
import { fetchUnidades, requireDepartmentContext } from "./_context"

// =============================================================================
// POST /api/admin/departments — cria um DEPARTAMENTO ("Área" no vocabulário de
// produto). NÃO cria unidade: unidade continua sendo `areas`, com as rotas dela
// (`/api/admin/areas`), intocadas por esta story.
// =============================================================================

const createDepartmentSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  description: z.string().optional(),
  /**
   * Unidade onde a área nasce. OBRIGATÓRIA por decisão do dono (2026-07-28):
   * "toda área nasce em uma unidade".
   *
   * Não é preciosismo de validação, é o que mantém honesto o rótulo "Arquivada".
   * Como `departments` não tem `archived_at`, o estado arquivado é modelado por
   * ZERO presenças em `department_areas`. Se a criação pudesse omitir a unidade,
   * uma área recém-criada nasceria indistinguível de uma arquivada — a tela
   * afirmaria um arquivamento que nunca aconteceu. Exigir a unidade aqui fecha
   * essa porta NA FONTE, para qualquer chamador (import em massa, integrador,
   * outra tela), e não só para a UI que hoje já a preenche sozinha.
   */
  areaId: z
    .string({ required_error: "Escolha a unidade onde a área vai nascer" })
    .uuid("Escolha a unidade onde a área vai nascer"),
})

export async function POST(request: Request) {
  const ctx = await requireDepartmentContext()
  if (!ctx.ok) return ctx.response

  const parsed = createDepartmentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  // A unidade precisa ser DESTA empresa. Confiar no id que chegou seria abrir a
  // porta para vincular uma área local a uma unidade alheia. A checagem é
  // incondicional porque `areaId` é obrigatório — e ela roda ANTES do insert, de
  // modo que uma unidade inválida não deixa área nenhuma para trás.
  const unidades = await fetchUnidades(ctx.client, ctx.tenantId)
  if (!unidades.some((u) => u.id === parsed.data.areaId)) {
    return NextResponse.json({ error: "Unidade não encontrada nesta empresa" }, { status: 400 })
  }

  const { data, error } = await ctx.client
    .from("departments")
    .insert({
      tenant_id: ctx.tenantId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
    })
    .select("id, name, slug, description")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe uma área com este slug" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: presenceError } = await ctx.client.from("department_areas").insert({
    department_id: data.id,
    area_id: parsed.data.areaId,
    tenant_id: ctx.tenantId,
  })
  if (presenceError && presenceError.code !== "23505") {
    // Único caminho que ainda produz uma área sem unidade: os dois inserts não
    // são uma transação. Ele não é silenciado — a resposta diz exatamente onde a
    // área foi parar e o que fazer com ela.
    return NextResponse.json(
      {
        error: `Área criada, mas não foi possível vinculá-la à unidade: ${presenceError.message}. Ela está em Arquivadas — restaure-a para a unidade desejada.`,
      },
      { status: 500 },
    )
  }

  await logAdminAction({
    actorId: ctx.userId,
    tenantId: ctx.tenantId,
    action: "department.created",
    targetType: "department",
    targetId: data.id,
    details: { name: parsed.data.name, slug: parsed.data.slug, area_id: parsed.data.areaId },
  })

  return NextResponse.json({ data }, { status: 201 })
}
