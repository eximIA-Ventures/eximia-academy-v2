import { describe, expect, it, vi } from "vitest"

// Mock auth to return a student (non-manager) so redirect("/dashboard") fires
vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    profile: { role: "student", tenant_id: "t-1" },
    roles: ["student"],
    supabase: {},
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))

// The page reads the active-area cookie (via next/headers `cookies()`) before the
// role check runs. Without this mock, the real `next/headers` throws outside a
// Next.js request context, which the test's empty catch swallows silently —
// masking the actual assertion (redirect was never reached).
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

describe("/analytics redirect", () => {
  it("redirects non-manager to /dashboard", async () => {
    const { redirect } = await import("next/navigation")
    const { default: AnalyticsPage } = await import("../../../app/(platform)/analytics/page")

    try {
      await AnalyticsPage({ searchParams: Promise.resolve({}) })
    } catch {
      // redirect throws NEXT_REDIRECT
    }

    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })
})
