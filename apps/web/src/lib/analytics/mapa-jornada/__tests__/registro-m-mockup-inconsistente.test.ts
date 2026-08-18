import { entradaMapaFixture } from "@/components/analytics/mapa-jornada/fixture"
import { computeMapaJornada } from "@/lib/analytics/mapa-jornada"
import { describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// REGISTRO — não é contrato. O denominador continua 35 (regra 4 do
// CONTRATO-mapa.md: achado novo vira nota no contrato mais próximo ou vai para
// a escalação, e NÃO abre `F-36`). O nome do arquivo não é `f-NN` de propósito:
// nenhum placar deve confundir isto com um 36º contrato aprovado.
//
// POR QUE ELE EXISTE. A régua visual `CRITERIOS-mapa.md` V-33 exige, na MESMA
// linha, coisas que nenhum conjunto de dados satisfaz simultaneamente sob as
// fórmulas do CONTRATO-mapa.md. A rodada 1 registrou isso em prosa (M-1, M-2)
// e a rodada 2 recebeu a mesma cobrança de volta. Prosa não sobrevive a uma
// troca de rodada; teste sobrevive. Aqui a impossibilidade vira aritmética
// executável, para a próxima rodada não gastar o orçamento redescobrindo-a — e
// para que, se alguém "consertar" a fixture rumo ao mockup, o teste caia e
// mostre exatamente qual outra coluna quebrou junto.
//
// O que este arquivo NÃO faz: não afrouxa nenhum contrato, não muda nenhuma
// fórmula, não altera a régua. Ele mede a fixture do preview (a única coisa que
// o crítico cego fotografa) e prova três teoremas sobre ela.
// ---------------------------------------------------------------------------

/** Os números do PNG de referência, transcritos, para o teste ter o alvo à mão. */
const MOCKUP = {
  roster: 40,
  tiles: { concluidos: 12, emAndamento: 16, travados: 8, naoIniciados: 4 },
  gargalos: [16, 13, 9, 6, 5],
  conversao: [90, 83, 75, 60, 45, 30, 20],
  concluiram: [36, 33, 30, 24, 18, 12, 8],
  iniciaram: [38, 37, 35, 32, 27, 20, 16],
} as const

function render() {
  return computeMapaJornada(entradaMapaFixture())
}

describe("REGISTRO M-1 · a série de gargalos do mockup não cabe no roster que o próprio mockup declara", () => {
  it("PROVA — a soma dos 5 gargalos do PNG (49) excede o teto de pessoas elegíveis (24)", () => {
    const { roster, tiles, gargalos } = MOCKUP

    // F-08: entra no gargalo quem tem o módulo corrente bloqueado E está
    // parado/atrasado. Quem concluiu tudo não tem módulo corrente; quem nunca
    // iniciou é `nao_iniciado`. Logo o teto é o resto do roster.
    const tetoElegivel = roster - tiles.concluidos - tiles.naoIniciados
    expect(tetoElegivel).toBe(24)

    // Cada pessoa entra em NO MÁXIMO um módulo (o primeiro não concluído), então
    // a soma sobre módulos é limitada pelo teto — não pode ser contornada por
    // distribuição nenhuma.
    const somaMockup = gargalos.reduce((a, b) => a + b, 0)
    expect(somaMockup).toBe(49)
    expect(somaMockup).toBeGreaterThan(tetoElegivel)
  })

  it("PROVA — mesmo isolado, o topo `16` estoura o orçamento de 5 linhas decrescentes + 6º módulo", () => {
    // V-19 pede 5 linhas, V-21 pede comprimento estritamente decrescente (logo
    // valores distintos), V-30 pede o link `Ver todos os módulos ›`, que só
    // existe com um 6º módulo elegível (F-10). Seis inteiros positivos
    // distintos, o maior igual a 16, custam no mínimo:
    const custoMinimoComTopo16 = 16 + 5 + 4 + 3 + 2 + 1
    expect(custoMinimoComTopo16).toBe(31)
    expect(custoMinimoComTopo16).toBeGreaterThan(24)
  })

  it("VARIÂNCIA — o teto se move quando os tiles se movem (não é constante disfarçada de teorema)", () => {
    const tetoComOsTilesDoMockup = 40 - 12 - 4
    const tetoSemConcluidos = 40 - 0 - 4
    expect(tetoComOsTilesDoMockup).toBe(24)
    expect(tetoSemConcluidos).toBe(36)
    // E nem assim 49 caberia: a impossibilidade não depende dos tiles.
    expect(tetoSemConcluidos).toBeLessThan(49)
  })

  it("A FIXTURE OPERA NO TETO — 5 gargalos distintos, decrescentes, somando com o 6º exatamente 24", () => {
    const r = render()
    expect(r.gargalos.estado).toBe("ok")

    const valores = r.gargalos.linhas.map((l) => l.pessoas)
    expect(valores).toEqual([8, 6, 4, 3, 2])

    // Estritamente decrescente (V-21) e coerente com o roster (V-33).
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]).toBeLessThan(valores[i - 1] as number)
    }
    for (const l of r.gargalos.linhas) {
      expect(l.pct).toBe(Math.round((l.pessoas / MOCKUP.roster) * 100))
    }

    // O 6º módulo elegível existe (é o que faz o link do rodapé aparecer), e
    // 8+6+4+3+2+1 = 24 é literalmente o teto provado acima: não sobra pessoa.
    expect(r.gargalos.linkRodape).not.toBeNull()
    expect(valores.reduce((a, b) => a + b, 0) + 1).toBe(24)
  })
})

describe("REGISTRO M-2 · o fim da coluna Conversão e o tile Concluídos são o MESMO número", () => {
  it("PROVA — Conversão(último módulo) ≡ tile Concluídos ÷ roster, num curso único", () => {
    const r = render()
    const ultima = r.funil.linhas[r.funil.linhas.length - 1]
    const tileConcluidos = r.distribuicao.tiles.find((t) => t.id === "concluidos")

    // Identidade estrutural, não coincidência: F-12 (linha inteira verde) num
    // curso de 7 módulos é exatamente F-24 aplicado ao módulo 7, porque o piso
    // cumulativo por evidência pinta 1..6 de quem tem evidência no 7.
    expect(ultima?.concluiram).toBe(tileConcluidos?.valor)
    expect(ultima?.conversaoPct).toBe(tileConcluidos?.pct)

    // Consequência: V-33 pede `12 (30%)` no tile e `20%` no fim do funil. Os
    // dois lados da mesma linha da régua exigem v₇ = 12 e v₇ = 8 ao mesmo tempo.
    expect(MOCKUP.tiles.concluidos).not.toBe(MOCKUP.concluiram[6])
    expect(MOCKUP.conversao[6]).toBe(Math.round((MOCKUP.concluiram[6] / MOCKUP.roster) * 100))
  })

  it("A FIXTURE HONRA O TILE — 12 (30%) nos três lugares em que o mesmo 12 aparece", () => {
    const r = render()
    const tile = r.distribuicao.tiles.find((t) => t.id === "concluidos")
    const insight = r.insights.itens.find((i) => i.id === "concluiu")

    expect(tile?.valor).toBe(12)
    expect(tile?.pct).toBe(30)
    expect(insight?.texto).toContain("30%")
    expect(r.funil.linhas[6]?.conversaoLabel).toBe("30%")
  })
})

describe("REGISTRO M-4 · a coluna Iniciaram do mockup não é alcançável nem no primeiro módulo", () => {
  it("PROVA — Iniciaram(1) ≤ roster − não iniciados, e o mockup pede 38 de um teto de 36", () => {
    expect(MOCKUP.iniciaram[0]).toBe(38)
    expect(MOCKUP.roster - MOCKUP.tiles.naoIniciados).toBe(36)
    expect(MOCKUP.iniciaram[0]).toBeGreaterThan(MOCKUP.roster - MOCKUP.tiles.naoIniciados)
  })

  it("A FIXTURE OBEDECE A IDENTIDADE DO PISO — Iniciaram(m) = Concluíram(m−1)", () => {
    const r = render()
    const l = r.funil.linhas
    expect(l.length).toBe(7)
    for (let m = 1; m < l.length; m++) {
      expect(l[m]?.iniciaram, `módulo ${m + 1}`).toBe(l[m - 1]?.concluiram)
    }
    // E o mockup não obedece em nenhuma linha — por isso a coluna nunca baterá.
    for (let m = 1; m < MOCKUP.iniciaram.length; m++) {
      expect(MOCKUP.iniciaram[m]).not.toBe(MOCKUP.concluiram[m - 1])
    }
  })
})

describe("REGISTRO · o ótimo alcançado nesta rodada, e a variância que prova que ele é lido", () => {
  it("INVARIÂNCIA — a fixture bate o mockup em 90%, 75% e 60%, e o resto é o teto provado", () => {
    const r = render()
    const conversao = r.funil.linhas.map((l) => l.conversaoPct)
    const concluiram = r.funil.linhas.map((l) => l.concluiram)

    expect(conversao).toEqual([90, 80, 75, 60, 53, 33, 30])
    expect(concluiram).toEqual([36, 32, 30, 24, 21, 13, 12])

    // Três células idênticas ao mockup (módulos 1, 3 e 4). A rodada anterior
    // batia só uma.
    const iguais = conversao.filter((v, i) => v === MOCKUP.conversao[i]).length
    expect(iguais).toBe(3)

    // Estritamente decrescente de 90% (V-33). O fim em 30% é M-2, escalado.
    expect(conversao[0]).toBe(90)
    for (let i = 1; i < conversao.length; i++) {
      expect(conversao[i] ?? 0).toBeLessThan(conversao[i - 1] ?? 0)
    }
  })

  it("VARIÂNCIA — mexer numa pessoa move funil, tiles e insight juntos", () => {
    const base = entradaMapaFixture()
    const antes = computeMapaJornada(base)

    // Tira a evidência de conclusão de UMA pessoa que fechava a jornada: ela sai
    // do tile `Concluídos` e derruba a última conversão. Se a tela fosse a
    // função constante da lição 1, nada aqui se moveria.
    const percorrido = base.percorrido ?? []
    const sessoes = base.sessoes ?? []
    const alvo = percorrido.find((p) => p.chegouAoFimISO !== null)?.alunoId
    expect(alvo).toBeDefined()
    const depois = computeMapaJornada({
      ...base,
      percorrido: percorrido.filter((p) => p.alunoId !== alvo),
      sessoes: sessoes.filter((s) => s.alunoId !== alvo),
    })

    const tileAntes = antes.distribuicao.tiles.find((t) => t.id === "concluidos")
    const tileDepois = depois.distribuicao.tiles.find((t) => t.id === "concluidos")
    expect(tileDepois?.valor).toBeLessThan(tileAntes?.valor ?? 0)

    const ultAntes = antes.funil.linhas[6]?.concluiram ?? 0
    const ultDepois = depois.funil.linhas[6]?.concluiram ?? 0
    expect(ultDepois).toBeLessThan(ultAntes)

    // A identidade M-2 continua valendo depois da mexida: as duas colunas
    // andaram juntas, e é isso que faz delas o mesmo número.
    expect(ultDepois).toBe(tileDepois?.valor)
  })
})
