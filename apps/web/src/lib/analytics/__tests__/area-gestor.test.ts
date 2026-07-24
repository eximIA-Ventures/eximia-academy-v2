import { describe, expect, it } from "vitest"
import {
  chapterModuleLabel,
  computeChapterProgressPct,
  computeMetricBlock,
  computeStudentComparison,
  computeUnitReferenceStats,
  nextPendingInteractionChapterOf,
  nextPendingReflectionSlideOf,
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
    // SH-2.1 — a Turma agora só conta alunos com >=1 sinal de atividade real
    // (session/reflection/last_seen_at); stud-2 fica de fora do reference (é o ponto
    // do fix), mas o teste em si verifica a FORMA da query, não o tamanho da
    // população, então stud-1 ganha um `last_seen_at` para a população ativa não
    // ficar vazia (o que zeraria `result.unit`/`referenceStats` abaixo à toa).
    const { db, calls } = makeMockDb({
      users: [{ id: "stud-1", last_seen_at: daysAgo(1) }, { id: "stud-2" }],
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
// SH-3.3 (Hugo 2026-07-21) — computeStudentComparison end-to-end: the deep-link
// hrefs are derived from the SAME rows already fetched for the indicators (no
// new query), and degrade to null (never a broken href) when nothing is pending.
// ---------------------------------------------------------------------------

describe("computeStudentComparison — nextPendingInteractionHref / nextPendingReflectionHref (SH-3.3)", () => {
  it("trilha com capítulo pendente + reflexão pendente → ambos os hrefs apontam pro deep-link real", async () => {
    const { db } = makeMockDb({
      users: [{ id: "px-1", last_seen_at: daysAgo(1) }],
      sessions: [], // nem própria nem org — ch-x segue sem sessão concluída.
      slide_reflections: [], // nenhuma reflexão respondida ainda.
      enrollments: [{ student_id: "px-1", status: "active", course_id: "course-x" }],
      courses: [{ id: "course-x", status: "active" }],
      chapters: [{ id: "ch-x", course_id: "course-x", order: 0 }],
      chapter_slides: [
        {
          id: "sl-x",
          chapter_id: "ch-x",
          order: 0,
          text_content: "> Reflexão: o que você aprendeu?",
        },
      ],
      areas: [],
    })

    const result = await computeStudentComparison(db, "tenant-sh33-pending", "px-1", { now: NOW })

    expect(result.nextPendingInteractionHref).toBe(
      "/courses/course-x/chapters/ch-x?focus=interaction",
    )
    expect(result.nextPendingReflectionHref).toBe(
      "/courses/course-x/chapters/ch-x?focus=reflection&slideId=sl-x",
    )
  })

  it("trilha 100% em dia (sessão concluída + reflexão respondida) → ambos os hrefs são null (degrada pro continueHref genérico)", async () => {
    const { db } = makeMockDb({
      users: [{ id: "px-2", last_seen_at: daysAgo(1) }],
      sessions: [
        { student_id: "px-2", status: "completed", chapter_id: "ch-y", created_at: daysAgo(1) },
      ],
      slide_reflections: [{ id: "ref-1", student_id: "px-2", slide_id: "sl-y" }],
      enrollments: [{ student_id: "px-2", status: "active", course_id: "course-y" }],
      courses: [{ id: "course-y", status: "active" }],
      chapters: [{ id: "ch-y", course_id: "course-y", order: 0 }],
      chapter_slides: [
        { id: "sl-y", chapter_id: "ch-y", order: 0, text_content: "> Reflexão: e agora?" },
      ],
      areas: [],
    })

    const result = await computeStudentComparison(db, "tenant-sh33-done", "px-2", { now: NOW })

    expect(result.nextPendingInteractionHref).toBeNull()
    expect(result.nextPendingReflectionHref).toBeNull()
  })

  it("aluno sem trilha (sem enrollment) → ambos os hrefs são null, sem crash", async () => {
    const { db } = makeMockDb({
      users: [{ id: "px-3", last_seen_at: daysAgo(1) }],
      sessions: [],
      slide_reflections: [],
      enrollments: [],
      courses: [],
      chapters: [],
      chapter_slides: [],
      areas: [],
    })

    const result = await computeStudentComparison(db, "tenant-sh33-empty", "px-3", { now: NOW })

    expect(result.nextPendingInteractionHref).toBeNull()
    expect(result.nextPendingReflectionHref).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// JRN-D (Hugo 2026-07-24) — o seletor de curso do card "Meu ritmo" escopa o
// SUJEITO por curso (opts.courseId). Default (sem courseId) = agregado, byte-
// idêntico (o drill do gestor NUNCA passa courseId → seu caminho não muda).
// ---------------------------------------------------------------------------
describe("computeStudentComparison — escopo por curso do sujeito (opts.courseId, JRN-D)", () => {
  // Aluno em 2 cursos: cA (2 sessões concluídas, 40% progresso) e cB (1 sessão,
  // 10%). Mesma DB/tenant para as 3 chamadas (org ref é tenant-wide, o sujeito é
  // recomputado a cada chamada).
  function scopedDb() {
    return makeMockDb({
      users: [{ id: "j1", last_seen_at: daysAgo(1) }],
      courses: [
        { id: "cA", status: "active", deadline_days: 100 },
        { id: "cB", status: "active", deadline_days: 100 },
      ],
      chapters: [
        { id: "chA1", course_id: "cA", order: 1, title: "A1" },
        { id: "chA2", course_id: "cA", order: 2, title: "A2" },
        { id: "chB1", course_id: "cB", order: 1, title: "B1" },
      ],
      enrollments: [
        {
          student_id: "j1",
          status: "active",
          course_id: "cA",
          created_at: daysAgo(50),
          progress: { percentage: 40 },
        },
        {
          student_id: "j1",
          status: "active",
          course_id: "cB",
          created_at: daysAgo(50),
          progress: { percentage: 10 },
        },
      ],
      sessions: [
        { student_id: "j1", status: "completed", chapter_id: "chA1", created_at: daysAgo(10) },
        { student_id: "j1", status: "completed", chapter_id: "chA2", created_at: daysAgo(8) },
        { student_id: "j1", status: "completed", chapter_id: "chB1", created_at: daysAgo(6) },
      ],
      slide_reflections: [],
      chapter_slides: [],
      questions: [],
      areas: [],
    })
  }

  it("SEM courseId → agregado: interações somam os 2 cursos (3) e progresso é o líder (40%)", async () => {
    const { db } = scopedDb()
    const r = await computeStudentComparison(db, "tenant-jrnd-agg", "j1", { now: NOW })
    expect(r.indicators?.subject.interactions).toBe(3)
    expect(r.indicators?.subject.progressPct).toBe(40)
  })

  it("courseId='cA' → só o curso A: 2 interações, progresso 40%", async () => {
    const { db } = scopedDb()
    const r = await computeStudentComparison(db, "tenant-jrnd-ca", "j1", {
      now: NOW,
      courseId: "cA",
    })
    expect(r.indicators?.subject.interactions).toBe(2)
    expect(r.indicators?.subject.engagement).toBe(2 * 2) // 2 interações, 0 reflexões
    expect(r.indicators?.subject.progressPct).toBe(40)
  })

  it("courseId='cB' → só o curso B: 1 interação, progresso 10% (não o líder)", async () => {
    const { db } = scopedDb()
    const r = await computeStudentComparison(db, "tenant-jrnd-cb", "j1", {
      now: NOW,
      courseId: "cB",
    })
    expect(r.indicators?.subject.interactions).toBe(1)
    expect(r.indicators?.subject.progressPct).toBe(10)
  })

  it("courseId inexistente → sujeito zera (sem capítulos do curso), nunca crash", async () => {
    const { db } = scopedDb()
    const r = await computeStudentComparison(db, "tenant-jrnd-none", "j1", {
      now: NOW,
      courseId: "nope",
    })
    expect(r.indicators?.subject.interactions).toBe(0)
    expect(r.indicators?.subject.progressPct).toBe(0)
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

  it("Round 2 — subject.engagementRank/total presentes no payload (posição de exibição)", async () => {
    // SH-2.1 — a Turma só conta alunos ativos; peer-3 ganha 1 sessão para permanecer
    // um membro contável da população (senão o "de 3" do comentário abaixo viraria "de
    // 2" por peer-3 nunca ter tocado a plataforma — não é o que este teste quer cobrir).
    const { db } = makeMockDb({
      users: [{ id: "top-1" }, { id: "peer-2" }, { id: "peer-3" }],
      sessions: [
        session("top-1", daysAgo(1)),
        session("top-1", daysAgo(2)),
        session("peer-2", daysAgo(1)),
        session("peer-3", daysAgo(1)),
      ],
      slide_reflections: [],
      chapters: [],
      courses: [],
      areas: [],
      enrollments: [],
    })
    const result = await computeStudentComparison(db, "tenant-rank", "top-1", { now: NOW })
    // top-1 domina os peers numa org de 3 → 1º de 3.
    expect(result.indicators?.subject.engagementRank).toBe(1)
    expect(result.indicators?.subject.engagementTotalStudents).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 Round 2 (Hugo 2026-07-18) — computeStudentComparison surfaces the CLASS-
// side fraction denominators (interactionsMaxAvg/reflectionsMaxAvg/engagementMaxAvg)
// on indicators.reference, derived org-wide from the CACHED catalog + a SINGLE
// chapter_slides union scan (no N+1 per student).
// ---------------------------------------------------------------------------

describe("computeStudentComparison — denominadores da Turma (Round 2)", () => {
  it("reference expõe interactionsMaxAvg/reflectionsMaxAvg/engagementMaxAvg e faz UMA varredura de chapter_slides", async () => {
    // Org de 2 alunos, ambos no curso c1 (ativo) com 2 capítulos (ch1, ch2).
    // ch1 tem 1 slide com reflexão. Cada aluno: interactionsMax=2, reflectionsMax=1.
    const { db, calls } = makeMockDb({
      users: [{ id: "a1" }, { id: "a2" }],
      sessions: [session("a1", daysAgo(1)), session("a2", daysAgo(2))],
      slide_reflections: [],
      chapters: [
        { id: "ch1", course_id: "c1" },
        { id: "ch2", course_id: "c1" },
      ],
      chapter_slides: [
        { chapter_id: "ch1", text_content: "> Reflexão: o que você aprendeu?" },
        { chapter_id: "ch2", text_content: "conteúdo normal" },
      ],
      courses: [{ id: "c1", title: "Curso 1", status: "published" }],
      areas: [],
      enrollments: [
        { student_id: "a1", status: "active", course_id: "c1" },
        { student_id: "a2", status: "active", course_id: "c1" },
      ],
      questions: [],
    })

    const result = await computeStudentComparison(db, "tenant-turma", "a1", { now: NOW })
    const ref = result.indicators?.reference
    // Ambos os alunos: 2 capítulos → interactionsMax médio = round((2+2)/2) = 2.
    expect(ref?.interactionsMaxAvg).toBe(2)
    // Ambos: 1 slide-com-reflexão → reflectionsMax médio = round((1+1)/2) = 1.
    expect(ref?.reflectionsMaxAvg).toBe(1)
    // Engajamento médio-teto = 2*2 + 1 = 5.
    expect(ref?.engagementMaxAvg).toBe(5)

    // NÃO-N+1: chapter_slides é consultado no MÁXIMO uma vez (varredura da união,
    // não uma query por aluno). A paginação de fetchAllRows pode gerar 2 chamadas
    // (page + página curta), mas nunca escala com o nº de alunos.
    const slideScans = calls.filter((c) => c.table === "chapter_slides")
    expect(slideScans.length).toBeLessThanOrEqual(2)
    // E a varredura é escopada por tenant_id + IN(chapter ativos), nunca por student_id.
    expect(
      slideScans.every(
        (c) =>
          c.filters.some((f) => f[0] === "eq" && f[1] === "tenant_id") &&
          !c.filters.some((f) => f[0] === "eq" && f[1] === "student_id"),
      ),
    ).toBe(true)
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

// ---------------------------------------------------------------------------
// SH-3.3 (Hugo 2026-07-21) — deep-link targets for the "Meu ritmo" CTAs. Both
// helpers are PURE over rows `computeStudentComparison` already fetches (no
// new query) — tested here in isolation from the DB mock.
// ---------------------------------------------------------------------------

describe("nextPendingInteractionChapterOf — próxima interação socrática pendente", () => {
  const CHAPTERS = [
    { id: "ch-1", course_id: "course-a", order: 0 },
    { id: "ch-2", course_id: "course-a", order: 1 },
    { id: "ch-3", course_id: "course-b", order: 0 },
  ]

  it("uma sessão ATIVA numa trilha vence — resume ela mesmo que outra tenha order menor", () => {
    const sessions = [
      { status: "completed", created_at: "2026-05-01T10:00:00Z", chapter_id: "ch-1" },
      { status: "active", created_at: "2026-05-10T10:00:00Z", chapter_id: "ch-3" },
    ]
    expect(nextPendingInteractionChapterOf(["ch-1", "ch-2", "ch-3"], CHAPTERS, sessions)).toEqual({
      chapterId: "ch-3",
      courseId: "course-b",
    })
  })

  it("sem sessão ativa: primeiro capítulo da trilha (course_id, order) SEM sessão concluída", () => {
    const sessions = [
      { status: "completed", created_at: "2026-05-01T10:00:00Z", chapter_id: "ch-1" },
    ]
    // ch-1 concluído → ch-2 (mesmo curso, próximo order) é o pendente.
    expect(nextPendingInteractionChapterOf(["ch-1", "ch-2", "ch-3"], CHAPTERS, sessions)).toEqual({
      chapterId: "ch-2",
      courseId: "course-a",
    })
  })

  it("todos os capítulos da trilha concluídos → null (caller degrada para continueHref)", () => {
    const sessions = [
      { status: "completed", created_at: "2026-05-01T10:00:00Z", chapter_id: "ch-1" },
      { status: "completed", created_at: "2026-05-02T10:00:00Z", chapter_id: "ch-2" },
      { status: "completed", created_at: "2026-05-03T10:00:00Z", chapter_id: "ch-3" },
    ]
    expect(nextPendingInteractionChapterOf(["ch-1", "ch-2", "ch-3"], CHAPTERS, sessions)).toBeNull()
  })

  it("trilha vazia → null", () => {
    expect(nextPendingInteractionChapterOf([], CHAPTERS, [])).toBeNull()
  })

  it("sessão ativa FORA da trilha é ignorada (não escapa o escopo)", () => {
    const sessions = [
      { status: "active", created_at: "2026-05-10T10:00:00Z", chapter_id: "ch-outside" },
    ]
    expect(nextPendingInteractionChapterOf(["ch-1"], CHAPTERS, sessions)).toEqual({
      chapterId: "ch-1",
      courseId: "course-a",
    })
  })
})

describe("nextPendingReflectionSlideOf — próxima reflexão pendente", () => {
  const CHAPTERS = [
    { id: "ch-1", course_id: "course-a", order: 0 },
    { id: "ch-2", course_id: "course-a", order: 1 },
  ]

  it("slide com bloco de reflexão AINDA NÃO respondido → retorna esse slide", () => {
    const slides = [
      {
        id: "sl-1",
        chapter_id: "ch-1",
        order: 0,
        text_content: "> Reflexão: o que você aprendeu?",
      },
    ]
    expect(nextPendingReflectionSlideOf(slides, CHAPTERS, new Set())).toEqual({
      slideId: "sl-1",
      chapterId: "ch-1",
      courseId: "course-a",
    })
  })

  it("slide JÁ respondido é pulado — o PRÓXIMO slide com reflexão pendente vence", () => {
    const slides = [
      {
        id: "sl-1",
        chapter_id: "ch-1",
        order: 0,
        text_content: "> Reflexão: o que você aprendeu?",
      },
      { id: "sl-2", chapter_id: "ch-2", order: 0, text_content: "> Reflexão: e agora?" },
    ]
    expect(nextPendingReflectionSlideOf(slides, CHAPTERS, new Set(["sl-1"]))).toEqual({
      slideId: "sl-2",
      chapterId: "ch-2",
      courseId: "course-a",
    })
  })

  it("slide SEM bloco de reflexão (texto comum) nunca é candidato", () => {
    const slides = [
      { id: "sl-1", chapter_id: "ch-1", order: 0, text_content: "Texto comum, sem prompt." },
    ]
    expect(nextPendingReflectionSlideOf(slides, CHAPTERS, new Set())).toBeNull()
  })

  it("todas as reflexões possíveis já respondidas → null (caller degrada para continueHref)", () => {
    const slides = [
      {
        id: "sl-1",
        chapter_id: "ch-1",
        order: 0,
        text_content: "> Reflexão: o que você aprendeu?",
      },
    ]
    expect(nextPendingReflectionSlideOf(slides, CHAPTERS, new Set(["sl-1"]))).toBeNull()
  })

  it("ordena por (course_id, order do capítulo, order do slide) — determinístico", () => {
    const slides = [
      { id: "sl-late", chapter_id: "ch-2", order: 0, text_content: "> Reflexão: tardia?" },
      { id: "sl-early", chapter_id: "ch-1", order: 1, text_content: "> Reflexão: cedo?" },
    ]
    expect(nextPendingReflectionSlideOf(slides, CHAPTERS, new Set())?.slideId).toBe("sl-early")
  })
})
