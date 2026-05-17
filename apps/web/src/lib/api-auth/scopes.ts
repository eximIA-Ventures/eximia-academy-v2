export const API_SCOPES = [
  "courses:read",
  "blueprints:read",
  "chapters:read",
  "enrollments:read",
  "enrollments:write",
  "users:read",
  "users:write",
  "analytics:read",
  "webhooks:manage",
] as const

export type ApiScope = (typeof API_SCOPES)[number]

export function requireScope(grantedScopes: string[], required: ApiScope): boolean {
  return grantedScopes.includes(required)
}
