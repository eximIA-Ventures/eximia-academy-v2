import { describe, expect, it } from "vitest"
import { computeEngagementTriage } from "../engagement-triage"

// ===========================================================================
// E12 Rodada 5 (item 1, achado Dave Malouf) — the /engagement triage must use
// the CANONICAL student-triage.ts taxonomy, NOT the old narrow "atenção = never
// accessed" that the overview reimplemented. The load-bearing proof here is that
// a student who HAS a recent session but is BEHIND the teaching plan lands in
// "Atenção" — a case the old !hasSession logic missed entirely, and the exact
// divergence that put the same student in different buckets across screens.
// ===========================================================================

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const NOW = new Date("2026-07-08T12:00:00.000Z").getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

type Row = Record<string, unknown>

/**
 * A minimal service-client stub whose table reads resolve to the rows provided.
 * Every builder is a chainable thenable, so `.select().eq().eq()` and
 * `.select().eq().in()` and `.select().eq().eq().in()` all resolve to the table
 * rows (the helper only ever reads users/sessions/enrollments/courses).
 */
function stubService(tables: Record<string, Row[]>) {
  // biome-ignore lint/suspicious/noExplicitAny: test stub client
  return {
    from: (table: string) => {
      const rows = tables[table] ?? []
      // biome-ignore lint/suspicious/noExplicitAny: chainable thenable
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub
        then: (onF: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(onF),
      }
      return builder
    },
    // biome-ignore lint/suspicious/noExplicitAny: match the SupabaseClient shape loosely
  } as any
}

describe("computeEngagementTriage — canonical taxonomy (E12 item 1)", () => {
  it("a student behind the teaching plan (with a recent session) is ATENÇÃO, not No ritmo", async () => {
    // BEHIND: active enrollment, deadline 100 days, enrolled 90 days ago
    // (expected ~90%), but only 10% progress → behind → atrasado → atenção.
    // It ALSO has a recent session (2 days ago), so the OLD !hasSession logic
    // would have wrongly filed it as "No ritmo". The canonical taxonomy catches it.
    const svc = stubService({
      users: [{ id: "s1" }],
      sessions: [{ student_id: "s1", created_at: daysAgo(2) }],
      enrollments: [
        {
          student_id: "s1",
          status: "active",
          created_at: daysAgo(90),
          progress: { percentage: 10 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", deadline_days: 100 }],
    })

    const { summary, triagemByStudent } = await computeEngagementTriage(svc, TENANT, ["s1"], NOW)

    expect(triagemByStudent.get("s1")).toBe("atencao")
    expect(summary.analisados).toBe(1)
    expect(summary.atencao).toBe(1)
    expect(summary.noRitmo).toBe(0)
    expect(summary.semAcesso).toBe(0)
  })

  it("classifies a mixed recorte into the three canonical buckets", async () => {
    const svc = stubService({
      users: [{ id: "ok" }, { id: "sumido" }, { id: "novato" }],
      sessions: [
        // ok: on track (recent session, on-pace enrollment) → No ritmo
        { student_id: "ok", created_at: daysAgo(1) },
        // sumido: had a session but 40 days ago, on-pace enrollment → Sem acesso
        { student_id: "sumido", created_at: daysAgo(40) },
        // novato: no sessions at all → nao_iniciado → Atenção
      ],
      enrollments: [
        {
          student_id: "ok",
          status: "active",
          created_at: daysAgo(10),
          progress: { percentage: 90 },
          course_id: "c1",
        },
        {
          student_id: "sumido",
          status: "active",
          created_at: daysAgo(10),
          progress: { percentage: 90 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", deadline_days: 100 }],
    })

    const { summary } = await computeEngagementTriage(svc, TENANT, ["ok", "sumido", "novato"], NOW)
    expect(summary.analisados).toBe(3)
    expect(summary.noRitmo).toBe(1) // ok
    expect(summary.semAcesso).toBe(1) // sumido
    expect(summary.atencao).toBe(1) // novato (never started)
  })

  it("fails closed on an empty scope (no DB reads, empty summary)", async () => {
    // The stub would throw if read; the helper must return early for [].
    const svc = {
      from: () => {
        throw new Error("should not read the DB for an empty scope")
      },
      // biome-ignore lint/suspicious/noExplicitAny: match loosely
    } as any
    const { summary, triagemByStudent } = await computeEngagementTriage(svc, TENANT, [], NOW)
    expect(summary.analisados).toBe(0)
    expect(triagemByStudent.size).toBe(0)
  })
})
