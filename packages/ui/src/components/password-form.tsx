"use client"

import { type FormEvent, type HTMLAttributes, forwardRef, useState } from "react"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card"
import { FormField } from "./form-field"
import { Input } from "./input"

export interface PasswordFormProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Called with {password, confirmPassword} on form submit */
  onSubmit: (data: { password: string; confirmPassword: string }) => void
  /** Shows loading state on submit button */
  loading?: boolean
  /** Error message to display on confirm password field */
  error?: string | null
  /** Card title - defaults to "Nova Senha" */
  title?: string
  /** Optional description below title */
  description?: string
  /** Submit button label - defaults to "Salvar" */
  submitLabel?: string
  /** Loading button label - defaults to "Salvando..." */
  loadingLabel?: string
  /** Optional back link handler */
  onBack?: () => void
  /** Back link label - defaults to "Voltar ao login" */
  backLabel?: string
}

const PasswordForm = forwardRef<HTMLDivElement, PasswordFormProps>(
  (
    {
      className,
      onSubmit,
      loading = false,
      error = null,
      title = "Nova Senha",
      description,
      submitLabel = "Salvar",
      loadingLabel = "Salvando...",
      onBack,
      backLabel = "Voltar ao login",
      ...props
    },
    ref,
  ) => {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    function handleSubmit(e: FormEvent) {
      e.preventDefault()
      onSubmit({ password, confirmPassword })
    }

    return (
      <Card ref={ref} className={cn("w-full max-w-sm", className)} {...props}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Senha" htmlFor="password" required>
              <Input
                id="password"
                type="password"
                placeholder="Minimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </FormField>

            <FormField
              label="Confirmar Senha"
              htmlFor="confirmPassword"
              error={error ?? undefined}
              required
            >
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!error}
                disabled={loading}
                required
              />
            </FormField>

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? loadingLabel : submitLabel}
            </Button>

            {onBack && (
              <Button type="button" variant="link" onClick={onBack} className="w-full">
                {backLabel}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    )
  },
)

PasswordForm.displayName = "PasswordForm"

export { PasswordForm }
