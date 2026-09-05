import { beforeEach, describe, expect, it } from "vitest"
import { TTL_DO_CACHE_MS, gravarNoCache, lerDoCache, limparCacheDeTenants } from "../cache"

// ===========================================================================
// O CACHE PRECISA SABER DIZER TRÊS COISAS DIFERENTES, NÃO DUAS.
//
//   • "não sei"          -> `undefined` (nunca consultei, ou já venceu)
//   • "sei que NÃO tem"  -> `null`      (host que não é domínio próprio)
//   • "sei que é este"   -> o tenant
//
// Colapsar os dois primeiros num só é o defeito clássico: `null` significando
// "não sei" faria toda requisição por subdomínio consultar `tenant_domains` de
// novo — o caso mais comum em produção viraria o mais caro.
// ===========================================================================

beforeEach(() => {
  limparCacheDeTenants()
})

const CORY = { id: "id-cory", slug: "cory-alimentos" }

describe("cache de resolução de tenant", () => {
  it("chave ausente é `undefined` (não sei), nunca `null` (sei que não tem)", () => {
    expect(lerDoCache("host:nunca-visto.com")).toBeUndefined()
  })

  it("o NEGATIVO é guardado: o segundo acesso ao mesmo host desconhecido não consulta", () => {
    gravarNoCache("host:desconhecido.com", null)
    expect(lerDoCache("host:desconhecido.com")).toBeNull()
  })

  it("cada host tem a PRÓPRIA chave — não existe estado 'último resolvido'", () => {
    gravarNoCache("host:a.com", CORY)
    gravarNoCache("host:b.com", null)
    expect(lerDoCache("host:a.com")).toEqual(CORY)
    expect(lerDoCache("host:b.com")).toBeNull()
    expect(lerDoCache("host:c.com")).toBeUndefined()
  })

  it("vencido volta a ser 'não sei' — é assim que um domínio novo entra em 60s", () => {
    const t0 = 1_000_000
    gravarNoCache("host:a.com", CORY, t0)
    expect(lerDoCache("host:a.com", t0 + TTL_DO_CACHE_MS - 1)).toEqual(CORY)
    expect(lerDoCache("host:a.com", t0 + TTL_DO_CACHE_MS)).toBeUndefined()
  })

  it("o TTL é o da D2: 60 segundos", () => {
    expect(TTL_DO_CACHE_MS).toBe(60_000)
  })
})
