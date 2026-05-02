import { createServiceClient } from "@/lib/supabase/service"

export function logApiUsage(params: {
  apiKeyId: string
  tenantId: string
  method: string
  path: string
  statusCode: number
  responseTimeMs: number
  ipAddress: string
  userAgent: string
}): void {
  // Fire-and-forget — never block the response
  const supabase = createServiceClient()
  supabase
    .from("api_key_usage_log")
    .insert({
      api_key_id: params.apiKeyId,
      tenant_id: params.tenantId,
      method: params.method,
      path: params.path,
      status_code: params.statusCode,
      response_time_ms: params.responseTimeMs,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    })
    .then(({ error }) => {
      if (error) console.warn("[api-usage] Failed to log:", error.message)
    })
}
