import { cookies } from "next/headers"

/** Os QUATRO mundos. `super` (rodada 9) é o do SUPER ADMIN: painel global de
 *  todas as empresas + "Empresas". Ele nasceu para tirar a administração GLOBAL
 *  de dentro do mundo de APRENDIZAGEM, onde o super_admin caía ao entrar pelo
 *  cartão "Plataforma de Aprendizagem". Estruturalmente idêntico ao
 *  `NavWorkspace` de `@eximia/shared`. */
export type WorkspaceId = "studio" | "standard" | "admin" | "super"

const WORKSPACE_COOKIE = "x-active-workspace"
const VALID: readonly WorkspaceId[] = ["studio", "standard", "admin", "super"]

/** Reads + validates FORM only. Invalid/absent => null (no active workspace). */
export async function getActiveWorkspace(): Promise<WorkspaceId | null> {
  const raw = (await cookies()).get(WORKSPACE_COOKIE)?.value
  return raw && (VALID as readonly string[]).includes(raw) ? (raw as WorkspaceId) : null
}

/** Ephemeral SESSION cookie — NO maxAge (dies with the browser session). D1: we
 *  keep session STATE, we never PERSIST the preference across logins. */
export async function setActiveWorkspace(ws: WorkspaceId) {
  const cookieStore = await cookies()
  cookieStore.set(WORKSPACE_COOKIE, ws, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })
}

export async function clearActiveWorkspace() {
  const cookieStore = await cookies()
  cookieStore.delete(WORKSPACE_COOKIE)
}
