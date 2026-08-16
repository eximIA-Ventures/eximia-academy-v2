import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  carregarModulo,
  chamar,
  coletarStrings,
  detectarChavesLgpd,
  diasAtras,
  entradaBase,
  esvaziarPeriodoAnterior,
  resolverExport,
  semComentarios,
} from "./contrato"

/**
 * I-7 · O gate de LGPD sobrevive à reescrita.
 *
 * INVARIÂNCIA (testes 2 e 3): em NENHUM estado de fixture (ok, vazio de cada
 *   um dos quatro blocos) o objeto retornado carrega texto de reflexão,
 *   avaliação de competência ou interpretação psicológica.
 * VARIÂNCIA: não se aplica ao valor — a ausência tem que valer sempre. O que
 *   substitui a variância é a ANTI-VACUIDADE em dois níveis:
 *   • teste 1: o objeto de saída TEM conteúdo textual de verdade, senão a
 *     ausência seria a de um objeto vazio;
 *   • teste 5: o detector acusa uma violação PLANTADA, senão um detector
 *     quebrado aprovaria qualquer coisa.
 * ESTÁTICO (teste 4): a camada de dados não SELECIONA coluna de conteúdo de
 *   `slide_reflections`. Ler o carimbo de tempo da reflexão é legítimo; trazer
 *   o texto para dentro do processo já é o vazamento, mesmo que não renderize.
 *
 * Fonte: INVARIANTES.md I-7 · SPEC-FUNCIONAL.md §30 · analytics/page.tsx:104.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const DIR_CAMADA = resolve(AQUI, "..")
const RAIZ_APP = resolve(AQUI, "../../../../..")

/** Colunas de CONTEÚDO de reflexão. `created_at`/`updated_at`/ids são legítimos. */
const COLUNAS_CONTEUDO =
  /\b(content|body|answer|answer_text|texto|text|resposta|reflection_text|transcript)\b/

async function calcular(entrada: EntradaVisaoGeral): Promise<Record<string, unknown>> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: EntradaVisaoGeral) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar<Record<string, unknown>>(fn, entrada)
}

function arquivosDaCamada(): Array<{ relativo: string; fonte: string }> {
  const out: Array<{ relativo: string; fonte: string }> = []
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
        if (nome !== "__tests__" && nome !== "node_modules") andar(caminho)
        continue
      }
      if (!/\.(ts|tsx)$/.test(nome) || /\.(test|spec)\.tsx?$/.test(nome)) continue
      out.push({
        relativo: relative(RAIZ_APP, caminho),
        // Sem comentários: a prosa que EXPLICA o gate não pode reprovar o gate.
        fonte: semComentarios(readFileSync(caminho, "utf8")),
      })
    }
  }
  andar(DIR_CAMADA)
  return out
}

/** Todos os estados de fixture relevantes, incluindo os quatro vazios da §32. */
async function todosOsEstados(): Promise<Array<{ nome: string; saida: Record<string, unknown> }>> {
  const base = entradaBase()
  const comAcionamento: EntradaVisaoGeral = {
    ...base,
    acionamentos: [
      { recipientId: "P3", sentAt: diasAtras(9), sentByManager: "G1" },
      { recipientId: "P5", sentAt: diasAtras(4), sentByManager: "G1" },
    ],
  }
  const semNinguem: EntradaVisaoGeral = { ...base, escopo: [], alunos: [], atividades: [] }

  return [
    { nome: "ok/completo", saida: await calcular(comAcionamento) },
    { nome: "vazio/acionamentos", saida: await calcular({ ...base, acionamentos: [] }) },
    { nome: "vazio/tendência", saida: await calcular(esvaziarPeriodoAnterior(base)) },
    { nome: "recorte vazio", saida: await calcular(semNinguem) },
  ]
}

describe("I-7 · o gate de LGPD sobrevive à reescrita", () => {
  it("ANTI-VACUIDADE — o objeto de saída tem conteúdo textual de verdade", async () => {
    const saida = await calcular(entradaBase())
    const strings = coletarStrings(saida)

    // Sem isto, "nenhuma chave de reflexão" seria satisfeito por `{}`.
    expect(
      strings.length,
      "objeto de saída sem nenhuma string: a ausência de conteúdo protegido seria vacuosa",
    ).toBeGreaterThan(10)
  })

  it("INVARIÂNCIA — nenhum estado de fixture expõe reflexão, competência ou psicologia", async () => {
    for (const { nome, saida } of await todosOsEstados()) {
      const violacoes = detectarChavesLgpd(saida)
      expect(
        violacoes.map((v) => `${v.caminho}: ${v.detalhe}`),
        `estado "${nome}" carrega conteúdo protegido pela §30`,
      ).toEqual([])
    }
  })

  it("INVARIÂNCIA — nenhuma string de saída parece transcrição de reflexão", async () => {
    for (const { nome, saida } of await todosOsEstados()) {
      const suspeitas = coletarStrings(saida).filter(
        ({ texto }) => texto.length > 180 && /\s/.test(texto),
      )
      expect(
        suspeitas.map((s) => `${s.caminho} (${s.texto.length} chars)`),
        `estado "${nome}": string longa demais para rótulo, curta demais para não ser texto livre`,
      ).toEqual([])
    }
  })

  it("ESTÁTICO — a camada não seleciona coluna de conteúdo de slide_reflections", () => {
    const violacoes: string[] = []
    for (const { relativo, fonte } of arquivosDaCamada()) {
      // Recorta o trecho entre `.from("slide_reflections")` e o `.select(...)`
      // seguinte, e olha só o que está sendo pedido ao PostgREST.
      const re = /slide_reflections[\s\S]{0,200}?\.select\(\s*["'`]([^"'`]*)["'`]/g
      let m: RegExpExecArray | null = re.exec(fonte)
      while (m !== null) {
        const colunas = m[1] ?? ""
        if (COLUNAS_CONTEUDO.test(colunas)) {
          violacoes.push(`${relativo} → select("${colunas}")`)
        }
        m = re.exec(fonte)
      }
    }
    expect(
      violacoes,
      "trazer o texto da reflexão para o processo já é o vazamento, mesmo sem renderizar",
    ).toEqual([])
  })

  it("DETECTOR — o detector acusa uma violação plantada", () => {
    const plantado = {
      sinais: {
        itens: [
          { id: "S1", primeiroNome: "Artur", texto: "Artur está há 14 dias sem acessar." },
          {
            id: "S2",
            primeiroNome: "Cintia",
            textoReflexao: "Hoje percebi que meu maior medo é...",
          },
        ],
      },
      resumo: { avaliacaoDeCompetencia: 3 },
    }

    const violacoes = detectarChavesLgpd(plantado)
    const caminhos = violacoes.map((v) => v.caminho)

    expect(caminhos).toContain("sinais.itens[1].textoReflexao")
    expect(caminhos).toContain("resumo.avaliacaoDeCompetencia")
    // E não pode acusar o que é legítimo: `texto` de sinal é rótulo da tela.
    expect(caminhos).not.toContain("sinais.itens[0].texto")
  })
})
