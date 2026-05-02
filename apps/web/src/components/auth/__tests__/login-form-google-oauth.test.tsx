import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

vi.mock("@eximia/ui", () => ({
  Button: ({ children, disabled, onClick, type, ...rest }: Record<string, unknown>) => {
    const safeProps: Record<string, unknown> = {}
    if (disabled != null) safeProps.disabled = disabled
    if (type != null) safeProps.type = type
    return (
      <button {...safeProps} onClick={onClick as () => void}>
        {children as React.ReactNode}
      </button>
    )
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  FormField: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Input: (props: Record<string, unknown>) => <input {...props} />,
}))

import { LoginForm } from "../login-form"

describe("LoginForm - Google OAuth", () => {
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

  // AC1: Google OAuth button visible with tenant context
  it("shows Google OAuth button when hasTenant is true", () => {
    render(<LoginForm hasTenant={true} />)
    expect(screen.getByText("Continuar com Google")).toBeInTheDocument()
  })

  // AC3a: Google OAuth hidden without tenant context
  it("hides Google OAuth button when hasTenant is false and no invite", () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, hostname: "localhost", search: "" },
      writable: true,
      configurable: true,
    })
    render(<LoginForm hasTenant={false} />)
    expect(screen.queryByText("Continuar com Google")).not.toBeInTheDocument()
  })

  // AC2: handleGoogleLogin calls signInWithOAuth correctly
  it("calls signInWithOAuth with provider google and correct redirectTo", async () => {
    render(<LoginForm hasTenant={true} />)
    const googleBtn = screen.getByText("Continuar com Google")
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining("/api/auth/callback?next="),
        },
      })
    })
  })

  // AC9: Deep link preservation in OAuth redirect
  it("includes next param in redirectTo for deep link preservation", async () => {
    mockSearchParams = new URLSearchParams("next=/courses/123")
    render(<LoginForm hasTenant={true} />)
    const googleBtn = screen.getByText("Continuar com Google")
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining(encodeURIComponent("/courses/123")),
        },
      })
    })
  })

  // AC11: OAuth cancelled error message
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
    expect(
      screen.getByText("Erro na autenticação. Tente novamente."),
    ).toBeInTheDocument()
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument()
  })

  // AC7: Invite token detected as tenant context
  it("detects invite token in URL for tenant context", async () => {
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        hostname: "localhost",
        search: "?token=abc123",
      },
      writable: true,
      configurable: true,
    })
    render(<LoginForm hasTenant={false} />)

    // After useEffect, invite token should enable Google button
    await waitFor(() => {
      expect(screen.getByText("Continuar com Google")).toBeInTheDocument()
    })
  })

  // Separator "ou" visible with tenant context
  it("shows separator 'ou' between form and Google button", () => {
    render(<LoginForm hasTenant={true} />)
    expect(screen.getByText("ou")).toBeInTheDocument()
  })

  // No regression: email/password form still works
  it("still renders email/password form", () => {
    render(<LoginForm hasTenant={true} />)
    expect(screen.getAllByText("Entrar").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument()
  })
})
