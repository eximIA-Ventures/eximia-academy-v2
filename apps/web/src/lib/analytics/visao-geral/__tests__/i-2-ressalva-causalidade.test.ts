import { describe, expect, it } from "vitest"
import {
  type EntradaVisaoGeral,
  NOMES_ENTRADA_PRINCIPAL,
  RESSALVA_CAUSALIDADE,
  carregarModulo,
  chamar,
  coletarStrings,
  diasAtras,
  entradaBase,
  resolverExport,
} from "./contrato"

/**
 * I-2 · A ressalva de causalidade é texto obrigatório, não decoração.
 *
 * INVARIÂNCIA (testes 1, 2 e 3): a string literal da §12 está no objeto de
 *   saída, num campo de TEXTO RENDERIZADO, em TODO estado do bloco (ok, vazio
 *   e erro). É invariante puro: nenhuma entrada pode fazê-la sumir.
 * VARIÂNCIA: não se aplica — o valor deve ser constante por definição. O que
 *   substitui a variância aqui é o teste 4 (ANTI-VACUIDADE): a asserção é de
 *   igualdade LITERAL byte a byte, então uma string vazia, um placeholder ou
 *   uma paráfrase reprovam. E o teste 5 prova que a ressalva não está escondida
 *   atrás de chave de tooltip/hover.
 *
 * Fonte: INVARIANTES.md I-2 · SPEC-FUNCIONAL.md §12 · fixture.ts §11.
 */

interface Resposta {
  estado?: string
  disclaimer?: string
  [k: string]: unknown
}

interface Resultado {
  resposta: Resposta
}

async function calcular(entrada: EntradaVisaoGeral): Promise<Resultado> {
  const mod = await carregarModulo()
  const fn = resolverExport<(e: EntradaVisaoGeral) => unknown>(
    mod,
    "entrada principal da Visão geral",
    NOMES_ENTRADA_PRINCIPAL,
  )
  return chamar<Resultado>(fn, entrada)
}

/** Onde a ressalva pode legitimamente estar: campo de texto renderizado. */
const CHAVES_RENDERIZADAS = ["disclaimer", "ressalva", "nota", "notaRodape", "observacao"]

/** Onde ela NÃO pode estar sozinha: I-2 exige visível sem hover. */
const CHAVES_ESCONDIDAS = /tooltip|hover|title|aria|ajuda|help|popover/i

describe("I-2 · ressalva de causalidade é texto obrigatório", () => {
  it("INVARIÂNCIA — a ressalva da §12 aparece com acionamentos no período", async () => {
    const base = entradaBase()
    const { resposta } = await calcular({
      ...base,
      acionamentos: [
        { recipientId: "P3", sentAt: diasAtras(9), sentByManager: "G1" },
        { recipientId: "P5", sentAt: diasAtras(4), sentByManager: "G1" },
      ],
    })

    const valores = CHAVES_RENDERIZADAS.map((k) => resposta[k]).filter(
      (v): v is string => typeof v === "string",
    )
    expect(valores).toContain(RESSALVA_CAUSALIDADE)
  })

  it("INVARIÂNCIA — a ressalva sobrevive ao estado VAZIO do bloco", async () => {
    // Sem acionamento nenhum o bloco cai no vazio da §32. A ressalva continua,
    // porque ela qualifica o bloco, não o número.
    const { resposta } = await calcular({ ...entradaBase(), acionamentos: [] })

    const textos = coletarStrings(resposta).map((s) => s.texto)
    expect(textos).toContain(RESSALVA_CAUSALIDADE)
  })

  it("INVARIÂNCIA — a ressalva aparece em qualquer volume de acionamento", async () => {
    const base = entradaBase()
    const volumes = [1, 3, 6]
    for (const n of volumes) {
      const acionamentos = Array.from({ length: n }, (_, i) => ({
        recipientId: `P${(i % 5) + 1}`,
        sentAt: diasAtras(3 + i),
        sentByManager: "G1",
      }))
      const { resposta } = await calcular({ ...base, acionamentos })
      const textos = coletarStrings(resposta).map((s) => s.texto)
      expect(textos, `volume ${n}`).toContain(RESSALVA_CAUSALIDADE)
    }
  })

  it("ANTI-VACUIDADE — a comparação é literal, acento e pontuação final incluídos", async () => {
    const { resposta } = await calcular(entradaBase())
    const textos = coletarStrings(resposta).map((s) => s.texto)
    const encontrada = textos.find((t) => t.includes("comprovação causal"))

    expect(
      encontrada,
      "nenhuma string do bloco menciona 'comprovação causal' — a ressalva sumiu",
    ).toBeDefined()
    // Igualdade estrita: paráfrase ("não prova causa") reprova de propósito.
    expect(encontrada).toBe(RESSALVA_CAUSALIDADE)
    expect(RESSALVA_CAUSALIDADE.endsWith(".")).toBe(true)
  })

  it("ANTI-VACUIDADE — a ressalva não pode existir SÓ em chave de tooltip/hover", async () => {
    const { resposta } = await calcular(entradaBase())
    const ocorrencias = coletarStrings(resposta).filter((s) => s.texto === RESSALVA_CAUSALIDADE)

    expect(ocorrencias.length).toBeGreaterThan(0)
    const visiveis = ocorrencias.filter((o) => !CHAVES_ESCONDIDAS.test(o.caminho))
    expect(
      visiveis.map((v) => v.caminho),
      `a ressalva só aparece em ${ocorrencias.map((o) => o.caminho).join(", ")} — I-2 exige texto renderizado, sem hover`,
    ).not.toHaveLength(0)
  })
})
