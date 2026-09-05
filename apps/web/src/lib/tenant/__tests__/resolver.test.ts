import { beforeEach, describe, expect, it, vi } from "vitest"
import { limparCacheDeTenants } from "../cache"
import {
  hostCanonico,
  hostDaRequisicao,
  normalizarHost,
  resolverTenantPorHost,
  slugDoSubdominio,
} from "../resolver"
import type { FonteDeTenants } from "../tipos"

// ===========================================================================
// A RESOLUÇÃO DE EMPRESA POR HOST (D1/D2), SEM BANCO.
//
// O DEFEITO QUE ESTES CASOS EXISTEM PARA IMPEDIR é um só, e ele é silencioso:
// um host desconhecido servir a marca (e o `tenantId`) da ÚLTIMA empresa
// resolvida. Nenhum erro apareceria; a tela simplesmente vestiria a empresa
// errada. Por isso o caso central aqui não é "resolve A" nem "resolve B", e
// sim a ALTERNÂNCIA A -> desconhecido -> B, que é onde um cache com estado
// "último" quebraria e um cache por chave não.
//
// Nada de banco: a `FonteDeTenants` é injetada, no mesmo espírito do stub de
// `tenant-features.test.ts`.
// ===========================================================================

const BASE = "academy.eximiaventures.com.br"

/** Duas tabelas em memória: `tenant_domains` (host -> slug) e `tenants` (slug -> id). */
function fonteDe(
  dominios: Record<string, string>,
  tenants: Record<string, string>,
): FonteDeTenants & { chamadasPorHost: string[]; chamadasPorSlug: string[] } {
  const chamadasPorHost: string[] = []
  const chamadasPorSlug: string[] = []
  return {
    chamadasPorHost,
    chamadasPorSlug,
    async porHost(host) {
      chamadasPorHost.push(host)
      const slug = dominios[host]
      return slug && tenants[slug] ? { id: tenants[slug], slug } : null
    },
    async porSlug(slug) {
      chamadasPorSlug.push(slug)
      return tenants[slug] ? { id: tenants[slug], slug } : null
    },
  }
}

const TENANTS = { "cory-alimentos": "id-cory", "harven-finance": "id-harven" }
const DOMINIOS = { "argos.eximiaacademy.com.br": "cory-alimentos" }

beforeEach(() => {
  limparCacheDeTenants()
})

describe("normalizarHost — o host é entrada de rede, não dado confiável", () => {
  it("baixa a caixa e tira a porta", () => {
    expect(normalizarHost("CORY.Academy.Eximiaventures.COM.br:3000")).toBe(
      "cory.academy.eximiaventures.com.br",
    )
  })

  it("tira o ponto final do FQDN e os espaços", () => {
    expect(normalizarHost("  exemplo.com.  ")).toBe("exemplo.com")
  })

  it("com dois proxies encadeados, vale o PRIMEIRO da lista (o que o cliente pediu)", () => {
    expect(normalizarHost("cliente.com, interno.local")).toBe("cliente.com")
  })

  it("IPv6 literal: a porta é o que vem depois do colchete", () => {
    expect(normalizarHost("[::1]:3000")).toBe("[::1]")
  })

  it("ausência vira string vazia, nunca `undefined` espalhado adiante", () => {
    expect(normalizarHost(null)).toBe("")
    expect(normalizarHost(undefined)).toBe("")
    expect(normalizarHost("")).toBe("")
  })

  it("prefere `x-forwarded-host` ao `host` do contêiner", () => {
    const h = new Headers({ host: "web:3000", "x-forwarded-host": "Cory.Exemplo.com" })
    expect(hostDaRequisicao(h)).toBe("cory.exemplo.com")
  })
})

describe("slugDoSubdominio — derivado por STRING, sem banco (D1)", () => {
  it("um rótulo simples vira slug", () => {
    expect(slugDoSubdominio(`cory-alimentos.${BASE}`, BASE)).toBe("cory-alimentos")
  })

  it("dois rótulos NÃO viram slug: `a.b.base` não é empresa nenhuma", () => {
    expect(slugDoSubdominio(`a.b.${BASE}`, BASE)).toBeNull()
  })

  it("rótulo reservado não vira empresa (D5)", () => {
    expect(slugDoSubdominio(`www.${BASE}`, BASE)).toBeNull()
    expect(slugDoSubdominio(`demo.${BASE}`, BASE)).toBeNull()
    expect(slugDoSubdominio(`admin.${BASE}`, BASE)).toBeNull()
  })

  it("host que apenas TERMINA parecido não casa (sufixo tem que ter o ponto)", () => {
    expect(slugDoSubdominio(`falso${BASE}`, BASE)).toBeNull()
  })

  it("sem domínio base configurado, o passo 2 simplesmente não existe", () => {
    expect(slugDoSubdominio(`cory.${BASE}`, undefined)).toBeNull()
  })

  it("hostCanonico é o inverso, e recusa slug reservado", () => {
    expect(hostCanonico("cory-alimentos", BASE)).toBe(`cory-alimentos.${BASE}`)
    expect(hostCanonico("demo", BASE)).toBeNull()
    expect(hostCanonico("cory-alimentos", undefined)).toBeNull()
  })
})

describe("resolverTenantPorHost — a ordem da D2", () => {
  it("1) domínio próprio ganha de tudo", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("argos.eximiaacademy.com.br", {
      fonte,
      base: BASE,
      slugLegado: "harven-finance",
    })
    expect(r).toMatchObject({
      tenantId: "id-cory",
      slug: "cory-alimentos",
      isNeutro: false,
      origem: "dominio-proprio",
    })
  })

  it("2) subdomínio do domínio base resolve pelo slug derivado por string", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost(`harven-finance.${BASE}`, { fonte, base: BASE })
    expect(r).toMatchObject({ tenantId: "id-harven", origem: "subdominio" })
    // O slug NÃO foi buscado no banco: o banco só converteu slug -> id.
    expect(fonte.chamadasPorSlug).toEqual(["harven-finance"])
  })

  it("3) sem domínio próprio e sem subdomínio, vale o env legado", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("academy.cliente.com", {
      fonte,
      base: BASE,
      slugLegado: "cory-alimentos",
    })
    expect(r).toMatchObject({ tenantId: "id-cory", origem: "env-legado" })
  })

  it("4) host desconhecido em PRODUÇÃO é NEUTRO, com tenantId null", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("host-que-ninguem-cadastrou.com", {
      fonte,
      base: BASE,
      ehDesenvolvimento: false,
    })
    expect(r).toMatchObject({
      tenantId: null,
      slug: "__neutro__",
      isNeutro: true,
      origem: "neutro",
    })
  })

  it("subdomínio inexistente NÃO cai no legado — seria servir o cliente do serviço a qualquer nome", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost(`inventado.${BASE}`, {
      fonte,
      base: BASE,
      slugLegado: "cory-alimentos",
    })
    expect(r.tenantId).toBeNull()
    expect(r.isNeutro).toBe(true)
  })

  it("env legado apontando para empresa inexistente devolve NEUTRO, não um id chutado", async () => {
    const fonte = fonteDe({}, {})
    const r = await resolverTenantPorHost("qualquer.com", { fonte, slugLegado: "sumiu" })
    expect(r).toMatchObject({ tenantId: null, isNeutro: true })
  })

  it("host forjado com porta e MAIÚSCULAS resolve o MESMO tenant que a forma canônica", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const a = await resolverTenantPorHost("ARGOS.EximiaAcademy.com.br:8443", { fonte, base: BASE })
    expect(a.tenantId).toBe("id-cory")
    expect(a.host).toBe("argos.eximiaacademy.com.br")
    // E a segunda chamada é servida pelo cache — mesma chave, uma consulta só.
    const b = await resolverTenantPorHost("argos.eximiaacademy.com.br", { fonte, base: BASE })
    expect(b.tenantId).toBe("id-cory")
    expect(fonte.chamadasPorHost).toEqual(["argos.eximiaacademy.com.br"])
  })

  it("ALTERNÂNCIA A -> desconhecido -> B: o cache nunca vaza a empresa anterior", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const opcoes = { fonte, base: BASE }

    const a = await resolverTenantPorHost(`cory-alimentos.${BASE}`, opcoes)
    expect(a.tenantId).toBe("id-cory")

    const desconhecido = await resolverTenantPorHost("nao-existe.exemplo.com", opcoes)
    expect(desconhecido.tenantId).toBeNull()
    expect(desconhecido.slug).toBe("__neutro__")

    const b = await resolverTenantPorHost(`harven-finance.${BASE}`, opcoes)
    expect(b.tenantId).toBe("id-harven")

    // E de volta ao desconhecido: continua neutro depois de DUAS empresas
    // resolvidas. É aqui que um cache com estado "último" entregaria a B.
    const outra = await resolverTenantPorHost("tambem-nao-existe.exemplo.com", opcoes)
    expect(outra.tenantId).toBeNull()
  })

  it("host vazio (requisição sem Host) é NEUTRO e não consulta domínio próprio", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("", { fonte, base: BASE })
    expect(r.isNeutro).toBe(true)
    expect(fonte.chamadasPorHost).toEqual([])
  })
})

describe("atalhos de desenvolvimento — existem, e só fora de produção", () => {
  it("`?tenant=` é IGNORADO em produção (seria trocador de marca por query string)", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("qualquer.com", {
      fonte,
      base: BASE,
      slugDaQuery: "harven-finance",
      ehDesenvolvimento: false,
    })
    expect(r.isNeutro).toBe(true)
    expect(fonte.chamadasPorSlug).toEqual([])
  })

  it("`?tenant=` resolve em desenvolvimento", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("localhost", {
      fonte,
      slugDaQuery: "harven-finance",
      ehDesenvolvimento: true,
    })
    expect(r).toMatchObject({ tenantId: "id-harven", origem: "dev" })
  })

  it("`{slug}.localhost` resolve em desenvolvimento", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("cory-alimentos.localhost:3000", {
      fonte,
      ehDesenvolvimento: true,
    })
    expect(r).toMatchObject({ tenantId: "id-cory", origem: "dev" })
  })

  it("`?tenant=` com slug inexistente devolve NEUTRO, e não a empresa do env", async () => {
    const fonte = fonteDe(DOMINIOS, TENANTS)
    const r = await resolverTenantPorHost("localhost", {
      fonte,
      slugDaQuery: "nao-existe",
      slugLegado: "cory-alimentos",
      ehDesenvolvimento: true,
    })
    expect(r.isNeutro).toBe(true)
  })
})

describe("falha de banco não derruba a página", () => {
  it("uma fonte que lança não é tratada como 'achou': a resolução vira erro do chamador", async () => {
    const fonte: FonteDeTenants = {
      porHost: vi.fn(async () => {
        throw new Error("banco fora do ar")
      }),
      porSlug: vi.fn(async () => null),
    }
    // A `fonteDoBanco()` real engole a exceção e devolve null; aqui se prova
    // que o resolvedor NÃO inventa um tenant quando a fonte falha.
    await expect(resolverTenantPorHost("qualquer.com", { fonte })).rejects.toThrow(
      "banco fora do ar",
    )
  })
})
