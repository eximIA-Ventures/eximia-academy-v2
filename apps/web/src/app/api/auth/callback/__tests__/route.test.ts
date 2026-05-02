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

  it("redirects to /dashboard on successful code exchange", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("/dashboard")
  })

  // AC9: Deep link preservation
  it("preserves deep link via next param", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code&next=/courses/123")
    const response = await GET(request)
    expect(getRedirectLocation(response)).toContain("/courses/123")
  })

  // --- Google Profile Sync (AC5, AC6) ---

  it("syncs Google avatar and name for existing user with empty fields", async () => {
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

    expect(mockServiceUpdate).toHaveBeenCalledWith({
      avatar_url: "https://lh3.google.com/photo.jpg",
      full_name: "John Doe",
    })
    expect(getRedirectLocation(response)).toContain("/dashboard")
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

  // AC4/AC7: Existing user (invited) with Google OAuth preserves data
  it("preserves existing user data and only updates empty avatar", async () => {
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

    // Should only update avatar (name already exists)
    expect(mockServiceUpdate).toHaveBeenCalledWith({
      avatar_url: "https://lh3.google.com/photo.jpg",
    })
    expect(getRedirectLocation(response)).toContain("/dashboard")
    expect(getRedirectLocation(response)).not.toContain("error=")
  })

  // FIX-1: Open redirect prevention
  it("sanitizes external URL in next param to /dashboard", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code&next=https://evil.com")
    const response = await GET(request)
    const location = getRedirectLocation(response)
    expect(location).toContain("/dashboard")
    expect(location).not.toContain("evil.com")
  })

  it("sanitizes protocol-relative URL in next param", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code&next=//evil.com")
    const response = await GET(request)
    const location = getRedirectLocation(response)
    expect(location).toContain("/dashboard")
    expect(location).not.toContain("evil.com")
  })

  // Non-Google provider: no profile sync
  it("skips profile sync for non-Google providers", async () => {
    const request = new Request("http://localhost/api/auth/callback?code=valid-code")
    const response = await GET(request)

    expect(mockServiceSelect).not.toHaveBeenCalled()
    expect(getRedirectLocation(response)).toContain("/dashboard")
  })
})
