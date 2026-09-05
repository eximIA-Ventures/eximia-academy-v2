import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// O WEBHOOK QUE FALHA NÃO PODE FALHAR EM SILÊNCIO TOTAL.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (laudo LOOP-0c, tabela E→SUCESSO #3).
//
//     dispatchEvent(profile.tenant_id, "blueprint.generated", {...}).catch(() => {})
//
// `.catch(() => {})` é a forma mais pura do padrão: nem `console.error`, nem
// Sentry, nem nada. A integração externa do tenant — que assinou justamente para
// saber quando um blueprint nasce — nunca recebe o evento, e ninguém no nosso
// lado fica sabendo. O rastro não é fraco: é inexistente.
//
// O REMÉDIO NÃO É PROPAGAR. O blueprint já está salvo e o SSE já vai anunciar
// `completed`; derrubar a geração por causa de um webhook seria trocar um defeito
// por outro pior. O que faltava era o RASTRO.
//
// CONTROLE POSITIVO [CP]: a geração continua terminando em `completed` mesmo com
// o webhook quebrado (senão a correção degenerada "throw" ficaria verde), e o
// caminho feliz não pode logar erro nenhum (senão "loga sempre" ficaria verde).
//
// NENHUMA ESCRITA REAL: Supabase, LLM e webhook são todos duplos.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const JOB = "22222222-2222-2222-2222-222222222222"
const BLUEPRINT = "33333333-3333-3333-3333-333333333333"

type Resultado = { data: unknown; error: unknown }

let respostas: Record<string, Resultado> = {}

const VERBOS_DE_ESCRITA = new Set(["insert", "update", "delete", "upsert"])

function clienteFake() {
  const construir = (tabela: string) => {
    let operacao = "select"
    const resolver = (): Resultado =>
      respostas[`${tabela}:${operacao}`] ?? { data: [], error: null }

    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvo, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(resolver()).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(resolver())
        if (typeof prop === "string" && VERBOS_DE_ESCRITA.has(prop)) {
          return () => {
            operacao = prop
            return elo
          }
        }
        return () => elo
      },
      apply: () => elo,
    })
    return elo
  }

  return {
    auth: { getUser: async () => ({ data: { user: { id: USUARIO } }, error: null }) },
    from: (tabela: string) => construir(tabela),
  }
}

const mockDispatchEvent = vi.fn()

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFake() }))
vi.mock("@/lib/feature-gate", () => ({ requireFeature: async () => null }))
vi.mock("@/lib/rate-limit", () => ({ courseDesignerGenerateLimiter: null }))
vi.mock("@/lib/webhooks", () => ({
  dispatchEvent: (...a: unknown[]) => mockDispatchEvent(...a),
}))
vi.mock("@eximia/agents", () => ({ getModelWithFallback: () => ({}) }))
vi.mock("@eximia/agents/course-designer", () => ({
  DesignOrchestratorAbortError: class extends Error {},
  DesignOrchestratorTimeoutError: class extends Error {},
  designCourse: async () => ({
    blueprint: {
      metadata: {
        primary_framework: "elc_plus",
        complementary_frameworks: [],
        quality_score: 88,
        neuroscience_score: 77,
        interaction_strategy: "bloom_mapped",
        version: 1,
      },
      quality_scorecard: { verdict: "aprovado" },
      audience: {},
      evaluation_plan: {},
      course_architecture: { bloom_progression: [] },
      modules: [],
    },
    phaseResults: {},
    retryCount: 0,
    totalDurationMs: 1234,
  }),
}))

import { POST } from "../route"

/** Corpo mínimo que o `courseDesignerInputSchema` aceita. */
const ENTRADA_VALIDA = {
  course_title: "Curso de teste do webhook",
  business_goal: "Provar que a falha de webhook deixa rastro",
  behavior_change: "A equipe passa a enxergar a falha em vez de adivinhá-la",
  target_audience: { role: "gestor", experience_level: "intermediario" },
  topics_outline: ["observabilidade"],
  total_duration_hours: 4,
}

/** Roda a rota e drena o SSE até o fim, devolvendo os eventos decodificados. */
async function gerarEDrenar(): Promise<Array<Record<string, unknown>>> {
  const resposta = await POST(
    new Request("http://t/api/course-designer/generate", {
      method: "POST",
      body: JSON.stringify(ENTRADA_VALIDA),
      headers: { "content-type": "application/json" },
    }),
  )

  const texto = await new Response(resposta.body).text()
  return texto
    .split("\n\n")
    .filter((bloco) => bloco.startsWith("data: "))
    .map((bloco) => JSON.parse(bloco.slice("data: ".length)) as Record<string, unknown>)
}

let erros: unknown[][] = []

beforeEach(() => {
  erros = []
  respostas = {
    "users:select": { data: { role: "manager", tenant_id: TENANT }, error: null },
    "blueprint_generation_jobs:insert": { data: { id: JOB }, error: null },
    "course_blueprints:insert": { data: { id: BLUEPRINT }, error: null },
  }
  mockDispatchEvent.mockReset()
  mockDispatchEvent.mockResolvedValue(undefined)
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    erros.push(a)
  })
})

describe("webhook blueprint.generated — falha deixa rastro", () => {
  it("webhook rejeitando precisa deixar rastro, e hoje não deixa nenhum", async () => {
    mockDispatchEvent.mockRejectedValue(new Error("502 do endpoint do tenant"))

    const eventos = await gerarEDrenar()

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1)
    // O coração do defeito: `.catch(() => {})` não registra absolutamente nada.
    expect(erros.length).toBeGreaterThan(0)
    const rastro = erros.map((linha) => linha.map(String).join(" ")).join(" | ")
    expect(rastro).toContain("blueprint.generated")
    expect(rastro).toContain(BLUEPRINT)

    // [CP] embutido: o rastro não pode custar a geração.
    expect(eventos.at(-1)).toMatchObject({ status: "completed", blueprint_id: BLUEPRINT })
  })

  it("[CP] caminho feliz não loga erro nenhum", async () => {
    const eventos = await gerarEDrenar()

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1)
    expect(erros).toHaveLength(0)
    expect(eventos.at(-1)).toMatchObject({ status: "completed" })
  })
})
