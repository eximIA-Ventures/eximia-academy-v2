import type { NextRequest } from "next/server"

/**
 * Derives the absolute base URL from request headers.
 * Reads x-forwarded-proto / x-forwarded-host (set by Traefik/nginx in production)
 * and falls back to the host header, then to NEXT_PUBLIC_APP_URL.
 */
export function getBaseUrl(request: Request | NextRequest): string {
  const headers = request.headers

  const proto = headers.get("x-forwarded-proto") ?? "https"
  const host = headers.get("x-forwarded-host") ?? headers.get("host")

  if (host) {
    return `${proto}://${host}`
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}
