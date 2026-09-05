import { inviteTenantUser } from "@/app/api/admin/users/invite-user"
import { recusaSePerfilIlegivel } from "@/lib/api-auth/perfil-de-sessao"
import { logAdminAction } from "@/lib/audit"
import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

// ===========================================================================
// POST /api/admin/tenants/[tenantId]/convidar-admin — o "reenviar convite"
//
// Existe porque o convite do primeiro admin acontece FORA da transação, depois
// do commit (D10): se o GoTrue estiver fora do ar, a empresa fica criada e sem
// ninguém dentro. A resposta do cadastro diz isso à tela, e a tela precisa de um
// lugar para tentar de novo.
//
// `users/[userId]/resend-invite` NÃO serve para este caso: ele parte de um
// usuário que já existe, e aqui o convite falhou justamente ANTES de existir.
// E `POST /api/admin/users` cria no tenant ATIVO do super_admin (cookie
// `x-sa-active-tenant`), não no tenant recém-criado — usá-lo colocaria o admin
// da empresa nova dentro de outra empresa.
// ===========================================================================

const corpoSchema = z.object({
  email: z.string().email("Email inválido"),
  fullName: z.string().min(1, "Nome obrigatório").max(200),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { user, profile, error: erroDePerfil } = await getAuthProfile()
  const indisponivel = recusaSePerfilIlegivel(
    erroDePerfil,
    "/api/admin/tenants/[tenantId]/convidar-admin",
  )
  if (indisponivel) return indisponivel
  if (!user || !profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { tenantId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 })
  }

  const parsed = corpoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase.from("tenants").select("id").eq("id", tenantId).single()
  if (!tenant) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 })
  }

  const convite = await inviteTenantUser(supabase, tenantId, {
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: "admin",
  })

  if (!convite.ok) {
    return NextResponse.json({ error: convite.message, stage: convite.stage }, { status: 502 })
  }

  await logAdminAction({
    actorId: user.id,
    tenantId,
    action: "tenant.admin_invited",
    targetType: "tenant",
    targetId: tenantId,
    details: { email: parsed.data.email },
  })

  return NextResponse.json({ data: { status: "sent", userId: convite.userId } })
}
