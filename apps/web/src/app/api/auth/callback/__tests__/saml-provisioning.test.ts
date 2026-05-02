import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockExchangeCodeForSession,
  mockGetUser,
  mockServiceSelect,
  mockServiceUpdate,
  mockServiceInsert,
  mockServiceSelectTenants,
} = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockServiceSelect: vi.fn(),
  mockServiceUpdate: vi.fn(),
  mockServiceInsert: vi.fn().mockResolvedValue({ error: null }),
  mockServiceSelectTenants: vi.fn(),
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
          insert: mockServiceInsert,
        }
      }
      if (table === "tenants") {
        return {
          select: mockServiceSelectTenants,
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

describe("Auth Callback — SAML Auto-Provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
  })

  it("auto-provisions new SAML user with role student", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "saml-user-1",
          email: "user@corp.com",
          app_metadata: { provider: "sso:saml", sso: { issuer: "https://idp.corp.com" } },
          user_metadata: { full_name: "Corp User" },
        },
      },
    })

    // User doesn't exist in users table
    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    })

    // Tenant lookup — sso_provider_id must match user's sso.issuer
    mockServiceSelectTenants.mockReturnValue({
      data: [
        {
          id: "tenant-1",
          settings: { sso_provider_id: "https://idp.corp.com" },
        },
      ],
    })

    const request = new Request("http://localhost/api/auth/callback?code=saml-code")
    const response = await GET(request)

    expect(mockServiceInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "saml-user-1",
        email: "user@corp.com",
        role: "student",
        full_name: "Corp User",
        status: "active",
        onboarding_completed: false,
      }),
    )
    expect(getRedirectLocation(response)).toContain("/dashboard")
  })

  it("uses role 'student' even if IdP provides a role (security)", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "saml-user-2",
          email: "admin@corp.com",
          app_metadata: {
            provider: "sso:saml",
            sso: { issuer: "https://idp.corp.com" },
            role: "admin", // IdP trying to set admin role
          },
          user_metadata: { full_name: "Corp Admin", role: "admin" },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    })

    mockServiceSelectTenants.mockReturnValue({
      data: [
        { id: "tenant-1", settings: { sso_provider_id: "https://idp.corp.com" } },
      ],
    })

    const request = new Request("http://localhost/api/auth/callback?code=saml-code")
    await GET(request)

    // Should ALWAYS use 'student', never IdP role
    expect(mockServiceInsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "student" }),
    )
  })

  it("does NOT create duplicate if SAML user already exists", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "saml-existing",
          email: "existing@corp.com",
          app_metadata: { provider: "sso:saml", sso: {} },
          user_metadata: { full_name: "Existing User" },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "saml-existing",
            full_name: "Existing User",
            tenant_id: "tenant-1",
          },
        }),
      }),
    })

    const request = new Request("http://localhost/api/auth/callback?code=saml-code")
    const response = await GET(request)

    expect(mockServiceInsert).not.toHaveBeenCalled()
    expect(getRedirectLocation(response)).toContain("/dashboard")
  })

  it("redirects to no_tenant if SAML user has no matching tenant", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "saml-orphan",
          email: "orphan@unknown.com",
          app_metadata: { provider: "sso:saml", sso: {} },
          user_metadata: {},
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    })

    mockServiceSelectTenants.mockReturnValue({
      data: [],
    })

    const request = new Request("http://localhost/api/auth/callback?code=saml-code")
    const response = await GET(request)

    expect(getRedirectLocation(response)).toContain("error=no_tenant")
  })

  it("detects SAML provider with startsWith 'sso:' check", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "saml-user-3",
          email: "user3@corp.com",
          app_metadata: { provider: "sso:custom-provider" },
          user_metadata: { full_name: "User 3" },
        },
      },
    })

    mockServiceSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "saml-user-3", full_name: "User 3", tenant_id: "t1" },
        }),
      }),
    })

    const request = new Request("http://localhost/api/auth/callback?code=saml-code")
    const response = await GET(request)

    // Should proceed (not error) — detected as SAML via startsWith check
    expect(getRedirectLocation(response)).toContain("/dashboard")
  })
})
