import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ---
const mockPush = vi.fn()
const mockRefresh = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}))

const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null })

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({}),
    },
  }),
}))

vi.mock("@eximia/shared", () => ({
  loginSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true }),
  },
}))

import { LoginForm } from "../login-form"

// eximia-academy-v2/apps/web/src/components/auth/login-form.tsx mantém
// GoogleLogo/handleGoogleLogin/googleLoading/hasTenantContext no código-fonte,
// mas nenhum deles está ligado ao JSX — o comentário no componente diz
// "Google OAuth — disabled until provider is configured" desde o import
// inicial do v1 (commit d65f3a5). Este teste documenta o comportamento REAL
// hoje (nenhum botão do Google, nenhum separador "ou" sem SSO), em vez de
// testar uma feature nunca ligada à UI. Se o Google OAuth for reativado,
// este arquivo deve voltar a cobrir clique/redirectTo/deep-link.
describe("LoginForm - Google OAuth (atualmente desativado)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    Object.defineProperty(window, "location", {
      value: {
        hostname: "demo.eximia.academy",
        search: "",
        origin: "https://demo.eximia.academy",
        pathname: "/login",
        href: "https://demo.eximia.academy/login",
      },
      writable: true,
      configurable: true,
    })
  })

  it("não renderiza botão do Google mesmo com hasTenant=true (feature desligada no componente)", () => {
    render(<LoginForm hasTenant={true} />)
    expect(screen.queryByText("Continuar com Google")).not.toBeInTheDocument()
  })

  it("não renderiza botão do Google com hasTenant=false", () => {
    render(<LoginForm hasTenant={false} />)
    expect(screen.queryByText("Continuar com Google")).not.toBeInTheDocument()
  })

  it("não renderiza separador 'ou' sem SSO configurado (Divider só aparece junto do botão SSO)", () => {
    render(<LoginForm hasTenant={true} />)
    expect(screen.queryByText("ou")).not.toBeInTheDocument()
  })

  it("nunca chama signInWithOAuth (não há botão para disparar)", () => {
    render(<LoginForm hasTenant={true} />)
    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
  })

  // AC11: OAuth cancelled error message — a mensagem de erro por query param
  // continua funcionando independente do botão estar desligado.
  it("shows 'Login com Google cancelado' for oauth_cancelled error", () => {
    mockSearchParams = new URLSearchParams("error=oauth_cancelled")
    render(<LoginForm hasTenant={true} />)
    expect(screen.getByText("Login com Google cancelado")).toBeInTheDocument()
  })

  // AC12: No tenant error message
  it("shows 'Solicite um convite ao administrador' for no_tenant error", () => {
    mockSearchParams = new URLSearchParams("error=no_tenant")
    render(<LoginForm hasTenant={true} />)
    expect(screen.getByText("Solicite um convite ao administrador")).toBeInTheDocument()
  })

  // AC13: Callback failed error with retry
  it("shows callback failed error with retry button", () => {
    mockSearchParams = new URLSearchParams("error=auth_callback_failed")
    render(<LoginForm hasTenant={true} />)
    expect(screen.getByText("Erro na autenticação. Tente novamente.")).toBeInTheDocument()
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument()
  })

  // No regression: email/password form still works
  it("still renders email/password form", () => {
    render(<LoginForm hasTenant={true} />)
    expect(screen.getAllByText("Entrar").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Senha")).toBeInTheDocument()
  })
})
