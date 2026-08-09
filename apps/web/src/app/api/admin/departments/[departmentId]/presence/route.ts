import { fetchDepartmentsSnapshot } from "@/app/(platform)/admin/areas/departments-loader"
import { type PresenceOp, planPresence } from "@/app/(platform)/admin/areas/departments-model"
import { logAdminAction } from "@/lib/audit"
import { NextResponse } from "next/server"
import { z } from "zod"
import { applyPresencePlan } from "../../_apply"
import { fetchUnidades, requireDepartmentContext } from "../../_context"

// =============================================================================
// POST /api/admin/departments/[id]/presence — a ÚNICA porta de escrita de
// `department_areas`, e o lugar onde o AC6 vira contrato.
//
// A operação é NOMEADA pelo cliente (`op`), nunca deduzida do payload. Uma rota
// que recebesse "eis as unidades finais deste departamento" e se virasse para
// descobrir o que mudou seria a mesma coisa que apagar a diferença entre MOVER
// e EXPANDIR: os dois terminam com o departamento presente na unidade de
// destino, e só um deles some da origem. Aqui, quem pede diz o que quer, e o
// modelo puro (já provado por teste) traduz isso em linhas.
// =============================================================================

const presenceSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("move"), fromAreaId: z.string().uuid(), toAreaId: z.string().uuid() }),
  z.object({ op: z.literal("expand"), toAreaId: z.string().uuid() }),
  z.object({ op: z.literal("shrink"), fromAreaId: z.string().uuid() }),
  z.object({ op: z.literal("archive") }),
  z.object({ op: z.literal("restore"), toAreaId: z.string().uuid() }),
])

type PresenceBody = z.infer<typeof presenceSchema>

/**
 * Traduz o corpo validado na operação do modelo, ramo a ramo — sem cast.
 * A tradução é explícita porque o `switch` é o que garante, em tempo de tipo,
 * que cada operação carrega EXATAMENTE os campos que ela precisa: `expand` não
 * tem origem, `shrink` não tem destino, e nenhuma delas pode virar outra por
 * descuido de spread.
 */
function toPresenceOp(departmentId: string, body: PresenceBody): PresenceOp {
  switch (body.op) {
    case "move":
      return {
        kind: "move",
        departmentId,
        fromAreaId: body.fromAreaId,
        toAreaId: body.toAreaId,
      }
    case "expand":
      return { kind: "expand", departmentId, toAreaId: body.toAreaId }
    case "shrink":
      return { kind: "shrink", departmentId, fromAreaId: body.fromAreaId }
    case "archive":
      return { kind: "archive", departmentId }
    case "restore":
      return { kind: "restore", departmentId, toAreaId: body.toAreaId }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ departmentId: string }> },
) {
  const ctx = await requireDepartmentContext()
  if (!ctx.ok) return ctx.response

  const { departmentId } = await params
  const parsed = presenceSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Operação inválida" },
      { status: 400 },
    )
  }

  // Estado atual DESTA empresa (AC0.1: o snapshot é escopado, então um id de
  // outra empresa simplesmente não existe daqui — o plano recusa por si).
  const unidades = await fetchUnidades(ctx.client, ctx.tenantId)
  const snapshot = await fetchDepartmentsSnapshot(ctx.client, ctx.tenantId, unidades)

  const planned = planPresence(snapshot, toPresenceOp(departmentId, parsed.data))
  if (!planned.ok) return NextResponse.json({ error: planned.error }, { status: 400 })

  const applied = await applyPresencePlan(ctx.client, ctx.tenantId, planned.plan)
  if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 500 })

  const warnings = [...planned.plan.warnings]
  if (applied.unreassignedUserIds.length > 0) {
    warnings.push(
      `${applied.unreassignedUserIds.length} pessoa(s) não tiveram a unidade atualizada. Revise os vínculos.`,
    )
  }

  await logAdminAction({
    actorId: ctx.userId,
    tenantId: ctx.tenantId,
    action: `department.${parsed.data.op}`,
    targetType: "department",
    targetId: departmentId,
    details: {
      op: parsed.data.op,
      removed: planned.plan.removePresences.map((p) => p.areaId),
      added: planned.plan.addPresences.map((p) => p.areaId),
      pessoas_reatribuidas: planned.plan.reassignUsers.map((u) => u.userId),
      pessoas_mantidas: planned.plan.heldBackUserIds,
      placement: `${planned.plan.placementBefore} -> ${planned.plan.placementAfter}`,
    },
  })

  return NextResponse.json({
    data: {
      placement: planned.plan.placementAfter,
      archived: planned.plan.archivesDepartment,
      heldBackUserIds: planned.plan.heldBackUserIds,
      warnings,
    },
  })
}
