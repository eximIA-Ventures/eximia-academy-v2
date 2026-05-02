import { createClient } from "@/lib/supabase/server"
import { updateTenantSchema } from "@eximia/shared"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: tenant })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate with Zod
  const parsed = updateTenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors },
      { status: 400 },
    )
  }

  // Whitelabel gate: reject whitelabel_config if not enabled
  if (parsed.data.whitelabel_config) {
    const { data: currentTenant } = await supabase
      .from("tenants")
      .select("whitelabel_enabled")
      .eq("id", profile.tenant_id)
      .single()

    if (!currentTenant?.whitelabel_enabled) {
      return NextResponse.json(
        { error: "Whitelabel nao esta habilitado para este tenant" },
        { status: 403 },
      )
    }
  }

  const { data, error } = await supabase
    .from("tenants")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", profile.tenant_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
