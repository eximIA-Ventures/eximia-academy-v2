import { z } from "zod"

export const WEBHOOK_EVENTS = [
  "course.created",
  "course.updated",
  "blueprint.generated",
  "enrollment.created",
] as const

export const createWebhookSchema = z.object({
  url: z.string().url("URL inválida"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pelo menos um evento é obrigatório"),
})

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  is_active: z.boolean().optional(),
})

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>
