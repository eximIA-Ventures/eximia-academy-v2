import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — família `api/analytics/**`.
// ---------------------------------------------------------------------------
// Mesmo defeito trancado em `src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts`
// (Course Designer) e em `src/app/api/admin/__tests__/…-admin.test.ts`.
//
// Esta família é a mais reveladora das três, porque as duas metades convivem no
// mesmo diretório: `student`, `manager-courses`, `leitura-do-periodo` e
// `autogestao/_contexto` JÁ destructuram o `error` e respondem 500 quando a
// leitura falha. As quatro rotas medidas aqui, não — e a diferença entre elas é
// literalmente uma palavra na desestruturação.
//
// Só entram aqui as rotas cujo gate decide pelo `role` SINGULAR. As que decidem
// pela UNIÃO de chapéus (`user_roles`) — `aggregate`, `semantic` — têm outra
// forma e ficaram registradas no relatório, não corrigidas às pressas.
// `aprendizagem-time/**` está fora por instrução: é de outra frente.
//
// CONTROLE POSITIVO: os casos [CP] passam ANTES e DEPOIS. São eles que impedem
// a correção degenerada "responde 503 sempre" e a que afrouxaria a porta.
//
// NENHUMA ESCRITA: cliente Supabase é duplo em memória, `fetch` é stub. Nenhuma
// rota alcança banco, LLM ou serviço externo.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const SESSAO = "55555555-5555-5555-5555-555555555555"
const ALUNO = "66666666-6666-6666-6666-666666666666"

/** O erro que o PostgREST devolve num timeout de statement. Transitório por definição. */
const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

/** O "erro" de zero linhas do `.single()`. NÃO é indisponibilidade: o perfil não existe. */
const ERRO_ZERO_LINHAS = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

let perfilRetornado: Resultado = { data: { role: "manager", tenant_id: TENANT }, error: null }
let usuarioAutenticado: { id: string } | null = { id: USUARIO }

/** Resultado das leituras que NÃO são `users` — sempre erro, para a rota parar cedo. */
const OUTRAS_TABELAS: Resultado = { data: null, error: ERRO_TRANSITORIO }

/** Listagem de `users` (quando a rota lê a tabela sem `.single()`). */
const LISTA_VAZIA = { data: [], error: null, count: 0 }

function clienteFake() {
  const construir = (tabela: string) => {
    const ehUsers = tabela === "users"
    const alvoSingular: Resultado = ehUsers ? perfilRetornado : OUTRAS_TABELAS
    const alvoPlural = ehUsers ? LISTA_VAZIA : OUTRAS_TABELAS
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvoProxy, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(alvoPlural).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(alvoSingular)
        return () => elo
      },
      apply: () => elo,
    })
    return elo
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }),
    },
    // biome-ignore lint/suspicious/noExplicitAny: RPC devolve o mesmo formato do builder
    rpc: async (): Promise<any> => ({ data: null, error: ERRO_TRANSITORIO }),
    from: (tabela: string) => construir(tabela),
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => clienteFake(),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => clienteFake(),
}))
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: async () => null,
}))
vi.mock("@/lib/rate-limit", () => ({
  contentAnalysisLimiter: null,
  analyticsAggregateLimiter: null,
  analyticsIndividualLimiter: null,
  semanticAnalysisLimiter: null,
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))

import { POST as gerarInsights } from "../insights/route"
import { POST as acoesPedagogicas } from "../pedagogical-actions/route"
import { GET as lerSessao } from "../sessions/[sessionId]/route"
import { GET as lerAluno } from "../students/[studentId]/route"

/**
 * O universo de papéis do produto. Cada rota declara quais ACEITA; o complemento
 * é o que ela precisa RECUSAR, e o teste cobre os dois lados — só a matriz
 * completa detecta lista alargada ou estreitada.
 */
const TODOS_OS_PAPEIS = [
  "student",
  "leader",
  "manager",
  "instructor",
  "admin",
  "super_admin",
] as const

/** Transcrições 1:1 das listas que cada rota já tinha em `HEAD`. */
const ANALISE = ["leader", "manager", "admin", "instructor", "super_admin"] as const
/**
 * `sessions/[sessionId]` NÃO aceita `super_admin`, ao contrário das rotas irmãs.
 * Isto é caracterização do que existe, não endosso: a divergência foi registrada
 * no relatório para decisão do dono do produto. Enquanto ela existir, este teste
 * é o que impede alguém de "consertar" a lista sem essa decisão.
 */
const ANALISE_SEM_SUPER_ADMIN = ["leader", "manager", "admin", "instructor"] as const

const ROTAS: Array<{
  nome: string
  chamar: () => Promise<Response>
  /** Papéis que ESTA rota aceita. Não é a lista "de analytics", é a dela. */
  aceitos: readonly string[]
}> = [
  {
    nome: "POST /api/analytics/insights",
    aceitos: ANALISE,
    chamar: () =>
      gerarInsights(
        new Request("http://t/api/analytics/insights", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "POST /api/analytics/pedagogical-actions",
    aceitos: ANALISE,
    chamar: () =>
      acoesPedagogicas(
        new Request("http://t/api/analytics/pedagogical-actions", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "GET /api/analytics/sessions/[sessionId]",
    aceitos: ANALISE_SEM_SUPER_ADMIN,
    chamar: () =>
      lerSessao(new Request("http://t/api/analytics/sessions/x"), {
        params: Promise.resolve({ sessionId: SESSAO }),
      }),
  },
  {
    nome: "GET /api/analytics/students/[studentId]",
    aceitos: ANALISE,
    chamar: () =>
      lerAluno(new Request("http://t/api/analytics/students/x"), {
        params: Promise.resolve({ studentId: ALUNO }),
      }),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "manager", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }))
})

describe("perfil ilegível não é negação de direito — api/analytics", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje todas devolvem 403 "Forbidden".
      expect(resposta.status).not.toBe(403)
      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBeTruthy()
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).toBe("profile_check_unavailable")
    })

    // ---- Matriz de papéis: os DOIS lados da lista, papel a papel. ----------
    // Um único caso de "papel de fora é barrado" não detecta lista alargada nem
    // estreitada; só a matriz completa detecta.
    for (const papel of TODOS_OS_PAPEIS) {
      const deveEntrar = rota.aceitos.includes(papel)

      it(`[CP] ${rota.nome} — \`${papel}\` ${deveEntrar ? "É ACEITO" : "é RECUSADO"}`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        if (!deveEntrar) {
          expect(resposta.status).toBe(403)
          return
        }

        expect(resposta.status).not.toBe(403)
        expect(resposta.status).not.toBe(401)
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
      })
    }

    it(`[CP] ${rota.nome} — perfil inexistente continua 403, não 503`, async () => {
      perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })
  }

  it("[CP] sem sessão continua 401, antes de qualquer leitura de perfil", async () => {
    usuarioAutenticado = null
    for (const rota of ROTAS) {
      const resposta = await rota.chamar()
      expect(resposta.status, rota.nome).toBe(401)
    }
  })
})
