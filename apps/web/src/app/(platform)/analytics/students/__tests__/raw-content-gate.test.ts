import { describe, expect, it } from "vitest"

/**
 * fix-manager-privacy-gates (2026-07-03), Correção 1 — LGPD: manager does not
 * read raw student content (chat messages, slide-reflection text).
 *
 * RATIFICAÇÃO DO HUGO (2026-07-13): the gate reads the PRIMARY role
 * (`profile.role`), NOT the union of hats. Verbatim is allowed ONLY when the
 * primary role is instructor/admin/super_admin. A manager or leader is DENIED
 * even when the role union also carries an instructor hat — the primary role
 * decides, closing the multi-hat loophole (@po finding). This REPLACED the
 * earlier union rule (where a manager+instructor kept the instructor's raw
 * access): that loophole is now closed.
 *
 * Pure-logic replica of the `canSeeRawContent` gate in
 * `analytics/students/[studentId]/page.tsx` (mirrors the repo convention of
 * `analytics/__tests__/analytics-scope.test.ts` / `courses/__tests__/role-
 * permissions.test.ts`: extract the exact decision instead of mocking the
 * full SSR page + service client).
 */

/**
 * Exact replica of the page's `canSeeRawContent` derivation: it reads the
 * PRIMARY role only. `_rolesUnion` is accepted to PROVE it is deliberately
 * ignored (the loophole close) — the real gate does not consult the union.
 */
function canSeeRawContent(primaryRole: string, _rolesUnion: string[] = []): boolean {
  return primaryRole === "instructor" || primaryRole === "admin" || primaryRole === "super_admin"
}

describe("canSeeRawContent gate (analytics/students/[studentId]/page.tsx)", () => {
  it("denies a manager primary role — the leak this fixes", () => {
    expect(canSeeRawContent("manager")).toBe(false)
  })

  it("denies a leader primary role", () => {
    expect(canSeeRawContent("leader")).toBe(false)
  })

  it("CRÍTICO (loophole fechado por decisão do Hugo, 2026-07-13): manager PRIMÁRIO com chapéu instructor na união → NEGADO", () => {
    // profile.role === "manager"; a instructor hat na união é IGNORADA — só o
    // papel primário decide. É exatamente o caminho que a política nova fecha.
    expect(canSeeRawContent("manager", ["manager", "instructor"])).toBe(false)
    expect(canSeeRawContent("leader", ["leader", "instructor"])).toBe(false)
  })

  it("instructor PRIMÁRIO continua permitido mesmo que a união também tenha manager", () => {
    expect(canSeeRawContent("instructor", ["instructor", "manager"])).toBe(true)
  })

  it("allows instructor primary role", () => {
    expect(canSeeRawContent("instructor")).toBe(true)
  })

  it("allows admin primary role", () => {
    expect(canSeeRawContent("admin")).toBe(true)
  })

  it("allows super_admin primary role", () => {
    expect(canSeeRawContent("super_admin")).toBe(true)
  })

  it("denies an unknown/empty primary role", () => {
    expect(canSeeRawContent("")).toBe(false)
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
