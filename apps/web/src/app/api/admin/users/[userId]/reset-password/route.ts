import { requireAdmin } from "@/lib/api-auth/require-admin"
import { logAdminAction } from "@/lib/audit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

/* ---------------------------------- POST ---------------------------------- */

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient()
  const { user, profile } = await requireAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params

  // Resolve tenant: admin/super_admin with null tenant uses cookie
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "Nenhum tenant ativo. Selecione um tenant primeiro." },
      { status: 400 },
    )
  }

  // Target must exist and belong to the caller's tenant
  const { data: target } = await supabase
    .from("users")
    .select("id, email, tenant_id")
    .eq("id", userId)
    .single()

  if (!target || target.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Usuário nao encontrado." }, { status: 404 })
  }

  // Trigger the recovery flow via Supabase Auth admin (service role).
  // The recovery link is NEVER returned to the caller.
  const serviceClient = createServiceClient()
  const { error } = await serviceClient.auth.admin.generateLink({
    type: "recovery",
    email: target.email,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logAdminAction({
    actorId: profile.id,
    tenantId,
    action: "user.password_reset_requested",
    targetType: "user",
    targetId: userId,
  })

  return NextResponse.json({ ok: true })
}
