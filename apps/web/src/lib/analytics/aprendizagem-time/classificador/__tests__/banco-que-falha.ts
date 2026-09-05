// ---------------------------------------------------------------------------
// Um duplo de Supabase que SABE FALHAR — e que registra o que foi gravado.
// ---------------------------------------------------------------------------
// POR QUE ELE EXISTE, e por que `banco-que-filtra.ts` não bastava. Aquele duplo
// devolve `error: null` sempre e não conhece escrita nenhuma (`upsert`,
// `insert`, `update`). O pipeline de classificação é justamente uma máquina de
// ESCREVER, e todo o defeito da tabela E→SUCESSO do laudo LOOP-0c mora no
// caminho em que a escrita FALHA e ninguém conta. Com um duplo que nunca falha,
// esse caminho é inalcançável — e foi por isso que ele nunca rodou sob teste.
//
// O que este duplo acrescenta, e só isso:
//   1. `errosDeLeitura[tabela]` — o `select` daquela tabela devolve
//      `{ data: null, error }`, como o PostgREST num timeout de statement.
//   2. `errosDeEscrita[tabela]` — o `upsert`/`insert`/`update` daquela tabela
//      devolve `{ data: null, error }`.
//   3. `gravacoes` — toda escrita BEM-SUCEDIDA, na ordem. A asserção é sobre o
//      que ENTROU no banco, não sobre a chamada ter acontecido: um pipeline que
//      tenta 20 vezes e grava 0 tem `gravacoes.length === 0`, e é exatamente
//      essa a diferença que `processadas` mentia.
//
// Os filtros são aplicados de verdade (mesma doutrina do `banco-que-filtra`):
// escrita bem-sucedida entra no armazém e é visível para a leitura seguinte, o
// que permite provar "não reclassificou o que já estava classificado".
//
// SOMENTE MEMÓRIA. Nenhuma ida ao banco: o `.env.local` deste repositório
// aponta para o Supabase de PRODUÇÃO, e nenhum teste desta suíte o alcança.
// ---------------------------------------------------------------------------

export type Linha = Record<string, unknown>

export interface ErroFalso {
  code?: string
  message: string
}

/** O erro que o PostgREST devolve num timeout de statement. Transitório por definição. */
export const ERRO_TRANSITORIO: ErroFalso = {
  code: "57014",
  message: "canceling statement due to statement timeout",
}

export interface Gravacao {
  tabela: string
  operacao: "upsert" | "insert" | "update"
  linhas: Linha[]
}

export interface OpcoesBanco {
  tabelas?: Record<string, Linha[]>
  errosDeLeitura?: Record<string, ErroFalso>
  errosDeEscrita?: Record<string, ErroFalso>
}

export interface BancoQueFalha {
  db: { from(tabela: string): Cadeia }
  /** Toda escrita bem-sucedida, na ordem. */
  gravacoes: Gravacao[]
  /** Linhas atuais de uma tabela (após as escritas aplicadas). */
  linhasDe(tabela: string): Linha[]
}

type Predicado = (linha: Linha) => boolean

interface Resposta {
  data: Linha[] | null
  error: ErroFalso | null
}

interface Cadeia {
  select(colunas?: string): Cadeia
  eq(coluna: string, valor: unknown): Cadeia
  neq(coluna: string, valor: unknown): Cadeia
  in(coluna: string, valores: readonly unknown[]): Cadeia
  is(coluna: string, valor: unknown): Cadeia
  order(...args: unknown[]): Cadeia
  limit(n: number): Cadeia
  range(de: number, ate: number): Cadeia
  upsert(linhas: Linha | Linha[], opcoes?: unknown): Cadeia
  insert(linhas: Linha | Linha[]): Cadeia
  update(patch: Linha): Cadeia
  maybeSingle(): Promise<{ data: Linha | null; error: ErroFalso | null }>
  single(): Promise<{ data: Linha | null; error: ErroFalso | null }>
  then(aoResolver: (r: Resposta) => unknown): Promise<unknown>
}

function projetar(linha: Linha, select: string | null): Linha {
  if (!select || select.includes("(")) return { ...linha }
  const colunas = select
    .split(",")
    .map((c) => c.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
  if (colunas.length === 0 || colunas.includes("*")) return { ...linha }
  const saida: Linha = {}
  for (const coluna of colunas) if (coluna in linha) saida[coluna] = linha[coluna]
  return saida
}

export function bancoQueFalha(opcoes: OpcoesBanco = {}): BancoQueFalha {
  const tabelas: Record<string, Linha[]> = {}
  for (const [nome, linhas] of Object.entries(opcoes.tabelas ?? {})) {
    tabelas[nome] = linhas.map((l) => ({ ...l }))
  }
  const errosDeLeitura = opcoes.errosDeLeitura ?? {}
  const errosDeEscrita = opcoes.errosDeEscrita ?? {}
  const gravacoes: Gravacao[] = []
  let sequencia = 0

  function armazem(tabela: string): Linha[] {
    const atual = tabelas[tabela]
    if (atual) return atual
    const novo: Linha[] = []
    tabelas[tabela] = novo
    return novo
  }

  function from(tabela: string): Cadeia {
    const predicados: Predicado[] = []
    let select: string | null = null
    let de = 0
    let ate = Number.POSITIVE_INFINITY
    let escrita: { operacao: Gravacao["operacao"]; linhas: Linha[] } | null = null

    function aplicarEscrita(): Resposta {
      if (!escrita) throw new Error("aplicarEscrita sem escrita pendente")
      const erro = errosDeEscrita[tabela]
      if (erro) return { data: null, error: erro }

      if (escrita.operacao === "update") {
        const patch = escrita.linhas[0] ?? {}
        const alvo = armazem(tabela).filter((l) => predicados.every((p) => p(l)))
        for (const linha of alvo) Object.assign(linha, patch)
        gravacoes.push({ tabela, operacao: "update", linhas: alvo.map((l) => ({ ...l })) })
        return { data: alvo.map((l) => projetar(l, select)), error: null }
      }

      sequencia += 1
      const gravadas = escrita.linhas.map((l, i) => ({
        id: l.id ?? `${tabela}-${sequencia}-${i}`,
        ...l,
      }))
      armazem(tabela).push(...gravadas.map((l) => ({ ...l })))
      gravacoes.push({
        tabela,
        operacao: escrita.operacao,
        linhas: gravadas.map((l) => ({ ...l })),
      })
      return { data: gravadas.map((l) => projetar(l, select)), error: null }
    }

    function resolver(): Resposta {
      if (escrita) return aplicarEscrita()
      const erro = errosDeLeitura[tabela]
      if (erro) return { data: null, error: erro }
      const filtradas = armazem(tabela).filter((l) => predicados.every((p) => p(l)))
      const recorte = filtradas.slice(de, ate === Number.POSITIVE_INFINITY ? undefined : ate + 1)
      return { data: recorte.map((l) => projetar(l, select)), error: null }
    }

    const chain: Cadeia = {
      select(colunas?: string) {
        select = typeof colunas === "string" ? colunas : null
        return chain
      },
      eq(coluna, valor) {
        predicados.push((linha) => linha[coluna] === valor)
        return chain
      },
      neq(coluna, valor) {
        predicados.push((linha) => linha[coluna] !== valor)
        return chain
      },
      in(coluna, valores) {
        predicados.push((linha) => valores.includes(linha[coluna]))
        return chain
      },
      is(coluna, valor) {
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
      upsert(linhas) {
        escrita = { operacao: "upsert", linhas: Array.isArray(linhas) ? linhas : [linhas] }
        return chain
      },
      insert(linhas) {
        escrita = { operacao: "insert", linhas: Array.isArray(linhas) ? linhas : [linhas] }
        return chain
      },
      update(patch) {
        escrita = { operacao: "update", linhas: [patch] }
        return chain
      },
      maybeSingle: async () => {
        const r = resolver()
        return { data: r.data?.[0] ?? null, error: r.error }
      },
      single: async () => {
        const r = resolver()
        return { data: r.data?.[0] ?? null, error: r.error }
      },
      // biome-ignore lint/suspicious/noThenProperty: o `PostgrestFilterBuilder` real é um thenable — resolver antes do `await` perderia os filtros aplicados depois de `.range()`.
      then(aoResolver: (r: Resposta) => unknown) {
        return Promise.resolve(resolver()).then(aoResolver)
      },
    }
    return chain
  }

  return {
    db: { from },
    gravacoes,
    linhasDe: (tabela: string) => (tabelas[tabela] ?? []).map((l) => ({ ...l })),
  }
}
