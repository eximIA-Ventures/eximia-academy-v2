import { createServiceClient } from "@/lib/supabase/service"

interface LogAdminActionParams {
  actorId: string
  tenantId: string | null
  action: string
  // CFG-7.1: `department` é aditivo e distinto de `area` de propósito — `area`
  // é a UNIDADE (tabela `areas`) e `department` é a "Área" do vocabulário de
  // produto (tabela `departments`). Registrar os dois sob o mesmo rótulo tornaria
  // a auditoria cúmplice da ambiguidade que a migration 20260728120000 desfez.
  // A coluna `target_type` é TEXT livre no banco: a mudança é só de tipo.
  targetType:
    | "tenant"
    | "user"
    | "area"
    | "department"
    | "api_key"
    | "webhook"
    | "sso"
    | "integration"
    | "settings"
  targetId: string
  details?: Record<string, unknown>
}

/**
 * Generic tenant-scoped admin audit helper. `platform_audit_log` has no
 * tenant_id column, so the tenant scope is recorded inside `details`.
 * Fail-open: a logging failure NEVER breaks the request.
 */
export async function logAdminAction({
  actorId,
  tenantId,
  action,
  targetType,
  targetId,
  details,
}: LogAdminActionParams) {
  try {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.from("platform_audit_log").insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: { tenant_id: tenantId, ...(details || {}) },
    })

    if (error) {
      console.error(`[audit] Failed to log action "${action}":`, error.message)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[audit] Failed to log action "${action}":`, message)
  }
}

export async function logSuperAdminAction(
  userId: string,
  action: string,
  targetType: "tenant" | "user",
  targetId: string,
  details?: Record<string, unknown>,
) {
  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from("platform_audit_log").insert({
    actor_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || {},
  })

  if (error) {
    console.error(`[audit] Failed to log action "${action}":`, error.message)
  }
}
