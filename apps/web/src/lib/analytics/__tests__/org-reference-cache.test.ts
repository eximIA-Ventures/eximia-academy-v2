import { beforeEach, describe, expect, it } from "vitest"
import { computeStudentComparison } from "../area-gestor"
import { ORG_REFERENCE_TTL_MS, __resetOrgReferenceCache } from "../org-reference-cache"

const NOW = Date.parse("2026-06-01T00:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

// ---------------------------------------------------------------------------
// Fake Supabase client that COUNTS .from(table) calls and HONORS .eq/.neq
// filters (so the student-scoped own scans return only that student's rows —
// essential to prove two students get DIFFERENT `student` blocks). Chainable +
// thenable + .range() (for fetchAllRows). No studentId ever reaches the cache.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: loose fake rows for the test
type Row = Record<string, any>

function makeDb(data: Record<string, Row[]>) {
  const fromCalls: string[] = []
  const db = {
    from(table: string) {
      fromCalls.push(table)
      const eqs: [string, unknown][] = []
      const neqs: [string, unknown][] = []
      const ins: [string, unknown[]][] = []
      const rowsFor = (): Row[] => {
        let rows = data[table] ?? []
        // Filter only on columns present in the row (absent col → filter ignored,
        // so tenant_id/role filters on minimal rows don't exclude everything).
        for (const [c, v] of eqs) rows = rows.filter((r) => r[c] === undefined || r[c] === v)
        for (const [c, v] of neqs) rows = rows.filter((r) => r[c] === undefined || r[c] !== v)
        for (const [c, vs] of ins)
          rows = rows.filter((r) => r[c] === undefined || vs.includes(r[c]))
        return rows
      }
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (c: string, v: unknown) => {
          eqs.push([c, v])
          return builder
        },
        neq: (c: string, v: unknown) => {
          neqs.push([c, v])
          return builder
        },
        in: (c: string, vs: unknown[]) => {
          ins.push([c, vs])
          return builder
        },
        range: (offset: number) =>
          Promise.resolve({ data: offset === 0 ? rowsFor() : [], error: null }),
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of the query builder
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: rowsFor(), error: null }).then(resolve),
      }
      return builder
    },
  }
  const count = (table: string) => fromCalls.filter((t) => t === table).length
  const reset = () => {
    fromCalls.length = 0
  }
  // biome-ignore lint/suspicious/noExplicitAny: fake client for the test
  return { db: db as any, count, reset, fromCalls }
}

// s1 and s2: same tenant, DIFFERENT own activity → different `student` blocks.
function fixtureData(): Record<string, Row[]> {
  return {
    users: [{ id: "s1" }, { id: "s2" }],
    sessions: [
      { student_id: "s1", status: "completed", created_at: daysAgo(1) },
      { student_id: "s1", status: "completed", created_at: daysAgo(2) },
      { student_id: "s2", status: "completed", created_at: daysAgo(9) },
    ],
    slide_reflections: [{ student_id: "s1" }, { student_id: "s1" }, { student_id: "s2" }],
    enrollments: [
      {
        student_id: "s1",
        status: "active",
        created_at: daysAgo(10),
        progress: { percentage: 80 },
        course_id: "c1",
      },
      {
        student_id: "s2",
        status: "active",
        created_at: daysAgo(10),
        progress: { percentage: 30 },
        course_id: "c1",
      },
    ],
    chapters: [{ id: "ch1", course_id: "c1" }],
    courses: [{ id: "c1", deadline_days: null, status: "published" }],
  }
}

const ORG_TABLES = ["users", "enrollments", "chapters"] as const
const orgScanCount = (count: (t: string) => number) =>
  ORG_TABLES.reduce((sum, t) => sum + count(t), 0)

beforeEach(() => __resetOrgReferenceCache())

describe("org-reference-cache — AC4: 0 scans org no 2º request dentro do TTL, recarga pós-TTL", () => {
  it("1º request carrega o org; 2º (mesmo tenant, dentro do TTL) faz 0 scans org; 3º (pós-TTL) recarrega", async () => {
    const { db, count, reset } = makeDb(fixtureData())

    // 1º request — carrega o org.
    await computeStudentComparison(db, "t1", "s1", { now: NOW })
    expect(orgScanCount(count)).toBeGreaterThan(0)
    expect(count("users")).toBe(1)

    // 2º request — mesmo tenant, now dentro do TTL → CACHE HIT → 0 scans org.
    reset()
    await computeStudentComparison(db, "t1", "s1", { now: NOW + 30_000 })
    expect(orgScanCount(count)).toBe(0)
    expect(count("users")).toBe(0)
    expect(count("enrollments")).toBe(0)
    // O bloco do aluno segue FRESCO — as leituras do próprio aluno ocorrem.
    expect(count("sessions")).toBeGreaterThan(0)

    // 3º request — now ALÉM do TTL → recarrega o org.
    reset()
    await computeStudentComparison(db, "t1", "s1", { now: NOW + ORG_REFERENCE_TTL_MS + 1 })
    expect(orgScanCount(count)).toBeGreaterThan(0)
    expect(count("users")).toBe(1)
  })
})

describe("org-reference-cache — AC5: número idêntico no cache hit", () => {
  it("unit e indicators do 2º request (hit) são numericamente idênticos ao 1º", async () => {
    const { db } = makeDb(fixtureData())
    const r1 = await computeStudentComparison(db, "t1", "s1", { now: NOW })
    const r2 = await computeStudentComparison(db, "t1", "s1", { now: NOW + 30_000 })
    expect(r2.unit).toEqual(r1.unit)
    expect(r2.indicators).toEqual(r1.indicators)
  })
})

describe("org-reference-cache — AC6: aluno NÃO cacheado (dois alunos, mesmo org, student distinto)", () => {
  it("2 studentId no mesmo tenant → blocos student DIFERENTES, orgBlock/unit IDÊNTICO, 0 scan org no 2º", async () => {
    const { db, count, reset } = makeDb(fixtureData())

    const rS1 = await computeStudentComparison(db, "t1", "s1", { now: NOW })
    reset()
    const rS2 = await computeStudentComparison(db, "t1", "s2", { now: NOW + 30_000 })

    // O org veio do cache (0 scan org no 2º aluno).
    expect(orgScanCount(count)).toBe(0)
    // Mesma régua org para os dois.
    expect(rS2.unit).toEqual(rS1.unit)
    // Mas o bloco do ALUNO é diferente (fresco por request, derivado de student_id).
    expect(rS2.student).not.toEqual(rS1.student)
    // s1 tem 2 sessões concluídas, s2 tem 1 → completedSessions difere.
    expect(rS1.student.completedSessions).toBe(2)
    expect(rS2.student.completedSessions).toBe(1)
  })
})
