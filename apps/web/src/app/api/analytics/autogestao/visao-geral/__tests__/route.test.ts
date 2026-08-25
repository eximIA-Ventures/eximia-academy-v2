import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * GET /api/analytics/autogestao/visao-geral — casca fina, contrato da rota.
 *
 * A camada de dados (fonte-supabase.ts / montagem.ts) já tem suíte própria em
 * `src/lib/analytics/autogestao/__tests__/`. Estes testes cobrem SÓ o que a
 * rota decide por conta própria: quem é o aluno (N.4), o default de período
 * (§4.2), o relógio injetado (só fora de produção) e que erro de leitura vira
 * 500 — nunca um 200 com zeros.
 */

const STUDENT = "11111111-1111-1111-1111-111111111111"
const OTHER_STUDENT = "22222222-2222-2222-2222-222222222222"
const COURSE = "33333333-3333-3333-3333-333333333333"
const TENANT = "tenant-1"

const mockGetUser = vi.fn()
const mockAuthFrom = vi.fn()
const mockLerFonteAutogestao = vi.fn()
const mockMontarVisaoGeralAutogestao = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockAuthFrom(table),
  }),
}))

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({}),
}))

vi.mock("@/lib/analytics/autogestao/fonte-supabase", () => ({
  lerFonteAutogestao: (...args: unknown[]) => mockLerFonteAutogestao(...args),
}))

vi.mock("@/lib/analytics/autogestao/montagem", () => ({
  montarVisaoGeralAutogestao: (...args: unknown[]) => mockMontarVisaoGeralAutogestao(...args),
}))

/**
 * Query builder encadeável e "awaitable" (mesma forma de
 * `aggregate/__tests__/route.test.ts`): qualquer método desconhecido devolve o
 * próprio builder; `single`/`maybeSingle` são terminais.
 */
function proxyBuilder(rows: unknown[], singleData: unknown = null): unknown {
  const base = Promise.resolve({ data: rows, error: null })
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

function makeAuthStub() {
  const profile = { role: "student", tenant_id: TENANT }
  const enrollments = [{ course_id: COURSE, created_at: new Date().toISOString() }]
  mockAuthFrom.mockImplementation((table: string) => {
    if (table === "users") return proxyBuilder([], profile)
    if (table === "enrollments") return proxyBuilder(enrollments)
    return proxyBuilder([])
  })
}

function buildRequest(query = ""): Request {
  return new Request(`http://localhost/api/analytics/autogestao/visao-geral${query}`)
}

const FONTE_OK = {
  tenantId: TENANT,
  studentId: STUDENT,
  courseId: COURSE,
  periodoDias: 30,
  sessoes: [],
  reflexoes: [],
  progresso: [],
  capitulos: [],
  plano: null,
  fusoHorarioMinutosOffset: null,
  duracaoMediaPorSlideMinutos: null,
  falhas: { sessoes: null, reflexoes: null, progresso: null, capitulos: null, plano: null },
}

describe("GET /api/analytics/autogestao/visao-geral", () => {
  let handler: typeof import("../route").GET

  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mockGetUser.mockReset()
    mockAuthFrom.mockReset()
    mockLerFonteAutogestao.mockReset()
    mockMontarVisaoGeralAutogestao.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: STUDENT } } })
    makeAuthStub()
    mockLerFonteAutogestao.mockResolvedValue(FONTE_OK)
    mockMontarVisaoGeralAutogestao.mockReturnValue({ estado: "ok" })
    handler = (await import("../route")).GET
  })

  it("N.4 — ?studentId= de outro aluno NÃO muda o resultado (sempre a PRÓPRIA jornada)", async () => {
    await handler(buildRequest(`?studentId=${OTHER_STUDENT}`))
    expect(mockLerFonteAutogestao).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: STUDENT }),
    )
    expect(mockLerFonteAutogestao).not.toHaveBeenCalledWith(
      expect.objectContaining({ studentId: OTHER_STUDENT }),
    )
  })

  it("falha na fonte devolve 500 com o motivo, nunca 200 com zeros", async () => {
    mockLerFonteAutogestao.mockResolvedValue({
      ...FONTE_OK,
      falhas: { ...FONTE_OK.falhas, sessoes: { codigo: "SESSOES", mensagem: "boom" } },
    })
    const res = await handler(buildRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("boom")
    expect(mockMontarVisaoGeralAutogestao).not.toHaveBeenCalled()
  })

  it("?periodo= inválido cai no default de 30 dias (§4.2), sem quebrar", async () => {
    const res = await handler(buildRequest("?periodo=abacate"))
    expect(res.status).toBe(200)
    expect(mockLerFonteAutogestao).toHaveBeenCalledWith(
      expect.objectContaining({ periodoDias: 30 }),
    )
  })

  it("?agora= é IGNORADO quando NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    await handler(buildRequest("?agora=2020-01-01T00:00:00.000Z"))
    const agoraUsado = mockMontarVisaoGeralAutogestao.mock.calls[0]?.[1] as Date
    expect(agoraUsado.getFullYear()).not.toBe(2020)
    expect(Math.abs(agoraUsado.getTime() - Date.now())).toBeLessThan(5000)
  })
})
