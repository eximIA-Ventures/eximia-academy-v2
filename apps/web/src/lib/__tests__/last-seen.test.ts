import { describe, expect, it } from "vitest"
import { LAST_SEEN_TTL_MS, shouldBumpLastSeen } from "../last-seen"

// ===========================================================================
// FOLLOW-UP B (Hugo 2026-07-14) — users.last_seen_at: navegação pura (login/
// browse sem chat nem reflexão) não gerava sinal NENHUM no banco, então
// "acessa todo dia" nunca ficava fiel. O bump roda no layout autenticado e é
// THROTTLED (máx 1 escrita/hora por usuário por instância) para não virar um
// write por page view. Aqui testamos a decisão PURA do throttle.
// ===========================================================================
describe("shouldBumpLastSeen — throttle de 1h do bump de last_seen_at", () => {
  const NOW = Date.parse("2026-07-14T12:00:00Z")

  it("nunca bumpou nesta instância → bump", () => {
    expect(shouldBumpLastSeen(null, NOW)).toBe(true)
  })

  it("bumpou há 5 minutos → NÃO bumpa de novo (throttle)", () => {
    expect(shouldBumpLastSeen(NOW - 5 * 60_000, NOW)).toBe(false)
  })

  it("bumpou há exatamente 1h ou mais → bumpa de novo", () => {
    expect(shouldBumpLastSeen(NOW - LAST_SEEN_TTL_MS, NOW)).toBe(true)
    expect(shouldBumpLastSeen(NOW - LAST_SEEN_TTL_MS - 1, NOW)).toBe(true)
  })

  it("1ms antes do TTL → ainda segura", () => {
    expect(shouldBumpLastSeen(NOW - LAST_SEEN_TTL_MS + 1, NOW)).toBe(false)
  })
})
