import { beforeEach, describe, expect, it, vi } from "vitest"

// getActiveContextCookie reads next/headers cookies(). We mock it so we can drive the
// raw cookie value and assert the FORM validation (E7 §4.3): the cookie is a UI hint
// only — malformed/forged shapes resolve to null (treated as "Minha Trilha"). Reach
// is validated elsewhere (authorizeContextAccess); this tests shape only.
const getCookie = vi.fn<(name: string) => { value: string } | undefined>()
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: getCookie })),
}))

import { getActiveContextCookie } from "../context-context"

const VALID_UUID = "11111111-1111-1111-1111-111111111111"

function setRaw(value: string | undefined) {
  getCookie.mockReturnValue(value === undefined ? undefined : { value })
}

describe("getActiveContextCookie — cookie FORM validation (E7 §4.3)", () => {
  beforeEach(() => {
    getCookie.mockReset()
  })

  it("absent cookie => null (fresh state, resolves to highest-privilege context)", async () => {
    setRaw(undefined)
    expect(await getActiveContextCookie()).toBeNull()
  })

  it("malformed JSON => null", async () => {
    setRaw("{not-json")
    expect(await getActiveContextCookie()).toBeNull()
  })

  it("valid personal + null id => { type: 'personal', id: null } (explicit 'Minha Trilha' choice)", async () => {
    setRaw(JSON.stringify({ type: "personal", id: null }))
    expect(await getActiveContextCookie()).toEqual({ type: "personal", id: null })
  })

  it("type outside {personal, team, organization} => null (e.g. 'self' / 'admin')", async () => {
    setRaw(JSON.stringify({ type: "self", id: null }))
    expect(await getActiveContextCookie()).toBeNull()
    setRaw(JSON.stringify({ type: "admin", id: VALID_UUID }))
    expect(await getActiveContextCookie()).toBeNull()
  })

  it("missing type => null", async () => {
    setRaw(JSON.stringify({ id: VALID_UUID }))
    expect(await getActiveContextCookie()).toBeNull()
  })

  it("non-UUID id => null", async () => {
    setRaw(JSON.stringify({ type: "team", id: "not-a-uuid" }))
    expect(await getActiveContextCookie()).toBeNull()
  })

  it("valid team + UUID id => { type: 'team', id }", async () => {
    setRaw(JSON.stringify({ type: "team", id: VALID_UUID }))
    expect(await getActiveContextCookie()).toEqual({ type: "team", id: VALID_UUID })
  })

  it("valid organization + UUID id => { type: 'organization', id }", async () => {
    setRaw(JSON.stringify({ type: "organization", id: VALID_UUID }))
    expect(await getActiveContextCookie()).toEqual({ type: "organization", id: VALID_UUID })
  })

  it("valid type with null id => id normalized to null", async () => {
    setRaw(JSON.stringify({ type: "team", id: null }))
    expect(await getActiveContextCookie()).toEqual({ type: "team", id: null })
  })

  it("valid type with absent id => id normalized to null", async () => {
    setRaw(JSON.stringify({ type: "organization" }))
    expect(await getActiveContextCookie()).toEqual({ type: "organization", id: null })
  })

  it("JSON primitive (not an object) => null", async () => {
    setRaw(JSON.stringify("team"))
    expect(await getActiveContextCookie()).toBeNull()
    setRaw(JSON.stringify(42))
    expect(await getActiveContextCookie()).toBeNull()
  })
})
