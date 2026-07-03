import { beforeEach, describe, expect, it, vi } from "vitest"

// getTeamViewMode reads next/headers cookies(). Mocked the same way as
// context-context.test.ts, so we can drive the raw cookie value and assert
// the READ contract — including the legacy "global" -> "hierarchy" mapping
// introduced by the Iteração 2 rename (2026-07-02).
const getCookie = vi.fn<(name: string) => { value: string } | undefined>()
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: getCookie })),
}))

import { getTeamViewMode } from "../team-view-context"

function setRaw(value: string | undefined) {
  getCookie.mockReturnValue(value === undefined ? undefined : { value })
}

describe("getTeamViewMode — cookie read contract", () => {
  beforeEach(() => {
    getCookie.mockReset()
  })

  it("absent cookie => 'direct' (default)", async () => {
    setRaw(undefined)
    expect(await getTeamViewMode()).toBe("direct")
  })

  it("'direct' => 'direct'", async () => {
    setRaw("direct")
    expect(await getTeamViewMode()).toBe("direct")
  })

  it("'hierarchy' => 'hierarchy'", async () => {
    setRaw("hierarchy")
    expect(await getTeamViewMode()).toBe("hierarchy")
  })

  it("legacy 'global' value => 'hierarchy' (rename compat, Iteração 2)", async () => {
    setRaw("global")
    expect(await getTeamViewMode()).toBe("hierarchy")
  })

  it("malformed/unknown value => 'direct' (default, fail-safe)", async () => {
    setRaw("not-a-real-mode")
    expect(await getTeamViewMode()).toBe("direct")
  })
})
