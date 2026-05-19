import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ allowed: false, error: "Não autenticado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, tenants(slug)")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ allowed: false, error: "Usuário não encontrado" })
  }

  // Super admin — no tenant restriction
  if (profile.role === "super_admin") {
    return NextResponse.json({ allowed: true, superAdmin: true })
  }

  // Regular user — allowed to their tenant (v2: no slug in URLs)
  return NextResponse.json({
    allowed: true,
    superAdmin: false,
  })
}
