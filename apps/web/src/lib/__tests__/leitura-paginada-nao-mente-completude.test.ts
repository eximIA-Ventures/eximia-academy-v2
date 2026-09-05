import { describe, expect, it, vi } from "vitest"
import {
  LeituraTruncadaError,
  MAX_PAGINAS,
  TAMANHO_DA_PAGINA,
  lerTodasAsLinhas,
} from "../leitura-paginada"

// ---------------------------------------------------------------------------
// LEITURA TRUNCADA NÃO PODE SE APRESENTAR COMO O CONJUNTO INTEIRO.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (laudo LOOP-0c, tabela E→PARCIAL / E→ENGOLIDO
// #3). A paginação de `api/analytics/aggregate` era:
//
//     if (error || !data || data.length === 0) break
//     ...
//     return all
//
// Três desfechos radicalmente diferentes colapsados num único `break`, e um tipo
// de retorno — `T[]` puro — que não tem onde carregar a diferença:
//
//   (a) acabaram as linhas          → o array ESTÁ completo
//   (b) a página falhou             → o array está incompleto e ninguém sabe
//   (c) bateu o teto de 50 páginas  → idem, a partir de 50.000 linhas
//
// Nos casos (b) e (c) o gestor lê "1.000 concluintes" onde o real é 2.500 — o
// número aparece com a mesma cara de fato que o número correto. É a família de
// defeito mais cara desta casa: o instrumento responde com precisão a uma
// pergunta que não é a pergunta.
//
// O remédio é fail-loud numa decisão SÓ: quem lê ou recebe o conjunto inteiro, ou
// recebe uma exceção nomeada. Não existe terceiro estado para nove chamadores
// interpretarem cada um do seu jeito — nove cópias do mesmo julgamento foi como o
// E→NEGA das oito rotas se espalhou.
//
// CONTROLE POSITIVO [CP]: as leituras que completam de verdade continuam
// devolvendo tudo, em uma página e em várias. Sem eles, a correção degenerada
// "lança sempre" ficaria verde.
// ---------------------------------------------------------------------------

/** Gera `n` linhas distinguíveis, para conferir que nada se perde pelo caminho. */
function linhas(n: number, deslocamento = 0) {
  return Array.from({ length: n }, (_, i) => ({ id: deslocamento + i }))
}

describe("lerTodasAsLinhas — completude não se presume", () => {
  it("erro no meio da paginação não pode devolver o parcial como se fosse tudo", async () => {
    const paginas = vi.fn(async (from: number) => {
      // Primeira página cheia: o laço vai pedir a segunda.
      if (from === 0) return { data: linhas(TAMANHO_DA_PAGINA), error: null }
      // Segunda página falha. Hoje isto vira `break` e devolve as 1.000 primeiras.
      return {
        data: null,
        error: { code: "57014", message: "canceling statement due to statement timeout" },
      }
    })

    await expect(lerTodasAsLinhas(paginas)).rejects.toBeInstanceOf(LeituraTruncadaError)
    expect(paginas).toHaveBeenCalledTimes(2)
  })

  it("erro logo na primeira página também não pode virar lista vazia", async () => {
    // O caso mais traiçoeiro dos dois: `[]` é indistinguível de "não há dados",
    // e "não há dados" é uma resposta que a tela sabe desenhar com naturalidade.
    const paginas = vi.fn(async () => ({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    }))

    await expect(lerTodasAsLinhas(paginas)).rejects.toBeInstanceOf(LeituraTruncadaError)
  })

  it("bater o teto de páginas é truncamento, não fim dos dados", async () => {
    // Todas as páginas vêm cheias: o conjunto real é MAIOR que o teto.
    const paginas = vi.fn(async (from: number) => ({
      data: linhas(TAMANHO_DA_PAGINA, from),
      error: null,
    }))

    await expect(lerTodasAsLinhas(paginas)).rejects.toBeInstanceOf(LeituraTruncadaError)
    expect(paginas).toHaveBeenCalledTimes(MAX_PAGINAS)
  })

  it("[CP] uma única página incompleta é o conjunto inteiro", async () => {
    const paginas = vi.fn(async () => ({ data: linhas(7), error: null }))

    await expect(lerTodasAsLinhas(paginas)).resolves.toHaveLength(7)
    expect(paginas).toHaveBeenCalledTimes(1)
  })

  it("[CP] várias páginas que terminam naturalmente devolvem tudo, em ordem", async () => {
    const paginas = vi.fn(async (from: number) => {
      if (from === 0) return { data: linhas(TAMANHO_DA_PAGINA, 0), error: null }
      if (from === TAMANHO_DA_PAGINA)
        return { data: linhas(TAMANHO_DA_PAGINA, TAMANHO_DA_PAGINA), error: null }
      return { data: linhas(5, 2 * TAMANHO_DA_PAGINA), error: null }
    })

    const todas = await lerTodasAsLinhas<{ id: number }>(paginas)

    expect(todas).toHaveLength(2 * TAMANHO_DA_PAGINA + 5)
    expect(todas[0].id).toBe(0)
    expect(todas.at(-1)?.id).toBe(2 * TAMANHO_DA_PAGINA + 4)
    expect(paginas).toHaveBeenCalledTimes(3)
  })

  it("[CP] página vazia sem erro é fim legítimo dos dados, não falha", async () => {
    const paginas = vi.fn(async (from: number) =>
      from === 0
        ? { data: linhas(TAMANHO_DA_PAGINA), error: null }
        : { data: [] as { id: number }[], error: null },
    )

    await expect(lerTodasAsLinhas(paginas)).resolves.toHaveLength(TAMANHO_DA_PAGINA)
  })
})
