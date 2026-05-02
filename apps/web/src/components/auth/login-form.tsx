"use client"

import { createClient } from "@/lib/supabase/client"
import { loginSchema } from "@eximia/shared"
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

const inputCls =
  "flex h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 pl-11 text-sm text-white placeholder:text-text-muted/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue-mid/40 focus-visible:border-accent-blue-mid/50 focus-visible:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"

const inputErrorCls =
  "flex h-12 w-full rounded-xl border border-semantic-error/40 bg-semantic-error/5 px-4 pl-11 text-sm text-white placeholder:text-text-muted/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-error/30 disabled:cursor-not-allowed disabled:opacity-50"

const btnPrimaryCls =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-blue-mid text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-[0_4px_20px_rgba(91,141,239,0.3)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"

const btnOutlineCls =
  "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"

interface LoginFormProps {
  loginTitle?: string
  loginSubtitle?: string
  hasTenant?: boolean
  tenantSlug?: string | null
  ssoProviderId?: string | null
  ssoDomain?: string | null
}

export function LoginForm({ loginTitle, loginSubtitle, hasTenant, tenantSlug, ssoProviderId, ssoDomain }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)

  const [hasTenantContext, setHasTenantContext] = useState(!!hasTenant)

  useEffect(() => {
    if (!hasTenantContext) {
      const params = new URLSearchParams(window.location.search)
      const hasInvite = params.has("token") || params.has("token_hash")
      if (hasInvite) setHasTenantContext(true)
    }
  }, [hasTenantContext])

  const urlError = searchParams.get("error")
  const urlErrorMessage = useMemo(() => {
    switch (urlError) {
      case "oauth_cancelled":
        return "Login com Google cancelado"
      case "no_tenant":
        return "Solicite um convite ao administrador"
      case "auth_callback_failed":
        return "Erro na autenticação. Tente novamente."
      case "session_expired":
        return "Sessão expirada. Faça login novamente."
      case "sso_failed":
        return "Erro no login SSO. Tente novamente."
      case "reset_failed":
        return searchParams.get("message") || "Link de redefinição expirado ou inválido."
      default:
        return null
    }
  }, [urlError, searchParams])

  const handleGoogleLogin = useCallback(async () => {
    setGoogleLoading(true)
    setError(null)
    const redirectPath = searchParams.get("next") || tenantHref(tenantSlug ?? null, "/dashboard")
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      },
    })
    if (oauthError) {
      setError("Erro ao iniciar login com Google")
      setGoogleLoading(false)
    }
  }, [searchParams])

  const handleSSOLogin = useCallback(async () => {
    if (!ssoProviderId) return
    setSsoLoading(true)
    setError(null)
    const supabase = createClient()
    const ssoParams = ssoDomain
      ? { domain: ssoDomain }
      : { providerId: ssoProviderId }

    const { error: ssoError } = await supabase.auth.signInWithSSO({
      ...ssoParams,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (ssoError) {
      setError("Erro ao iniciar login SSO")
      setSsoLoading(false)
    }
  }, [ssoProviderId, ssoDomain])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError("Email ou senha inválidos")
      setLoading(false)
      return
    }

    // Validate tenant access and resolve redirect
    try {
      const res = await fetch("/api/auth/validate-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: tenantSlug || null }),
      })
      const data = await res.json()

      if (!data.allowed) {
        await supabase.auth.signOut()
        setError(data.error || "Você não tem acesso a esta organização")
        setLoading(false)
        return
      }

      // Redirect based on validation result
      if (data.superAdmin) {
        router.push("/super-admin/tenants")
      } else if (data.selectOrg) {
        // TODO: implement /select-org page. For now, use first tenant
        const firstTenant = data.tenants?.[0]
        router.push(firstTenant ? `/${firstTenant.slug}/dashboard` : "/login")
      } else if (data.redirectSlug) {
        router.push(`/${data.redirectSlug}/dashboard`)
      } else if (tenantSlug) {
        router.push(`/${tenantSlug}/dashboard`)
      } else {
        router.push("/dashboard")
      }
    } catch {
      router.push(tenantHref(tenantSlug ?? null, "/dashboard"))
    }
    router.refresh()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSent(true)
    setLoading(false)
  }

  if (showReset) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Recuperar senha</h1>
          <p className="mt-1 text-sm text-text-muted">Enviaremos um link para seu email</p>
        </div>
        {resetSent ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-semantic-success/20 bg-semantic-success/5 p-4">
              <p className="text-sm text-semantic-success">
                Email enviado. Verifique sua caixa de entrada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowReset(false); setResetSent(false) }}
              className="text-sm text-accent-blue-mid hover:underline"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/40" />
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={loading} className={btnPrimaryCls}>
              {loading ? "Enviando..." : (<>Enviar link <ArrowRight size={16} /></>)}
            </button>
            <button
              type="button"
              onClick={() => setShowReset(false)}
              className="block text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">
          {loginTitle || "Bem-vindo de volta"}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {loginSubtitle || "Entre com suas credenciais para continuar"}
        </p>
      </div>

      {/* SSO button */}
      {ssoProviderId && (
        <>
          <button type="button" onClick={handleSSOLogin} disabled={ssoLoading} className={btnOutlineCls}>
            <Shield size={18} />
            {ssoLoading ? "Redirecionando..." : "Login Corporativo (SSO)"}
          </button>
          <Divider />
        </>
      )}

      {/* URL error messages */}
      {urlErrorMessage && (
        <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 px-4 py-3 text-sm text-red-400">
          <p>{urlErrorMessage}</p>
          {urlError === "auth_callback_failed" && (
            <button
              type="button"
              onClick={() => { window.location.href = window.location.pathname }}
              className="mt-2 text-xs text-accent-blue-mid hover:underline"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Login form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/40" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className={error ? inputErrorCls : inputCls}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/40" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              required
              autoComplete="current-password"
              className={error ? inputErrorCls : inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-muted transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Forgot password — inline */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs text-text-muted/50 transition-colors hover:text-accent-blue-mid"
          >
            Esqueceu a senha?
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className={btnPrimaryCls}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Entrando...
            </span>
          ) : (
            <>Entrar <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      {/* Google OAuth — disabled until provider is configured */}
    </div>
  )
}

function Shield(props: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={props.size} height={props.size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/[0.06]" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-bg-app px-4 text-text-muted/40">ou</span>
      </div>
    </div>
  )
}
