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
    reportName: null,
    email: "ana@corp.com",
    totalSessions: 10,
    completedSessions: 7,
    reflectionsCount: 4,
    daysSinceLastActivity: 2,
    lastSessionDate: "2026-07-15T12:00:00.000Z",
    progressPct: 62,
    viewProgressPct: 38,
    viewHasNewContent: true,
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
      viewProgressPct: 38,
      viewHasNewContent: true,
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

  it("(d) full_name resolves report_name ?? fullName (nome padronizado vence quando presente)", () => {
    // Standardized report name present → it wins over the raw full name.
    const withReport = fullDetail()
    withReport.reportName = "Ana S. (Comercial)"
    expect(toInsightRow(withReport).full_name).toBe("Ana S. (Comercial)")

    // report_name null → fall back to the real full name.
    const noReport = fullDetail()
    noReport.reportName = null
    expect(toInsightRow(noReport).full_name).toBe("Ana Silva")

    // Both null → empty string (unchanged null-safety contract).
    const bothNull = fullDetail()
    bothNull.reportName = null
    bothNull.fullName = null
    expect(toInsightRow(bothNull).full_name).toBe("")
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

// =============================================================================
// Percorrido x Elaborado — DEFEITO REAL (2026-07-31): o endpoint entregava
// `viewProgressPct`, mas este adaptador não copiava o campo, e a coluna
// PERCORRIDO ficava "sem dado" para todo mundo em produção. O tsc não pega,
// porque o campo é opcional em StudentInsightRow. Só um teste pega.
// =============================================================================
describe("toInsightRow — Percorrido", () => {
  it("propaga viewProgressPct para a linha da tabela", () => {
    const row = toInsightRow(fullDetail())
    expect(row.viewProgressPct).toBe(38)
  })

  it("propaga o sinal de conteúdo novo", () => {
    const row = toInsightRow(fullDetail())
    expect(row.viewHasNewContent).toBe(true)
  })

  it("mantém null quando não há medição — nunca 0%", () => {
    const row = toInsightRow({ ...fullDetail(), viewProgressPct: null })
    expect(row.viewProgressPct).toBeNull()
    expect(row.viewProgressPct).not.toBe(0)
  })

  it("degrada para null quando o campo vem ausente do contrato", () => {
    const detail = fullDetail()
    delete (detail as { viewProgressPct?: number | null }).viewProgressPct
    expect(toInsightRow(detail).viewProgressPct).toBeNull()
  })
})
