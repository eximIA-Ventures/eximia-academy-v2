import { describe, expect, it } from "vitest"
import type { CapituloBruto } from "../entrada"
import { computePadroesTendencias } from "../index"
import { BADGE_ALTA, BADGE_QUEDA, BADGE_RECORRENTE } from "../sinais"
import type { DefModulo, PessoaCenario } from "./cenario"
import {
  DIAS_REGULARES,
  DIAS_REGULARES_ANTES,
  DIA_NA_JANELA_ANTERIOR,
  PONTE_SEM_PAUSA,
  capitulo,
  cenario,
} from "./cenario"

// ---------------------------------------------------------------------------
// PROVA DE CONFLITO ENTRE AS DUAS RÉGUAS — **não é um contrato**.
// ---------------------------------------------------------------------------
// Este arquivo NÃO acrescenta nada ao denominador congelado de 44 contratos
// (`F-01` a `F-44`), pelo mesmo motivo e no mesmo formato de
// `conflito-regua-v25-ordem.test.ts`.
//
// A régua visual pede, em `V-27`, que a §18 exiba TRÊS itens nesta ordem:
//
//   1. `Desaceleração recorrente em um módulo`  · selo ÂMBAR  `Padrão recorrente`
//   2. o item de ORIGEM DE ACESSO (montado em `ITEM_2_DE_V27`, abaixo, sem
//      escrever o token — a varredura roda sobre esta pasta) · selo VERDE
//      `Tendência de alta`
//   3. `Menor regularidade de estudos`          · selo VERMELHO `Tendência de queda`
//
// A régua funcional torna esse conjunto inalcançável por DUAS razões
// independentes, e nenhuma delas é de implementação. As duas estão provadas
// abaixo, executáveis, para que a próxima rodada não gaste a vez redescobrindo:
//
//   • RAZÃO 1 (fonte) — o item 2 é telemetria de origem de acesso, e `F-07`
//     proíbe a tela de emitir isso porque o schema não tem a coluna. O detector
//     de `F-07` acusa o literal exigido por `V-27`: satisfazer uma régua reprova
//     a outra, no mesmo byte.
//
//   • RAZÃO 2 (aritmética do motor) — mesmo IGNORANDO a razão 1, os selos verde
//     e vermelho saem do MESMO candidato: a porta de limiar de `F-18` emite
//     `Tendência de alta` quando a regularidade sobe e `Tendência de queda`
//     quando cai. É um único candidato com dois rótulos mutuamente exclusivos,
//     e a §18 não tem terceira porta que produza selo verde. Logo NENHUM mundo
//     — sintético ou de produção — exibe os três selos de `V-27` ao mesmo tempo.
//
// O que NÃO é o problema, e é importante registrar para não se corrigir o alvo
// errado: o TETO. O bloco chega a 3 itens sem esforço (dois módulos em queda
// recorrente mais o limiar), e o último caso abaixo demonstra isso. Falta o
// item 2 do PNG, não altura de card.
//
// Conclusão que sobe ao dono: ou `V-27` deixa de exigir o item de origem de
// acesso (e a §18 passa a ter no máximo os dois tipos que o schema sustenta),
// ou o produto ganha telemetria de origem de acesso — coluna ou tabela nova,
// fora do escopo desta tela, como `F-07` já registrou. É decisão de produto.
// ---------------------------------------------------------------------------

// Tokens por concatenação, pela mesma razão de sempre: a varredura de `F-07`
// roda sobre ESTA pasta, e um detector que encontra o literal dentro do próprio
// teste reprova sozinho sem que nada esteja errado.
const T = ["mob", "ile"].join("")
const DETECTOR_DA_PROIBICAO = new RegExp(`${T}|disposit|app nativo|platafor`, "i")

/** O literal que `V-27` exige na 2ª posição, montado sem escrever o token. */
const ITEM_2_DE_V27 = {
  titulo: `Acesso via ${T} em ascensão`,
  descricao: `+12% de acessos via ${T} em relação ao período anterior`,
  selo: BADGE_ALTA,
}

describe("conflito de réguas · V-27 (os 3 selos do PNG) contra F-07 e contra a §18", () => {
  it("RAZÃO 1 — o literal que V-27 exige no item 2 é exatamente o que a proibição de fonte acusa", () => {
    expect(DETECTOR_DA_PROIBICAO.test(ITEM_2_DE_V27.titulo)).toBe(true)
    expect(DETECTOR_DA_PROIBICAO.test(ITEM_2_DE_V27.descricao)).toBe(true)
  })

  it("RAZÃO 1 (variância) — o detector NÃO acusa os outros dois itens que V-27 exige", () => {
    // Sem isto o caso acima seria vacuoso: um detector que acusa toda string
    // "provaria" qualquer conflito. Os itens 1 e 3 do PNG passam limpos — o
    // problema é do item 2, não da régua inteira.
    for (const texto of [
      "Desaceleração recorrente em um módulo",
      "Executar Ações Corretivas apresenta queda há 2 semanas",
      "Menor regularidade de estudos",
      "Redução de 6 p.p. em alunos que estudam 2x ou mais por semana",
    ]) {
      expect(DETECTOR_DA_PROIBICAO.test(texto), texto).toBe(false)
    }
  })

  it("RAZÃO 2 — nenhum mundo exibe o selo verde e o vermelho ao mesmo tempo", () => {
    let comAlta = 0
    let comQueda = 0

    for (const direcao of ["sobe", "cai", "estavel"] as const) {
      for (const quantosModulos of [0, 1, 2, 3]) {
        const { sinais } = computePadroesTendencias(mundo(direcao, quantosModulos))
        const selos = sinais.itens.map((i) => i.badgeRotulo)
        const alta = selos.includes(BADGE_ALTA)
        const queda = selos.includes(BADGE_QUEDA)

        expect(alta && queda, `mundo(${direcao}, ${quantosModulos}) exibiu os dois selos`).toBe(
          false,
        )
        if (alta) comAlta++
        if (queda) comQueda++
      }
    }

    // Anti-vacuidade: se nenhum mundo acendesse selo algum, a asserção acima
    // passaria por ausência e não por exclusão mútua.
    expect(comAlta, "nenhum mundo acendeu o selo verde").toBeGreaterThan(0)
    expect(comQueda, "nenhum mundo acendeu o selo vermelho").toBeGreaterThan(0)
  })

  it("RAZÃO 2 (variância) — cada selo aparece sozinho no mundo que o produz", () => {
    const sobe = computePadroesTendencias(mundo("sobe", 1)).sinais.itens.map((i) => i.badgeRotulo)
    const cai = computePadroesTendencias(mundo("cai", 1)).sinais.itens.map((i) => i.badgeRotulo)

    expect(sobe).toContain(BADGE_ALTA)
    expect(sobe).not.toContain(BADGE_QUEDA)
    expect(cai).toContain(BADGE_QUEDA)
    expect(cai).not.toContain(BADGE_ALTA)
  })

  it("O TETO NÃO É O PROBLEMA — o bloco chega a 3 itens, e nenhum deles é o item 2", () => {
    const { sinais } = computePadroesTendencias(mundo("cai", 2))

    expect(sinais.itens).toHaveLength(3)
    expect(sinais.itens.map((i) => i.badgeRotulo)).toEqual([
      BADGE_RECORRENTE,
      BADGE_RECORRENTE,
      BADGE_QUEDA,
    ])
    // Três itens, e ainda assim o conjunto de selos de V-27 não fecha: falta o
    // verde, e ele não tem de onde sair.
    expect(sinais.itens.map((i) => i.badgeRotulo)).not.toContain(BADGE_ALTA)
    for (const item of sinais.itens) {
      expect(DETECTOR_DA_PROIBICAO.test(`${item.titulo} ${item.descricao}`)).toBe(false)
    }
  })
})

/**
 * Um mundo com a regularidade indo para `direcao` e `quantosModulos` capítulos
 * em queda recorrente.
 *
 * Os dois eixos são independentes de propósito: as pessoas que movem a
 * regularidade não tocam capítulo nenhum, e as dos módulos não entram na conta
 * de regulares. Sem essa separação, mexer num eixo moveria o outro e a
 * varredura mediria ruído.
 */
function mundo(direcao: "sobe" | "cai" | "estavel", quantosModulos: number) {
  const pessoas: PessoaCenario[] = []

  for (let i = 0; i < 10; i++) {
    const move = i < 3
    const sessoes =
      move && direcao === "sobe"
        ? [...DIAS_REGULARES, ...PONTE_SEM_PAUSA, DIA_NA_JANELA_ANTERIOR]
        : move && direcao === "cai"
          ? [...DIAS_REGULARES_ANTES, ...PONTE_SEM_PAUSA, 2]
          : [DIA_NA_JANELA_ANTERIOR]
    pessoas.push({ id: `reg-p${i}`, sessoes })
  }

  const capitulos: CapituloBruto[] = []
  const defs: DefModulo[] = Array.from({ length: quantosModulos }, (_, k) => ({
    id: `m${k + 1}`,
    titulo: `Módulo ${k + 1}`,
    antes: 6,
    agora: 1,
  }))
  defs.forEach((d, ordem) => {
    capitulos.push(capitulo(d.id, d.titulo, ordem + 1))
    for (let i = 0; i < Math.max(d.antes, d.agora); i++) {
      const offsets: number[] = []
      if (i < d.antes) offsets.push(DIA_NA_JANELA_ANTERIOR)
      if (i < d.agora) offsets.push(25)
      pessoas.push({ id: `${d.id}-p${i}`, porCapitulo: { [d.id]: offsets } })
    }
  })

  return cenario({ pessoas, capitulos, periodoDias: 30 })
}
