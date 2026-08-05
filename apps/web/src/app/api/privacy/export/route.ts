import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Determine which user's data to export
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

  let exportUserId = user.id

  // If admin is exporting on behalf of another user
  if (targetUserId && targetUserId !== user.id) {
    if (!["admin", "super_admin"].includes(callerProfile.role)) {
      return NextResponse.json(
        { error: "Apenas administradores podem exportar dados de outros usuários." },
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

    // super_admin may export cross-tenant; admins are restricted to their own tenant
    if (
      callerProfile.role !== "super_admin" &&
      targetProfile.tenant_id !== callerProfile.tenant_id
    ) {
      return NextResponse.json(
        { error: "Usuário alvo não pertence ao mesmo tenant." },
        { status: 403 },
      )
    }

    exportUserId = targetUserId
  }

  // Quem consegue LER `product_announcement_views` do titular, pelas policies
  // que a migration cria: `pav_select_own` (`user_id = auth.uid()`) e
  // `pav_super_admin_select` (`is_super_admin()`). NÃO existe policy para admin
  // de tenant, e isso é decisão de produto, não esquecimento (story §"O que NÃO
  // entra", item 1: dar ao gestor/admin a leitura de "quem viu o aviso"
  // transformaria preferência de interface em monitoramento de trabalhador).
  //
  // A consequência precisa ser dita em voz alta: RLS de SELECT **filtra, não
  // recusa**. O admin da Cory exportando os dados de um funcionário receberia
  // ZERO linhas e NENHUM erro, e o `?? []` abaixo transformaria "não pude ler"
  // em "não há dado" — um export LGPD que SUBDECLARA o dado retido. É a mesma
  // classe de falha registrada no comentário de `users` mais abaixo (2026-07-28,
  // export voltando sem os dados cadastrais, sem erro), só que na direção
  // inversa. Por isso o bloco vem MARCADO em vez de vazio, e a consulta nem é
  // disparada quando se sabe de antemão que ela não teria alcance.
  const featureIntroReadable = exportUserId === user.id || callerProfile.role === "super_admin"

  // Fetch all user data for LGPD export
  const [userResult, enrollmentsResult, sessionsResult, featureIntroResult] = await Promise.all([
    supabase
      .from("users")
      // Sem `avatar_url` (coluna inexistente, 2026-07-28). Aqui a consequência
      // era a mais grave das cinco: a exportação LGPD do titular voltava com
      // `user: null`, ou seja, o pedido de "me dê meus dados" era respondido
      // sem os dados cadastrais — e sem erro nenhum.
      .select(
        "id, tenant_id, email, full_name, role, status, profile, onboarding_completed, created_at, updated_at",
      )
      .eq("id", exportUserId)
      .single(),
    supabase
      .from("enrollments")
      .select("id, course_id, tenant_id, status, progress, created_at, updated_at")
      .eq("student_id", exportUserId),
    supabase
      .from("sessions")
      .select(
        "id, chapter_id, question_id, tenant_id, status, interactions_remaining, turn_number, created_at, updated_at",
      )
      .eq("student_id", exportUserId),
    // `product_announcement_views` (onboarding/novidades, `lib/onboarding/types.ts`) guarda
    // qual anúncio/tour cada pessoa já viu — dado pessoal, então entra no export.
    // `select("*")` é deliberado aqui: o schema exato é dono de outra peça (a
    // migration), escrita em paralelo a este arquivo, e listar colunas a dedo
    // arriscaria divergir do nome real assim que ela for aplicada. Fail-open:
    // a tabela ainda não existe em produção, então esta query retorna `error`
    // (relação inexistente) sem lançar exceção — o Supabase client nunca
    // rejeita a Promise por erro de query, só devolve `{ data: null, error }`,
    // e o `?? []` abaixo cobre exatamente esse caso.
    featureIntroReadable
      ? supabase.from("product_announcement_views").select("*").eq("user_id", exportUserId)
      : Promise.resolve({ data: null, error: null }),
  ])

  // Fetch messages and analyses linked to the user's sessions
  const sessionIds = (sessionsResult.data ?? []).map((s) => s.id)

  let messagesData: Array<Record<string, unknown>> = []
  let analysesData: Array<Record<string, unknown>> = []

  if (sessionIds.length > 0) {
    const [messagesResult, analysesResult] = await Promise.all([
      supabase
        .from("messages")
        .select("id, session_id, tenant_id, role, content, turn_number, created_at")
        .in("session_id", sessionIds),
      supabase
        .from("analyses")
        .select("id, message_id, session_id, tenant_id, ai_detection, metrics, flags, created_at")
        .in("session_id", sessionIds),
    ])

    messagesData = (messagesResult.data ?? []) as Array<Record<string, unknown>>
    analysesData = (analysesResult.data ?? []) as Array<Record<string, unknown>>
  }

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user: userResult.data,
    enrollments: enrollmentsResult.data ?? [],
    sessions: sessionsResult.data ?? [],
    messages: messagesData,
    analyses: analysesData,
    // Bloco nomeado exigido pela story de onboarding/novidades (LGPD entra no
    // mesmo PR da feature, não como follow-up — omitir aqui seria não
    // conformidade nova, não uma dívida herdada).
    feature_intro: featureIntroResult.data ?? [],
    // `true` só quando o EXPORTADOR não tem alcance de RLS sobre as views do
    // titular (admin de tenant exportando em nome de terceiro). Nunca é `true`
    // no caso mais importante — o titular pedindo os próprios dados. Existe
    // para que "não há dado" e "não pude ler" nunca cheguem ao destinatário
    // como o mesmo `[]`.
    feature_intro_unavailable: !featureIntroReadable,
  }

  // Audit log — durable trail for LGPD compliance
  await supabase.from("platform_audit_log").insert({
    actor_id: user.id,
    action: "privacy_export",
    target_type: "user",
    target_id: exportUserId,
    details: {
      caller_id: user.id,
      tenant_id: callerProfile.tenant_id,
    },
  }).then(({ error }) => {
    if (error) {
      console.error("[audit] Failed to log privacy export:", error.message)
    }
  })

  return NextResponse.json(exportPayload)
}
