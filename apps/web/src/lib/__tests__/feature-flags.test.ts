import { describe, expect, it, vi } from "vitest"

vi.mock("posthog-js", () => ({
  default: {
    isFeatureEnabled: vi.fn((flag: string) => flag === "enabled-flag"),
    __loaded: true,
  },
  __esModule: true,
}))

import { isFeatureEnabled } from "../feature-flags"

describe("isFeatureEnabled", () => {
  it("returns true for enabled flags", () => {
    expect(isFeatureEnabled("enabled-flag")).toBe(true)
  })

  it("returns false for disabled flags", () => {
    expect(isFeatureEnabled("disabled-flag")).toBe(false)
  })
})
