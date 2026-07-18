import { describe, expect, it } from "vitest"
import {
  chapterModuleLabel,
  computeChapterProgressPct,
  computeMetricBlock,
  computeStudentComparison,
  computeUnitReferenceStats,
  whereStoppedChapterIdOf,
} from "../area-gestor"

/**
 * SH-1.1 — FIRST unit cover of the ÁREA/GESTOR aggregation engine. Focused on the
 * two additive computations this story introduces:
 *   • computeMetricBlock.distinctActiveDays (AC4) — UTC-day distinct days, mean per
 *     student in an aggregated block.
 *   • computeUnitReferenceStats (AC7) — per-student median resists the outlier the
 *     arithmetic mean does not.
 *
 * Both are pure over in-memory rows, so no Supabase client is mocked. computeMetric
 * Block's pre-existing mean logic is intentionally NOT re-asserted here (AC6: untouched).
 */

// Deterministic clock — distinctActiveDays / referenceStats don't depend on it, but a
// fixed value keeps the "active in last 30d" window stable regardless of wall time.
const NOW = Date.parse("2026-06-01T00:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

/**
 * Minimal builder for the (non-exported) SessionRow shape computeMetricBlock consumes.
 * `status` defaults to "completed"; `depth` (when set) becomes analytics.depth_reached.
 */
function session(
  studentId: string,
  createdAt: string,
  opts: { status?: string | null; depth?: number } = {},
) {
  return {
    student_id: studentId,
    status: opts.status ?? "completed",
    chapter_id: null,
    created_at: createdAt,
    analytics: opts.depth !== undefined ? { depth_reached: opts.depth } : null,
  }
}

describe("computeMetricBlock — distinctActiveDays (AC2/AC3/AC4)", () => {
  it("per-student: 3 sessions on the SAME UTC day → 1", () => {
    const sessions = [
      session("s1", "2026-01-01T02:00:00Z"),
      session("s1", "2026-01-01T12:00:00Z"),
      session("s1", "2026-01-01T23:30:00Z"),
    ]
    expect(computeMetricBlock(["s1"], sessions, [], 4, NOW).distinctActiveDays).toBe(1)
  })

  it("per-student: 3 sessions on 3 DISTINCT UTC days → 3", () => {
    const sessions = [
      session("s1", "2026-01-01T10:00:00Z"),
      session("s1", "2026-01-02T10:00:00Z"),
      session("s1", "2026-01-03T10:00:00Z"),
    ]
    expect(computeMetricBlock(["s1"], sessions, [], 4, NOW).distinctActiveDays).toBe(3)
  })

  it("UTC-day grouping: hours spanning a full UTC date collapse to one day", () => {
    // Two sessions inside the SAME UTC calendar date (00:01Z and 23:59Z) → one day.
    const sessions = [session("s1", "2026-02-10T00:01:00Z"), session("s1", "2026-02-10T23:59:00Z")]
    expect(computeMetricBlock(["s1"], sessions, [], 4, NOW).distinctActiveDays).toBe(1)
  })

  it("aggregated block (2+ students): reports the MEAN distinct-active-days per student", () => {
    // s1 → 1 distinct day (3 sessions same day); s2 → 3 distinct days. Mean = (1+3)/2 = 2.
    const sessions = [
      session("s1", "2026-01-01T02:00:00Z"),
      session("s1", "2026-01-01T12:00:00Z"),
      session("s1", "2026-01-01T20:00:00Z"),
      session("s2", "2026-01-01T10:00:00Z"),
      session("s2", "2026-01-02T10:00:00Z"),
      session("s2", "2026-01-03T10:00:00Z"),
    ]
    expect(computeMetricBlock(["s1", "s2"], sessions, [], 4, NOW).distinctActiveDays).toBe(2)
  })

  it("aggregated mean divides by scope size incl. students with ZERO sessions", () => {
    // s1 → 2 days, s2 → 0 sessions (0 days), s3 → 1 day. Mean = (2+0+1)/3 = 1.
    const sessions = [
      session("s1", "2026-01-01T10:00:00Z"),
      session("s1", "2026-01-02T10:00:00Z"),
      session("s3", "2026-01-05T10:00:00Z"),
    ]
    expect(computeMetricBlock(["s1", "s2", "s3"], sessions, [], 4, NOW).distinctActiveDays).toBe(1)
  })
})

describe("computeUnitReferenceStats — median resists the outlier (AC5/AC7)", () => {
  // Unit of 5: one "champion" (deep + fully complete) + four medianos. The champion
  // drags the arithmetic mean up; the median must NOT follow.
  //   depth  → medianos 2,2,3,3 ; champion 7
  //   completion → medianos 1/4 (25%) ; champion 4/4 (100%)
  const CHAPTERS = 4
  const sessions = [
    session("s1", "2026-01-01T10:00:00Z", { depth: 2 }),
    session("s2", "2026-01-01T10:00:00Z", { depth: 2 }),
    session("s3", "2026-01-01T10:00:00Z", { depth: 3 }),
    session("s4", "2026-01-01T10:00:00Z", { depth: 3 }),
    // champion: four completed sessions (100% of 4 chapters) each at depth 7.
    session("s5", "2026-01-01T10:00:00Z", { depth: 7 }),
    session("s5", "2026-01-02T10:00:00Z", { depth: 7 }),
    session("s5", "2026-01-03T10:00:00Z", { depth: 7 }),
    session("s5", "2026-01-04T10:00:00Z", { depth: 7 }),
  ]
  const ids = ["s1", "s2", "s3", "s4", "s5"]

  it("avgDepth: median (3) < arithmetic mean (4.8)", () => {
    const ref = computeUnitReferenceStats(ids, sessions, [], CHAPTERS, NOW)
    const unit = computeMetricBlock(ids, sessions, [], CHAPTERS, NOW)
    expect(ref?.avgDepth).not.toBeNull()
    expect(ref?.avgDepth?.median).toBe(3)
    expect(unit.avgDepth).toBe(4.8) // the outlier-dragged mean
    // The whole point of the story: median holds where the mean does not.
    expect(ref?.avgDepth?.median).toBeLessThan(unit.avgDepth as number)
    // Quartiles are ordered.
    expect(ref?.avgDepth?.p25).toBeLessThanOrEqual(ref?.avgDepth?.median as number)
    expect(ref?.avgDepth?.median as number).toBeLessThanOrEqual(ref?.avgDepth?.p75 as number)
  })

  it("completionPct: median (25) < arithmetic mean (40)", () => {
    const ref = computeUnitReferenceStats(ids, sessions, [], CHAPTERS, NOW)
    const unit = computeMetricBlock(ids, sessions, [], CHAPTERS, NOW)
    expect(ref?.completionPct.median).toBe(25)
    expect(unit.completionPct).toBe(40) // the outlier-dragged mean
    expect(ref?.completionPct.median).toBeLessThan(unit.completionPct)
  })

  it("returns undefined for an empty population (no student → field omitted)", () => {
    expect(computeUnitReferenceStats([], sessions, [], CHAPTERS, NOW)).toBeUndefined()
  })

  it("avgDepth is null when no student had a depth signal", () => {
    const noDepth = [session("s1", "2026-01-01T10:00:00Z"), session("s2", "2026-01-01T10:00:00Z")]
    const ref = computeUnitReferenceStats(["s1", "s2"], noDepth, [], CHAPTERS, NOW)
    expect(ref?.avgDepth).toBeNull()
    // completionPct distribution is still present (all students have completion data).
    expect(ref?.completionPct).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// M2 (2026-07-11) — computeStudentComparison reference scope = ORGANIZATION.
// The reference is the WHOLE tenant (all role=student users), NOT the student's
// UNIDADE. This test INSPECTS THE QUERY (not the label): the org population is
// scoped ONLY by tenant_id + role=student, and `user_areas` is never consulted.
// ---------------------------------------------------------------------------

interface QueryCall {
  table: string
  filters: Array<[string, string, unknown]>
}

/** Minimal chainable + thenable Supabase-like mock that records table+filters. */
function makeMockDb(dataByTable: Record<string, unknown[]>) {
  const calls: QueryCall[] = []
  const from = (table: string) => {
    const rec: QueryCall = { table, filters: [] }
    calls.push(rec)
    const rows = () => dataByTable[table] ?? []
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        rec.filters.push(["eq", col, val])
        return builder
      },
      neq: (col: string, val: unknown) => {
        rec.filters.push(["neq", col, val])
        return builder
      },
      in: (col: string, val: unknown) => {
        rec.filters.push(["in", col, val])
        return builder
      },
      // `.limit(n)` is thenable (the chapters lookup awaits it directly).
      limit: (_n: number) => Promise.resolve({ data: rows(), error: null }),
      single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      range: (offset: number) => Promise.resolve({ data: offset === 0 ? rows() : [], error: null }),
      // thenable so `await db.from(...).select(...).eq(...)` resolves { data, error }.
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of the query builder
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve),
    }
    return builder
  }
  // biome-ignore lint/suspicious/noExplicitAny: loose service-client mock for the test
  return { db: { from } as any, calls }
}

describe("computeStudentComparison — reference scope is ORG-WIDE (M2)", () => {
  it("consulta a população por tenant_id + role=student, SEM tocar user_areas", async () => {
    const { db, calls } = makeMockDb({
      users: [{ id: "stud-1" }, { id: "stud-2" }],
      sessions: [],
      slide_reflections: [],
      chapters: [],
      courses: [],
      areas: [],
    })

    const result = await computeStudentComparison(db, "tenant-1", "stud-1", { now: NOW })

    // The org population query: users, scoped ONLY by tenant + role=student.
    const orgPop = calls.find(
      (c) =>
        c.table === "users" &&
        c.filters.some((f) => f[0] === "eq" && f[1] === "tenant_id" && f[2] === "tenant-1") &&
        c.filters.some((f) => f[0] === "eq" && f[1] === "role" && f[2] === "student"),
    )
    expect(orgPop).toBeDefined()

    // CRITICAL: NO area/unidade resolution — user_areas is never queried.
    expect(calls.some((c) => c.table === "user_areas")).toBe(false)

    // The ORG sessions query filters by tenant_id and NOT by a student_id (that is
    // the org-wide reference load, distinct from the student's OWN sessions query).
    const orgSessions = calls.filter(
      (c) =>
        c.table === "sessions" && !c.filters.some((f) => f[0] === "eq" && f[1] === "student_id"),
    )
    expect(orgSessions.length).toBeGreaterThan(0)
    expect(
      orgSessions.every((c) =>
        c.filters.some((f) => f[0] === "eq" && f[1] === "tenant_id" && f[2] === "tenant-1"),
      ),
    ).toBe(true)

    // The reference block is present and carries NO named unidade (org-wide).
    expect(result.unit).not.toBeNull()
    expect(result.unitName).toBeNull()
  })

  // "Onde você está" end-to-end: the subject label is ONDE O ALUNO PAROU (o módulo
  // da atividade mais recente, típicamente EM ANDAMENTO) + a % DAQUELE módulo, NÃO
  // o último concluído. Fresh tenant id to dodge the org-reference cache.
  it("indicators.subject.lastCompletedLabel = 'Módulo N: título · X%' (onde parou + %)", async () => {
    const { db } = makeMockDb({
      users: [{ id: "ws-1" }],
      // A atividade MAIS recente do aluno está EM ANDAMENTO no ch-2 (não no ch-1
      // concluído). 1 sessão concluída no ch-2 de 4 questões ativas → 25%.
      sessions: [
        { student_id: "ws-1", status: "completed", chapter_id: "ch-1", created_at: daysAgo(9) },
        { student_id: "ws-1", status: "completed", chapter_id: "ch-2", created_at: daysAgo(5) },
        { student_id: "ws-1", status: "in_progress", chapter_id: "ch-2", created_at: daysAgo(1) },
      ],
      slide_reflections: [],
      // Single chapters row so the by-id `.limit(1)` lookup returns the intended one.
      chapters: [{ id: "ch-2", title: "Precificação", order: 2 }],
      questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }],
      courses: [],
      areas: [],
      enrollments: [],
    })

    const result = await computeStudentComparison(db, "tenant-ws", "ws-1", { now: NOW })
    expect(result.indicators?.subject.lastCompletedLabel).toBe("Módulo 3: Precificação · 25%")
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 (AC7/AC13) — computeStudentComparison surfaces the REAL engagement rank
// on indicators.subject.isTopEngagement, computed over the whole org population,
// AND the returned payload carries NO identity/score of peers (LGPD, AC13).
// ---------------------------------------------------------------------------

describe("computeStudentComparison — rank real de engajamento (AC7) + payload sem PII (AC13)", () => {
  it("aluno com o MAIOR engajamento da org → subject.isTopEngagement true", async () => {
    // top-1: 3 sessões concluídas (*2) + 2 reflexões = 8. top-1 domina os peers.
    const { db } = makeMockDb({
      users: [{ id: "top-1" }, { id: "peer-2" }, { id: "peer-3" }],
      sessions: [
        session("top-1", daysAgo(1)),
        session("top-1", daysAgo(2)),
        session("top-1", daysAgo(3)),
        session("peer-2", daysAgo(1)),
        session("peer-3", daysAgo(1)),
      ],
      slide_reflections: [{ id: "r1" }, { id: "r2" }],
      chapters: [],
      courses: [],
      areas: [],
      enrollments: [],
    })
    const result = await computeStudentComparison(db, "tenant-top", "top-1", { now: NOW })
    expect(result.indicators?.subject.isTopEngagement).toBe(true)
  })

  it("aluno NÃO-#1 (peer com engajamento menor que outro) → isTopEngagement false", async () => {
    // "low-1" tem 1 sessão; "star" tem 4 → star é o #1, low-1 não.
    const { db } = makeMockDb({
      users: [{ id: "low-1" }, { id: "star" }],
      // org-wide sessions carregam AMBOS; a query student-scoped do low-1 usa a
      // mesma lista mockada (o rank é derivado do lado org, org-wide).
      sessions: [
        session("low-1", daysAgo(1)),
        session("star", daysAgo(1)),
        session("star", daysAgo(2)),
        session("star", daysAgo(3)),
        session("star", daysAgo(4)),
      ],
      slide_reflections: [],
      chapters: [],
      courses: [],
      areas: [],
      enrollments: [],
    })
    const result = await computeStudentComparison(db, "tenant-low", "low-1", { now: NOW })
    expect(result.indicators?.subject.isTopEngagement).toBe(false)
  })

  it("AC13 — o payload de retorno NÃO carrega id/nome/score de outros alunos", async () => {
    const { db } = makeMockDb({
      users: [{ id: "me" }, { id: "colega-secreto" }],
      sessions: [session("me", daysAgo(1)), session("colega-secreto", daysAgo(1))],
      slide_reflections: [],
      chapters: [],
      courses: [],
      areas: [],
      enrollments: [],
    })
    const result = await computeStudentComparison(db, "tenant-lgpd", "me", { now: NOW })
    // O único sinal do rank é um booleano do PRÓPRIO aluno. Nenhum id/score de peer
    // aparece em NENHUM lugar do payload serializado.
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain("colega-secreto")
    // subject expõe só o booleano de rank, não uma lista ordenada nem posições alheias.
    expect(typeof result.indicators?.subject.isTopEngagement).toBe("boolean")
  })
})

// ---------------------------------------------------------------------------
// "Onde você está" (Hugo 2026-07-14) — ONDE O ALUNO PAROU: o módulo da ATIVIDADE
// MAIS RECENTE (tipicamente EM ANDAMENTO, não o último concluído) + a % daquele
// módulo. Helpers PUROS + subject-scoped: whereStoppedChapterIdOf (sessão mais
// recente COM chapter, qualquer status) + computeChapterProgressPct (concluídas ÷
// questões ativas) + chapterModuleLabel (rótulo "Módulo N: título · X%").
// ---------------------------------------------------------------------------

describe("whereStoppedChapterIdOf — onde o aluno parou (subject-scoped)", () => {
  it("pega o chapter_id da sessão MAIS RECENTE por created_at, QUALQUER status", () => {
    const rows = [
      { status: "completed", created_at: "2026-05-01T10:00:00Z", chapter_id: "ch-a" },
      { status: "completed", created_at: "2026-05-05T10:00:00Z", chapter_id: "ch-b" },
      // A atividade MAIS recente está EM ANDAMENTO — é AQUI que o aluno parou.
      { status: "in_progress", created_at: "2026-05-10T10:00:00Z", chapter_id: "ch-c" },
    ]
    expect(whereStoppedChapterIdOf(rows)).toBe("ch-c")
  })

  it("ignora apenas as sessões SEM chapter_id (status é irrelevante)", () => {
    const rows = [
      { status: "in_progress", created_at: "2026-05-20T10:00:00Z", chapter_id: null },
      { status: "abandoned", created_at: "2026-05-19T10:00:00Z", chapter_id: "ch-x" },
      { status: "completed", created_at: "2026-05-02T10:00:00Z", chapter_id: "ch-y" },
    ]
    // A sessão de created_at mais alto COM chapter é a 'abandoned' em ch-x.
    expect(whereStoppedChapterIdOf(rows)).toBe("ch-x")
  })

  it("nenhuma atividade com módulo → null (o aluno está 'Começando')", () => {
    expect(whereStoppedChapterIdOf([])).toBeNull()
    expect(
      whereStoppedChapterIdOf([
        { status: "in_progress", created_at: "2026-05-01T10:00:00Z", chapter_id: null },
      ]),
    ).toBeNull()
  })
})

describe("computeChapterProgressPct — % de progresso DENTRO do módulo", () => {
  it("concluídas ÷ questões ativas, arredondado (3 de 5 = 60%)", () => {
    expect(computeChapterProgressPct(3, 5)).toBe(60)
    expect(computeChapterProgressPct(1, 3)).toBe(33)
  })

  it("clampa em 100 quando concluídas ≥ questões (nunca > 100%)", () => {
    expect(computeChapterProgressPct(5, 5)).toBe(100)
    expect(computeChapterProgressPct(7, 5)).toBe(100)
  })

  it("denominador 0 → null (sem fração honesta a mostrar)", () => {
    expect(computeChapterProgressPct(0, 0)).toBeNull()
    expect(computeChapterProgressPct(2, 0)).toBeNull()
  })

  it("nada concluído → 0%", () => {
    expect(computeChapterProgressPct(0, 4)).toBe(0)
  })
})

describe("chapterModuleLabel — rótulo do módulo onde parou + %", () => {
  it("order 0-based + pct → 'Módulo N: título · X%' (N = order + 1)", () => {
    expect(chapterModuleLabel("Precificação", 2, 60)).toBe("Módulo 3: Precificação · 60%")
    expect(chapterModuleLabel("Introdução", 0, 0)).toBe("Módulo 1: Introdução · 0%")
  })

  it("sem pct → só o rótulo do módulo (sem sufixo '· X%')", () => {
    expect(chapterModuleLabel("Precificação", 2)).toBe("Módulo 3: Precificação")
    expect(chapterModuleLabel("Precificação", 2, null)).toBe("Módulo 3: Precificação")
  })

  it("sem order → só o título (+ pct quando houver)", () => {
    expect(chapterModuleLabel("Precificação", null)).toBe("Precificação")
    expect(chapterModuleLabel("Precificação", null, 40)).toBe("Precificação · 40%")
  })

  it("sem título → null (caller cai para 'Começando')", () => {
    expect(chapterModuleLabel(null, 2, 60)).toBeNull()
    expect(chapterModuleLabel("   ", 2, 60)).toBeNull()
  })
})
