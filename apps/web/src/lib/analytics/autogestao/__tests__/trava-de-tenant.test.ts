import { describe, expect, it } from "vitest"
import {
  SLUGS_PROIBIDOS,
  SLUG_DESCARTAVEL,
  TravaViolada,
  guardar,
  limpar,
  resolverTenantDescartavel,
} from "../../../../../scripts/gauntlet/trava-de-tenant.mjs"

// ===========================================================================
// A TRAVA, testada pelos ACIDENTES QUE ELA PRECISA IMPEDIR.
//
// O banco alvo é produção compartilhada com dois clientes pagantes, e esta
// casa já teve vazamento cross-tenant real chegar lá (18/08/2026). Um teste
// que só confirma o caminho feliz não prova nada sobre uma trava: trava é
// definida pelo que ela RECUSA.
//
// Por isso cada caso verde abaixo vem emparelhado com o vermelho no mesmo
// eixo. Uma trava que aprovasse tudo (`guardar = (id, l) => l`) passaria em
// metade destes testes e falharia em todos os pares.
// ===========================================================================

const DESCARTAVEL = "11111111-1111-1111-1111-111111111111"
const CLIENTE = "99999999-9999-9999-9999-999999999999"

type LinhaTenant = { id?: string; slug: string; name?: string }
type BancoFalsoOpcoes = {
  tenantPorSlug?: Record<string, LinhaTenant>
  tenantPorId?: Record<string, LinhaTenant>
  erroDelete?: string | null
}

/** Um duplo de Supabase mínimo, só com o que a trava consome. */
function bancoFalso({
  tenantPorSlug = {},
  tenantPorId = {},
  erroDelete = null,
}: BancoFalsoOpcoes = {}) {
  const deletadas: Array<{ tabela: string; tenantId: string }> = []
  return {
    deletadas,
    from(tabela: string) {
      return {
        select() {
          return {
            eq(coluna: string, valor: string) {
              return {
                maybeSingle: async () => {
                  const achado = coluna === "slug" ? tenantPorSlug[valor] : tenantPorId[valor]
                  return { data: achado ?? null, error: null }
                },
              }
            },
          }
        },
        delete() {
          return {
            eq: async (_coluna: string, tenantId: string) => {
              deletadas.push({ tabela, tenantId })
              return erroDelete
                ? { error: { message: erroDelete }, count: null }
                : { error: null, count: 1 }
            },
          }
        },
      }
    },
  }
}

describe("trava de tenant — guardar()", () => {
  describe("deixa passar (o caminho legítimo)", () => {
    it("linhas que declaram o tenant descartável", () => {
      const linhas = [
        { tenant_id: DESCARTAVEL, nome: "a" },
        { tenant_id: DESCARTAVEL, nome: "b" },
      ]
      expect(guardar(DESCARTAVEL, linhas)).toHaveLength(2)
    })

    it("aceita uma linha solta, não só array", () => {
      expect(guardar(DESCARTAVEL, { tenant_id: DESCARTAVEL })).toHaveLength(1)
    })
  })

  describe("recusa (cada um é um acidente distinto e já plausível)", () => {
    it("linha SEM tenant_id: a coluna cairia no default do banco", () => {
      expect(() => guardar(DESCARTAVEL, [{ nome: "sem tenant" }])).toThrow(TravaViolada)
      expect(() => guardar(DESCARTAVEL, [{ nome: "sem tenant" }])).toThrow(/não declara tenant_id/)
    })

    it("linha apontando para tenant de CLIENTE: o acidente de 18/08", () => {
      expect(() => guardar(DESCARTAVEL, [{ tenant_id: CLIENTE }])).toThrow(/NÃO é o descartável/)
    })

    it("uma linha boa e uma ruim no MESMO lote: o lote inteiro cai", () => {
      // Sem este caso, uma trava que checasse só a primeira linha passaria.
      const lote = [{ tenant_id: DESCARTAVEL }, { tenant_id: CLIENTE }]
      expect(() => guardar(DESCARTAVEL, lote)).toThrow(/linha 1/)
    })

    it("lista vazia: quase sempre é um filtro que não casou nada", () => {
      // O caso do catálogo de vacuidade: semear zero linha "passa" em tudo.
      expect(() => guardar(DESCARTAVEL, [])).toThrow(/lista vazia/)
    })

    it("sem tenant resolvido", () => {
      expect(() => guardar(null, [{ tenant_id: DESCARTAVEL }])).toThrow(/não resolvido/)
    })
  })
})

describe("trava de tenant — resolverTenantDescartavel()", () => {
  it("resolve o descartável quando ele existe", async () => {
    const db = bancoFalso({
      tenantPorSlug: { [SLUG_DESCARTAVEL]: { id: DESCARTAVEL, slug: SLUG_DESCARTAVEL } },
    })
    await expect(resolverTenantDescartavel(db)).resolves.toBe(DESCARTAVEL)
  })

  it("NÃO cria o tenant quando ele falta — instrui e aborta", async () => {
    // Um script que cria o que não acha transforma erro de digitação em
    // tenant novo dentro do banco do cliente.
    const db = bancoFalso({ tenantPorSlug: {} })
    await expect(resolverTenantDescartavel(db)).rejects.toThrow(/NÃO cria tenant sozinho/)
  })

  it("aborta se a resolução devolver um slug de produção", async () => {
    // Redundância deliberada: prova o outro lado do mesmo fato.
    const db = bancoFalso({
      tenantPorSlug: { [SLUG_DESCARTAVEL]: { id: CLIENTE, slug: "cory-alimentos" } },
    })
    await expect(resolverTenantDescartavel(db)).rejects.toThrow(/tenant de PRODUÇÃO/)
  })

  it("a lista negra cobre os quatro tenants reais do banco", () => {
    for (const slug of [
      "cory-alimentos",
      "eximia-academy",
      "harven-finance",
      "vertice-industria",
    ]) {
      expect(SLUGS_PROIBIDOS).toContain(slug)
    }
    expect(SLUGS_PROIBIDOS).not.toContain(SLUG_DESCARTAVEL)
  })
})

describe("trava de tenant — limpar()", () => {
  it("apaga apenas no tenant descartável, tabela a tabela", async () => {
    const db = bancoFalso({
      tenantPorId: { [DESCARTAVEL]: { slug: SLUG_DESCARTAVEL } },
    })
    const apagadas = await limpar(db, DESCARTAVEL, ["sessions", "enrollments"])
    expect(apagadas).toEqual({ sessions: 1, enrollments: 1 })
    expect(db.deletadas.every((d) => d.tenantId === DESCARTAVEL)).toBe(true)
  })

  it("RECONFIRMA pelo banco antes de deletar: id de cliente derruba o DELETE", async () => {
    // O pior comando do arquivo. Se a resolução do tenant for corrompida rio
    // acima, é aqui que o estrago seria irreversível.
    const db = bancoFalso({ tenantPorId: { [CLIENTE]: { slug: "cory-alimentos" } } })
    await expect(limpar(db, CLIENTE, ["sessions"])).rejects.toThrow(/DELETE abortado/)
    expect(db.deletadas).toHaveLength(0)
  })

  it("tenant que sumiu entre resolver e limpar não vira DELETE cego", async () => {
    const db = bancoFalso({ tenantPorId: {} })
    await expect(limpar(db, DESCARTAVEL, ["sessions"])).rejects.toThrow(/não existe mais/)
    expect(db.deletadas).toHaveLength(0)
  })
})
