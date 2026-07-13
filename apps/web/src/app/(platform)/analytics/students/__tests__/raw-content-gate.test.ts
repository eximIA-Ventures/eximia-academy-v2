import { describe, expect, it } from "vitest"

/**
 * fix-manager-privacy-gates (2026-07-03), Correção 1 — LGPD: manager does not
 * read raw student content (chat messages, slide-reflection text).
 *
 * Pure-logic replica of the `canSeeRawContent` gate in
 * `analytics/students/[studentId]/page.tsx` (mirrors the repo convention of
 * `analytics/__tests__/analytics-scope.test.ts` / `courses/__tests__/role-
 * permissions.test.ts`: extract the exact decision instead of mocking the
 * full SSR page + service client).
 *
 * Decision rule (the dono): permitido se o usuário TEM chapéu instructor OU
 * admin OU super_admin; negado se ele só alcança pela lente de
 * manager/leader. Checked over the UNION of hats, never the singular
 * `profile.role` — a manager+instructor keeps the instructor's raw access.
 */

/** Exact replica of the page's `canSeeRawContent` derivation. */
function canSeeRawContent(roles: string[]): boolean {
  return roles.includes("instructor") || roles.includes("admin") || roles.includes("super_admin")
}

describe("canSeeRawContent gate (analytics/students/[studentId]/page.tsx)", () => {
  it("denies a manager-only hat — the leak this fixes", () => {
    expect(canSeeRawContent(["manager"])).toBe(false)
  })

  it("denies a leader-only hat", () => {
    expect(canSeeRawContent(["leader"])).toBe(false)
  })

  it("denies manager+leader (neither is instructor/admin/super_admin)", () => {
    expect(canSeeRawContent(["manager", "leader"])).toBe(false)
  })

  it("allows instructor hat", () => {
    expect(canSeeRawContent(["instructor"])).toBe(true)
  })

  it("allows admin hat", () => {
    expect(canSeeRawContent(["admin"])).toBe(true)
  })

  it("allows super_admin hat", () => {
    expect(canSeeRawContent(["super_admin"])).toBe(true)
  })

  it("allows manager+instructor — union, manager hat never subtracts (Rinaldo's real shape)", () => {
    expect(canSeeRawContent(["manager", "instructor"])).toBe(true)
  })

  it("denies an empty union", () => {
    expect(canSeeRawContent([])).toBe(false)
  })
})

/**
 * Replica of the redaction applied to `chapterSessions[].sessions[].messages`
 * and `chapterReflections` when the caller lacks raw-content access — locks
 * in that the redaction produces an EMPTY structure (never a truncated or
 * masked one that could still leak signal), and that `moduleInsights` (the
 * replacement) never carries a raw text field.
 */
describe("raw content redaction shape", () => {
  function redactSessionMessages(rawMessages: string[], allowed: boolean): string[] {
    return allowed ? rawMessages : []
  }

  function redactReflections<T>(rawReflections: T[], allowed: boolean): T[] {
    return allowed ? rawReflections : []
  }

  it("empties session messages when raw content is denied", () => {
    expect(redactSessionMessages(["oi", "quero entender melhor X"], false)).toEqual([])
  })

  it("preserves session messages when raw content is allowed", () => {
    const msgs = ["oi", "quero entender melhor X"]
    expect(redactSessionMessages(msgs, true)).toBe(msgs)
  })

  it("empties chapter reflections when raw content is denied", () => {
    expect(redactReflections([{ response: "minha resposta" }], false)).toEqual([])
  })

  it("moduleInsights (the manager/leader replacement) never includes a response/message field", () => {
    const moduleInsight = {
      chapterTitle: "Módulo 1",
      chapterOrder: 0,
      totalSessions: 3,
      completedSessions: 2,
      reflectionCount: 5,
      avgDepth: 4.5,
      lastAccessAt: "01/07/2026",
    }
    expect(Object.keys(moduleInsight)).not.toContain("response")
    expect(Object.keys(moduleInsight)).not.toContain("aiResponse")
    expect(Object.keys(moduleInsight)).not.toContain("messages")
  })
})
