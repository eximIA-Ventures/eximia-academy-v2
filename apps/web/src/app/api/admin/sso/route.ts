import { requireRole } from "@/lib/api-role-guard"
import { logAdminAction } from "@/lib/audit"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import { z } from "zod"

function requestIp(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  )
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

const ssoConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("metadata_url"),
    metadata_url: z.string().url(),
    email_attribute: z.string().default("email"),
    sso_domain: z.string().optional(),
  }),
  z.object({
    mode: z.literal("metadata_xml"),
    metadata_xml: z.string().min(100),
    email_attribute: z.string().default("email"),
    sso_domain: z.string().optional(),
  }),
])

/** Papéis que configuram SSO do tenant. Inalterada. */
const PAPEIS_DE_ADMINISTRACAO = ["admin", "super_admin"] as const

/**
 * A recusa por sessão ausente continua **403**, como sempre foi nesta rota (os
 * três handlers traduziam o `null` num 403 "Unauthorized"). Não é o defeito
 * desta rodada e mudá-la seria alterar um contrato que ninguém pediu — o que
 * muda é que a leitura FALHA do perfil deixa de se disfarçar de veredito.
 */
async function getAdminContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ctx: null,
      recusa: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    }
  }

  const serviceClient = createServiceClient()
  const { profile, recusa } = await requireRole(serviceClient, user.id, PAPEIS_DE_ADMINISTRACAO)
  if (recusa) return { ctx: null, recusa }

  return {
    ctx: { userId: user.id, tenantId: profile.tenant_id, serviceClient },
    recusa: null,
  }
}

// Call Supabase Auth Admin SSO API via REST
async function supabaseSSO(
  method: "POST" | "GET" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/sso/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return { data, ok: res.ok, status: res.status }
}

// CSRF: Validate Origin header on mutating requests
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true // Non-browser requests (e.g. curl) have no Origin
  const url = new URL(request.url)
  return origin === url.origin
}

// POST — Create/configure SAML SSO provider for tenant
export async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { ctx, recusa } = await getAdminContext()
  if (recusa) return recusa

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = ssoConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input = parsed.data

  // FIX-3: Reject XML containing XXE/DTD patterns before forwarding to Supabase
  if (input.mode === "metadata_xml") {
    const forbidden = /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i
    if (forbidden.test(input.metadata_xml)) {
      return NextResponse.json(
        { error: "XML metadata contains forbidden patterns (DOCTYPE/ENTITY not allowed)" },
        { status: 400 },
      )
    }
  }

  const providerConfig =
    input.mode === "metadata_url"
      ? { metadata_url: input.metadata_url }
      : { metadata_xml: input.metadata_xml }

  try {
    const { data, ok } = await supabaseSSO("POST", "providers", {
      type: "saml",
      ...providerConfig,
      attribute_mapping: {
        keys: {
          email: { name: input.email_attribute },
          full_name: { name: "displayName" },
        },
      },
    })

    if (!ok) {
      return NextResponse.json(
        { error: data.message || "Failed to create SSO provider" },
        { status: 500 },
      )
    }

    // Save sso_provider_id + sso_domain in tenant.settings
    const { data: tenant } = await ctx.serviceClient
      .from("tenants")
      .select("settings")
      .eq("id", ctx.tenantId)
      .single()

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {}
    await ctx.serviceClient
      .from("tenants")
      .update({
        settings: {
          ...currentSettings,
          sso_provider_id: data.id,
          sso_domain: input.sso_domain || undefined,
        },
      })
      .eq("id", ctx.tenantId)

    await logAdminAction({
      actorId: ctx.userId,
      tenantId: ctx.tenantId,
      action: "sso.configured",
      targetType: "sso",
      targetId: data.id,
      // Mode and domain only — metadata XML/URL content stays out of details
      details: { mode: input.mode, sso_domain: input.sso_domain, ip: requestIp(request) },
    })

    return NextResponse.json({ configured: true, provider_id: data.id })
  } catch (err) {
    console.error("Error creating SSO provider:", err)
    return NextResponse.json({ error: "Failed to create SSO provider" }, { status: 500 })
  }
}

// GET — Return SSO configuration status (no sensitive data)
export async function GET() {
  const { ctx, recusa } = await getAdminContext()
  if (recusa) return recusa

  const { data: tenant } = await ctx.serviceClient
    .from("tenants")
    .select("settings")
    .eq("id", ctx.tenantId)
    .single()

  const settings = (tenant?.settings as Record<string, unknown>) || {}
  const ssoProviderId = settings.sso_provider_id as string | undefined

  return NextResponse.json({
    configured: !!ssoProviderId,
    provider_id: ssoProviderId || null,
    sso_domain: (settings.sso_domain as string) || null,
    session_timeout_hours: (settings.session_timeout_hours as number) || 8,
  })
}

// DELETE — Remove SAML SSO configuration
export async function DELETE(request: Request) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { ctx, recusa } = await getAdminContext()
  if (recusa) return recusa

  const { data: tenant } = await ctx.serviceClient
    .from("tenants")
    .select("settings")
    .eq("id", ctx.tenantId)
    .single()

  const settings = (tenant?.settings as Record<string, unknown>) || {}
  const ssoProviderId = settings.sso_provider_id as string | undefined

  if (!ssoProviderId) {
    return NextResponse.json({ error: "No SSO configuration found" }, { status: 404 })
  }

  try {
    await supabaseSSO("DELETE", `providers/${ssoProviderId}`)
  } catch (err) {
    console.error("Error deleting SSO provider:", err)
  }

  // Remove from tenant settings
  const { sso_provider_id: _, sso_domain: __, ...rest } = settings
  await ctx.serviceClient.from("tenants").update({ settings: rest }).eq("id", ctx.tenantId)

  await logAdminAction({
    actorId: ctx.userId,
    tenantId: ctx.tenantId,
    action: "sso.removed",
    targetType: "sso",
    targetId: ssoProviderId,
    details: { ip: requestIp(request) },
  })

  return NextResponse.json({ configured: false })
}
