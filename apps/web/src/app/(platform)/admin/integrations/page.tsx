import { getAuthProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { TenantIntegrationsClient } from "./_components/tenant-integrations-client"

export default async function TenantIntegrationsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return tenantRedirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return tenantRedirect("/dashboard")

  const tenantId = profile.tenant_id
  const service = createServiceClient()

  // Check if integration is enabled for this tenant
  const { data: tenant } = await service
    .from("tenants")
    .select("name, settings")
    .eq("id", tenantId)
    .single()

  const settings = (tenant?.settings as Record<string, unknown>) ?? {}
  const integrationEnabled = !!settings.integration_enabled

  // Fetch keys for this tenant
  const { data: keys } = await service
    .from("integration_keys")
    .select("id, app_name, key_prefix, scopes, status, last_used, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  // Fetch outbound connections
  const { data: connections } = await service
    .from("integration_outbound")
    .select("id, remote_app, remote_url, status, entities, last_sync, last_error, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  // Fetch recent logs
  const { data: logs } = await service
    .from("integration_logs")
    .select("id, direction, method, endpoint, entity, status_code, duration_ms, remote_app, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <TenantIntegrationsClient
      tenantName={tenant?.name ?? ""}
      integrationEnabled={integrationEnabled}
      keys={keys ?? []}
      connections={connections ?? []}
      logs={logs ?? []}
    />
  )
}
