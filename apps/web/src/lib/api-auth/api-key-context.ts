import type { NextRequest } from "next/server"

import type { ValidatedApiKey } from "./api-key-validator"
import { validateApiKey } from "./api-key-validator"

export interface ApiKeyContext {
  apiKey: ValidatedApiKey
  tenantId: string
  scopes: string[]
}

export async function extractApiKeyContext(request: NextRequest): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const rawKey = authHeader.slice(7)
  if (!rawKey.startsWith("exa_live_")) return null

  const apiKey = await validateApiKey(rawKey)
  if (!apiKey) return null

  return {
    apiKey,
    tenantId: apiKey.tenantId,
    scopes: apiKey.scopes,
  }
}
