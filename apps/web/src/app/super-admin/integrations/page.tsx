import { createServiceClient } from "@/lib/supabase/service"
import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { IntegrationsClient } from "./_components/integrations-client"

export default async function IntegrationsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile || profile.role !== "super_admin") redirect("/login")

  const service = createServiceClient()

  // Get all tenants with integration status
  const { data: tenants } = await service
    .from("tenants")
    .select("id, name, slug, settings, status")
    .order("name")

  // Get all integration keys (cross-tenant for super admin)
  const { data: keys } = await service
    .from("integration_keys")
    .select("id, tenant_id, app_name, key_prefix, scopes, status, last_used, expires_at, created_at")
    .order("created_at", { ascending: false })

  // Get recent logs
  const { data: logs } = await service
    .from("integration_logs")
    .select("id, tenant_id, direction, method, endpoint, entity, status_code, duration_ms, remote_app, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <IntegrationsClient
      tenants={tenants ?? []}
      keys={keys ?? []}
      logs={logs ?? []}
    />
  )
}
