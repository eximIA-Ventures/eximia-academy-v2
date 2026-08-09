import { requireSuperAdmin } from "@/lib/super-admin-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { profile } = await requireSuperAdmin(supabase)
  if (!profile) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  const { tenantId } = await request.json()

  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 })
  }

  // Validate that the target tenant exists before setting the cookie
  const service = createServiceClient()
  const { data: tenant } = await service
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .single()

  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 })
  }

  const cookieStore = await cookies()
  cookieStore.set("x-sa-active-tenant", tenantId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return NextResponse.json({ ok: true })
}
