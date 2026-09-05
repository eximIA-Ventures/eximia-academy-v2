import { requireRole } from "@/lib/api-role-guard"
import { logAdminAction } from "@/lib/audit"
import { PAPEIS_CHAVES_INTEGRACAO } from "@/lib/papeis-de-conteudo"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

function requestIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  )
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_CHAVES_INTEGRACAO)
  if (recusa) return recusa

  const service = createServiceClient()
  let query = service.from("integration_keys").update({ status: "revoked" }).eq("id", id)

  // Non-super_admins can only revoke keys within their own tenant (prevents IDOR/DoS)
  if (profile.role !== "super_admin") {
    query = query.eq("tenant_id", profile.tenant_id)
  }

  const { data: revoked, error } = await query.select("id, tenant_id, app_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const revokedKey = revoked?.[0]
  if (revokedKey) {
    await logAdminAction({
      actorId: user.id,
      tenantId: revokedKey.tenant_id ?? profile.tenant_id,
      action: "integration.key_revoked",
      targetType: "integration",
      targetId: id,
      details: { app_name: revokedKey.app_name, ip: requestIp(request) },
    })
  }

  return NextResponse.json({ success: true })
}
