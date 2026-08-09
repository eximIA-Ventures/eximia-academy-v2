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

  let tenantSlug: string | null = null
  try {
    const body = (await request.json()) as { tenantSlug?: string | null }
    tenantSlug = body?.tenantSlug ?? null
  } catch {
    tenantSlug = null
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id, tenants(slug)")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json(
      { allowed: false, error: "Usuário não encontrado" },
      { status: 404 },
    )
  }

  // Super admin — no tenant restriction
  if (profile.role === "super_admin") {
    return NextResponse.json({ allowed: true, superAdmin: true })
  }

  // Regular user — only allowed when the requested tenant matches their own.
  // `tenants` may come back as an object or a single-element array depending on the join shape.
  const tenants = profile.tenants as { slug?: string } | { slug?: string }[] | null
  const profileSlug = Array.isArray(tenants) ? tenants[0]?.slug ?? null : tenants?.slug ?? null

  if (tenantSlug && tenantSlug !== profileSlug) {
    return NextResponse.json(
      { allowed: false, error: "Você não tem acesso a esta organização" },
      { status: 403 },
    )
  }

  return NextResponse.json({
    allowed: true,
    superAdmin: false,
  })
}
