import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_API_HEADERS = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
}

export function handleCorsPreflightPublicApi(
  request: NextRequest,
  allowedOrigins: string[],
): NextResponse | null {
  if (request.method !== "OPTIONS") return null

  const origin = request.headers.get("origin") ?? ""

  // Reject CORS preflight if no origins are configured for this API key
  if (allowedOrigins.length === 0) {
    return new NextResponse(null, { status: 403 })
  }

  const isAllowed = allowedOrigins.includes(origin)

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...PUBLIC_API_HEADERS,
      "Access-Control-Allow-Origin": isAllowed ? origin : "",
    },
  })
}

export function applyCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  allowedOrigins: string[],
): NextResponse {
  const origin = request.headers.get("origin") ?? ""

  if (allowedOrigins.length === 0) {
    // No wildcard — API keys must explicitly configure allowed origins
    return response
  }

  if (allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Vary", "Origin")
  }

  return response
}
