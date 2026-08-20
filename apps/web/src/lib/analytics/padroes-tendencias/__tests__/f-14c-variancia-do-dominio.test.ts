import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import { dominioDaSerie } from "../serie"
import { cenario } from "./cenario"

/**
 * F-14c · O PAR DE VARIÂNCIA do domínio do eixo y de §17.
 *
 * ESCRITO JUNTO COM A CORREÇÃO, não antes: o vermelho desta rodada é
 * `f-14b-dominio-da-serie.test.ts` (topo 6 e não 5, com 6 pessoas e pico 1).
 * Este arquivo existe porque só o vermelho não bastaria — um eixo ancorado é,
 * por definição, INVARIANTE ao dado dentro do universo, e "a função constante
 * satisfaz toda invariância". Uma regra que nunca move o eixo passaria em
 * qualquer teste de estabilidade e seria indistinguível de um número mágico
 * novo no lugar do antigo.
 *
 * Então aqui a invariância é declarada COM as duas causas que a rompem:
 *
 *   • sacode o RECORTE  → o topo tem que se mover (6 pessoas ≠ 24 pessoas);
 *   • sacode o PICO ACIMA do recorte → o topo tem que se mover (o dado nunca é
 *     cortado);
 *   • sacode o pico ABAIXO do recorte → o topo NÃO se move, e isso é a escolha,
 *     não um acidente: é o que torna dois períodos do mesmo recorte comparáveis
 *     a olho.
 *
 * O quarto teste é a propriedade que faltava em F-14 e que deixava o eixo
 * inflado passar: `topo >= pico` é satisfeito por qualquer topo grande o
 * bastante. Aqui o topo também tem TETO.
 */

/** Uma pessoa com carimbo em duas semanas: o mínimo para a série existir. */
function recorteDe(quantas: number, sessoesDaPrimeira: readonly number[] = [1, 9]) {
  return cenario({
    pessoas: Array.from({ length: quantas }, (_, i) => ({
      id: `p${i}`,
      sessoes: i === 0 ? sessoesDaPrimeira : undefined,
    })),
  })
}

function picoDe(pontos: readonly { ativos: number; sessoes: number }[]): number {
  return Math.max(0, ...pontos.map((p) => Math.max(p.ativos, p.sessoes)))
}

describe("F-14c · variância do domínio do eixo y", () => {
  it("VARIÂNCIA — o mesmo dado em 6 e em 24 pessoas produz eixos DIFERENTES", () => {
    const seis = computePadroesTendencias(recorteDe(6))
    const vinteQuatro = computePadroesTendencias(recorteDe(24))

    expect(seis.contexto.totalRecorte).toBe(6)
    expect(vinteQuatro.contexto.totalRecorte).toBe(24)
    // A série é a MESMA nos dois mundos: só o universo mudou.
    expect(picoDe(seis.serie.pontos)).toBe(picoDe(vinteQuatro.serie.pontos))

    expect(seis.serie.eixoY?.topo).toBe(6)
    expect(vinteQuatro.serie.eixoY?.topo).toBe(25)
    expect(vinteQuatro.serie.eixoY?.ticks).toEqual([0, 5, 10, 15, 20, 25])
  })

  it("VARIÂNCIA — pico ACIMA do recorte empurra o topo: o dado nunca é cortado", () => {
    // Uma pessoa com sete sessões na MESMA semana: 7 sessões num recorte de 6.
    // O balde mais recente é `[agora−7d, agora)`, e o carimbo de "7 dias atrás"
    // cai 2h ANTES da fronteira — por isso o offset 6 aparece duas vezes em vez
    // de existir um offset 7 que a bucketização mandaria para a semana vizinha.
    const { serie, contexto } = computePadroesTendencias(recorteDe(6, [1, 2, 3, 4, 5, 6, 6, 9]))

    expect(contexto.totalRecorte).toBe(6)
    expect(picoDe(serie.pontos)).toBe(7)
    expect(serie.eixoY?.topo).toBeGreaterThanOrEqual(7)
    expect(serie.eixoY?.topo).not.toBe(6)
  })

  it("INVARIÂNCIA DELIBERADA — pico 1 e pico 4 no mesmo recorte dão o MESMO eixo", () => {
    // É o que se compra com o eixo ancorado: a figura de duas semanas do mesmo
    // recorte é comparável. Sem isto, cair de 5 para 4 e cair de 500 para 400
    // desenhariam exatamente o mesmo gráfico.
    expect(dominioDaSerie(1, 6)).toEqual(dominioDaSerie(4, 6))
    expect(dominioDaSerie(1, 6).topo).toBe(6)
  })

  it("ANTI-INFLAÇÃO — ancorado no recorte, o topo fica a ≤ 35% acima do universo", () => {
    // A propriedade que F-14 não tinha: `topo >= pico` sozinho aprova 0–5 para
    // um pico de 1, que é o defeito que abriu esta rodada. Aqui o topo tem TETO,
    // e é ele que impede a área morta de voltar por outra porta.
    for (let recorte = 1; recorte <= 300; recorte++) {
      for (const pico of [0, 1, Math.ceil(recorte / 2), recorte]) {
        const eixo = dominioDaSerie(pico, recorte)
        expect(eixo.topo).toBeGreaterThanOrEqual(recorte)
        // 1,35 e não 1,25: a escada redonda tem degraus (…20, 25, 40, 50…), e o
        // pior caso medido cai logo depois de um degrau — recorte 31 sobe para
        // 40 (1,29×) e recorte 61 sobe para 80 (1,31×). Um teto de 1,25 seria
        // uma régua inventada depois do fato; 1,35 é o degrau real da escada.
        expect(eixo.topo).toBeLessThanOrEqual(Math.ceil(recorte * 1.35))
        // Marca fracionária é fração de pessoa, e fração de pessoa não existe.
        for (const t of eixo.ticks) expect(Number.isInteger(t)).toBe(true)
        expect(eixo.ticks[0]).toBe(0)
        expect(eixo.ticks[eixo.ticks.length - 1]).toBe(eixo.topo)
        expect(new Set(eixo.ticks).size).toBe(eixo.ticks.length)
        expect(eixo.ticks.length).toBeLessThanOrEqual(8)
      }
    }
  })

  it("ACHADO — no ramo do PICO, a escada contratada em F-14 ainda infla até 2,5×", () => {
    // Este teste NÃO celebra a folga: ele a documenta com número. Quando o pico
    // ultrapassa o recorte, quem decide é `eixoY` (semanas.ts) — FORA do escopo
    // desta correção — e ele continua com `topo = passo × 5`. O pior caso
    // ALCANÇÁVEL é o menor recorte que ainda cai neste ramo: 1 pessoa com 2
    // sessões numa semana desenha um eixo 0–5. É a mesma frouxidão que deixou
    // 0–5 passar para um pico de 1 antes desta rodada, agora restrita a um canto
    // e medida. Fica registrado para o dono decidir se a escada de 5 divisões
    // também deve ser revista.
    expect(dominioDaSerie(2, 1).topo).toBe(5)
    expect(dominioDaSerie(11, 10).topo).toBe(25)

    let pior = 0
    for (let pico = 2; pico <= 1000; pico++) {
      // `recorte = pico − 1` é o menor universo que ainda roteia para este ramo.
      const eixo = dominioDaSerie(pico, pico - 1)
      expect(eixo.topo).toBeGreaterThanOrEqual(pico)
      pior = Math.max(pior, eixo.topo / pico)
    }
    expect(pior).toBeCloseTo(2.5, 5)
  })

  it("NÃO REGRIDE O MOCKUP — com a fixture (100 pessoas, pico 143) o eixo é o do PNG", () => {
    // A régua visual congelada (V-26) exige `0 40 80 120 160 200` no screenshot
    // da fixture. A regra nova mantém isso EXATO, porque ali o pico ultrapassa o
    // recorte e quem manda volta a ser a escada contratada em F-14. Só o regime
    // pequeno mudou — que é onde o tenant real vive.
    const eixo = dominioDaSerie(143, 100)
    expect(eixo.topo).toBe(200)
    expect(eixo.ticks).toEqual([0, 40, 80, 120, 160, 200])
  })
})
