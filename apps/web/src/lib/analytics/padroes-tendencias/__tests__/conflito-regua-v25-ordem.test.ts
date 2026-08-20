import { describe, expect, it } from "vitest"
import { computePadroesTendencias } from "../index"
import type { PessoaCenario } from "./cenario"
import { PONTE_SEM_PAUSA, capitulo, cenario } from "./cenario"

// ---------------------------------------------------------------------------
// PROVA DE CONFLITO ENTRE AS DUAS RÉGUAS — **não é um contrato**.
// ---------------------------------------------------------------------------
// Este arquivo NÃO acrescenta nada ao denominador congelado de 44 contratos
// (`F-01` a `F-44`). Ele existe por um motivo operacional: a régua visual pede,
// em `V-25`, que `Mais alunos ativos +3` seja o PRIMEIRO item da §16, e a régua
// funcional manda, em `F-08`, ordenar por PESSOAS AFETADAS decrescente. Rodada
// após rodada alguém tenta reconciliar as duas mexendo no mundo sintético, e
// perde a rodada descobrindo que não fecha.
//
// Não fecha por ARITMÉTICA, não por implementação. A prova está abaixo, e é
// executável para que a próxima rodada não precise refazê-la:
//
//   • `V-25` prende o valor do item de ativos em `+3` → `pessoas = 3`;
//   • `V-28` prende os dois piores módulos em `−18%` e `−15%`, e `V-25` prende o
//     item de módulos em "2 módulos";
//   • para um módulo EXIBIR `−18%` é preciso perder no mínimo 2 pessoas, e o
//     mesmo vale para `−15%` (é o que a busca exaustiva abaixo demonstra);
//   • logo o item de módulos afeta ao menos 4 pessoas contra as 3 de ativos, e
//     sob `F-08` ele fica SEMPRE acima.
//
// Conclusão que sobe ao dono: nenhum mundo sintético satisfaz `V-25` e `F-08` ao
// mesmo tempo. Ou a ordem da §16 deixa de ser critério visual, ou `F-08` deixa
// de ordenar por pessoas. É decisão de produto, não de implementação.
// ---------------------------------------------------------------------------

/**
 * Menor perda de pessoas (`d`) capaz de EXIBIR `alvo`% num módulo, para qualquer
 * base `antes` até `tetoDaBase`.
 *
 * Busca exaustiva de propósito: uma fórmula fechada aqui seria uma segunda
 * afirmação a conferir, e o que se quer provar é justamente que nenhuma
 * combinação inteira escapa.
 */
function menorPerdaQueExibe(alvo: number, tetoDaBase = 2000): number | null {
  for (let d = 1; d <= tetoDaBase; d++) {
    for (let antes = d; antes <= tetoDaBase; antes++) {
      const agora = antes - d
      if (Math.round(((agora - antes) / antes) * 100) === alvo) return d
    }
  }
  return null
}

describe("conflito de réguas · V-25 (ordem da §16) contra F-08 (ordenar por pessoas)", () => {
  it("LEMA — exibir −18% custa no mínimo 2 pessoas, e exibir −15% também", () => {
    expect(menorPerdaQueExibe(-18)).toBe(2)
    expect(menorPerdaQueExibe(-15)).toBe(2)
  })

  it("LEMA (variância) — a busca NÃO devolve 2 para todo alvo", () => {
    // Se devolvesse, o lema acima seria vacuoso: uma função constante `2`
    // "provaria" qualquer coisa. −20% sai com 1 pessoa (1 de 5), −50% também.
    expect(menorPerdaQueExibe(-20)).toBe(1)
    expect(menorPerdaQueExibe(-50)).toBe(1)
  })

  it("CONSEQUÊNCIA — com os valores que V-25 e V-28 prendem, módulos vem antes de ativos", () => {
    const dados = computePadroesTendencias(mundoDoMockup())
    const ordem = dados.mudancas.itens.map((i) => i.id)

    const ativos = dados.mudancas.itens.find((i) => i.id === "ativos")
    const modulos = dados.mudancas.itens.find((i) => i.id === "modulos")
    expect(ativos?.valorTexto, "o mundo não reproduziu o +3 que V-25 prende").toBe("+3")
    expect(modulos?.valorTexto, "o mundo não reproduziu o −15% que V-25 prende").toBe("−15%")

    expect(ordem.indexOf("modulos")).toBeLessThan(ordem.indexOf("ativos"))
  })

  it("VARIÂNCIA — a ordem se inverte quando ativos passa de 4 pessoas", () => {
    // Prova que o caso acima mede a ORDENAÇÃO e não devolve uma constante: com
    // Δativos = +7 (acima das 4 pessoas dos dois módulos), ativos assume o topo.
    // O preço é perder o `+3` — que é exatamente o trade-off impossível.
    const dados = computePadroesTendencias(mundoDoMockup(7))
    const ordem = dados.mudancas.itens.map((i) => i.id)

    expect(dados.mudancas.itens.find((i) => i.id === "ativos")?.valorTexto).toBe("+7")
    expect(ordem.indexOf("ativos")).toBeLessThan(ordem.indexOf("modulos"))
  })
})

/**
 * O menor mundo que reproduz as duas âncoras do mockup ao mesmo tempo: dois
 * módulos caindo −18% e −15%, e `deltaAtivos` pessoas a mais na janela atual.
 *
 * Os dois módulos usam grupos disjuntos, e a base (11 e 13) é a menor que exibe
 * cada percentual — é o LEMA acima aplicado, não um número escolhido a dedo.
 */
function mundoDoMockup(deltaAtivos = 3) {
  const MODULOS = [
    { id: "m1", titulo: "Executar Ações Corretivas", antes: 11, agora: 9 },
    { id: "m2", titulo: "Monitoramento dos Resultados", antes: 13, agora: 11 },
  ]

  const pessoas: PessoaCenario[] = []
  const capitulos = MODULOS.map((m, i) => capitulo(m.id, m.titulo, i + 1))

  for (const m of MODULOS) {
    for (let i = 0; i < Math.max(m.antes, m.agora); i++) {
      // Ativo nas DUAS janelas quando possível: quem só existe numa delas
      // mexeria no Δ de ativos, que este mundo precisa controlar sozinho.
      const offsets: number[] = []
      if (i < m.antes) offsets.push(31)
      if (i < m.agora) offsets.push(25)
      pessoas.push({ id: `${m.id}-p${i}`, porCapitulo: { [m.id]: offsets }, sessoes: [20] })
    }
  }

  // As pessoas que produzem o Δ de ativos: existem só na janela atual.
  for (let i = 0; i < deltaAtivos; i++) {
    pessoas.push({ id: `novo-${i}`, sessoes: [4, ...PONTE_SEM_PAUSA] })
  }

  return cenario({ pessoas, capitulos, periodoDias: 30 })
}
