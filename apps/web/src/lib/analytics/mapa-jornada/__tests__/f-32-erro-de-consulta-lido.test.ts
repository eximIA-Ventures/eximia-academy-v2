import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { entradaBase, semComentarios } from "./contrato"

/**
 * F-32 · I-4 — falha de leitura vira ESTADO, nunca tela limpa.
 *
 * Duas metades, as duas obrigatórias pelo contrato:
 *
 *  A) VARREDURA ESTÁTICA. `const { data } = await ...` compila, roda e devolve
 *     `null` em silêncio: `supabase-js` devolve `{data,error}` em vez de lançar,
 *     então o `error.tsx` do App Router nunca dispara e falha de banco vira
 *     tela limpa apresentada como fato (achado A-1 da auditoria, 16 páginas).
 *     Nenhum teste de runtime pega isso sem um mock que já pressupõe a forma da
 *     chamada — por isso aqui se lê o código-fonte.
 *
 *  B) COMPORTAMENTO. `erro` ≠ `vazio`, e falha PARCIAL não apaga a tela: só
 *     `cursos` (R3) falhando derruba `Gargalos` e deixa matriz, distribuição e
 *     funil em `ok`. Um "erro" que apaga tudo é tão errado quanto um que some.
 *
 * ANTI-VACUIDADE: o grep fica verde num diretório vazio ou num módulo que não
 *   lê banco nenhum. Daí o piso de arquivos e o piso de leituras.
 * DETECTOR: a regex é testada contra violação plantada E contra prosa de
 *   comentário — um detector que acusa quem documenta a regra ensina a apagar a
 *   documentação para ficar verde (regressão real medida em 2026-08-16).
 *
 * Fonte: CONTRATO-mapa.md F-32 · INVARIANTES.md I-4.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const DIR_CAMADA = resolve(AQUI, "..")
const RAIZ_APP = resolve(AQUI, "../../../../..") // apps/web
const DIR_COMPONENTES = resolve(RAIZ_APP, "src/components/analytics/mapa-jornada")

/**
 * PISO de leituras. Não é arbitrário: o CONTRATO-mapa enumera OITO leituras
 * base (R1..R8) e nenhuma delas é opcional — sem `chapter_view_progress` não há
 * célula verde, sem `chapter_slides` não há denominador, sem `sessions` não há
 * "Parado há". Abaixo de oito, a camada não está lendo o que a tela afirma.
 */
const MINIMO_LEITURAS_SUPABASE = 8

/** Desestruturação de `data` sem `error` no mesmo padrão. */
const RE_DESESTRUTURACAO = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await/g

/** Chamada de leitura ao PostgREST: `.from(` de tabela ou `.rpc(`. */
const RE_LEITURA = /\.(?:from|rpc)\s*\(/g

interface Arquivo {
  relativo: string
  /** Fonte JÁ SEM COMENTÁRIOS — ver `semComentarios` em `contrato.ts`. */
  fonte: string
}

function listarArquivos(raiz: string): Arquivo[] {
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
        relativo: relative(RAIZ_APP, caminho),
        fonte: semComentarios(readFileSync(caminho, "utf8")),
      })
    }
  }
  andar(raiz)
  return out
}

function violacoesDe(arquivo: Arquivo): string[] {
  const out: string[] = []
  RE_DESESTRUTURACAO.lastIndex = 0
  let m: RegExpExecArray | null = RE_DESESTRUTURACAO.exec(arquivo.fonte)
  while (m !== null) {
    const dentro = m[1] ?? ""
    if (/\bdata\b/.test(dentro) && !/\berror\b/.test(dentro)) {
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

/** Constrói a fonte da fixture e injeta falha nas chaves informadas. */
async function calcularComFalhaEm(chaves: readonly string[]) {
  const mod = (await import("../index")) as typeof import("../index")
  const fonte = mod.fonteDaEntradaMapa(entradaBase())
  const falhas = { ...fonte.falhas } as Record<string, { codigo: string; mensagem: string } | null>
  for (const chave of chaves) {
    falhas[chave] = { codigo: chave.toUpperCase(), mensagem: "falha simulada de leitura" }
  }
  return mod.montarMapaJornada(
    { ...fonte, falhas: falhas as typeof fonte.falhas },
    { cursoFiltroNome: null },
  )
}

describe("F-32 · falha de leitura vira estado, nunca tela limpa", () => {
  const daCamada = listarArquivos(DIR_CAMADA)
  const daTela = [...daCamada, ...listarArquivos(DIR_COMPONENTES)]

  it("ANTI-VACUIDADE — a camada de dados existe com pelo menos um arquivo", () => {
    expect(
      daCamada.map((a) => a.relativo),
      "nenhum .ts fora de __tests__: o grep de I-4 ficaria verde sobre o vazio",
    ).not.toHaveLength(0)
  })

  it("INVARIÂNCIA — nenhuma desestruturação de `data` sem `error`, na camada e na UI", () => {
    const violacoes = daTela.flatMap(violacoesDe)
    expect(
      violacoes,
      "supabase-js devolve {data,error} em vez de lançar: sem `error`, falha de " +
        "banco vira tela limpa apresentada como fato",
    ).toEqual([])
  })

  it("ANTI-VACUIDADE — a camada faz pelo menos as 8 leituras base (R1..R8)", () => {
    const total = daCamada.reduce((soma, a) => soma + contarLeituras(a), 0)
    const detalhe = daCamada
      .filter((a) => contarLeituras(a) > 0)
      .map((a) => `${a.relativo}: ${contarLeituras(a)}`)
      .join(" · ")
    expect(
      total,
      `apenas ${total} leitura(s) (.from/.rpc) — piso é ${MINIMO_LEITURAS_SUPABASE}. ${detalhe}`,
    ).toBeGreaterThanOrEqual(MINIMO_LEITURAS_SUPABASE)
  })

  it("COBERTURA — todo arquivo que lê Supabase menciona `error`", () => {
    const mudos = daTela
      .filter((a) => contarLeituras(a) > 0 && !/\berror\b/.test(a.fonte))
      .map((a) => a.relativo)
    expect(mudos, "arquivo com leitura de Supabase e nenhuma menção a `error`").toEqual([])
  })

  it("DETECTOR — a regex acusa violação plantada e absolve a forma correta", () => {
    const plantado: Arquivo = {
      relativo: "(sintetico)",
      fonte: semComentarios(
        [
          'const { data } = await db.from("users").select("id")',
          'const { data: linhas } = await db.from("sessions").select("id")',
          'const { data: ok, error: erro } = await db.from("courses").select("id")',
        ].join("\n"),
      ),
    }
    expect(violacoesDe(plantado)).toHaveLength(2)
    expect(contarLeituras(plantado)).toBe(3)
  })

  it("DETECTOR — a prosa de um comentário NÃO conta como violação", () => {
    const documentado: Arquivo = {
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
    expect(documentado.fonte).toContain("https://supabase.com/docs")
  })

  it("INVARIÂNCIA — falha em R6 põe os blocos dependentes em `erro`, não em `vazio`", async () => {
    const r = await calcularComFalhaEm(["percorrido"])

    for (const [nome, bloco] of [
      ["mapa", r.mapa],
      ["distribuicao", r.distribuicao],
      ["funil", r.funil],
      ["gargalos", r.gargalos],
      ["insights", r.insights],
    ] as const) {
      expect(bloco.estado, `${nome} deveria estar em erro`).toBe("erro")
      expect(bloco.erro, `${nome} sem objeto de falha`).not.toBeNull()
      expect(
        bloco.motivoVazio,
        `${nome}: erro não é vazio, e não pode ter motivo de ausência`,
      ).toBeNull()
    }

    // Nenhum numeral parcial: o bloco em erro não publica contagem nenhuma.
    expect(r.mapa.linhas).toHaveLength(0)
    expect(r.distribuicao.tiles).toHaveLength(0)
    expect(r.funil.linhas).toHaveLength(0)
  })

  it("VARIÂNCIA — falha só em R3 derruba `Gargalos` e deixa o resto em `ok`", async () => {
    const r = await calcularComFalhaEm(["cursos"])

    // `cursos` alimenta o prazo que define "atrasado", e só `Gargalos` declara
    // depender dela. Um "erro" que apagasse a tela inteira seria tão errado
    // quanto um que sumisse.
    expect(r.gargalos.estado).toBe("erro")
    expect(r.mapa.estado).toBe("ok")
    expect(r.distribuicao.estado).toBe("ok")
    expect(r.funil.estado).toBe("ok")
    expect(r.mapa.linhas.length).toBeGreaterThan(0)
  })

  it("VARIÂNCIA — sem falha nenhuma, nada sai em `erro`", async () => {
    const r = await calcularComFalhaEm([])
    const estados = [r.mapa, r.gargalos, r.distribuicao, r.funil, r.insights].map((b) => b.estado)
    expect(estados, "a fixture canônica não pode nascer em erro").not.toContain("erro")
    expect(r.estado).toBe("ok")
  })

  it("DISCRIMINANTE — `erro` e `vazio` não colapsam no mesmo estado", async () => {
    const comFalha = await calcularComFalhaEm(["percorrido"])
    const semDado = await calcularComFalhaEm([])

    expect(comFalha.mapa.estado).not.toBe(semDado.mapa.estado)
    expect(comFalha.mapa.textoVazio).not.toBe(semDado.mapa.textoVazio)
  })
})
