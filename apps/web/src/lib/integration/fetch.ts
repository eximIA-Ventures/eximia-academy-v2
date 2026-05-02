import { createServiceClient } from "@/lib/supabase/service"
import { decryptKey } from "./helpers"

interface FetchOptions {
  tenantId: string
  connectionId: string
  method?: string
  path: string
  body?: unknown
}

/** Fetch from a remote eximIA app with auto-logging */
export async function integrationFetch({ tenantId, connectionId, method = "GET", path, body }: FetchOptions) {
  const supabase = createServiceClient()

  const { data: conn } = await supabase
    .from("integration_outbound")
    .select("remote_app, remote_url, api_key_encrypted, status")
    .eq("id", connectionId)
    .eq("tenant_id", tenantId)
    .single()

  if (!conn) throw new Error("Connection not found")
  if (conn.status === "disabled") throw new Error("Connection disabled")

  const apiKey = decryptKey(conn.api_key_encrypted)
  const url = `${conn.remote_url.replace(/\/$/, "")}/api/v1/integration${path}`

  const start = Date.now()
  let statusCode = 0

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-eximia-api-key": apiKey,
        "x-eximia-contract-version": "v1",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    statusCode = res.status
    const data = await res.json()

    // Update connection status
    if (res.ok) {
      await supabase
        .from("integration_outbound")
        .update({ status: "active", last_sync: new Date().toISOString(), last_error: null })
        .eq("id", connectionId)
    } else {
      await supabase
        .from("integration_outbound")
        .update({ status: "error", last_error: data.error ?? `HTTP ${res.status}` })
        .eq("id", connectionId)
    }

    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    statusCode = 0
    const message = err instanceof Error ? err.message : "Network error"
    await supabase
      .from("integration_outbound")
      .update({ status: "error", last_error: message })
      .eq("id", connectionId)
    throw err
  } finally {
    const duration = Date.now() - start
    await supabase.from("integration_logs").insert({
      tenant_id: tenantId,
      direction: "outbound",
      method,
      endpoint: path,
      entity: path.split("/").filter(Boolean)[0] ?? null,
      status_code: statusCode,
      duration_ms: duration,
      remote_app: conn.remote_app,
    })
  }
}
