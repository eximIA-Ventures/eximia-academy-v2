import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const nextParam = searchParams.get("next") ?? "/workspace"
  const next = (nextParam.startsWith("/") && !nextParam.startsWith("//")) ? nextParam : "/workspace"

  // Step 1: Handle OAuth errors before code exchange (AC11, AC13)
  const oauthError = searchParams.get("error")
  if (oauthError) {
    const errorType = oauthError === "access_denied" ? "oauth_cancelled" : "auth_callback_failed"
    return NextResponse.redirect(`${origin}/login?error=${errorType}`)
  }

  const code = searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Step 2: Code exchange
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Step 3: Provider detection + profile sync (AC5, AC6)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.app_metadata?.provider === "google") {
    try {
      const serviceClient = createServiceClient()

      // Check if user exists in our users table
      //
      // Sem `avatar_url` no select: a coluna não existe no banco (2026-07-28).
      // Aqui o dano do erro engolido era o pior de todos: `42703` devolvia
      // `data: null`, o código lia isso como "esta pessoa não existe" e caía no
      // ramo de CRIAÇÃO para alguém que JÁ EXISTE — o que, sem `tenant_id` no
      // metadata, termina em `redirect(/login?error=no_tenant)`. Ou seja, o erro
      // de schema não falhava só a sincronização: podia derrubar o login.
      const { data: existingUser, error: lookupError } = await serviceClient
        .from("users")
        .select("id, full_name, tenant_id")
        .eq("id", user.id)
        .single()

      // `PGRST116` = "nenhuma linha", que é o caso legítimo de usuário novo.
      // Qualquer OUTRO erro significa que a pergunta não foi respondida — e
      // "não sei se existe" nunca pode virar "não existe, então crie".
      if (lookupError && lookupError.code !== "PGRST116") {
        console.error("[auth/callback] Falha ao consultar o perfil Google:", lookupError.message)
      } else if (existingUser) {
        // User exists (invited) — sync Google name if empty (AC4, AC5, AC6, AC7)
        const updates: Record<string, string> = {}
        if (
          !existingUser.full_name &&
          (user.user_metadata?.full_name || user.user_metadata?.name)
        ) {
          updates.full_name = user.user_metadata.full_name || user.user_metadata.name
        }
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await serviceClient
            .from("users")
            .update(updates)
            .eq("id", user.id)
          if (updateError) {
            console.error("[auth/callback] Falha ao sincronizar o perfil:", updateError.message)
          }
        }
      } else {
        // Step 4: Tenant context enforcement (AC3a, AC12)
        const tenantId = user.user_metadata?.tenant_id
        if (!tenantId) {
          return NextResponse.redirect(`${origin}/login?error=no_tenant`)
        }
        // FIX-H3: Create user row for new Google OAuth user with invite tenant
        // Sem `avatar_url`: escrever a coluna inexistente devolvia `PGRST204` e
        // era descartado em silêncio, então o INSERT inteiro falhava sem deixar
        // rastro nenhum.
        const { error: insertError } = await serviceClient.from("users").insert({
          id: user.id,
          tenant_id: tenantId,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!,
          role: "student",
          status: "active",
          onboarding_completed: false,
          profile: {},
        })
        if (insertError) {
          console.error("[auth/callback] Falha ao criar o perfil Google:", insertError.message)
        }
      }
    } catch (err) {
      console.error("Error syncing Google profile:", err)
      // Don't block login if profile sync fails
    }
  }

  // Story 8.2: SAML SSO auto-provisioning
  const isSaml =
    user?.app_metadata?.provider === "sso:saml" ||
    user?.app_metadata?.provider?.startsWith("sso:") ||
    !!user?.app_metadata?.sso

  if (isSaml && user) {
    try {
      const serviceClient = createServiceClient()

      const { data: existingUser } = await serviceClient
        .from("users")
        .select("id, full_name, tenant_id")
        .eq("id", user.id)
        .single()

      if (existingUser) {
        // User exists — update full_name from SAML if empty
        if (
          !existingUser.full_name &&
          (user.user_metadata?.full_name || user.user_metadata?.name)
        ) {
          await serviceClient
            .from("users")
            .update({
              full_name: user.user_metadata.full_name || user.user_metadata.name,
            })
            .eq("id", user.id)
        }
      } else {
        // Auto-provisioning: find tenant via reverse lookup
        const { data: tenants } = await serviceClient
          .from("tenants")
          .select("id, settings")

        // FIX-C3: Compare actual provider ID, not just truthy check
        const userSsoIssuer = user.app_metadata?.sso?.issuer || user.app_metadata?.provider_id
        const matchingTenant = tenants?.find((t) => {
          const s = t.settings as Record<string, unknown> | null
          return s?.sso_provider_id && userSsoIssuer && s.sso_provider_id === userSsoIssuer
        })

        const resolvedTenantId =
          matchingTenant?.id || user.user_metadata?.tenant_id

        if (!resolvedTenantId) {
          return NextResponse.redirect(`${origin}/login?error=no_tenant`)
        }

        // Create user with role='student' — NEVER use IdP role (security)
        await serviceClient.from("users").insert({
          id: user.id,
          tenant_id: resolvedTenantId,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email!,
          role: "student",
          status: "active",
          onboarding_completed: false,
          profile: {},
        })
      }
    } catch (err) {
      console.error("Error in SAML auto-provisioning:", err)
    }
  }

  // Step 5: Deep link preservation (AC9)
  return NextResponse.redirect(`${origin}${next}`)
}
