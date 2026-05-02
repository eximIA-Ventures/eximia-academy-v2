import { describe, expect, it, vi } from "vitest"

// Mock auth to return a student (non-manager) so redirect("/dashboard") fires
vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    profile: { role: "student", tenant_id: "t-1" },
    supabase: {},
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))

describe("/analytics redirect", () => {
  it("redirects non-manager to /dashboard", async () => {
    const { redirect } = await import("next/navigation")
    const { default: AnalyticsPage } = await import("../../../app/(platform)/analytics/page")

    try {
      await AnalyticsPage()
    } catch {
      // redirect throws NEXT_REDIRECT
    }

    expect(redirect).toHaveBeenCalledWith("/dashboard")
  })
})
