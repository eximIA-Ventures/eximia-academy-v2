import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { tenantId } = await request.json()

  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 })
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
