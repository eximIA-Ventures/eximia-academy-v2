import { describe, expect, it } from "vitest"
import { loadAdminOverview } from "../admin-overview"
import { __resetOrgReferenceCache } from "../org-reference-cache"

// ---------------------------------------------------------------------------
// A-2 / LOOP-1 — "erro de leitura de `users` vira: a empresa tem zero pessoas".
//
// `readTenantUsers` devolve `TenantUserRow[]`. Não existe canal de falha: a
// informação de que a leitura falhou nasce dentro de `readAll` e morre na
// saída da função. Um soluço de rede na leitura de `users` faz `/admin/visao-geral`
// renderizar a empresa com 0 pessoas, funil vazio e engajamento zerado — sem
// erro, sem "—", sem retry.
//
// O que estes testes exigem: que a falha CHEGUE à superfície como falha, e não
// como um zero indistinguível de "a empresa não tem ninguém". A empresa
// genuinamente vazia (`makeDb({})`) continua sendo um caso legítimo e tem de
// permanecer distinguível do erro — é o par que dá sentido ao sinal.
//
// A segunda porta para o mesmo sintoma é o truncamento (A-1): `readAll` marca
// `available: offset > 0`, isto é, uma leitura que quebrou na página 2 volta
// como COMPLETA. Sem fechar essa porta, qualquer sinal de falha de população
// continua contornável a partir da segunda página — por isso ela é testada
// aqui, junto, e não como um achado separado.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: linhas frouxas do harness
type Row = Record<string, any>

interface FalhaDeTabela {
  /** A partir de qual página a leitura passa a falhar (0 = já na primeira). */
  aPartirDaPagina: number
  code?: string
  message?: string
}

const PAGE_SIZE = 1000

/**
 * Mesmo desenho do harness de `admin-overview.test.ts`, com UMA capacidade a
 * mais: falhar a partir de uma PÁGINA específica, não só na primeira. Sem isso
 * não há como distinguir "não consegui ler" de "li tudo" quando a quebra
 * acontece no meio da paginação.
 */
function makeDb(data: Record<string, Row[]>, falhas: Record<string, FalhaDeTabela> = {}) {
  const db = {
    from(table: string) {
      const eqs: [string, unknown][] = []
      const ins: [string, unknown[]][] = []
      const rowsFor = (): Row[] => {
        let rows = data[table] ?? []
        for (const [c, v] of eqs) rows = rows.filter((r) => r[c] === undefined || r[c] === v)
        for (const [c, vs] of ins)
          rows = rows.filter((r) => r[c] === undefined || vs.includes(r[c]))
        return rows
      }
      const falha = falhas[table]
      const erro = () => ({
        data: null,
        error: {
          code: falha?.code ?? "57014",
          message: falha?.message ?? `relation ${table} unavailable`,
        },
      })
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (c: string, v: unknown) => {
          eqs.push([c, v])
          return builder
        },
        neq: () => builder,
        in: (c: string, vs: unknown[]) => {
          ins.push([c, vs])
          return builder
        },
        range: (offset: number) => {
          const pagina = Math.floor(offset / PAGE_SIZE)
          if (falha && pagina >= falha.aPartirDaPagina) return Promise.resolve(erro())
          return Promise.resolve({
            data: rowsFor().slice(offset, offset + PAGE_SIZE),
            error: null,
          })
        },
        // biome-ignore lint/suspicious/noThenProperty: thenable proposital do mock
        then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) =>
          Promise.resolve(
            falha && falha.aPartirDaPagina === 0 ? erro() : { data: rowsFor(), error: null },
          ).then(resolve),
      }
      return builder
    },
  }
  // biome-ignore lint/suspicious/noExplicitAny: cliente falso do teste
  return db as any
}

const NOW = Date.parse("2026-06-01T00:00:00Z")

function pessoas(n: number, tenantId = "t1"): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    tenant_id: tenantId,
    role: "student",
    status: "active",
    last_seen_at: new Date(NOW - 2 * 86_400_000).toISOString(),
  }))
}

describe("A-2 — falha ao ler `users` não pode virar 'a empresa tem zero pessoas'", () => {
  it("leitura de `users` que falha na PRIMEIRA página é reportada como falha", async () => {
    __resetOrgReferenceCache()
    const db = makeDb({ users: pessoas(7) }, { users: { aPartirDaPagina: 0 } })

    const overview = await loadAdminOverview(db, "t1", { now: NOW })

    // O canal de falha existe e aponta a fonte.
    expect(overview.readFailure).not.toBeNull()
    expect(overview.readFailure?.source).toBe("users")
  })

  it("empresa genuinamente vazia continua sendo 'vazia', nunca 'falha' (controle positivo)", async () => {
    __resetOrgReferenceCache()
    const overview = await loadAdminOverview(makeDb({}), "vazio", { now: NOW })

    expect(overview.readFailure).toBeNull()
    expect(overview.totals.people).toBe(0)
  })

  it("leitura de `users` truncada na SEGUNDA página não passa por completa", async () => {
    __resetOrgReferenceCache()
    // 1500 pessoas: a página 0 volta cheia (1000) e a página 1 quebra.
    const db = makeDb({ users: pessoas(1500) }, { users: { aPartirDaPagina: 1 } })

    const overview = await loadAdminOverview(db, "t1", { now: NOW })

    expect(overview.readFailure).not.toBeNull()
    expect(overview.readFailure?.source).toBe("users")
    // O número parcial (1.000 de 1.500) nunca é publicado como fato.
    expect(overview.totals.people).not.toBe(1000)
  })

  /**
   * O fallback da projeção enxuta é NOMEADO: existe para a coluna
   * `last_seen_at` poder não existir antes da migration. Os dois testes abaixo
   * são o par que prende essa porta dos dois lados — um exige que o `42703`
   * ainda passe, o outro exige que um erro qualquer NÃO seja resgatado por ele.
   */
  function bancoComProjecaoEnriquecidaQuebrada(erro: { code: string; message: string }) {
    const linhas = pessoas(7).map(({ last_seen_at: _ignorado, ...resto }) => resto)
    return {
      from(table: string) {
        const builder: Record<string, unknown> = {
          select: (colunas: string) => {
            builder.__enriquecida = table === "users" && colunas.includes("last_seen_at")
            return builder
          },
          order: () => builder,
          limit: () => builder,
          eq: () => builder,
          neq: () => builder,
          in: () => builder,
          range: () =>
            builder.__enriquecida
              ? Promise.resolve({ data: null, error: erro })
              : Promise.resolve({ data: table === "users" ? linhas : [], error: null }),
          // biome-ignore lint/suspicious/noThenProperty: thenable proposital do mock
          then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) =>
            Promise.resolve({ data: table === "users" ? linhas : [], error: null }).then(resolve),
        }
        return builder
      },
      // biome-ignore lint/suspicious/noExplicitAny: cliente falso do teste
    } as any
  }

  it("coluna ausente (42703) continua caindo na projeção enxuta, sem virar falha", async () => {
    __resetOrgReferenceCache()
    const db = bancoComProjecaoEnriquecidaQuebrada({
      code: "42703",
      message: 'column "last_seen_at" does not exist',
    })

    const overview = await loadAdminOverview(db, "t1", { now: NOW })

    expect(overview.readFailure).toBeNull()
    expect(overview.totals.people).toBe(7)
  })

  it("erro QUALQUER não é resgatado pelo fallback: timeout vira falha, não projeção enxuta", async () => {
    __resetOrgReferenceCache()
    // Antes, o gatilho do fallback era qualquer `error`. Um timeout na primeira
    // projeção fazia a segunda rodar e, quando ela respondia, a tela publicava
    // uma população SEM o sinal de navegação pura como se fosse completa.
    const db = bancoComProjecaoEnriquecidaQuebrada({
      code: "57014",
      message: "canceling statement due to statement timeout",
    })

    const overview = await loadAdminOverview(db, "t1", { now: NOW })

    expect(overview.readFailure).not.toBeNull()
    expect(overview.readFailure?.source).toBe("users")
  })
})
