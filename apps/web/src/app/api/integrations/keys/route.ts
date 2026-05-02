"use server"

import { generateKey } from "@/lib/integration/helpers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

async function requireAdminOrSuper(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single()
  if (!profile || !["admin", "super_admin"].includes(profile.role)) return null
  return { userId: user.id, role: profile.role, tenantId: profile.tenant_id }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdminOrSuper(supabase)
  if (!auth) return NextResponse.json({ error: "Permissão negada" }, { status: 403 })

  const url = new URL(request.url)
  const tenantId = url.searchParams.get("tenant_id") ?? auth.tenantId

  // Only super_admin can query other tenants
  if (tenantId !== auth.tenantId && auth.role !== "super_admin") {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const service = createServiceClient()
  const { data } = await service
    .from("integration_keys")
    .select("id, app_name, key_prefix, scopes, status, last_used, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const auth = await requireAdminOrSuper(supabase)
  if (!auth) return NextResponse.json({ error: "Permissão negada" }, { status: 403 })

  const body = await request.json()
  const { app_name, scopes = ["read"], tenant_id } = body

  if (!app_name) return NextResponse.json({ error: "app_name obrigatório" }, { status: 400 })

  // tenant_id can be: a specific tenant, null (platform-level, super_admin only), or default to user's tenant
  const targetTenant = tenant_id === "platform" ? null : (tenant_id ?? auth.tenantId)
  if (targetTenant === null && auth.role !== "super_admin") {
    return NextResponse.json({ error: "Apenas super admin pode criar chaves de plataforma" }, { status: 403 })
  }
  if (targetTenant && targetTenant !== auth.tenantId && auth.role !== "super_admin") {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const { raw, prefix, hash } = generateKey(app_name.replace(/\s+/g, "-").toLowerCase())

  const service = createServiceClient()
  const { data, error } = await service
    .from("integration_keys")
    .insert({
      tenant_id: targetTenant,
      app_name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      created_by: auth.userId,
    })
    .select("id, app_name, key_prefix, scopes, status, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return raw key ONLY on creation (never stored, never retrievable again)
  return NextResponse.json({ data: { ...data, api_key: raw } }, { status: 201 })
}
