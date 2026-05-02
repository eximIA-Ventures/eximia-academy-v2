"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import { useState } from "react"
import { Button, Input } from "@eximia/ui"
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
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-text-secondary">E-mail</label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seunome@empresa.com"
          autoComplete="email"
          autoFocus
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-text-secondary">Senha</label>
        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

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
        isLoading={pending}
        className="w-full h-11 text-sm font-semibold"
      >
        Entrar
      </Button>
    </form>
  )
}
