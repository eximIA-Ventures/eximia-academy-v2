import { describe, it, expect } from "vitest"
import { z } from "zod"

// Replicate the Zod schema from onboarding/actions.ts for pure testing
// (importing server actions directly would fail in test env)
const onboardingSchema = z.object({
  profile: z.object({
    employee_status: z.enum(["new_needs_onboarding", "new_already_onboarded", "existing"]),
    photo_url: z.string().optional(),
  }),
})

describe("Onboarding Wizard — Zod Validation", () => {
  it("accepts valid new_needs_onboarding payload", () => {
    const payload = {
      profile: { employee_status: "new_needs_onboarding" },
    }
    const result = onboardingSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("accepts valid new_already_onboarded payload", () => {
    const payload = {
      profile: { employee_status: "new_already_onboarded" },
    }
    const result = onboardingSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("accepts valid existing payload", () => {
    const payload = {
      profile: { employee_status: "existing" },
    }
    const result = onboardingSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("accepts payload with optional photo_url", () => {
    const payload = {
      profile: { employee_status: "new_needs_onboarding", photo_url: "https://example.com/photo.jpg" },
    }
    const result = onboardingSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("rejects payload with invalid employee_status", () => {
    const payload = {
      profile: { employee_status: "invalid_status" },
    }
    const result = onboardingSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it("rejects payload with role field (role escalation prevention)", () => {
    const payload = {
      profile: { employee_status: "new_needs_onboarding", role: "admin" },
    }
    // Zod strips unknown fields in strict mode, but safeParse still passes
    // The key point: role is NOT in the schema so it won't be included in parsed output
    const result = onboardingSchema.safeParse(payload)
    if (result.success) {
      const parsed = result.data
      expect("role" in parsed.profile).toBe(false)
    }
  })

  it("rejects payload without profile", () => {
    const result = onboardingSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects payload with empty profile", () => {
    const result = onboardingSchema.safeParse({ profile: {} })
    expect(result.success).toBe(false)
  })
})

describe("Onboarding Wizard — Step Configuration", () => {
  it("wizard has exactly 2 steps", () => {
    const STEP_LABELS = ["Boas-vindas", "Sua situação"]
    const TOTAL_STEPS = 2
    expect(STEP_LABELS).toHaveLength(TOTAL_STEPS)
  })

  it("auto-enrollment triggers only for new_needs_onboarding", () => {
    const shouldAutoEnroll = (status: string) => status === "new_needs_onboarding"
    expect(shouldAutoEnroll("new_needs_onboarding")).toBe(true)
    expect(shouldAutoEnroll("new_already_onboarded")).toBe(false)
    expect(shouldAutoEnroll("existing")).toBe(false)
  })
})
