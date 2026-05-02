export const API_SCOPES = [
  "courses:read",
  "blueprints:read",
  "chapters:read",
  "enrollments:read",
  "analytics:read",
  "webhooks:manage",
] as const

export type ApiScope = (typeof API_SCOPES)[number]

export function requireScope(grantedScopes: string[], required: ApiScope): boolean {
  return grantedScopes.includes(required)
}
