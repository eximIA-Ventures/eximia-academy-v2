import { cookies } from "next/headers"

/**
 * Active-context cookie (`x-active-context`) — the UI hint of WHICH dashboard a
 * multi-hat person is looking at right now. Mirrors `area-context.ts` exactly
 * (8h maxAge, UUID guard, httpOnly/secure/sameSite).
 *
 * NON-NEGOTIABLE (E7 §1, §4.3): this cookie is a UI hint ONLY. It NEVER grants
 * permission. The cookie can only NARROW the dashboard to a sub-slice of what
 * RLS already allows. Reach validation is `authorizeContextAccess` (server) and,
 * in the last instance, RLS. Forging the cookie grants nothing.
 *
 * The cravado cookie carries `type ∈ {personal, team, organization}` + `id`.
 * ABSENCE of the cookie is the FRESH state (no choice yet) and resolves to the
 * highest-privilege available context (precedence E1) in `resolveContext`.
 *
 * The `personal` form is the EXPLICIT "Minha Trilha" choice (E7 §107 contemplates
 * "ou um cookie `personal`"). It exists so that a manager who deliberately picks
 * the student trail STAYS there — the default ascent would otherwise bounce a
 * cleared cookie straight back to "Meu Time". `personal` still grants nothing:
 * it only NARROWS the screen to the student trail (which RLS already allows for
 * any enrolled person), mirroring how "Todas" = absence of an active area.
 */

const CONTEXT_COOKIE = "x-active-context"
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours — mirrors area-context.ts:6
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ContextType = "personal" | "team" | "organization"
export interface ActiveContext {
  type: ContextType
  id: string | null
}

/**
 * Reads + validates the FORM of the cookie. Invalid form => null (treated as the
 * fresh state). Only the shape is validated here (is it personal/team/
 * organization? is id null or a UUID?); reach is validated in
 * `authorizeContextAccess` and, ultimately, by RLS.
 */
export async function getActiveContextCookie(): Promise<ActiveContext | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(CONTEXT_COOKIE)?.value
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p?.type !== "personal" && p?.type !== "team" && p?.type !== "organization") return null
    if (p.id !== null && p.id !== undefined && !UUID_RE.test(p.id)) return null
    return { type: p.type, id: p.id ?? null }
  } catch {
    return null // malformed JSON => fresh state
  }
}

export async function setActiveContext(ctx: ActiveContext) {
  if (ctx.id !== null && !UUID_RE.test(ctx.id)) return // refuse malformed id
  const cookieStore = await cookies()
  cookieStore.set(CONTEXT_COOKIE, JSON.stringify(ctx), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function clearActiveContext() {
  const cookieStore = await cookies()
  cookieStore.delete(CONTEXT_COOKIE)
}
