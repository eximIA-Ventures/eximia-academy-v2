import * as Sentry from "@sentry/nextjs"

export function setSentryContext(userId: string, tenantId: string, route: string) {
  Sentry.setUser({ id: userId })
  Sentry.setTag("tenant_id", tenantId)
  Sentry.setTag("route", route)
}
