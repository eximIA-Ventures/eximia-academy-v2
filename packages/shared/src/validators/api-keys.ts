import { z } from "zod"

export const API_SCOPES = [
  "courses:read",
  "blueprints:read",
  "chapters:read",
  "enrollments:read",
  "analytics:read",
  "webhooks:manage",
] as const

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Pelo menos um scope é obrigatório"),
  rate_limit_rpm: z.number().int().min(1).max(10000).default(60),
  rate_limit_rpd: z.number().int().min(1).max(1000000).default(10000),
  cors_origins: z.array(z.string().url("Origem CORS inválida")).default([]),
  expires_at: z.string().datetime().optional(),
})

export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
  rate_limit_rpm: z.number().int().min(1).max(10000).optional(),
  rate_limit_rpd: z.number().int().min(1).max(1000000).optional(),
  cors_origins: z.array(z.string().url()).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
})

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>
