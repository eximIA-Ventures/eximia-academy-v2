import { getAuthProfile } from "@/lib/auth"
import { getActiveContextCookie } from "@/lib/context-context"

/**
 * Context resolution (E7 §4.4). Canonical source (§4.10): E8/E9/E10 import
 * these names; they do NOT redefine them.
 *
 * `resolveContext()` decides the SCREEN (which dashboard to render) and the list
 * of contexts the person CAN choose. It never reads student data outside reach;
 * the data shield is RLS + `authorizeContextAccess`. Forging the cookie cannot
 * expand what is read — the worst case is a safe fallback to "Minha Trilha".
 */

export interface AvailableContext {
  /** "personal" is the canonical value for "Minha Trilha" — NEVER "self". */
  type: "personal" | "team" | "organization"
  id: string | null
  label: string // "Minha Trilha" | "Meu Time" | "Minha Organização"
}

export interface ResolvedContext {
  /** What is rendering right NOW. */
  active: AvailableContext
  /** Everything the person CAN choose (>= 1). */
  available: AvailableContext[]
}

const PERSONAL: AvailableContext = { type: "personal", id: null, label: "Minha Trilha" }

/**
 * Derives available contexts from hats + capability signals (no reach recompute).
 *
 * Exported (named) so the pure decision table is unit-testable without DB/auth I/O.
 * This is an ADDITIONAL export from the canonical module — it does NOT redefine the
 * canonical names elsewhere (E7 §4.10 forbids redefinition in E8/E9/E10, not local
 * exports here). Runtime behaviour is unchanged.
 */
export function buildAvailable(
  roles: string[],
  hasSubordinates: boolean,
  hasEnrollment: boolean,
): AvailableContext[] {
  const out: AvailableContext[] = []
  if (hasEnrollment || roles.includes("student")) {
    out.push({ type: "personal", id: null, label: "Minha Trilha" })
  }
  // "Meu Time" só quando há alcance real de subárvore (hasSubordinates), espelhando
  // authorizeContextAccess('team') (E7 §4.5). Oferecer por hat sem subordinados daria
  // uma opção que o servidor nega e cairia silenciosamente em "Minha Trilha".
  if (hasSubordinates) {
    out.push({ type: "team", id: null, label: "Meu Time" })
  }
  if (roles.some((r) => ["admin", "super_admin"].includes(r))) {
    out.push({ type: "organization", id: null, label: "Minha Organização" })
  }
  // Every user is at least a student by product rule (E1) — guarantee one option.
  if (out.length === 0) out.push({ ...PERSONAL })
  return out
}

/**
 * Safe default: the highest-privilege context available (precedence E1),
 * falling back to "Minha Trilha". It is the INITIAL screen a person lands on
 * when there is no explicit choice yet; they switch freely afterwards.
 *
 * Rationale (E7 §75/§229 vs §446 reconciliation): a person whose top hat is a
 * management hat (manager/admin/super_admin) should land on the corresponding
 * management view by default — a manager who logs in must SEE their team (the
 * aggregate + "Times abaixo"), not the student trail. "Minha Trilha" stays one
 * click away in the ContextSwitcher, and that choice is now PERSISTED (see the
 * `personal` sentinel in `resolveContext`), so descending to the trail and the
 * default ascent no longer fight each other.
 *
 * Exported (named) for unit-testing the pure precedence pick. Additional export
 * only; behaviour unchanged (see note on `buildAvailable`).
 */
export function defaultContext(available: AvailableContext[]): AvailableContext {
  return (
    available.find((c) => c.type === "organization") ??
    available.find((c) => c.type === "team") ??
    available.find((c) => c.type === "personal") ??
    available[0]
  )
}

export async function resolveContext(): Promise<ResolvedContext> {
  const { roles, hasSubordinates, hasEnrollment } = await getAuthProfile()
  const available = buildAvailable(roles, hasSubordinates, hasEnrollment)

  const cookie = await getActiveContextCookie() // form already validated (personal|team|organization|null)

  // No cookie at all => FRESH state (just logged in): land on the highest-privilege
  // context the person actually has (precedence E1). For a manager that is "Meu
  // Time" — so a manager who logs in immediately sees the team aggregate + the
  // "Times abaixo" drill-down, instead of the student trail. A pure student still
  // resolves to "Minha Trilha" because that is their only available context.
  if (!cookie) {
    return { active: defaultContext(available), available }
  }

  // Explicit `personal` choice ("Minha Trilha" in the ContextSwitcher): honour it
  // whenever the person can be a student. This is what keeps the trail reachable
  // for a manager — selecting it PERSISTS (the sentinel cookie), so the default
  // ascent above no longer bounces them back to the team view. If for some reason
  // there is no personal context (staff with no enrollment), fall back to default.
  if (cookie.type === "personal") {
    return { active: available.find((c) => c.type === "personal") ?? defaultContext(available), available }
  }

  // Cookie asks team/organization: only honour it if the person HAS that context.
  const match = available.find((c) => c.type === cookie.type)
  if (!match) {
    return { active: defaultContext(available), available } // forge / invalid reach => fallback
  }
  // The specific `id` is re-validated at the E9 drill-down gate.
  return { active: { ...match, id: cookie.id ?? null }, available }
}
