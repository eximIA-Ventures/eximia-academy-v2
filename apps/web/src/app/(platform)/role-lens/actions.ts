"use server"

import { getAuthProfile } from "@/lib/auth"
import { clearRoleLensCookie, setRoleLensCookie } from "@/lib/role-lens-context"
import { resolveRoleLens, type Role, type RoleLens } from "@eximia/shared"

export async function switchRoleLens(lens: RoleLens) {
  const { roles } = await getAuthProfile()
  const resolved = resolveRoleLens(roles as Role[], lens)
  await setRoleLensCookie(resolved)
}

export async function exitRoleLens() {
  await clearRoleLensCookie()
}
