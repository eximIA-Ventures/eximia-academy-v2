import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export interface V1Context {
  tenantId: string
  apiKeyId: string
  scopes: string[]
  serviceClient: ReturnType<typeof createServiceClient>
}

export function getV1Context(request: Request): V1Context | null {
  const headers = new Headers(request.headers)
  const tenantId = headers.get("x-api-tenant-id")
  const apiKeyId = headers.get("x-api-key-id")
  const scopesRaw = headers.get("x-api-scopes")

  if (!tenantId || !apiKeyId) return null

  return {
    tenantId,
    apiKeyId,
    scopes: scopesRaw ? scopesRaw.split(",") : [],
    serviceClient: createServiceClient(),
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function paginatedResponse<T extends Record<string, unknown>>(items: T[], limit: number) {
  const hasMore = items.length > limit
  const data = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]?.id : null

  return NextResponse.json({
    data,
    meta: {
      limit,
      next_cursor: nextCursor,
    },
  })
}
