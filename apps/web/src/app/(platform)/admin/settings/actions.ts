"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

const tenantSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  branding: z
    .object({
      logo_url: z.string().url().optional().or(z.literal("")),
      primary_color: z.string().regex(HEX_COLOR_RE, "Cor hexadecimal invalida").optional(),
      secondary_color: z.string().regex(HEX_COLOR_RE, "Cor hexadecimal invalida").optional(),
    })
    .optional(),
  settings: z
    .object({
      max_interactions_per_session: z.number().int().min(1).max(20).optional(),
      ai_model: z
        .enum([
          "claude-sonnet-4-5",
          "claude-haiku-4-5",
          "claude-opus-4",
          "gpt-4o",
          "gpt-4o-mini",
        ])
        .optional(),
      enrollment_mode: z.enum(["open", "assigned"]).optional(),
      features: z
        .object({
          ai_detection: z.boolean().optional(),
          learning_journal: z.boolean().optional(),
          certificates: z.boolean().optional(),
          analytics_dashboard: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
})

export type TenantSettingsPayload = z.infer<typeof tenantSettingsSchema>

export async function saveTenantSettings(payload: TenantSettingsPayload) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role))
    return { error: "Acesso negado" }

  // Resolve tenant_id: super_admin uses active tenant cookie
  const tenantId =
    profile.role === "super_admin"
      ? await getActiveTenantForSuperAdmin()
      : profile.tenant_id

  if (!tenantId) return { error: "Nenhum tenant ativo selecionado" }

  const parsed = tenantSettingsSchema.safeParse(payload)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  // Load current tenant to merge JSONB fields
  const { data: currentTenant } = await supabase
    .from("tenants")
    .select("branding, settings")
    .eq("id", tenantId)
    .single()

  const currentBranding = (currentTenant?.branding as Record<string, unknown>) || {}
  const currentSettings = (currentTenant?.settings as Record<string, unknown>) || {}

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name

  if (parsed.data.branding) {
    updateData.branding = { ...currentBranding, ...parsed.data.branding }
  }

  if (parsed.data.settings) {
    const merged = { ...currentSettings }
    if (parsed.data.settings.max_interactions_per_session !== undefined) {
      merged.max_interactions_per_session = parsed.data.settings.max_interactions_per_session
    }
    if (parsed.data.settings.ai_model !== undefined) {
      merged.ai_model = parsed.data.settings.ai_model
    }
    if (parsed.data.settings.enrollment_mode !== undefined) {
      merged.enrollment_mode = parsed.data.settings.enrollment_mode
    }
    if (parsed.data.settings.features) {
      const currentFeatures = (currentSettings.features as Record<string, unknown>) || {}
      merged.features = { ...currentFeatures, ...parsed.data.settings.features }
    }
    updateData.settings = merged
  }

  const { error } = await supabase.from("tenants").update(updateData).eq("id", tenantId)

  if (error) return { error: error.message }

  revalidatePath("/admin/settings")
  revalidatePath("/", "layout")

  return { success: true }
}
