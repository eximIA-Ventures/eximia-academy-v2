import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Hoisted mocks (vi.mock factories are hoisted, so variables must be too) ---
const {
  mockExchangeCodeForSession,
  mockGetUser,
  mockServiceSelect,
  mockServiceUpdate,
  mockServiceEqAfterUpdate,
} = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockServiceSelect: vi.fn(),
  mockServiceUpdate: vi.fn(),
  mockServiceEqAfterUpdate: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: mockServiceSelect,
          update: mockServiceUpdate,
        }
      }
      return {}
    }),
  }),
}))

import { GET } from "../route"

function getRedirectLocation(response: Response): string {
  return response.headers.get("location") || ""
}

describe("Auth Callback Route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          app_metadata: { provider: "email" },
          user_metadata: {},
          email: "test@test.com",
        },
      },
    })
  })

  // --- OAuth Error Handling (AC11, AC13) ---

  it("redirects to login with oauth_cancelled on access_denied", async () => {
    const request = new Request("http://localhost/api/auth/callback?error=access_denied")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("error=oauth_cancelled")
  })

  it("redirects to login with auth_callback_failed on generic OAuth error", async () => {
    const request = new Request("http://localhost/api/auth/callback?error=server_error")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("error=auth_callback_failed")
  })

  it("redirects with auth_callback_failed when no code is present", async () => {
    const request = new Request("http://localhost/api/auth/callback")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("error=auth_callback_failed")
  })

  it("redirects with auth_callback_failed when code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: new Error("expired") })
    const request = new Request("http://localhost/api/auth/callback?code=bad-code")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("error=auth_callback_failed")
  })

  // --- Successful Code Exchange ---

  it("redirects to /workspace on successful code exchange", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("/workspace")
  })

  // AC9: Deep link preservation
  it("preserves deep link via next param", async () => {
    const request = new Request(
      "http://localhost/api/auth/callback?code=valid-code&next=/courses/123",
    )
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("/courses/123")
  })

  // --- Google Profile Sync (AC5, AC6) ---

  // ATUALIZADO EM 2026-07-28, e a mudança é DELIBERADA.
  //
  // Este teste afirmava que a rota escrevia `avatar_url`. A coluna NÃO EXISTE no
  // banco: em produção aquela escrita voltava `PGRST204` e era descartada em
  // silêncio. O teste passava porque o mock aceita qualquer payload — ou seja, o
  // harness era mais permissivo que o banco, que é a mesma família de defeito
  // que deixou o bug de produção invisível. Agora ele afirma o que o código faz
  // e deve fazer: sincroniza o NOME e nunca escreve a coluna fantasma.
  it("sincroniza o nome do Google e NUNCA escreve avatar_url", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          app_metadata: { provider: "google" },
          user_metadata: {
            avatar_url: "https://lh3.google.com/photo.jpg",
            full_name: "John Doe",
          },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "user-1", avatar_url: null, full_name: null, tenant_id: "tenant-1" },
        }),
      }),
    })

    mockServiceUpdate.mockReturnValue({
      eq: mockServiceEqAfterUpdate,
    })

    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)

    expect(mockServiceUpdate).toHaveBeenCalledWith({ full_name: "John Doe" })
    // Explícito: a coluna inexistente não pode voltar por descuido.
    expect(mockServiceUpdate.mock.calls[0]?.[0]).not.toHaveProperty("avatar_url")
    expect(getRedirectLocation(response)).toContain("/workspace")
  })

  // AC5/AC6: Does NOT overwrite existing data
  it("does NOT overwrite existing avatar and name", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          app_metadata: { provider: "google" },
          user_metadata: {
            avatar_url: "https://lh3.google.com/new-photo.jpg",
            full_name: "New Name",
          },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "user-1",
            avatar_url: "https://existing-avatar.jpg",
            full_name: "Existing Name",
            tenant_id: "tenant-1",
          },
        }),
      }),
    })

    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    await GET(request)

    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  // --- Tenant Context Enforcement (AC3a, AC12) ---

  it("redirects with no_tenant for Google user without tenant context", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-new",
          app_metadata: { provider: "google" },
          user_metadata: {},
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    })

    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("error=no_tenant")
  })

  // AC4/AC7 — ATUALIZADO EM 2026-07-28, mudança DELIBERADA.
  //
  // A premissa antiga ("só atualiza o avatar vazio") deixou de existir junto com
  // a coluna. O que sobra é mais forte e é o que este teste passa a provar:
  // quando a ÚNICA coisa que faltaria era o avatar, NENHUMA escrita acontece —
  // a rota não dispara um `update` inútil que o banco recusaria.
  it("quando só faltaria o avatar, NENHUMA escrita acontece", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-invited",
          app_metadata: { provider: "google" },
          user_metadata: {
            avatar_url: "https://lh3.google.com/photo.jpg",
            full_name: "Invited User",
          },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "user-invited",
            avatar_url: null,
            full_name: "Invited User",
            tenant_id: "tenant-1",
          },
        }),
      }),
    })

    mockServiceUpdate.mockReturnValue({
      eq: mockServiceEqAfterUpdate,
    })

    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)

    // O nome já existe e o avatar não é mais sincronizável: nada a escrever.
    expect(mockServiceUpdate).not.toHaveBeenCalled()
    expect(getRedirectLocation(response)).toContain("/workspace")
    expect(getRedirectLocation(response)).not.toContain("error=")
  })

  // Cobre a correção ESTRUTURAL de 2026-07-28, que não tinha teste.
  //
  // Era o dano real do `avatar_url` aqui: o select falhava com `42703`, o código
  // lia `data: null` como "esta pessoa não existe" e caía no ramo de CRIAÇÃO
  // para quem JÁ EXISTE — e, sem `tenant_id` no metadata, isso terminava em
  // `error=no_tenant`. Ou seja, um erro de banco derrubava o login.
  it("erro na consulta NÃO vira 'usuário não existe' e não derruba o login", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-existente",
          app_metadata: { provider: "google" },
          // Sem `tenant_id`: se o código cair no ramo de criação, o teste vê
          // `error=no_tenant` e falha. É esse o sinal que queremos vigiar.
          user_metadata: { full_name: "Pessoa Real" },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "42703", message: "column users.qualquer_coisa does not exist" },
        }),
      }),
    })

    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)

    expect(getRedirectLocation(response)).not.toContain("error=no_tenant")
    expect(getRedirectLocation(response)).toContain("/workspace")
    expect(mockServiceUpdate).not.toHaveBeenCalled()
  })

  // O contraponto: `PGRST116` ("nenhuma linha") É o caso legítimo de usuário
  // novo, e precisa continuar seguindo para a criação.
  it("PGRST116 continua sendo tratado como usuário novo", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-novo",
          app_metadata: { provider: "google" },
          user_metadata: {},
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" },
        }),
      }),
    })

    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)

    // Sem tenant no metadata, o ramo de criação para aqui — que é o comportamento
    // correto e preexistente para quem realmente não tem linha.
    expect(getRedirectLocation(response)).toContain("error=no_tenant")
  })

  // FIX-1: Open redirect prevention
  it("sanitizes external URL in next param to /workspace", async () => {
    const request = new Request(
      "http://localhost/api/auth/callback?code=valid-code&next=https://evil.com",
    )
    const response = await GET(request)
    const location = getRedirectLocation(response)
    expect(location).toContain("/workspace")
    expect(location).not.toContain("evil.com")
  })

  it("sanitizes protocol-relative URL in next param", async () => {
    const request = new Request(
      "http://localhost/api/auth/callback?code=valid-code&next=//evil.com",
    )
    const response = await GET(request)
    const location = getRedirectLocation(response)
    expect(location).toContain("/workspace")
    expect(location).not.toContain("evil.com")
  })

  // Non-Google provider: no profile sync
  it("skips profile sync for non-Google providers", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)

    expect(mockServiceSelect).not.toHaveBeenCalled()
    expect(getRedirectLocation(response)).toContain("/workspace")
  })
})
