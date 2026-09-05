// ---------------------------------------------------------------------------
// Um duplo de Supabase que DE FATO FILTRA — a régua dos testes de isolamento.
// ---------------------------------------------------------------------------
// POR QUE ELE EXISTE, e por que não bastava o `bancoFalso()` de
// `fuso-horario.test.ts`. Aquele duplo devolve `{ data: [], error: null }` para
// qualquer consulta: `.eq()` é um no-op que só devolve a própria cadeia. Um
// duplo assim ATRAVESSA a consulta sem OLHAR para ela — apagar
// `.eq("tenant_id", …)` do código de produção não muda uma vírgula do que ele
// devolve. Foi exatamente isso que deixou as 7 mutações do Eixo A (laudo
// LOOP-2) passarem com 235/235 verde.
//
// Este duplo é o oposto: ele guarda cada predicado (`eq`/`in`/`is`/`neq`),
// aplica todos sobre um conjunto de linhas de DOIS tenants, e só então
// devolve. Se um filtro sumir do código de produção, a linha do outro tenant
// APARECE no resultado — e a asserção é sobre o resultado, não sobre a
// existência da chamada.
//
// A diferença importa para o que o teste pina: `grep`/spy de `.eq()` pinaria a
// IMPLEMENTAÇÃO (chamar `.eq`); linhas de dois tenants pinam a INTENÇÃO (não
// vazar). A segunda sobrevive a um refactor que troque `.eq()` por `.match()`
// ou por uma view — a primeira não.
//
// SOMENTE MEMÓRIA. Nenhuma ida ao banco: o `.env.local` deste repositório
// aponta para o Supabase de PRODUÇÃO, e nenhum teste desta suíte o alcança.
// ---------------------------------------------------------------------------

export type Linha = Record<string, unknown>

/** Uma chamada de filtro registrada, para o caso raro em que a linha não discrimina. */
export interface ChamadaFiltro {
  tabela: string
  operador: "eq" | "in" | "is" | "neq"
  coluna: string
  valor: unknown
}

type Predicado = (linha: Linha) => boolean

/**
 * Recorta a linha às colunas do `select()`, como o PostgREST faz.
 *
 * Sem isto o duplo devolveria `tenant_id` em linhas cujo `select` não o pede, e
 * a asserção poderia se apoiar num campo que produção nunca lê — um verde que
 * não corresponde a nada. Selects com embed (`courses!inner(...)`) não são
 * recortados: nenhuma das consultas sob teste usa um, e adivinhar a forma do
 * embed seria inventar comportamento.
 */
function projetar(linha: Linha, select: string | null): Linha {
  if (!select || select.includes("(")) return { ...linha }
  const colunas = select
    .split(",")
    .map((c) => c.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
  if (colunas.length === 0 || colunas.includes("*")) return { ...linha }
  const saida: Linha = {}
  for (const coluna of colunas) {
    if (coluna in linha) saida[coluna] = linha[coluna]
  }
  return saida
}

/** O que uma consulta resolvida devolve — a forma reduzida do `supabase-js`. */
interface Resposta {
  data: Linha[]
  error: null
}

/**
 * A cadeia do PostgREST, tipada explicitamente em vez de `any`.
 *
 * Escrever a forma toda custa vinte linhas e paga: um `any` aqui deixaria um
 * `.eq()` com o nome errado (`.eqq`, `.equals`) passar em silêncio no duplo
 * enquanto explodiria em produção — o duplo mediria uma consulta que não existe.
 */
interface Cadeia {
  select(colunas?: string): Cadeia
  eq(coluna: string, valor: unknown): Cadeia
  neq(coluna: string, valor: unknown): Cadeia
  in(coluna: string, valores: readonly unknown[]): Cadeia
  is(coluna: string, valor: unknown): Cadeia
  order(...args: unknown[]): Cadeia
  limit(n: number): Cadeia
  range(de: number, ate: number): Cadeia
  maybeSingle(): Promise<{ data: Linha | null; error: null }>
  single(): Promise<{ data: Linha | null; error: null }>
  then(aoResolver: (r: Resposta) => unknown): Promise<unknown>
}

export interface BancoQueFiltra {
  /**
   * O client. Cada suíte faz `db as unknown as ClienteLeitura` na fronteira: o
   * tipo real (`ReturnType<typeof createServiceClient>`) não é construível fora
   * de um client concreto, e o cast fica visível no ponto de uso em vez de
   * escondido aqui dentro.
   */
  db: { from(tabela: string): Cadeia }
  /** Todo filtro emitido, na ordem. Só usado quando a linha não discrimina sozinha. */
  chamadas: ChamadaFiltro[]
}

/**
 * Monta o duplo a partir de um dicionário `tabela → linhas`.
 *
 * A cadeia devolvida é *thenable* (tem `then`), como o `PostgrestFilterBuilder`
 * real — e por isso os filtros são aplicados na RESOLUÇÃO, não na chamada. Isso
 * não é detalhe: `aprendizagem-time/fonte-supabase.ts` chama `.range()` e só
 * DEPOIS `.eq("course_id", …)`; um duplo que resolvesse dentro de `.range()`
 * perderia esse filtro e mediria a consulta errada.
 */
export function bancoQueFiltra(tabelas: Record<string, Linha[]>): BancoQueFiltra {
  const chamadas: ChamadaFiltro[] = []

  function from(tabela: string): Cadeia {
    const predicados: Predicado[] = []
    let select: string | null = null
    let de = 0
    let ate = Number.POSITIVE_INFINITY

    function resolver(): Linha[] {
      const fonte = tabelas[tabela] ?? []
      const filtradas = fonte.filter((linha) => predicados.every((p) => p(linha)))
      return filtradas.slice(de, ate === Number.POSITIVE_INFINITY ? undefined : ate + 1)
    }

    const chain: Cadeia = {
      select(colunas?: string) {
        select = typeof colunas === "string" ? colunas : null
        return chain
      },
      eq(coluna: string, valor: unknown) {
        chamadas.push({ tabela, operador: "eq", coluna, valor })
        predicados.push((linha) => linha[coluna] === valor)
        return chain
      },
      neq(coluna: string, valor: unknown) {
        chamadas.push({ tabela, operador: "neq", coluna, valor })
        predicados.push((linha) => linha[coluna] !== valor)
        return chain
      },
      in(coluna: string, valores: readonly unknown[]) {
        chamadas.push({ tabela, operador: "in", coluna, valor: valores })
        predicados.push((linha) => valores.includes(linha[coluna]))
        return chain
      },
      is(coluna: string, valor: unknown) {
        chamadas.push({ tabela, operador: "is", coluna, valor })
        predicados.push((linha) => (linha[coluna] ?? null) === valor)
        return chain
      },
      order() {
        return chain
      },
      limit(n: number) {
        ate = de + n - 1
        return chain
      },
      range(inicio: number, fim: number) {
        de = inicio
        ate = fim
        return chain
      },
      maybeSingle: async () => {
        const linhas = resolver()
        return { data: linhas[0] ? projetar(linhas[0], select) : null, error: null }
      },
      single: async () => {
        const linhas = resolver()
        return { data: linhas[0] ? projetar(linhas[0], select) : null, error: null }
      },
      // A cadeia é o próprio thenable — `await q` resolve aqui, com todos os
      // filtros já registrados, inclusive os aplicados depois de `.range()`.
      // biome-ignore lint/suspicious/noThenProperty: é justamente o ponto — o `PostgrestFilterBuilder` real é um thenable, e resolver dentro de `.range()` perderia os filtros aplicados depois dele.
      then(aoResolver: (r: Resposta) => unknown) {
        const linhas = resolver().map((linha) => projetar(linha, select))
        return Promise.resolve({ data: linhas, error: null }).then(aoResolver)
      },
    }
    return chain
  }

  return { db: { from }, chamadas }
}
