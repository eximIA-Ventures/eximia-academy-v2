import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { semComentarios } from "./contrato"

/**
 * I-4 · O erro da consulta é lido, não descartado.
 *
 * Este é o único invariante verificado por LEITURA DE CÓDIGO-FONTE, não por
 * execução: `const { data } = await ...` compila, roda e devolve `null` em
 * silêncio. Nenhum teste de runtime pega isso sem um mock que já pressupõe a
 * forma da chamada.
 *
 * INVARIÂNCIA (teste 2): zero desestruturações de `data` sem `error` ao lado
 *   nos arquivos que a run criou.
 * ANTI-VACUIDADE (testes 1 e 3): esta é a armadilha central deste arquivo —
 *   um grep por violação fica VERDE num módulo que não lê banco nenhum. Por
 *   isso o teste 1 exige que a camada exista com pelo menos um arquivo, e o
 *   teste 3 impõe um PISO de leituras de Supabase. Sem o piso, a Visão geral
 *   poderia continuar sendo a casca que é hoje e este invariante aplaudiria.
 * COBERTURA (teste 4): todo arquivo que lê Supabase menciona `error`.
 * DETECTOR (teste 5): a própria regex é testada contra uma violação plantada,
 *   para não passar por estar quebrada.
 *
 * Fonte: INVARIANTES.md I-4 · achado A-1 da auditoria de 2026-08-15.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const DIR_CAMADA = resolve(AQUI, "..")
const RAIZ_APP = resolve(AQUI, "../../../../..") // apps/web

/**
 * PISO de leituras. Justificativa medida, não arbitrária: o contrato do Placar
 * enumera SEIS leituras paginadas só para os 5 indicadores (roster, sessions,
 * slide_reflections, enrollments, courses e as tabelas de participação). Os
 * blocos "Resposta aos acionamentos" (notifications) e "Sinais fora do padrão"
 * somam mais. Seis é o mínimo defensável abaixo do qual a tela não pode estar
 * funcional — e é exatamente o número que separa "camada de dados" de "casca".
 */
const MINIMO_LEITURAS_SUPABASE = 6

/** Desestruturação de `data` sem `error` no mesmo padrão. */
const RE_DESESTRUTURACAO = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await/g

/** Chamada de leitura ao PostgREST: `.from(` de tabela ou `.rpc(`. */
const RE_LEITURA = /\.(?:from|rpc)\s*\(/g

interface Arquivo {
  caminho: string
  relativo: string
  /** Fonte JÁ SEM COMENTÁRIOS — ver `semComentarios` em `contrato.ts`. */
  fonte: string
}

function listarArquivosDaRun(): Arquivo[] {
  const out: Arquivo[] = []
  const andar = (dir: string): void => {
    let entradas: string[]
    try {
      entradas = readdirSync(dir)
    } catch {
      return
    }
    for (const nome of entradas) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        if (nome === "__tests__" || nome === "node_modules") continue
        andar(caminho)
        continue
      }
      if (!/\.(ts|tsx)$/.test(nome)) continue
      if (/\.(test|spec)\.tsx?$/.test(nome)) continue
      out.push({
        caminho,
        relativo: relative(RAIZ_APP, caminho),
        fonte: semComentarios(readFileSync(caminho, "utf8")),
      })
    }
  }
  andar(DIR_CAMADA)
  return out
}

function violacoesDe(arquivo: Arquivo): string[] {
  const out: string[] = []
  RE_DESESTRUTURACAO.lastIndex = 0
  let m: RegExpExecArray | null = RE_DESESTRUTURACAO.exec(arquivo.fonte)
  while (m !== null) {
    const dentro = m[1] ?? ""
    const temData = /\bdata\b/.test(dentro)
    const temError = /\berror\b/.test(dentro)
    if (temData && !temError) {
      const linha = arquivo.fonte.slice(0, m.index).split("\n").length
      out.push(`${arquivo.relativo}:${linha} → const {${dentro.trim()}} = await ...`)
    }
    m = RE_DESESTRUTURACAO.exec(arquivo.fonte)
  }
  return out
}

function contarLeituras(arquivo: Arquivo): number {
  RE_LEITURA.lastIndex = 0
  return (arquivo.fonte.match(RE_LEITURA) ?? []).length
}

describe("I-4 · o erro da consulta é lido, não descartado", () => {
  const arquivos = listarArquivosDaRun()

  it("ANTI-VACUIDADE — a camada de dados existe com pelo menos um arquivo", () => {
    expect(
      arquivos.map((a) => a.relativo),
      `nenhum arquivo .ts em ${relative(RAIZ_APP, DIR_CAMADA)} (fora de __tests__) — o grep de I-4 ficaria verde por vacuidade sobre um diretório vazio`,
    ).not.toHaveLength(0)
  })

  it("INVARIÂNCIA — nenhuma desestruturação de `data` sem `error` ao lado", () => {
    const violacoes = arquivos.flatMap(violacoesDe)
    expect(
      violacoes,
      "supabase-js devolve {data,error} em vez de lançar: sem `error`, o error.tsx " +
        "nunca dispara e falha de banco vira tela limpa apresentada como fato",
    ).toEqual([])
  })

  it("ANTI-VACUIDADE — o módulo faz pelo menos 6 leituras de Supabase", () => {
    const total = arquivos.reduce((soma, a) => soma + contarLeituras(a), 0)
    const detalhe = arquivos.map((a) => `${a.relativo}: ${contarLeituras(a)}`).join(" · ")
    expect(
      total,
      `apenas ${total} leitura(s) (.from/.rpc) na camada — piso é ${MINIMO_LEITURAS_SUPABASE}. ` +
        `Distribuição: ${detalhe}. Uma tela que não lê banco passa em I-4 sem mérito.`,
    ).toBeGreaterThanOrEqual(MINIMO_LEITURAS_SUPABASE)
  })

  it("COBERTURA — todo arquivo que lê Supabase menciona `error`", () => {
    const mudos = arquivos
      .filter((a) => contarLeituras(a) > 0 && !/\berror\b/.test(a.fonte))
      .map((a) => a.relativo)
    expect(mudos, "arquivo com leitura de Supabase e nenhuma menção a `error`").toEqual([])
  })

  it("DETECTOR — a regex acusa uma violação plantada", () => {
    const plantado: Arquivo = {
      caminho: "(sintetico)",
      relativo: "(sintetico)",
      fonte: semComentarios(
        [
          'const { data } = await db.from("users").select("id")',
          'const { data: linhas } = await db.from("sessions").select("id")',
          'const { data: ok, error: erro } = await db.from("courses").select("id")',
        ].join("\n"),
      ),
    }
    const violacoes = violacoesDe(plantado)

    // As duas primeiras são violação; a terceira é a forma correta e não pode
    // ser acusada. Detector que não morde, ou que morde tudo, reprova aqui.
    expect(violacoes).toHaveLength(2)
    expect(contarLeituras(plantado)).toBe(3)
  })

  it("DETECTOR — a prosa de um comentário NÃO conta como violação", () => {
    // Regressão medida em 2026-08-16: o detector acusou fonte-supabase.ts:6,
    // que era o comentário explicando por que o padrão é proibido.
    const documentado: Arquivo = {
      caminho: "(sintetico)",
      relativo: "(sintetico)",
      fonte: semComentarios(
        [
          "// I-4: nunca escrever `const { data } = await ...` — engole a falha.",
          "/* Bloco: const { data } = await algo() também não vale aqui. */",
          'const { data: linhas, error } = await db.from("sessions").select("id")',
          'const docs = "https://supabase.com/docs"',
        ].join("\n"),
      ),
    }

    expect(violacoesDe(documentado)).toEqual([])
    expect(contarLeituras(documentado)).toBe(1)
    // A barra dupla de uma URL em CÓDIGO não pode ser tratada como comentário.
    expect(documentado.fonte).toContain("https://supabase.com/docs")
  })
})
