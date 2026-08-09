"use server"

import { logAdminAction } from "@/lib/audit"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// =============================================================================
// Correção de auditoria (rodada 3) — eixo E resolução de tenant.
//
// (a) EIXO: o gate era `["admin","super_admin"].includes(profile.role)`, a coluna
//     SINGULAR, enquanto a tela que dispara esta action já abre por chapéus. Esta
//     action foi TOCADA por esta frente (ganhou `logAdminAction`), então o eixo
//     dela é responsabilidade desta frente. Agora é `hasAnyRole` sobre a união de
//     chapéus, com o conjunto permitido INALTERADO (admin-tier).
//
// (b) TENANT: `profile.role === "super_admin" ? null : profile.tenant_id` dava
//     SEMPRE `null` para o super_admin — o comentário jurava "usa active tenant
//     cookie" e a linha fazia o oposto. Resultado: o dono do produto (super_admin)
//     podia abrir Configurações mas NENHUM salvamento passava, sempre "Nenhum
//     tenant ativo selecionado". Meia-porta: o loader lê e a gravação recusa. Os
//     dois foram corrigidos juntos, pelo MESMO `resolveTenantId`.
//
// A escrita continua no client AUTENTICADO (RLS ativo) de propósito: resolver o
// tenant não é motivo para dar bypass de RLS a um caminho de escrita. Como o RLS
// pode recusar em silêncio (UPDATE que casa 0 linhas devolve `error: null`), o
// update passou a devolver as linhas afetadas e a falha vira mensagem honesta.
// =============================================================================

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
        .enum(["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4", "gpt-4o", "gpt-4o-mini"])
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
  const { user, profile, roles, supabase } = await getAuthProfile()

  if (!user) return { error: "Não autenticado" }

  // Gate por CHAPÉU real (regra dura 3), conjunto permitido inalterado.
  if (!profile || !hasAnyRole({ roles }, ["admin", "super_admin"]))
    return { error: "Acesso negado" }

  // Tenant próprio -> cookie `x-sa-active-tenant` (o seletor do topo) ->
  // primeiro tenant do banco. Mesmo caminho do loader desta mesma tela.
  const tenantId = await resolveTenantId(profile.tenant_id)

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

  // `.select("id")` para NÃO confundir "RLS recusou" com "salvou": um UPDATE que
  // não casa nenhuma linha devolve `error: null`, e sem isto a tela diria
  // "salvo" sem ter salvado nada.
  const { data: updated, error } = await supabase
    .from("tenants")
    .update(updateData)
    .eq("id", tenantId)
    .select("id")

  if (error) return { error: error.message }
  if (!updated || updated.length === 0)
    return {
      error: "Não foi possível salvar: esta conta não tem permissão de escrita nesta empresa.",
    }

  await logAdminAction({
    actorId: user.id,
    tenantId,
    action: "settings.updated",
    targetType: "settings",
    targetId: tenantId,
    details: {
      campos_alterados: Object.keys(updateData).filter((k) => k !== "updated_at"),
      ...(parsed.data.settings?.features
        ? { features: Object.keys(parsed.data.settings.features) }
        : {}),
    },
  })

  revalidatePath("/admin/settings")
  revalidatePath("/", "layout")

  return { success: true }
}
