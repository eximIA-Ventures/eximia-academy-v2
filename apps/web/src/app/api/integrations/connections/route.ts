import { encryptKey } from "@/lib/integration/helpers"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single()
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const service = createServiceClient()
  const { data } = await service
    .from("integration_outbound")
    .select("id, remote_app, remote_url, status, entities, last_sync, last_error, created_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single()
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const body = await request.json()
  const { remote_app, remote_url, api_key } = body

  if (!remote_app || !remote_url || !api_key) {
    return NextResponse.json({ error: "remote_app, remote_url e api_key são obrigatórios" }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from("integration_outbound")
    .insert({
      tenant_id: profile.tenant_id,
      remote_app,
      remote_url: remote_url.replace(/\/$/, ""),
      api_key_encrypted: encryptKey(api_key),
      status: "pending",
      created_by: user.id,
    })
    .select("id, remote_app, remote_url, status, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
