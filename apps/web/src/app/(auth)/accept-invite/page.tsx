"use client"

import { useTenantNav } from "@/lib/hooks/use-tenant-nav"
import { createClient } from "@/lib/supabase/client"
import { acceptInviteSchema } from "@eximia/shared"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Skeleton,
} from "@eximia/ui"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

function AcceptInviteForm() {
  const { push } = useTenantNav()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenError, setTokenError] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function processInvite() {
      const hash = typeof window !== "undefined" ? window.location.hash : ""
      const isInviteRedirect = hash.includes("access_token")
      const code = searchParams.get("code")
      const token = searchParams.get("token")
      const type = searchParams.get("type")

      // Case 1: Implicit flow — Supabase redirected with #access_token=...
      // The browser client already detected the hash and set the invited user's session
      if (isInviteRedirect) {
        setVerifying(false)
        return
      }

      // Case 2: PKCE flow — Supabase redirected with ?code=...
      if (code) {
        await supabase.auth.signOut({ scope: "local" })
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)
        if (codeError) setTokenError(true)
        setVerifying(false)
        return
      }

      // Case 3: Direct OTP token — ?token=...&type=invite
      if (token && type === "invite") {
        await supabase.auth.signOut({ scope: "local" })
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "invite",
        })
        if (verifyError) setTokenError(true)
        setVerifying(false)
        return
      }

      // No invite data found — invalid or expired link
      setTokenError(true)
      setVerifying(false)
    }

    processInvite()
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const result = acceptInviteSchema.safeParse({ password, confirmPassword })
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const metadata = user.user_metadata
      await supabase.from("users").upsert({
        id: user.id,
        tenant_id: metadata.tenant_id,
        email: user.email,
        full_name: metadata.full_name || "Novo Usuário",
        role: metadata.role || "student",
      })
    }

    push("/dashboard")
    router.refresh()
  }

  if (verifying) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tokenError) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Convite Inválido</CardTitle>
          <CardDescription>
            O link de convite é inválido ou expirou. Solicite um novo convite ao administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Definir Senha</CardTitle>
        <CardDescription>Crie uma senha para acessar a plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Senha" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </FormField>
          <FormField label="Confirmar Senha" htmlFor="confirmPassword" error={error ?? undefined}>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              error={!!error}
              required
            />
          </FormField>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Criar conta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="p-8">
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardContent>
        </Card>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  )
}
