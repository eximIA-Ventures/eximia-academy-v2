"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import { useState } from "react"
import { Button } from "@eximia/ui"
import { Input } from "@eximia/ui"
import { signIn } from "../actions"

interface LoginFormProps {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [state, action, pending] = useActionState(signIn, null)

  useEffect(() => {
    if (state && !state.error) {
      router.push(redirectTo || "/dashboard")
      router.refresh()
    }
  }, [state, redirectTo, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        name="email"
        type="email"
        label="E-mail"
        placeholder="seunome@empresa.com"
        autoComplete="email"
        autoFocus
        required
        leftIcon={<Mail className="h-4 w-4" />}
      />

      <Input
        name="password"
        type={showPassword ? "text" : "password"}
        label="Senha"
        placeholder="••••••••"
        autoComplete="current-password"
        required
        leftIcon={<Lock className="h-4 w-4" />}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="p-1 -mr-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
      />

      {state?.error && (
        <div
          className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5"
          role="alert"
        >
          <span className="text-sm text-destructive">{state.error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <a
          href="/reset-password"
          className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150"
        >
          Esqueceu a senha?
        </a>
      </div>

      <Button
        type="submit"
        loading={pending}
        className="w-full h-11 text-sm font-semibold"
      >
        Entrar
      </Button>
    </form>
  )
}
