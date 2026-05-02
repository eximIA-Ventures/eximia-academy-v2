import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

const AREA_COOKIE = "x-active-area"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getActiveAreaId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(AREA_COOKIE)?.value ?? null
}

export async function setActiveArea(areaId: string) {
  if (!UUID_RE.test(areaId)) return
  const cookieStore = await cookies()
  cookieStore.set(AREA_COOKIE, areaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearActiveArea() {
  const cookieStore = await cookies()
  cookieStore.delete(AREA_COOKIE)
}

export async function getUserAreas(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("user_areas")
    .select("area_id, areas(id, name, slug)")
    .eq("user_id", userId)

  return (data ?? []).map((row) => {
    const area = row.areas as unknown as { id: string; name: string; slug: string }
    return { id: area.id, name: area.name, slug: area.slug }
  })
}
