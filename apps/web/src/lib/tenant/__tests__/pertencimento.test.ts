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

  // ------------------------------------------------------------------------
  // HOST NEUTRO. Antes desta rodada a função devolvia `null` aqui, e o ápice do
  // domínio base, `www.{base}` e todo typo de subdomínio serviam o app logado
  // inteiro com a marca eximIA e os 6 módulos do NEUTRO para o admin de uma
  // empresa real — a incoerência que a D3 existe para consertar, no endereço
  // mais fácil de alcançar num wildcard DNS.
  // ------------------------------------------------------------------------
  it("ápice do domínio base manda a pessoa para o host canônico do próprio tenant", () => {
    expect(
      hostDeDestinoD3(entrada({ tenantDoHost: null, origem: "neutro", hostAtual: BASE })),
    ).toBe(`harven-finance.${BASE}`)
  })

  it("`www.{base}` (rótulo reservado, D5) também sai do neutro", () => {
    expect(
      hostDeDestinoD3(entrada({ tenantDoHost: null, origem: "neutro", hostAtual: `www.${BASE}` })),
    ).toBe(`harven-finance.${BASE}`)
  })

  it("typo de subdomínio não deixa ninguém logado vestido com a marca do NEUTRO", () => {
    expect(
      hostDeDestinoD3(
        entrada({ tenantDoHost: null, origem: "neutro", hostAtual: `acdemy.${BASE}` }),
      ),
    ).toBe(`harven-finance.${BASE}`)
  })

  it("host neutro FORA do domínio base fica onde está (localhost, IP, DNS em virada)", () => {
    expect(
      hostDeDestinoD3(entrada({ tenantDoHost: null, origem: "neutro", hostAtual: "localhost" })),
    ).toBeNull()
    expect(
      hostDeDestinoD3(
        entrada({
          tenantDoHost: null,
          origem: "neutro",
          hostAtual: "argos.eximiaacademy.com.br",
        }),
      ),
    ).toBeNull()
  })

  it("host neutro sem domínio base configurado não tem destino nenhum", () => {
    expect(
      hostDeDestinoD3(
        entrada({ tenantDoHost: null, origem: "neutro", hostAtual: BASE, base: undefined }),
      ),
    ).toBeNull()
  })

  it("super_admin continua servido no host neutro", () => {
    expect(
      hostDeDestinoD3(
        entrada({
          tenantDoHost: null,
          origem: "neutro",
          hostAtual: BASE,
          chapeus: ["super_admin"],
        }),
      ),
    ).toBeNull()
  })

  it("host neutro e pessoa SEM tenant primário: servir é melhor que inventar endereço", () => {
    expect(
      hostDeDestinoD3(
        entrada({
          tenantDoHost: null,
          origem: "neutro",
          hostAtual: BASE,
          tenantDoUsuario: null,
          slugDoUsuario: null,
        }),
      ),
    ).toBeNull()
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
