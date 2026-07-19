import { describe, expect, it } from "vitest"
import {
  type EnrollmentRow,
  computeBehindAndProgress,
  computeEngagementTriage,
} from "../engagement-triage"

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

// ===========================================================================
// FOLLOW-UP A (Hugo 2026-07-14, caso Rinaldo) — a MESMA cegueira de created_at
// corrigida na home vale aqui: a sessão socrática é REUTILIZADA ao voltar
// (só updated_at anda) e reflexões são atividade. "Sem acesso" não pode ser
// declarado olhando apenas sessions.created_at.
// ===========================================================================
describe("computeEngagementTriage — atividade em sessão reutilizada e reflexões (Rinaldo)", () => {
  it("sessão criada há 20d mas com turno ONTEM (updated_at) → No ritmo, não Sem acesso", async () => {
    const svc = stubService({
      users: [{ id: "rin" }],
      sessions: [{ student_id: "rin", created_at: daysAgo(20), updated_at: daysAgo(1) }],
      enrollments: [
        {
          student_id: "rin",
          status: "active",
          created_at: daysAgo(30),
          progress: { percentage: 50 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", deadline_days: null }],
    })

    const { triagemByStudent, summary } = await computeEngagementTriage(svc, TENANT, ["rin"], NOW)
    expect(triagemByStudent.get("rin")).toBe("no_ritmo")
    expect(summary.semAcesso).toBe(0)
  })

  it("sessão velha (20d) mas REFLEXÃO editada ontem → No ritmo, não Sem acesso", async () => {
    const svc = stubService({
      users: [{ id: "rin" }],
      sessions: [{ student_id: "rin", created_at: daysAgo(20) }],
      slide_reflections: [{ student_id: "rin", created_at: daysAgo(40), updated_at: daysAgo(1) }],
      enrollments: [
        {
          student_id: "rin",
          status: "active",
          created_at: daysAgo(30),
          progress: { percentage: 50 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", deadline_days: null }],
    })

    const { triagemByStudent } = await computeEngagementTriage(svc, TENANT, ["rin"], NOW)
    expect(triagemByStudent.get("rin")).toBe("no_ritmo")
  })
})

// ===========================================================================
// FOLLOW-UP C (Hugo 2026-07-18, "Caio sumido") — a multi-hat member (primary
// `users.role` = 'manager', but with a 'student' hat via `user_roles`, e.g. a
// gestor who is himself enrolled) was being silently dropped from the semáforo
// cards' cohorts. `allowedStudentIds` (as resolved by resolveEngagementScope,
// which reads the student HAT via the SECURITY DEFINER RPCs
// auth_direct_student_ids / auth_reachable_student_ids) already IS the correct
// student population — but `usersQuery` used to hard-filter `.eq("role",
// "student")` on top, which checks the LEGACY singular column and excludes
// multi-hat members like Caio regardless of scope. The `stubService` above
// ignores filter arguments entirely (can't catch this class of bug — same blind
// spot documented in the auth_direct_student_ids migration), so this uses a
// FILTER-AWARE stub that actually applies `.eq()`/`.in()` to the rows.
// ===========================================================================
function stubServiceWithRealFilters(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => {
      let rows = tables[table] ?? []
      // biome-ignore lint/suspicious/noExplicitAny: chainable filtering stub
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val)
          return builder
        },
        in: (col: string, vals: unknown[]) => {
          const set = new Set(vals)
          rows = rows.filter((r) => set.has(r[col] as unknown))
          return builder
        },
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub
        then: (onF: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(onF),
      }
      return builder
    },
    // biome-ignore lint/suspicious/noExplicitAny: match the SupabaseClient shape loosely
  } as any
}

describe("computeEngagementTriage — multi-hat member is not dropped by the legacy role column (caso Caio)", () => {
  it("a SCOPED multi-hat student (users.role='manager', student hat) still lands in the taxonomy", async () => {
    const svc = stubServiceWithRealFilters({
      users: [{ id: "caio", role: "manager", tenant_id: TENANT }],
      sessions: [{ student_id: "caio", tenant_id: TENANT, created_at: daysAgo(1) }],
      slide_reflections: [],
      enrollments: [
        {
          student_id: "caio",
          tenant_id: TENANT,
          status: "active",
          created_at: daysAgo(10),
          progress: { percentage: 90 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", tenant_id: TENANT, deadline_days: 100 }],
    })

    // allowedStudentIds is what resolveEngagementScope already resolved (the RPC
    // reads user_roles, the student HAT) — Caio IS in the caller's recorte.
    const { triagemByStudent, summary } = await computeEngagementTriage(svc, TENANT, ["caio"], NOW)

    expect(triagemByStudent.has("caio")).toBe(true)
    expect(summary.analisados).toBe(1)
  })

  it("UNSCOPED (admin, allowedStudentIds=null) still excludes a non-student role", async () => {
    const svc = stubServiceWithRealFilters({
      users: [
        { id: "caio", role: "manager", tenant_id: TENANT },
        { id: "aluno", role: "student", tenant_id: TENANT },
      ],
      sessions: [],
      slide_reflections: [],
      enrollments: [],
      courses: [],
    })

    const { triagemByStudent } = await computeEngagementTriage(svc, TENANT, null, NOW)
    expect(triagemByStudent.has("caio")).toBe(false)
    expect(triagemByStudent.has("aluno")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SH-2.7 (Hugo 2026-07-19, caso Rinaldo) — `computeBehindAndProgress` agora
// TAMBÉM propaga `expectedPct` (antes descartado após decidir `behind`) como
// `expectedPctByStudent` — o sinal que o freio da tabela "Meu ritmo" consome
// (`student-home-indicators.ts` → `comparison-insights-table.tsx`). Reproduz o
// dado REAL lido do tenant CORY (Supabase, leitura read-only, 2026-07-19): a
// matrícula do Rinaldo em "Análise e Solução de Problemas" (curso
// 4711c03e-6f91-4b28-80cf-047cd607d04b), created_at 2026-05-21T23:05:25Z,
// deadline_days=180, progresso 50% — NÃO é fixture sintética.
// ---------------------------------------------------------------------------
describe("computeBehindAndProgress — expectedPctByStudent (SH-2.7, caso real Rinaldo)", () => {
  const RINALDO = "55993f62-c640-4243-96e4-3c8a39887678"
  const COURSE = "4711c03e-6f91-4b28-80cf-047cd607d04b"
  const RINALDO_ENROLLMENT: EnrollmentRow = {
    student_id: RINALDO,
    status: "active",
    created_at: "2026-05-21T23:05:25.612666+00:00",
    progress: { percentage: 50 },
    course_id: COURSE,
  }
  // Momento real da leitura (Supabase, 2026-07-19) — elapsedDays≈58.7, não "agora".
  const REAL_NOW = new Date("2026-07-19T16:33:23.095Z").getTime()
  const deadlineByCourse = new Map([[COURSE, 180]])

  it("propaga expectedPct (33%, elapsedDays≈58.7/deadlineDays=180) para o Rinaldo, dado real", () => {
    const { expectedPctByStudent } = computeBehindAndProgress(
      [RINALDO_ENROLLMENT],
      deadlineByCourse,
      REAL_NOW,
    )
    expect(expectedPctByStudent.get(RINALDO)).toBe(33)
  })

  it("progresso do Rinaldo (50%) está ACIMA do próprio ritmo esperado (33%) — não é o mesmo caso das Reflexões", () => {
    const { progressByStudent, expectedPctByStudent } = computeBehindAndProgress(
      [RINALDO_ENROLLMENT],
      deadlineByCourse,
      REAL_NOW,
    )
    expect(progressByStudent.get(RINALDO)).toBe(50)
    expect((progressByStudent.get(RINALDO) ?? 0) >= (expectedPctByStudent.get(RINALDO) ?? 0)).toBe(
      true,
    )
  })

  it("sem deadline computável (curso sem deadline_days) → expectedPctByStudent SEM entrada (degradação graciosa)", () => {
    const { expectedPctByStudent } = computeBehindAndProgress(
      [RINALDO_ENROLLMENT],
      new Map([[COURSE, null]]),
      REAL_NOW,
    )
    expect(expectedPctByStudent.has(RINALDO)).toBe(false)
  })

  it("matrícula não-ativa → expectedPctByStudent SEM entrada", () => {
    const { expectedPctByStudent } = computeBehindAndProgress(
      [{ ...RINALDO_ENROLLMENT, status: "completed" }],
      deadlineByCourse,
      REAL_NOW,
    )
    expect(expectedPctByStudent.has(RINALDO)).toBe(false)
  })

  it("trilha líder SEM deadline sobrepõe uma trilha anterior COM deadline (sem valor obsoleto)", () => {
    // Curso A (25%, com deadline) processado primeiro; curso B (60%, SEM deadline)
    // vira o líder depois — expectedPctByStudent não pode ficar com o valor do A.
    const courseA: EnrollmentRow = {
      student_id: RINALDO,
      status: "active",
      created_at: "2026-05-21T23:05:25.612666+00:00",
      progress: { percentage: 25 },
      course_id: "course-a",
    }
    const courseB: EnrollmentRow = {
      student_id: RINALDO,
      status: "active",
      created_at: "2026-06-01T00:00:00.000000+00:00",
      progress: { percentage: 60 },
      course_id: "course-b",
    }
    const { progressByStudent, expectedPctByStudent } = computeBehindAndProgress(
      [courseA, courseB],
      new Map([
        ["course-a", 180],
        ["course-b", null],
      ]),
      REAL_NOW,
    )
    expect(progressByStudent.get(RINALDO)).toBe(60)
    expect(expectedPctByStudent.has(RINALDO)).toBe(false)
  })
})
