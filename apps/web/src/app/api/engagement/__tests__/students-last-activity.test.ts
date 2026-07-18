import { beforeEach, describe, expect, it, vi } from "vitest"

// ===========================================================================
// FOLLOW-UP A (Hugo 2026-07-14, caso Rinaldo) — GET /api/engagement/students
// tinha a MESMA cegueira de created_at corrigida na home "Meu ritmo": a sessão
// socrática é REUTILIZADA quando o aluno volta ao capítulo (createSession
// redireciona para a active; claim_session_turn bumpa SÓ updated_at), e
// reflexões são atividade. O "Último acesso"/status do gestor não pode declarar
// "sem_acesso" olhando apenas sessions.created_at. Harness espelha o de
// students-scope.test.ts (mesmos mocks), variando só as linhas de dados.
// ===========================================================================

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockActiveContext = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/context-context", () => ({
  getActiveContextCookie: () => mockActiveContext(),
}))
vi.mock("@/lib/team-view-context", () => ({
  getTeamViewMode: () => Promise.resolve("hierarchy"),
}))

const mockServiceFrom = vi.fn()
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { GET as studentsGET } from "../students/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ADMIN = "11111111-1111-1111-1111-111111111111"
const RIN = "22222222-2222-2222-2222-222222222222"

const NOW = Date.now()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

type Row = Record<string, unknown>

function authClient(subtree: string[]) {
  return {
    rpc: (name: string) =>
      name === "auth_reachable_student_ids"
        ? Promise.resolve({ data: subtree, error: null })
        : Promise.resolve({ data: [], error: null }),
  }
}

/**
 * Table stub: users echoes the queried ids; the rest resolve to the rows given.
 * The `users` builder is chain-order-agnostic (`.eq()` is a no-op passthrough,
 * any number of times) so it doesn't hard-code how many `.eq()` calls precede
 * `.in()` — the route conditionally applies `role='student'` only when unscoped
 * (see MULTI-CHAPÉU fix, caso Caio), so the exact chain shape varies by scope.
 */
function stubServiceReads(tables: Record<string, Row[]>) {
  mockServiceFrom.mockImplementation((table: string) => {
    if (table === "users") {
      // biome-ignore lint/suspicious/noExplicitAny: chainable stub
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: (_col: string, ids: string[]) =>
          Promise.resolve({
            data: ids.map((id) => ({ id, full_name: `Aluno ${id.slice(0, 4)}` })),
            error: null,
          }),
      }
      return builder
    }
    const rows = tables[table] ?? []
    return {
      select: () => ({
        eq: () => ({ in: () => Promise.resolve({ data: rows, error: null }) }),
      }),
    }
  })
}

function studentsReq(ids: string[], action = "recognize"): Request {
  const q = new URLSearchParams({ ids: ids.join(","), action })
  return new Request(`http://localhost/api/engagement/students?${q.toString()}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockResolveTenantId.mockResolvedValue(TENANT)
  mockActiveContext.mockResolvedValue(null)
  mockGetAuthProfile.mockResolvedValue({
    user: { id: ADMIN },
    profile: { tenant_id: TENANT, full_name: "R" },
    roles: ["admin"],
    supabase: authClient([]),
  })
})

describe("GET /api/engagement/students — último acesso enxerga sessão reutilizada e reflexões", () => {
  it("sessão criada há 21d mas com turno ONTEM (updated_at) → daysSinceLastActivity 1, não 21", async () => {
    stubServiceReads({
      sessions: [
        { student_id: RIN, status: "completed", created_at: daysAgo(21), updated_at: daysAgo(1) },
      ],
      slide_reflections: [],
      enrollments: [
        {
          student_id: RIN,
          status: "active",
          created_at: daysAgo(30),
          progress: { percentage: 50 },
          course_id: "c1",
        },
      ],
      courses: [{ id: "c1", deadline_days: null }],
    })

    const res = await studentsGET(studentsReq([RIN]))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.students).toHaveLength(1)
    expect(json.students[0].daysSinceLastActivity).toBe(1)
    // Ativo ontem NÃO é "sem_acesso" (threshold 14d).
    expect(json.students[0].status).not.toBe("sem_acesso")
  })

  it("sessão velha (30d) mas REFLEXÃO editada há 2 dias → daysSinceLastActivity 2", async () => {
    stubServiceReads({
      sessions: [{ student_id: RIN, status: "completed", created_at: daysAgo(30) }],
      slide_reflections: [
        { student_id: RIN, created_at: daysAgo(40), updated_at: daysAgo(2) },
      ],
      enrollments: [],
      courses: [],
    })

    const res = await studentsGET(studentsReq([RIN]))
    const json = await res.json()
    expect(json.students[0].daysSinceLastActivity).toBe(2)
    expect(json.students[0].status).not.toBe("sem_acesso")
  })

  it("retrocompatível: linhas SÓ com created_at comportam como antes", async () => {
    stubServiceReads({
      sessions: [{ student_id: RIN, status: "completed", created_at: daysAgo(5) }],
      slide_reflections: [],
      enrollments: [],
      courses: [],
    })

    const res = await studentsGET(studentsReq([RIN]))
    const json = await res.json()
    expect(json.students[0].daysSinceLastActivity).toBe(5)
  })
})
