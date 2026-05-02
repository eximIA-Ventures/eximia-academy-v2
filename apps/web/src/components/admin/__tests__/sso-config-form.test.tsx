import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@eximia/ui", () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
  Button: ({ children, disabled, onClick, variant }: Record<string, unknown>) => (
    <button disabled={disabled as boolean} onClick={onClick as () => void} data-variant={variant as string}>
      {children as React.ReactNode}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  FormField: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Input: (props: Record<string, unknown>) => <input {...props} />,
}))

import { SSOConfigForm } from "../sso-config-form"

describe("SSOConfigForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    global.confirm = vi.fn().mockReturnValue(true)
  })

  it("shows 'SSO Nao Configurado' badge when not configured", () => {
    render(<SSOConfigForm ssoConfigured={false} tenantId="t1" />)
    expect(screen.getByText("SSO Nao Configurado")).toBeInTheDocument()
  })

  it("shows 'SSO Configurado' badge when configured", () => {
    render(<SSOConfigForm ssoConfigured={true} tenantId="t1" />)
    expect(screen.getByText("SSO Configurado")).toBeInTheDocument()
  })

  it("shows configuration form when not configured", () => {
    render(<SSOConfigForm ssoConfigured={false} tenantId="t1" />)
    expect(screen.getByText("Metadata URL (recomendado)")).toBeInTheDocument()
    expect(screen.getByText("Metadata XML")).toBeInTheDocument()
    expect(screen.getByText("Configurar SAML SSO")).toBeInTheDocument()
  })

  it("shows remove button when configured", () => {
    render(<SSOConfigForm ssoConfigured={true} tenantId="t1" />)
    expect(screen.getByText("Remover Configuração SSO")).toBeInTheDocument()
  })

  it("calls POST /api/admin/sso on submit with metadata_url", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ configured: true, provider_id: "p1" }),
    })
    global.fetch = mockFetch

    render(<SSOConfigForm ssoConfigured={false} tenantId="t1" />)

    const urlInput = screen.getByPlaceholderText(
      "https://login.microsoftonline.com/.../federationmetadata.xml",
    )
    fireEvent.change(urlInput, {
      target: { value: "https://idp.example.com/metadata.xml" },
    })

    fireEvent.click(screen.getByText("Configurar SAML SSO"))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("metadata_url"),
      })
    })
  })

  it("calls DELETE /api/admin/sso on remove", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ configured: false }),
    })
    global.fetch = mockFetch

    render(<SSOConfigForm ssoConfigured={true} tenantId="t1" />)

    fireEvent.click(screen.getByText("Remover Configuração SSO"))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/sso", {
        method: "DELETE",
      })
    })
  })

  it("shows session timeout input", () => {
    render(
      <SSOConfigForm
        ssoConfigured={false}
        tenantId="t1"
        sessionTimeoutHours={12}
      />,
    )
    expect(screen.getByText("Timeout de Sessão")).toBeInTheDocument()
    const timeoutInput = screen.getByDisplayValue("12")
    expect(timeoutInput).toBeInTheDocument()
  })

  it("non-admin receives 403 from API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    })
    global.fetch = mockFetch

    render(<SSOConfigForm ssoConfigured={false} tenantId="t1" />)

    const urlInput = screen.getByPlaceholderText(
      "https://login.microsoftonline.com/.../federationmetadata.xml",
    )
    fireEvent.change(urlInput, {
      target: { value: "https://idp.example.com/metadata.xml" },
    })

    fireEvent.click(screen.getByText("Configurar SAML SSO"))

    await waitFor(() => {
      expect(screen.getByText("Unauthorized")).toBeInTheDocument()
    })
  })
})
