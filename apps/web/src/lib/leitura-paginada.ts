// ---------------------------------------------------------------------------
// Leitura paginada de PostgREST — completude não se presume.
// ---------------------------------------------------------------------------
// Extraída de `app/api/analytics/aggregate/route.ts` (era a `fetchAllRows`
// privada, enterrada num arquivo de 1.500 linhas, que nenhum teste conseguia
// interrogar).
//
// O DEFEITO QUE ISTO CORRIGE (laudo LOOP-0c, E→PARCIAL). A versão anterior
// colapsava três desfechos radicalmente diferentes num único `break`, e devolvia
// `T[]` puro — um tipo que não tem onde carregar a diferença:
//
//   (a) acabaram as linhas          → o array ESTÁ completo
//   (b) a página falhou             → o array está incompleto e ninguém sabe
//   (c) bateu o teto de páginas     → idem, a partir de 50.000 linhas
//
// Os nove chamadores em `aggregate/route.ts` recebiam (b) e (c) com a mesma cara
// de (a) e os somavam como fato: "1.000 concluintes" onde o real é 2.500, sem um
// "—" à vista.
//
// A CORREÇÃO É FAIL-LOUD, E EM UM LUGAR SÓ. Ou se devolve o conjunto inteiro, ou
// se lança `LeituraTruncadaError`. Não existe terceiro estado para cada chamador
// interpretar do seu jeito: nove cópias do mesmo julgamento é exatamente como o
// E→NEGA se espalhou por oito rotas.
// ---------------------------------------------------------------------------

/** PostgREST corta uma requisição em ~1000 linhas. */
export const TAMANHO_DA_PAGINA = 1000

/** Teto de páginas (50.000 linhas), guarda de FinOps contra laço desgovernado. */
export const MAX_PAGINAS = 50

/** Por que a leitura não pôde ser declarada completa. */
export type MotivoDoTruncamento = "erro-de-leitura" | "teto-de-paginas"

export class LeituraTruncadaError extends Error {
  readonly motivo: MotivoDoTruncamento
  /** Quantas linhas haviam sido lidas quando a leitura foi interrompida. */
  readonly linhasLidas: number

  constructor(motivo: MotivoDoTruncamento, linhasLidas: number, causa?: unknown) {
    super(
      motivo === "erro-de-leitura"
        ? `Leitura paginada interrompida por erro apos ${linhasLidas} linhas`
        : `Leitura paginada atingiu o teto de ${MAX_PAGINAS} paginas (${linhasLidas} linhas) — o conjunto real e maior`,
      { cause: causa },
    )
    this.name = "LeituraTruncadaError"
    this.motivo = motivo
    this.linhasLidas = linhasLidas
  }
}

/**
 * Percorre exaustivamente uma consulta PostgREST que devolve LINHAS (não uma
 * contagem `head`). `buildPage(from, to)` deve devolver a consulta daquela janela
 * `.range()` inclusiva.
 *
 * Devolve todas as linhas, ou lança `LeituraTruncadaError` — nunca um parcial
 * disfarçado de total.
 */
export async function lerTodasAsLinhas<T>(
  // biome-ignore lint/suspicious/noExplicitAny: PostgREST builder is loosely typed
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const todas: T[] = []
  let from = 0

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const to = from + TAMANHO_DA_PAGINA - 1
    const { data, error } = await buildPage(from, to)

    // `data: null` sem `error` é a mesma coisa em prática: a página não veio.
    // Tratá-la como "acabaram as linhas" foi como o `[]` da primeira página
    // passava por "não há dados" — a forma mais traiçoeira do defeito, porque a
    // tela sabe desenhar "não há dados" com naturalidade.
    if (error || !data) {
      throw new LeituraTruncadaError("erro-de-leitura", todas.length, error)
    }

    todas.push(...data)

    // Página incompleta (inclusive vazia) sem erro: fim legítimo do conjunto.
    if (data.length < TAMANHO_DA_PAGINA) return todas

    from += TAMANHO_DA_PAGINA
  }

  // Saiu do laço com todas as páginas cheias: há mais dados do lá fora do que o
  // teto permite ler. Devolver o que se tem seria afirmar um total que não é.
  throw new LeituraTruncadaError("teto-de-paginas", todas.length)
}
