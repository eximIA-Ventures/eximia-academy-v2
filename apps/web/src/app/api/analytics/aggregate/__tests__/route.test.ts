import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Diretos/Hierarquia — regressão travada (2026-08-12).
 *
 * `GET /api/analytics/aggregate` LIA `?includeSubtree=` para classificar o
 * `scope`, mas resolvia o universo de alunos com `{ includeSubtree: true }`
 * CRAVADO. Sintoma na tela: em Diretos o card do recorte dizia "6 alunos" e a
 * lista "Quem saiu do normal" mostrava 10 pessoas, incluindo quem não é report
 * direto do gestor.
 *
 * Estes testes provam a regra nas duas pontas, e nos dois níveis:
 *   • QUAL primitiva de escopo é chamada, e em QUAL nó (Diretos → o nó em foco
 *     ou a própria raiz; Hierarquia → subárvore inteira / drill gated);
 *   • que o universo resolvido REALMENTE morde o payload — as sessões de quem
 *     está fora do recorte não entram no `summary` (é isso que fazia o número
 *     da lista divergir do badge).
 *
 * O invariante fail-closed (manager NUNCA colapsa para tenant-wide) também é
 * exercitado: `null` da primitiva vira escopo vazio, não o tenant inteiro.
 */

/* --------- mocks --------- */

const mockGetUser = vi.fn()
const mockAuthFrom = vi.fn()
const mockServiceFrom = vi.fn()
const mockGetManagedTeamStudentIds = vi.fn()
const mockGetDirectTeamStudentIds = vi.fn()
const mockGetSubtreeStudentIdsAtNode = vi.fn()

const MANAGER = "11111111-1111-1111-1111-111111111111"
const TENANT = "tenant-1"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockAuthFrom(table),
    rpc: vi.fn(async () => ({ data: [] })),
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => mockServiceFrom(table),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  }),
}))

vi.mock("@/lib/area-context", () => ({
  getManagedTeamStudentIds: (...args: unknown[]) => mockGetManagedTeamStudentIds(...args),
  getDirectTeamStudentIds: (...args: unknown[]) => mockGetDirectTeamStudentIds(...args),
  getSubtreeStudentIdsAtNode: (...args: unknown[]) => mockGetSubtreeStudentIdsAtNode(...args),
}))

// Determinístico: sem depender de Upstash estar (ou não) configurado na máquina.
vi.mock("@/lib/rate-limit", () => ({
  analyticsAggregateLimiter: { limit: async () => ({ success: true }) },
}))

/* --------- helpers --------- */

type SessionRow = {
  id: string
  student_id: string
  analytics: Record<string, unknown>
  created_at: string
  status: string
  turn_number: number
  chapter_id: string
}

function sessionRow(id: string, studentId: string): SessionRow {
  return {
    id,
    student_id: studentId,
    analytics: { depth_reached: 3, breakthrough_moments: 1 },
    created_at: new Date().toISOString(),
    status: "completed",
    turn_number: 4,
    chapter_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  }
}

/**
 * Query builder encadeável e "awaitable".
 *
 * Proxy em vez de lista fixa de métodos: a rota é longa e encadeia dezenas de
 * filtros diferentes (`neq`, `not`, `order`, `limit`...). Qualquer método
 * desconhecido devolve o próprio builder; `then` vem da promise real (nada de
 * chave literal `then`, que o biome proíbe); `single`/`maybeSingle` são
 * terminais e devolvem `singleData`.
 */
function proxyBuilder(rows: unknown[], singleData: unknown = null): unknown {
  const base = Promise.resolve({ data: rows, count: rows.length, error: null })
  const proxy: unknown = new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const value = Reflect.get(target, prop, target)
        return typeof value === "function" ? value.bind(target) : value
      }
      if (prop === "single" || prop === "maybeSingle") {
        return async () => ({ data: singleData, error: null })
      }
      if (typeof prop === "symbol") return Reflect.get(target, prop, receiver)
      return () => proxy
    },
  })
  return proxy
}

/**
 * Service client (RLS-bypassing). Toda query resolve vazia, exceto
 * `from("sessions")`, que devolve as linhas passadas — a rota faz short-circuit
 * com payload vazio quando não há sessão alguma, e é DEPOIS desse ponto que o
 * escopo do gestor é resolvido.
 */
function makeServiceStub(sessions: SessionRow[]) {
  mockServiceFrom.mockImplementation((table: string) =>
    proxyBuilder(table === "sessions" ? (sessions as unknown[]) : []),
  )
}

/** Cliente autenticado: `from("users").single()` é o profile do chamador. */
function makeAuthStub(roles: string[] = ["manager"]) {
  const profile = {
    role: roles[0],
    tenant_id: TENANT,
    user_roles: roles.map((role) => ({ role })),
  }
  mockAuthFrom.mockImplementation((table: string) =>
    proxyBuilder([], table === "users" ? profile : null),
  )
}

function buildRequest(extraParams = "") {
  return new Request(`http://localhost/api/analytics/aggregate?period=30d${extraParams}`, {
    method: "GET",
  })
}

/* --------- tests --------- */

describe("GET /api/analytics/aggregate — recorte Diretos vs Hierarquia (gestor)", () => {
  let handler: typeof import("../route").GET

  beforeEach(async () => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockAuthFrom.mockReset()
    mockServiceFrom.mockReset()
    mockGetManagedTeamStudentIds.mockReset()
    mockGetDirectTeamStudentIds.mockReset()
    mockGetSubtreeStudentIdsAtNode.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: MANAGER } } })
    makeAuthStub()

    const mod = await import("../route")
    handler = mod.GET
  })

  it("Diretos (sem includeSubtree) resolve pelos DIRETOS da própria raiz — nunca a subárvore", async () => {
    makeServiceStub([sessionRow("s1", "direct-1"), sessionRow("s2", "subtree-only-1")])
    mockGetDirectTeamStudentIds.mockResolvedValue(["direct-1"])

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)

    expect(mockGetDirectTeamStudentIds).toHaveBeenCalledWith(expect.anything(), TENANT, MANAGER)
    expect(mockGetManagedTeamStudentIds).not.toHaveBeenCalled()
    expect(mockGetSubtreeStudentIdsAtNode).not.toHaveBeenCalled()

    // O universo morde o payload: a sessão de quem está fora dos diretos não
    // entra no summary (era exatamente a divergência badge x lista).
    const body = await res.json()
    expect(body.summary.totalSessions).toBe(1)
  })

  it("Diretos + focusUserId resolve pelos DIRETOS do nó focado, não da raiz", async () => {
    makeServiceStub([sessionRow("s1", "direct-1")])
    mockGetDirectTeamStudentIds.mockResolvedValue(["direct-1"])
    const FOCUS = "22222222-2222-2222-2222-222222222222"

    const res = await handler(buildRequest(`&focusUserId=${FOCUS}`))
    expect(res.status).toBe(200)

    expect(mockGetDirectTeamStudentIds).toHaveBeenCalledWith(expect.anything(), TENANT, FOCUS)
    expect(mockGetSubtreeStudentIdsAtNode).not.toHaveBeenCalled()
  })

  it("Hierarquia (includeSubtree=true, sem foco) resolve pela subárvore inteira", async () => {
    makeServiceStub([sessionRow("s1", "direct-1"), sessionRow("s2", "subtree-only-1")])
    mockGetManagedTeamStudentIds.mockResolvedValue(["direct-1", "subtree-only-1"])

    const res = await handler(buildRequest("&includeSubtree=true"))
    expect(res.status).toBe(200)

    expect(mockGetManagedTeamStudentIds).toHaveBeenCalledWith(expect.anything(), TENANT, MANAGER, {
      includeSubtree: true,
    })
    expect(mockGetDirectTeamStudentIds).not.toHaveBeenCalled()

    // Mesmas sessões do primeiro teste, universo maior → summary maior.
    const body = await res.json()
    expect(body.summary.totalSessions).toBe(2)
  })

  it("Hierarquia + focusUserId mantém o drill-down gated (getSubtreeStudentIdsAtNode)", async () => {
    makeServiceStub([sessionRow("s1", "direct-1")])
    mockGetSubtreeStudentIdsAtNode.mockResolvedValue(["direct-1"])
    const FOCUS = "33333333-3333-3333-3333-333333333333"

    const res = await handler(buildRequest(`&includeSubtree=true&focusUserId=${FOCUS}`))
    expect(res.status).toBe(200)

    expect(mockGetSubtreeStudentIdsAtNode).toHaveBeenCalledWith(expect.anything(), TENANT, FOCUS)
    expect(mockGetDirectTeamStudentIds).not.toHaveBeenCalled()
    expect(mockGetManagedTeamStudentIds).not.toHaveBeenCalled()
  })

  it("fail-closed: Diretos com escopo vazio zera o payload, NUNCA vira tenant-wide", async () => {
    makeServiceStub([sessionRow("s1", "direct-1"), sessionRow("s2", "subtree-only-1")])
    mockGetDirectTeamStudentIds.mockResolvedValue([])

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.summary.totalSessions).toBe(0)
  })

  it("admin/super_admin não passa pelas primitivas de gestor (caminho tenant-wide intacto)", async () => {
    makeAuthStub(["admin"])
    makeServiceStub([sessionRow("s1", "direct-1"), sessionRow("s2", "subtree-only-1")])

    const res = await handler(buildRequest())
    expect(res.status).toBe(200)

    expect(mockGetDirectTeamStudentIds).not.toHaveBeenCalled()
    expect(mockGetManagedTeamStudentIds).not.toHaveBeenCalled()
    expect(mockGetSubtreeStudentIdsAtNode).not.toHaveBeenCalled()

    // Sem escopo (tenant-wide) o summary vê as duas sessões.
    const body = await res.json()
    expect(body.summary.totalSessions).toBe(2)
  })
})
