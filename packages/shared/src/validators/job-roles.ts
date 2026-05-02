import { z } from "zod"

export const createJobRoleSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  area_id: z.string().uuid("ID de area inválido").nullable().optional(),
  seniority_level: z.enum(["junior", "mid", "senior", "lead", "manager"]).default("mid"),
  description: z.string().max(500).nullable().optional(),
})

export type CreateJobRoleInput = z.infer<typeof createJobRoleSchema>

export const updateJobRoleSchema = createJobRoleSchema.partial()

export type UpdateJobRoleInput = z.infer<typeof updateJobRoleSchema>
