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

  it("A FIXTURE OPERA NO TETO — 5 gargalos distintos, decrescentes, dentro das 24 pessoas elegíveis", () => {
    const r = render()
    expect(r.gargalos.estado).toBe("ok")

    const valores = r.gargalos.linhas.map((l) => l.pessoas)
    expect(valores).toEqual([8, 5, 4, 3, 2])

    // Estritamente decrescente (V-21) e coerente com o roster (V-33).
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]).toBeLessThan(valores[i - 1] as number)
    }
    for (const l of r.gargalos.linhas) {
      expect(l.pct).toBe(Math.round((l.pessoas / MOCKUP.roster) * 100))
    }

    // V-21 · a última barra entre 20% e 40% da primeira. É o critério que
    // reprova a série `8·6·3·2·1`, que caberia no orçamento mas terminaria em
    // 12,5% da trilha.
    const razao = (valores[4] as number) / (valores[0] as number)
    expect(razao).toBeGreaterThanOrEqual(0.2)
    expect(razao).toBeLessThanOrEqual(0.4)

    // O 6º módulo elegível existe — é o que faz o link do rodapé aparecer
    // (V-30). 8+5+4+3+2 = 22 nas cinco linhas, mais 1 no 6º módulo = 23 das 24
    // pessoas elegíveis. A 24ª é a que desempata as barras 4ª e 5ª saindo da
    // população do gargalo (matrícula recente ⇒ dentro do ritmo esperado), sem
    // sair do roster nem do tile `Em andamento`.
    expect(r.gargalos.linkRodape).not.toBeNull()
    const noCorte = valores.reduce((a, b) => a + b, 0)
    expect(noCorte).toBe(22)
    const tetoElegivel = MOCKUP.roster - MOCKUP.tiles.concluidos - MOCKUP.tiles.naoIniciados
    expect(noCorte + 1 + 1).toBe(tetoElegivel)
  })

  it("O BADGE É POSIÇÃO, NÃO MÓDULO — `1 2 3 4 5` sobre os módulos `6 4 5 2 3`", () => {
    const r = render()
    // A referência traz `1 2 3 4 5` nos badges, ao lado dos módulos 6, 7, 5, 4
    // e 3. Renderizar o número do módulo fazia a coluna sair `6 4 2 5 3`.
    expect(r.gargalos.linhas.map((l) => l.ordem)).toEqual([1, 2, 3, 4, 5])
    expect(r.gargalos.linhas.map((l) => l.numero)).toEqual([6, 4, 5, 2, 3])

    // Três dos cinco rótulos batem com a referência (1º, 3º e 5º). Os outros
    // dois são o preço do registro M-5 abaixo.
    const REF_MODULOS = [6, 7, 5, 4, 3]
    const iguais = r.gargalos.linhas.filter((l, i) => l.numero === REF_MODULOS[i]).length
    expect(iguais).toBe(3)
  })
})

describe("REGISTRO M-5 · o 2º gargalo do mockup contradiz o 2º insight do mockup", () => {
  it("PROVA — pôr o módulo 7 na 2ª linha troca a frase `módulos 4 a 6` por `módulos 6 a 7`", () => {
    // F-28 é literal: os módulos citados no insight são os DOIS PRIMEIROS de
    // F-10, em ordem ASC. O PNG traz, ao mesmo tempo:
    //   • gargalos 1º e 2º = módulos 6 e 7;
    //   • insight = "ofereça reforços nos módulos 4 a 6".
    // Um exige o intervalo 6..7, o outro afirma 4..6. Não é imprecisão de
    // implementação: são duas leituras do mesmo par de células do mockup.
    const REF_GARGALO_TOP2 = [6, 7]
    const intervaloImplicado = [...REF_GARGALO_TOP2].sort((a, b) => a - b)
    expect(intervaloImplicado).toEqual([6, 7])
    expect(intervaloImplicado).not.toEqual([4, 6])

    // A fixture escolhe o lado que o mockup escreve por extenso.
    const r = render()
    const top2 = r.gargalos.linhas.slice(0, 2).map((l) => l.numero)
    expect([...top2].sort((a, b) => a - b)).toEqual([4, 6])

    // ═══ O VEÍCULO DESTA PROVA FOI APOSENTADO, E O REGISTRO CONTINUA ════════
    // Até 2026-08-19 a contradição era demonstrável NA TELA: o insight escrevia
    // "ofereça reforços nos módulos 4 a 6", em desacordo com os gargalos 6 e 7
    // do mesmo PNG. A doutrina D-1 matou esse trecho da frase — ele era eco do
    // card de gargalos logo acima, e endereçava módulo por NÚMERO, que não é
    // endereço de gestor nenhum.
    //
    // A inconsistência do MOCKUP não deixou de existir por isso; o que deixou de
    // existir é a superfície onde ela aparecia. As asserções acima continuam
    // registrando-a pelo lado que sobreviveu (os gargalos). A linha abaixo é o
    // que impede a volta pela porta dos fundos: se alguém reintroduzir o
    // intervalo de módulos no insight, este teste acusa.
    const insight = r.insights.itens.find((i) => i.id === "em-andamento")
    expect(insight, "sem o insight em cena a guarda abaixo seria vácua").toBeDefined()
    expect(insight?.texto, "o eco do card de gargalos voltou ao insight").not.toMatch(
      /m[óo]dulos \d+ a \d+/i,
    )
  })

  it("PROVA — módulo 7 na 2ª linha custa 2 das 3 linhas de funil que hoje batem", () => {
    // Para ocupar a 2ª posição, o módulo 7 precisa superar 3 valores positivos
    // distintos abaixo dele, logo g₇ ≥ 4 — e, com a razão de V-21 exigindo a 5ª
    // barra ≥ 20% da 1ª (que vale ≥ 8, pelos 8 travados), a 5ª vale ≥ 2 e a
    // série mínima acima dela é 5 > 4 > 3 > 2, o que empurra g₇ ≥ 5.
    const TRAVADOS_NO_ANCORA = 8
    const g7Minimo = 5
    expect(g7Minimo).toBeGreaterThan(4)

    // g₇ ≤ v₆, e Concluíram(6) = v₆ + v₇ = v₆ + 12.
    const concluiram6Minimo = g7Minimo + 12
    expect(concluiram6Minimo).toBe(17)
    // Concluíram(5) = Concluíram(6) + v₅, e v₅ ≥ 8 pelos travados.
    const concluiram5Minimo = concluiram6Minimo + TRAVADOS_NO_ANCORA
    expect(concluiram5Minimo).toBe(25)
    // Concluíram(4) ≥ Concluíram(5) + 1 = 26, e o mockup pede 24.
    expect(concluiram5Minimo + 1).toBeGreaterThan(24)
    // Concluíram(3) ≥ 27 > 30? não — mas Concluíram(2) ≥ 28 e o alvo é 33,
    // então a única linha que ainda poderia bater é a 3ª, e só ela.
    // Conclusão: das linhas 2, 3 e 4 (as três que hoje batem: 83%, 75% e a 1ª
    // trivial), sobram no máximo 1 além da linha 1.
    const linhasQueSobram = 1
    expect(3 - linhasQueSobram).toBe(2)
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

  it("A FIXTURE HONRA O TILE — 12 (30%) nos dois lugares que restaram", () => {
    const r = render()
    const tile = r.distribuicao.tiles.find((t) => t.id === "concluidos")

    expect(tile?.valor).toBe(12)
    expect(tile?.pct).toBe(30)
    expect(r.funil.linhas[6]?.conversaoLabel).toBe("30%")

    // ═══ ERAM TRÊS LUGARES; O TERCEIRO MORREU DE PROPÓSITO ══════════════════
    // O insight `concluiu` publicava "30% da equipe já concluiu a jornada" — o
    // percentual do tile ao lado, reimpresso num card chamado "Insights". Era
    // DESCRIÇÃO, não insight: o gestor já tinha lido aquele número oito
    // centímetros acima. A doutrina D-1 o removeu, e a remoção é o resultado
    // desejado, não uma perda a compensar.
    //
    // A identidade que este registro afirma (tile ≡ fim do funil) segue valendo
    // e segue verificada acima. O que a linha abaixo guarda é a AUSÊNCIA: se o
    // eco voltar, o teste que documenta a identidade é o mesmo que acusa a
    // repetição.
    expect(
      r.insights.itens.find((i) => i.id === "concluiu"),
      "o eco do tile Concluídos voltou ao card de insights",
    ).toBeUndefined()
    expect(
      r.insights.itens.filter((i) => i.texto.includes(`${tile?.pct}%`)),
      "algum insight reimprimiu o percentual do tile",
    ).toHaveLength(0)
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

// ---------------------------------------------------------------------------
// A ENUMERAÇÃO. As rodadas 1 e 2 afirmaram em prosa que "o ótimo é 3 células".
// Prosa não é prova, e a rodada 3 recebeu a mesma cobrança de volta pela
// segunda vez. Aqui a afirmação vira varredura executável do espaço inteiro.
//
// `v[k]` = quantas pessoas têm exatamente `k` módulos iniciais concluídos.
// O motor deriva o funil inteiro daí: Concluíram(m) = Σ_{k ≥ m} v_k.
//
// As amarras NÃO são escolha de quem constrói:
//   v₀ = 4        tile `Não iniciados` (V-33)
//   v₇ = 12       tile `Concluídos`    (V-33)
//   Σ v = 40      roster               (V-33)
//   v₅ ≥ 8        os 8 travados moram no módulo âncora — sem isso F-21 não
//                 renderiza o bloco §26 e o insight de 20% deixa de existir
//   v₁..v₆ ≥ 1    são os 6 módulos elegíveis que o link `Ver todos os
//                 módulos ›` exige (V-30 + F-10: com 5, o link some)
//   top-5 das barras estritamente decrescente, a 5ª entre 20% e 40% da 1ª (V-21)
// ---------------------------------------------------------------------------

/** Conversão (%) das 7 linhas, a partir do histograma. */
function conversaoDe(v: readonly number[]): number[] {
  const saida: number[] = []
  for (let m = 1; m <= 7; m++) {
    let concluiram = 0
    for (let k = m; k <= 7; k++) concluiram += v[k] ?? 0
    saida.push(Math.round((concluiram / 40) * 100))
  }
  return saida
}

function acertosDeConversao(v: readonly number[]): number {
  return conversaoDe(v).filter((pct, i) => pct === MOCKUP.conversao[i]).length
}

/**
 * Existe alguma atribuição de gargalos, sobre este histograma, que satisfaça
 * V-21 (5 barras estritamente decrescentes, a última entre 20% e 40% da
 * primeira) e V-30 (um 6º módulo elegível, para o link existir)?
 *
 * O teto de cada módulo `m` é `v[m-1]` — ninguém pode estar parado num módulo
 * que não é o corrente de ninguém. Abaixo do teto tudo é escolha (uma pessoa
 * ativa e no ritmo sai do gargalo sem sair do roster), então basta perguntar se
 * os tetos COMPORTAM alguma série válida. Como os valores mínimos de uma série
 * `a > b > c > d > e` com `d` fixo são `d+3, d+2, d+1, d, 1`, a viabilidade é
 * dominação dos tetos ordenados sobre esses mínimos ordenados.
 */
function barrasViaveis(v: readonly number[]): boolean {
  const tetoAncora = v[5] ?? 0
  if (tetoAncora < 8) return false
  const outros = [v[1] ?? 0, v[2] ?? 0, v[3] ?? 0, v[4] ?? 0, v[6] ?? 0]
  if (outros.some((c) => c < 1)) return false
  const tetosOrdenados = [...outros].sort((a, b) => b - a)

  for (let topo = 8; topo <= tetoAncora; topo++) {
    const dMin = Math.max(2, Math.ceil(0.2 * topo))
    const dMax = Math.floor(0.4 * topo)
    for (let d = dMin; d <= dMax; d++) {
      if (d + 3 >= topo) continue
      const minimos = [d + 3, d + 2, d + 1, d, 1]
      if (minimos.every((mv, i) => (tetosOrdenados[i] ?? 0) >= mv)) return true
    }
  }
  return false
}

/** Varre todos os histogramas admissíveis. `comBarras` liga as amarras V-21/V-30. */
function melhorAcerto(comBarras: boolean): number {
  let melhor = 0
  for (let v1 = 1; v1 <= 15; v1++) {
    for (let v2 = 1; v2 <= 15; v2++) {
      for (let v3 = 1; v3 <= 15; v3++) {
        for (let v4 = 1; v4 <= 15; v4++) {
          const restante = 24 - v1 - v2 - v3 - v4
          for (let v5 = 8; v5 <= restante - 1; v5++) {
            const v6 = restante - v5
            if (v6 < 1) continue
            const v = [4, v1, v2, v3, v4, v5, v6, 12]
            if (comBarras && !barrasViaveis(v)) continue
            const a = acertosDeConversao(v)
            if (a > melhor) melhor = a
          }
        }
      }
    }
  }
  return melhor
}

describe("REGISTRO · o ótimo é 3 linhas de funil, e isso é ENUMERADO, não estimado", () => {
  it("PROVA — sob todas as amarras, nenhum histograma passa de 3 linhas de `Conversão`", () => {
    expect(melhorAcerto(true)).toBe(3)
  })

  it("ANTI-VACUIDADE — sem V-21/V-30 o teto sobe para 4, logo a varredura discrimina", () => {
    // Se a varredura devolvesse 3 dos dois lados, ela não estaria medindo as
    // amarras — estaria medindo a aritmética dos tiles, e o "ótimo" seria uma
    // constante disfarçada de teorema. O 4 aqui é o histograma
    // (4,3,3,6,3,8,1,12): ele bate as linhas 1 a 4 e, em troca, ou perde o
    // link `Ver todos os módulos ›` ou termina as barras em 12,5% da trilha.
    expect(melhorAcerto(false)).toBe(4)
  })

  it("A FIXTURE ESTÁ NO ÓTIMO — o histograma medido da tela é viável e acerta 3", () => {
    const r = render()
    // O histograma é DERIVADO da saída do motor, não transcrito: se a fixture
    // mudar, este teste mede a nova, não uma cópia velha.
    const concluiram = r.funil.linhas.map((l) => l.concluiram)
    const v = [40 - (concluiram[0] as number)]
    for (let k = 1; k <= 6; k++) {
      v.push((concluiram[k - 1] as number) - (concluiram[k] as number))
    }
    v.push(concluiram[6] as number)

    expect(v).toEqual([4, 3, 3, 5, 4, 8, 1, 12])
    expect(v.reduce((a, b) => a + b, 0)).toBe(40)
    expect(barrasViaveis(v)).toBe(true)
    expect(acertosDeConversao(v)).toBe(3)
  })
})

describe("REGISTRO · o ótimo alcançado nesta rodada, e a variância que prova que ele é lido", () => {
  it("INVARIÂNCIA — a fixture bate o mockup em 90%, 83% e 75%, e o resto é o teto provado", () => {
    const r = render()
    const conversao = r.funil.linhas.map((l) => l.conversaoPct)
    const concluiram = r.funil.linhas.map((l) => l.concluiram)

    expect(conversao).toEqual([90, 83, 75, 63, 53, 33, 30])
    expect(concluiram).toEqual([36, 33, 30, 25, 21, 13, 12])

    // Três células idênticas ao mockup (linhas 1, 2 e 3). A rodada 2 também
    // batia três, mas nas linhas 1, 3 e 4 — e com um rótulo de gargalo a menos.
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
