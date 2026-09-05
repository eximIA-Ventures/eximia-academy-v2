import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// O CONSUMIDOR: leitura truncada não pode sair desta rota como 200.
// ---------------------------------------------------------------------------
// O irmão deste teste (`lib/__tests__/leitura-paginada-nao-mente-completude`)
// prova que a leitura paginada passou a GRITAR em vez de devolver um parcial com
// cara de total. Este aqui prova a outra metade, que é a que o gestor vê: o grito
// vira **503 retentável**, e não um 200 com números subcontados nem um 500 mudo.
//
// Sem este arquivo, a correção ficaria "meio feita" do jeito mais perigoso: a
// função honesta e nove chamadores que derrubam a página sem dizer por quê.
//
// CONTROLE POSITIVO [CP]: a rota continua respondendo 200 quando a leitura
// completa de verdade — senão "responde 503 sempre" ficaria verde.
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockAuthFrom = vi.fn()
const mockServiceFrom = vi.fn()
const mockLerTodasAsLinhas = vi.fn()

const GESTOR = "11111111-1111-1111-1111-111111111111"
const TENANT = "tenant-1"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (tabela: string) => mockAuthFrom(tabela),
    rpc: vi.fn(async () => ({ data: [] })),
  }),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (tabela: string) => mockServiceFrom(tabela),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  }),
}))
vi.mock("@/lib/area-context", () => ({
  getManagedTeamStudentIds: async () => null,
  getDirectTeamStudentIds: async () => ["aluno-1"],
  getSubtreeStudentIdsAtNode: async () => null,
}))
vi.mock("@/lib/rate-limit", () => ({
  analyticsAggregateLimiter: { limit: async () => ({ success: true }) },
}))
// A classe REAL é preservada — o `instanceof` da rota depende dela. Só a função
// de leitura é substituída, para encenar o truncamento sem precisar de 50.000
// linhas de fixture.
vi.mock("@/lib/leitura-paginada", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/leitura-paginada")>("@/lib/leitura-paginada")
  return { ...real, lerTodasAsLinhas: (...a: unknown[]) => mockLerTodasAsLinhas(...a) }
})

import { LeituraTruncadaError } from "@/lib/leitura-paginada"

function linhaDeSessao(id: string, alunoId: string) {
  return {
    id,
    student_id: alunoId,
    analytics: { depth_reached: 3, breakthrough_moments: 1 },
    created_at: new Date().toISOString(),
    status: "completed",
    turn_number: 4,
    chapter_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  }
}

/** Builder encadeável e "awaitable" — mesmo desenho do `route.test.ts` vizinho. */
function builder(linhas: unknown[], dadoSingle: unknown = null): unknown {
  const base = Promise.resolve({ data: linhas, count: linhas.length, error: null })
  const proxy: unknown = new Proxy(base, {
    get(alvo, prop, receptor) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const valor = Reflect.get(alvo, prop, alvo)
        return typeof valor === "function" ? valor.bind(alvo) : valor
      }
      if (prop === "single" || prop === "maybeSingle") {
        return async () => ({ data: dadoSingle, error: null })
      }
      if (typeof prop === "symbol") return Reflect.get(alvo, prop, receptor)
      return () => proxy
    },
  })
  return proxy
}

describe("GET /api/analytics/aggregate — leitura truncada não vira 200", () => {
  let handler: typeof import("../route").GET

  beforeEach(async () => {
    vi.resetModules()
    mockGetUser.mockReset()
    mockAuthFrom.mockReset()
    mockServiceFrom.mockReset()
    mockLerTodasAsLinhas.mockReset()
    mockLerTodasAsLinhas.mockResolvedValue([])

    mockGetUser.mockResolvedValue({ data: { user: { id: GESTOR } } })
    mockAuthFrom.mockImplementation((tabela: string) =>
      builder(
        [],
        tabela === "users"
          ? { role: "manager", tenant_id: TENANT, user_roles: [{ role: "manager" }] }
          : null,
      ),
    )
    // Precisa haver ao menos uma sessão: sem nenhuma, a rota faz short-circuit
    // com payload vazio e nunca chega à leitura paginada.
    mockServiceFrom.mockImplementation((tabela: string) =>
      builder(tabela === "sessions" ? [linhaDeSessao("s1", "aluno-1")] : []),
    )

    vi.spyOn(console, "error").mockImplementation(() => {})

    const mod = await import("../route")
    handler = mod.GET
  })

  const pedir = () =>
    handler(new Request("http://localhost/api/analytics/aggregate?period=30d", { method: "GET" }))

  it("leitura interrompida por erro vira 503 nomeado, nunca 200", async () => {
    mockLerTodasAsLinhas.mockRejectedValue(
      new LeituraTruncadaError("erro-de-leitura", 1000, { message: "statement timeout" }),
    )

    const resposta = await pedir()

    expect(resposta.status).toBe(503)
    expect(resposta.headers.get("Retry-After")).toBeTruthy()
    const corpo = (await resposta.json()) as { error?: string; reason?: string; rows_read?: number }
    expect(corpo.error).toBe("analytics_read_incomplete")
    expect(corpo.reason).toBe("erro-de-leitura")
    expect(corpo.rows_read).toBe(1000)
  })

  it("teto de páginas também vira 503, com o motivo próprio", async () => {
    mockLerTodasAsLinhas.mockRejectedValue(new LeituraTruncadaError("teto-de-paginas", 50000))

    const resposta = await pedir()

    expect(resposta.status).toBe(503)
    const corpo = (await resposta.json()) as { reason?: string }
    expect(corpo.reason).toBe("teto-de-paginas")
  })

  it("[CP] leitura completa continua 200", async () => {
    const resposta = await pedir()

    expect(resposta.status).toBe(200)
    expect(mockLerTodasAsLinhas).toHaveBeenCalled()
  })
})
