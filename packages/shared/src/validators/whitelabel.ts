import { z } from "zod"

export const whitelabelConfigSchema = z.object({
  custom_texts: z
    .object({
      app_name: z.string().max(100).optional(),
      tagline: z.string().max(200).optional(),
      login_title: z.string().max(50).optional(),
      login_subtitle: z.string().max(200).optional(),
    })
    .optional(),
  favicon_url: z.string().url().nullable().optional(),
  footer_text: z.string().max(200).optional(),
  support_email: z.string().email().optional(),
  custom_css: z.string().max(5000).optional(),
})

export type WhitelabelConfigInput = z.infer<typeof whitelabelConfigSchema>

export const slugSchema = z
  .string()
  .min(3, "Slug deve ter no minimo 3 caracteres")
  .max(50, "Slug deve ter no maximo 50 caracteres")
  .regex(/^[a-z0-9]/, "Slug deve comecar com letra ou numero")
  .regex(/[a-z0-9]$/, "Slug deve terminar com letra ou numero")
  .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, numeros e hífens")

export const createTenantSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  slug: slugSchema,
  plan: z.enum(["essencial", "standard", "premium"]),
  branding: z
    .object({
      logo_url: z.string().url().optional(),
      primary_color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Cor hexadecimal invalida")
        .optional(),
      secondary_color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Cor hexadecimal invalida")
        .optional(),
    })
    .optional(),
  settings: z
    .object({
      ai_model: z.string().optional(),
      max_interactions_per_session: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
  initial_manager: z
    .object({
      email: z.string().email("Email inválido"),
      full_name: z.string().min(1, "Nome obrigatório"),
      role: z.enum(["admin", "manager"]),
    })
    .optional(),
})

export type CreateTenantInput = z.infer<typeof createTenantSchema>

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  plan: z.enum(["essencial", "standard", "premium"]).optional(),
  whitelabel_enabled: z.boolean().optional(),
  whitelabel_config: whitelabelConfigSchema.optional(),
  settings: z
    .object({
      ai_model: z.string().optional(),
      max_interactions_per_session: z.number().int().min(1).max(20).optional(),
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
  status: z.enum(["active", "inactive"]).optional(),
})

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>
