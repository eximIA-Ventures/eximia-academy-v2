import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
})

export const acceptInviteSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  })

export const resetPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
})

export type LoginInput = z.infer<typeof loginSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
