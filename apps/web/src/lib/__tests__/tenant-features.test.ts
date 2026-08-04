import { describe, expect, it, vi } from "vitest"
import { isFeatureEnabled, isTenantFeatureEnabled } from "../tenant-features"

const FEATURE = "onboarding_jornada_v1"

describe("isFeatureEnabled (checagem pura sobre settings já carregado)", () => {
  it("default OFF: settings ausente", () => {
    expect(isFeatureEnabled(undefined, FEATURE)).toBe(false)
    expect(isFeatureEnabled(null, FEATURE)).toBe(false)
  })

  it("default OFF: settings sem bloco features", () => {
    expect(isFeatureEnabled({}, FEATURE)).toBe(false)
    expect(isFeatureEnabled({ other: true }, FEATURE)).toBe(false)
  })

  it("default OFF: features presente mas sem a chave", () => {
    expect(isFeatureEnabled({ features: {} }, FEATURE)).toBe(false)
    expect(isFeatureEnabled({ features: { outra_flag: true } }, FEATURE)).toBe(false)
  })

  it("default OFF: chave presente mas não estritamente true (string, 1, etc.)", () => {
    expect(isFeatureEnabled({ features: { [FEATURE]: "true" } }, FEATURE)).toBe(false)
    expect(isFeatureEnabled({ features: { [FEATURE]: 1 } }, FEATURE)).toBe(false)
  })

  it("ON somente quando a chave é estritamente true", () => {
    expect(isFeatureEnabled({ features: { [FEATURE]: true } }, FEATURE)).toBe(true)
  })

  it("settings de tipo inesperado (array, string) nunca lança e dá false", () => {
    expect(isFeatureEnabled("not-an-object", FEATURE)).toBe(false)
    expect(isFeatureEnabled([1, 2, 3], FEATURE)).toBe(false)
  })
})

/** Stub mínimo de `TenantSettingsClient` — um único `.from().select().eq().maybeSingle()`. */
function stubClient(result: { data: { settings: unknown } | null; error: unknown }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve(result)),
        })),
      })),
    })),
  }
}

describe("isTenantFeatureEnabled (busca no banco + checagem)", () => {
  it("default OFF quando o tenant não tem a flag", async () => {
    const client = stubClient({ data: { settings: {} }, error: null })
    await expect(isTenantFeatureEnabled(client, "tenant-1", FEATURE)).resolves.toBe(false)
  })

  it("ON quando o tenant tem a flag ligada", async () => {
    const client = stubClient({
      data: { settings: { features: { [FEATURE]: true } } },
      error: null,
    })
    await expect(isTenantFeatureEnabled(client, "tenant-1", FEATURE)).resolves.toBe(true)
  })

  it("fail-safe: erro do banco degrada para false, nunca lança", async () => {
    const client = stubClient({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    })
    await expect(isTenantFeatureEnabled(client, "tenant-1", FEATURE)).resolves.toBe(false)
  })

  it("fail-safe: tenant inexistente (maybeSingle null) degrada para false", async () => {
    const client = stubClient({ data: null, error: null })
    await expect(isTenantFeatureEnabled(client, "tenant-1", FEATURE)).resolves.toBe(false)
  })

  it("fail-safe: exceção lançada pelo client degrada para false, nunca propaga", async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error("boom")
      }),
    }
    await expect(isTenantFeatureEnabled(client, "tenant-1", FEATURE)).resolves.toBe(false)
  })
})
