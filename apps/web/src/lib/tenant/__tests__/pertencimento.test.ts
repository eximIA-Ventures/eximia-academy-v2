import { describe, expect, it } from "vitest"
import { type EntradaDaDecisao, hostDeDestinoD3 } from "../pertencimento"

// ===========================================================================
// D3 — HOST × USUÁRIO DIVERGEM.
//
// O que se testa aqui é a REGRA, não as consultas: "alcança o tenant do host?"
// tem duas respostas afirmativas (`users.tenant_id` e `user_tenant_memberships`)
// e a segunda é a que a crítica apontou como esquecida no plano original —
// esquecê-la deslogaria em laço quem tem acesso multiempresa.
//
// Redirecionar NÃO é negar acesso: a RLS já entrega a cada pessoa os dados
// dela em qualquer host. O que se conserta é a incoerência de ler os próprios
// dados vestido com a marca de outra empresa.
// ===========================================================================

const BASE = "academy.eximiaventures.com.br"

function entrada(over: Partial<EntradaDaDecisao> = {}): EntradaDaDecisao {
  return {
    tenantDoHost: "id-cory",
    origem: "subdominio",
    chapeus: ["student"],
    tenantDoUsuario: "id-harven",
    slugDoUsuario: "harven-finance",
    temMembership: false,
    hostAtual: `cory-alimentos.${BASE}`,
    base: BASE,
    ...over,
  }
}

describe("hostDeDestinoD3", () => {
  it("quem não alcança o tenant do host vai para o host canônico do PRÓPRIO tenant", () => {
    expect(hostDeDestinoD3(entrada())).toBe(`harven-finance.${BASE}`)
  })

  it("quem tem `users.tenant_id` igual ao do host fica onde está", () => {
    expect(hostDeDestinoD3(entrada({ tenantDoUsuario: "id-cory" }))).toBeNull()
  })

  it("quem alcança por `user_tenant_memberships` fica — acesso multiempresa é real", () => {
    expect(hostDeDestinoD3(entrada({ temMembership: true }))).toBeNull()
  })

  it("super_admin serve em QUALQUER host", () => {
    expect(hostDeDestinoD3(entrada({ chapeus: ["super_admin"] }))).toBeNull()
  })

  it("domínio próprio segue a mesma regra do subdomínio", () => {
    expect(hostDeDestinoD3(entrada({ origem: "dominio-proprio" }))).toBe(`harven-finance.${BASE}`)
  })

  it("modo LEGADO nunca redireciona: ali o host não carrega identidade de empresa", () => {
    expect(hostDeDestinoD3(entrada({ origem: "env-legado" }))).toBeNull()
  })

  it("atalho de desenvolvimento não redireciona (`?tenant=`/`*.localhost`)", () => {
    expect(hostDeDestinoD3(entrada({ origem: "dev" }))).toBeNull()
  })

  it("host neutro não afirma empresa nenhuma — não há divergência a resolver", () => {
    expect(hostDeDestinoD3(entrada({ tenantDoHost: null, origem: "neutro" }))).toBeNull()
  })

  it("sem tenant primário não há destino: servir onde está é melhor que inventar endereço", () => {
    expect(hostDeDestinoD3(entrada({ tenantDoUsuario: null, slugDoUsuario: null }))).toBeNull()
  })

  it("sem `NEXT_PUBLIC_APP_BASE_DOMAIN` não há host canônico para onde mandar", () => {
    expect(hostDeDestinoD3(entrada({ base: undefined }))).toBeNull()
  })

  it("slug reservado não vira destino (D5) — `demo.{base}` não é empresa de ninguém", () => {
    expect(hostDeDestinoD3(entrada({ slugDoUsuario: "demo" }))).toBeNull()
  })

  it("nunca redireciona para o próprio host: laço infinito é pior que marca incoerente", () => {
    expect(
      hostDeDestinoD3(
        entrada({ slugDoUsuario: "harven-finance", hostAtual: `harven-finance.${BASE}` }),
      ),
    ).toBeNull()
  })
})
