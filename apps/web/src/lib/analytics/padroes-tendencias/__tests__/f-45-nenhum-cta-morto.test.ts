import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { cenario, cenarioAtivosMais3, cenarioRegularidadeCai } from "./cenario"

/**
 * F-45 · nenhum dos sete CTAs desta tela é decorativo.
 *
 * F-44 congela o que eles NÃO fazem (escrever). Este arquivo congela o que eles
 * FAZEM. Os dois juntos são o par: sem F-44, ligar um destino poderia virar
 * escrita; sem F-45, "não escreve" seria satisfeito por um `<span>` inerte —
 * que é literalmente o estado anterior desta tela, e o motivo deste trabalho.
 *
 * A regra que cada destino obedece: ele mostra MAIS do que o bloco já mostra.
 * Um CTA cujo detalhamento repete o card é um CTA morto disfarçado de vivo, que
 * é pior que um rótulo mudo — o gestor clica, não vê nada novo, e passa a
 * desconfiar de todos os outros.
 *
 * CONTROLE POSITIVO em cada asserção de cobertura: o teste afirma primeiro que
 * há sete ações (senão "todas cobertas" é verdade por vacuidade sobre lista
 * vazia) e depois que o mapa de destinos as cobre.
 */

describe("F-45 · nenhum CTA morto", () => {
  it("CONTROLE POSITIVO — o cenário produz as sete ações", () => {
    const { acoes } = computePadroesTendencias(cenarioAtivosMais3())
    expect(acoes).toHaveLength(7)
  })

  it("INVARIÂNCIA — todo `Acao.id` tem destino declarado, em todo cenário", () => {
    for (const entrada of [
      cenarioAtivosMais3(),
      cenarioRegularidadeCai(4),
      cenario({ pessoas: [] }),
    ]) {
      const dados = computePadroesTendencias(entrada)
      expect(dados.acoes.length, "sem ação não há o que cobrir").toBe(7)
      for (const acao of dados.acoes) {
        const destino = dados.detalhes[acao.id]
        expect(destino, `"${acao.rotulo}" (id ${acao.id}) sem destino`).toBeDefined()
        // Destino com título vazio é um modal em branco: o mesmo nada, com um
        // passo a mais.
        expect(destino?.titulo.length, acao.rotulo).toBeGreaterThan(0)
        expect(destino?.nota.length, `${acao.rotulo}: régua do recorte ausente`).toBeGreaterThan(0)
      }
    }
  })

  it("VARIÂNCIA — a asserção lê o mapa, não devolve verdadeiro por construção", () => {
    const dados = computePadroesTendencias(cenarioAtivosMais3())
    expect(dados.detalhes["id-que-nao-existe"]).toBeUndefined()
  })

  it("INVARIÂNCIA — nenhum destino desta tela é lista de PESSOA", () => {
    // Esta aba é sobre TEMPO, RECORRÊNCIA e TENDÊNCIA (§14), e a §21 diz
    // literalmente "não mostrar ranking de pessoas". Um destino do tipo
    // `pessoas` aqui seria a porta por onde a aba vira lista nominal.
    const dados = computePadroesTendencias(cenarioAtivosMais3())
    for (const [id, destino] of Object.entries(dados.detalhes)) {
      expect(destino.tipo, `destino "${id}"`).toBe("tabela")
    }
  })

  it("INVARIÂNCIA — cada tabela é retangular: toda linha tem o nº de colunas", () => {
    // Linha mais curta que o cabeçalho vira célula fantasma na renderização, e
    // o gestor lê o valor de uma coluna embaixo do rótulo de outra.
    const dados = computePadroesTendencias(cenarioAtivosMais3())
    for (const [id, destino] of Object.entries(dados.detalhes)) {
      if (destino.tipo !== "tabela") continue
      expect(destino.alinhamentos.length, `alinhamentos de "${id}"`).toBe(destino.colunas.length)
      for (const [i, linha] of destino.linhas.entries()) {
        expect(linha.length, `linha ${i} de "${id}"`).toBe(destino.colunas.length)
      }
    }
  })

  it("INVARIÂNCIA — o detalhamento mostra MAIS que o bloco, não o mesmo", () => {
    const dados = computePadroesTendencias(cenarioAtivosMais3())

    // §17 · o gráfico desenha as semanas; a gaveta acrescenta a razão
    // sessões/pessoa, que é a leitura que a §17 pede e o desenho não dá.
    const serie = dados.detalhes.serie
    expect(serie?.tipo).toBe("tabela")
    if (serie?.tipo === "tabela") {
      expect(serie.colunas).toContain("Sessões por pessoa")
    }

    // §19 · o card lista as maiores QUEDAS; a gaveta lista todos os módulos com
    // base comparável, inclusive os que subiram.
    const gargalos = dados.detalhes.gargalos
    if (gargalos?.tipo === "tabela") {
      expect(gargalos.linhas.length).toBeGreaterThanOrEqual(dados.gargalos.itens.length)
    }

    // §20 · o card mostra a composição do PERÍODO; a gaveta abre por semana.
    const participacao = dados.detalhes.participacao
    if (participacao?.tipo === "tabela") {
      expect(participacao.colunas[0]).toBe("Semana")
    }
  })
})
