import { createServiceClient } from "@/lib/supabase/service"

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
