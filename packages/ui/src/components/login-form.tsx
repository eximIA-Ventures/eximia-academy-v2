"use client"

import { type FormEvent, type HTMLAttributes, forwardRef, useState } from "react"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { FormField } from "./form-field"
import { Input } from "./input"

export interface LoginFormProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Called with {email, password} on form submit */
  onSubmit: (data: { email: string; password: string }) => void
  /** Called when "Forgot password" is clicked */
  onForgotPassword?: () => void
  /** Shows loading state on submit button */
  loading?: boolean
  /** Error message to display */
  error?: string | null
  /** Card title - defaults to "Entrar" */
  title?: string
  /** Submit button label - defaults to "Entrar" */
  submitLabel?: string
  /** Loading button label - defaults to "Entrando..." */
  loadingLabel?: string
}

const LoginForm = forwardRef<HTMLDivElement, LoginFormProps>(
  (
    {
      className,
      onSubmit,
      onForgotPassword,
      loading = false,
      error = null,
      title = "Entrar",
      submitLabel = "Entrar",
      loadingLabel = "Entrando...",
      ...props
    },
    ref,
  ) => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault()
      onSubmit({ email, password })
    }

    return (
      <Card ref={ref} className={cn("w-full max-w-sm", className)} {...props}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <p className="text-sm text-semantic-error" role="alert">
                {error}
              </p>
            )}

            <FormField label="E-mail" htmlFor="login-email" required>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                error={!!error}
                aria-required="true"
              />
            </FormField>

            <FormField label="Senha" htmlFor="login-password" required>
              <Input
                id="login-password"
                type="password"
                placeholder="********"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                error={!!error}
                aria-required="true"
              />
            </FormField>

            {onForgotPassword && (
              <button
                type="button"
                className="self-end text-sm text-accent-blue-mid hover:text-accent-blue-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-mid focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app rounded-sm"
                onClick={onForgotPassword}
              >
                Esqueceu a senha?
              </button>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? loadingLabel : submitLabel}
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  },
)

LoginForm.displayName = "LoginForm"

export { LoginForm }
