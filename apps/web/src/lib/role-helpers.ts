import type { Role } from "@eximia/shared"

/**
 * Pure role-hat checks over the UNION of hats (`profile.roles`, E1).
 *
 * E7 canonical contract (§4.10): these operate on `profile.roles` — the union
 * of hats from `user_roles` — NEVER on the singular `profile.role`. No I/O, so
 * they are usable both on the client and the server.
 *
 * E8/E9 import these; they do not redefine them.
 */
export function hasRole(profile: { roles: string[] }, role: Role): boolean {
  return profile.roles.includes(role)
}

export function hasAnyRole(profile: { roles: string[] }, roles: Role[]): boolean {
  return roles.some((r) => profile.roles.includes(r))
}
