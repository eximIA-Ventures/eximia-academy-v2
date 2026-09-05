import { describe, expect, it } from "vitest"
import { lerFonteAutogestao } from "../fonte-supabase"
import { TAMANHO_PAGINA } from "../parametros"

// ---------------------------------------------------------------------------
// LOOP-0c, E→PARCIAL #2 / E→ENGOLIDO #2 (M-1 de Aria) — o teto de páginas.
//
// `ler()` pagina até `MAX_PAGINAS`. Quando o laço termina POR ESGOTAR O TETO
// (e não por uma página curta), ele devolve `{ linhas, falha: null }`: uma
// leitura TRUNCADA entregue como se fosse o conjunto inteiro. Nenhum erro
// aconteceu, então nada nesta camada sabe que faltou dado — e a Autogestão,
// que é honesta em todo o resto, publicaria o número menor como fato.
//
// O par que dá sentido ao sinal: a leitura que termina numa página CURTA é
// completa de verdade e continua sem falha. Sem esse controle positivo, marcar
// falha sempre passaria no teste de cima.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

/**
 * Um banco que devolve páginas CHEIAS para sempre na tabela escolhida — é como
 * se parece, do lado de cá, um aluno com mais linhas do que o teto alcança.
 */
function bancoInesgotavel(tabelaInesgotavel: string, paginasCheias = Number.POSITIVE_INFINITY) {
  let paginasServidas = 0
  const db = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: (de: number) => {
          if (table !== tabelaInesgotavel) return Promise.resolve({ data: [], error: null })
          const pagina = Math.floor(de / TAMANHO_PAGINA)
          paginasServidas = Math.max(paginasServidas, pagina + 1)
          const cheia = pagina < paginasCheias
          const linhas: Row[] = Array.from({ length: cheia ? TAMANHO_PAGINA : 3 }, (_, i) => ({
            id: `${table}-${de + i}`,
            created_at: "2026-08-01T12:00:00.000Z",
          }))
          return Promise.resolve({ data: linhas, error: null })
        },
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }
      return builder
    },
    get paginasServidas() {
      return paginasServidas
    },
  }
  // biome-ignore lint/suspicious/noExplicitAny: cliente falso do teste
  return db as any
}

const PARAMETROS = {
  tenantId: "t1",
  studentId: "aluno-1",
  courseId: "curso-1",
  periodoDias: 30 as const,
}

describe("teto de paginação — truncar não pode passar por 'isso é tudo'", () => {
  it("esgotar o teto de páginas vira FALHA, não um conjunto completo menor", async () => {
    const db = bancoInesgotavel("sessions")

    const fonte = await lerFonteAutogestao({ db, ...PARAMETROS })

    expect(fonte.falhas.sessoes).not.toBeNull()
    expect(fonte.falhas.sessoes?.codigo).toBe("SESSOES")
    // E o truncado nunca sai como se fosse o conjunto inteiro.
    expect(fonte.sessoes).toEqual([])
  })

  it("controle positivo — leitura que termina numa página curta continua sem falha", async () => {
    // 2 páginas cheias e a terceira curta: fim legítimo, dentro do teto.
    const db = bancoInesgotavel("sessions", 2)

    const fonte = await lerFonteAutogestao({ db, ...PARAMETROS })

    expect(fonte.falhas.sessoes).toBeNull()
    expect(fonte.sessoes).toHaveLength(TAMANHO_PAGINA * 2 + 3)
  })
})
