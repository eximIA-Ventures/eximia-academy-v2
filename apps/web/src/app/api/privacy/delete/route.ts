import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

/* --------------------------------- Schema --------------------------------- */

const deleteSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Confirmação obrigatória: { confirm: true }" }),
  }),
})

/* --------------------------------- DELETE ---------------------------------- */

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate confirmation in body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Request body obrigatório com { confirm: true }." },
      { status: 400 },
    )
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  // Determine target user
  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("userId")

  // Fetch caller's profile
  const { data: callerProfile } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!callerProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 })
  }

  let deleteUserId = user.id

  // If admin is deleting on behalf of another user
  if (targetUserId && targetUserId !== user.id) {
    if (callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem excluir dados de outros usuários." },
        { status: 403 },
      )
    }

    // Verify target user belongs to the same tenant
    const { data: targetProfile } = await supabase
      .from("users")
      .select("id, tenant_id")
      .eq("id", targetUserId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Usuário alvo não encontrado." }, { status: 404 })
    }

    if (targetProfile.tenant_id !== callerProfile.tenant_id) {
      return NextResponse.json(
        { error: "Usuário alvo não pertence ao mesmo tenant." },
        { status: 403 },
      )
    }

    deleteUserId = targetUserId
  }

  // Prevent admin from deleting themselves
  if (deleteUserId === user.id && callerProfile.role === "admin") {
    return NextResponse.json(
      { error: "Administradores não podem excluir a própria conta." },
      { status: 400 },
    )
  }

  // Use service client for admin operations (ban user, bypass RLS for transaction)
  const serviceClient = createServiceClient()

  // Execute atomic soft delete via stored procedure (single transaction)
  const { data: deletedAt, error: rpcError } = await serviceClient.rpc("lgpd_soft_delete_user", {
    p_user_id: deleteUserId,
  })

  if (rpcError) {
    return NextResponse.json(
      { error: `Falha ao excluir dados do usuário: ${rpcError.message}` },
      { status: 500 },
    )
  }

  const now = deletedAt ?? new Date().toISOString()

  // 4. Ban user in Supabase Auth (effectively disables login)
  // 876600h ~= 100 years
  const { error: banError } = await serviceClient.auth.admin.updateUserById(deleteUserId, {
    ban_duration: "876600h",
  })

  if (banError) {
    // User data is already soft-deleted, log the ban failure
    console.error(
      JSON.stringify({
        event: "privacy.delete.ban_failed",
        user_id: deleteUserId,
        error: banError.message,
        timestamp: new Date().toISOString(),
      }),
    )
    // FIX-4: Return 207 Multi-Status when ban fails (partial failure)
    return NextResponse.json({
      message: "Dados excluídos mas falha ao desativar autenticação. Contate o administrador.",
      deleted_user_id: deleteUserId,
      deleted_at: now,
      warning: "auth_ban_failed",
    }, { status: 207 })
  }

  // Audit log
  console.log(
    JSON.stringify({
      event: "privacy.delete",
      caller_id: user.id,
      target_user_id: deleteUserId,
      tenant_id: callerProfile.tenant_id,
      timestamp: new Date().toISOString(),
    }),
  )

  return NextResponse.json({
    message: "Dados do usuário excluídos com sucesso (LGPD soft delete).",
    deleted_user_id: deleteUserId,
    deleted_at: now,
  })
}
