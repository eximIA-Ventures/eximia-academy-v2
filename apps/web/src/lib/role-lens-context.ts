import { cookies } from "next/headers"
import type { RoleLens } from "@eximia/shared"

const LENS_COOKIE = "x-role-lens"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8h, mirrors x-active-context
const VALID: readonly RoleLens[] = ["student", "instructor", "manager"]

/** Reads + validates the FORM only. Invalid means fresh state. */
export async function getRoleLensCookie(): Promise<RoleLens | null> {
  const raw = (await cookies()).get(LENS_COOKIE)?.value
  return raw && (VALID as readonly string[]).includes(raw) ? (raw as RoleLens) : null
}

export async function setRoleLensCookie(lens: RoleLens) {
  const cookieStore = await cookies()
  cookieStore.set(LENS_COOKIE, lens, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearRoleLensCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(LENS_COOKIE)
}
