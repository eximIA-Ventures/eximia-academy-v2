import { describe, expect, it } from "vitest"
import { toInsightRow } from "../roster-tab"
import type { EngagementStudentDetail } from "../types"

// =============================================================================
// Fatia 16c (spec-roster-reforma-v3.md §6.3) — unit tests of the exported
// `toInsightRow` adapter (EngagementStudentDetail → StudentInsightRow). It is
// the ONLY glue between the engagement data contract and the shared
// StudentInsightsTable; a silent field typo here would break a column without
// breaking tsc, hence the explicit rename assertions (case c).
// =============================================================================

function fullDetail(): EngagementStudentDetail {
  return {
    id: "stu-1",
    fullName: "Ana Silva",
    email: "ana@corp.com",
    totalSessions: 10,
    completedSessions: 7,
    reflectionsCount: 4,
    daysSinceLastActivity: 2,
    lastSessionDate: "2026-07-15T12:00:00.000Z",
    progressPct: 62,
    behindSchedule: false,
    ritmo: "no_ritmo",
    status: "no_ritmo",
    coursesEnrolled: 3,
    coursesCompleted: 1,
    nudgeType: "top_performer",
    templateKey: "reconhecimento",
    courseIds: ["c-1", "c-2"],
  }
}

describe("toInsightRow (fatia 16c, adapter da Tabela simplificada)", () => {
  it("(a) maps a full detail field by field", () => {
    const row = toInsightRow(fullDetail())
    expect(row).toEqual({
      id: "stu-1",
      full_name: "Ana Silva",
      email: "ana@corp.com",
      lastSessionDate: "2026-07-15T12:00:00.000Z",
      totalSessions: 10,
      completedSessions: 7,
      coursesEnrolled: 3,
      coursesCompleted: 1,
      courseProgressPct: 62,
      reflectionsCount: 4,
      ritmo: "no_ritmo",
      triagem: "no_ritmo",
    })
    // `subteam` is deliberately absent (showSubteam={false}, no Time column).
    expect("subteam" in row).toBe(false)
  })

  it("(b) null fullName/email become empty strings; absent course counts become 0", () => {
    const d = fullDetail()
    d.fullName = null
    d.email = null
    d.coursesEnrolled = undefined
    d.coursesCompleted = undefined
    d.lastSessionDate = null

    const row = toInsightRow(d)
    expect(row.full_name).toBe("")
    expect(row.email).toBe("")
    expect(row.coursesEnrolled).toBe(0)
    expect(row.coursesCompleted).toBe(0)
    expect(row.lastSessionDate).toBeNull()
  })

  it("(c) the 2 field RENAMES land on the right keys: status→triagem, progressPct→courseProgressPct", () => {
    const d = fullDetail()
    d.status = "sem_acesso"
    d.progressPct = 33

    const row = toInsightRow(d) as unknown as Record<string, unknown>
    expect(row.triagem).toBe("sem_acesso")
    expect(row.courseProgressPct).toBe(33)
    // The source names must NOT leak through as keys — a silent typo here
    // would render an empty column without failing tsc.
    expect("status" in row).toBe(false)
    expect("progressPct" in row).toBe(false)
  })
})
