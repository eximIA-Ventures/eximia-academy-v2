import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// O CONTRATO DA ACTION, medido separadamente do componente. E por quê.
// ---------------------------------------------------------------------------
// O arquivo irmão (`falha-de-leitura-nao-e-lista-vazia.test.tsx`) prova o que o
// USUÁRIO vê. Ele NÃO prova o contrato da action: mutei a action para voltar a
// devolver `data: []` junto do erro e **os 5 testes de tela continuaram verdes**,
// porque o componente corrigido checa `"error" in res` primeiro e nunca chega no
// `data`.
//
// Isso é um achado sobre a minha própria suíte, não um detalhe: o teste de tela
// mede o comportamento do consumidor ATUAL. O `data: []` na perna de falha é o
// convite para o PRÓXIMO consumidor repetir o colapso — e nenhum teste de tela
// pega isso, porque o próximo consumidor ainda não existe.
//
// Este arquivo tranca a forma. É o teste que mata aquele mutante.
// ---------------------------------------------------------------------------

const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

let retorno: Resultado = { data: [], error: null }
let usuarioAutenticado: { id: string } | null = { id: "u1" }

function clienteFake() {
  // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
  const elo: any = new Proxy(() => elo, {
    get(_a, prop) {
      if (prop === "then") {
        // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
        return (ok: any, falha: any) => Promise.resolve(retorno).then(ok, falha)
      }
      if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(retorno)
      return () => elo
    },
    apply: () => elo,
  })
  return {
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }) },
    from: () => elo,
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))

import { listCourseQuizzes } from "../actions"

beforeEach(() => {
  usuarioAutenticado = { id: "u1" }
  retorno = { data: [], error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("listCourseQuizzes — a perna de falha não carrega lista", () => {
  it("erro de banco: devolve `error` e NÃO devolve `data`", async () => {
    retorno = { data: null, error: ERRO_TRANSITORIO }

    const res = (await listCourseQuizzes("c1")) as Record<string, unknown>

    expect(res.error).toBeTruthy()
    // O coração: `data: []` aqui é o convite ao colapso. Não pode existir, nem
    // vazio — um consumidor futuro leria `res.data` e desenharia "não há nada".
    expect("data" in res).toBe(false)
  })

  it("sem sessão: mesma forma, sem `data`", async () => {
    usuarioAutenticado = null

    const res = (await listCourseQuizzes("c1")) as Record<string, unknown>

    expect(res.error).toBeTruthy()
    expect("data" in res).toBe(false)
  })

  it("[CP] sucesso vazio: devolve `data: []` e NÃO devolve `error`", async () => {
    retorno = { data: [], error: null }

    const res = (await listCourseQuizzes("c1")) as Record<string, unknown>

    expect(res.data).toEqual([])
    expect("error" in res).toBe(false)
  })

  it("[CP] sucesso com linhas: devolve as linhas", async () => {
    retorno = { data: [{ id: "q1" }], error: null }

    const res = (await listCourseQuizzes("c1")) as Record<string, unknown>

    expect(res.data).toEqual([{ id: "q1" }])
    expect("error" in res).toBe(false)
  })
})
