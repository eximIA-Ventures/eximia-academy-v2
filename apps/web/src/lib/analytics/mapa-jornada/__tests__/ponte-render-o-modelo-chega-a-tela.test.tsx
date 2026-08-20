// ---------------------------------------------------------------------------
// PONTE RENDER — o que a camada calcula chega à TELA, e a tela é função dele.
// ---------------------------------------------------------------------------
// ISTO NÃO É UM CONTRATO NOVO. O denominador está congelado em 35 (regra 4 do
// CONTRATO-mapa.md: "descobrir um número novo no meio da construção não abre
// F-36"). Este arquivo REFORÇA o lado de RENDER de contratos que já existem:
//
//   F-05  a régua do cinza é RENDERIZADA (I-2), nunca tooltip
//   F-21  o CTA carrega o total COMPLETO da população, não o corte exibido
//   F-22  a régua de "Chegaram" é renderizada
//   F-33  a régua do período é renderizada
//   F-34  vocabulário de apoio na tela inteira
//   I-3   nenhum estado degenerado publicado (V-37 da régua visual)
//
// POR QUE ELE EXISTE. Os 35 contratos são verificados sobre a SAÍDA DA CAMADA.
// Um campo obrigatório no tipo garante que o motor o PRODUZ; não garante que o
// componente o RENDERIZA. Essa fresta já custou caro duas vezes nesta série:
//
//   • lição 2 — o preview lia a fixture já calculada, e correções existiam no
//     código sem aparecer na tela de inspeção;
//   • lição 3, na versão de render — `ctaTotal` chegava certo à camada e MORRIA
//     no JSX (está escrito no próprio `mapa-jornada-tab.tsx`, §26).
//
// Nos dois casos a suíte inteira ficou VERDE enquanto a tela estava errada,
// porque nenhum teste atravessava a ponte. Este atravessa.
//
// A ASSERÇÃO QUE IMPORTA É A DE VARIÂNCIA. Verificar que a tela contém o texto
// certo é satisfeito por um literal cravado no JSX — a função constante da
// lição 1, na sua forma de renderização. Por isso todo item aqui vem em par: a
// tela tem de MUDAR quando o modelo muda, e o texto antigo tem de SUMIR.
// ---------------------------------------------------------------------------

import { entradaMapaFixture } from "@/components/analytics/mapa-jornada/fixture"
import { MapaJornadaTab } from "@/components/analytics/mapa-jornada/mapa-jornada-tab"
import { computeMapaJornada } from "@/lib/analytics/mapa-jornada"
import type { MapaJornadaDados } from "@/lib/analytics/mapa-jornada/tipos"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { TERMOS_PUNITIVOS } from "./contrato"

afterEach(cleanup)

/** O MESMO objeto que o preview em `?fonte=fixture` fotografa. */
function modelo(): MapaJornadaDados {
  return computeMapaJornada(entradaMapaFixture())
}

/** Texto visível da tela inteira, com espaços normalizados. */
function telaComoTexto(dados: MapaJornadaDados): string {
  const { container } = render(<MapaJornadaTab dados={dados} />)
  return (container.textContent ?? "").replace(/\s+/g, " ").trim()
}

const SENTINELA = {
  cinza: "SENTINELA-REGUA-CINZA-F05",
  chegaram: "SENTINELA-REGUA-CHEGARAM-F22",
  periodo: "SENTINELA-REGUA-PERIODO-F33",
  faixa: "SENTINELA-FAIXA-RODAPE",
} as const

/**
 * Troca as quatro strings de régua por sentinelas e o total do CTA por um valor
 * impossível de aparecer por acaso. Toca SÓ o modelo — o componente não sabe da
 * existência deste arquivo.
 */
function comSentinelas(d: MapaJornadaDados): MapaJornadaDados {
  return {
    ...d,
    notaPeriodo: SENTINELA.periodo,
    faixaRodape: SENTINELA.faixa,
    mapa: { ...d.mapa, textoRodape: SENTINELA.cinza },
    funil: { ...d.funil, notaRegua: SENTINELA.chegaram },
    travados: { ...d.travados, ctaTotal: 4242 },
  }
}

describe("PONTE RENDER · o modelo chega à tela, e a tela é função dele", () => {
  it("ANTI-VACUIDADE — a fixture calcula uma tela `ok`, com texto de verdade", () => {
    const d = modelo()
    const texto = telaComoTexto(d)

    // Sem isto, todas as varreduras abaixo passariam sobre uma tela vazia.
    expect(d.estado).toBe("ok")
    expect(d.mapa.linhas.length).toBeGreaterThan(0)
    expect(d.funil.linhas.length).toBeGreaterThan(0)
    expect(texto.length).toBeGreaterThan(600)
  })

  it("INVARIÂNCIA — as três réguas de I-2 e a faixa estão na tela, renderizadas", () => {
    const d = modelo()
    const texto = telaComoTexto(d)

    // As quatro precisam ser texto de verdade no modelo, senão `toContain("")`
    // passaria trivialmente.
    for (const s of [d.mapa.textoRodape, d.funil.notaRegua, d.notaPeriodo, d.faixaRodape]) {
      expect(s.length).toBeGreaterThan(20)
      expect(texto).toContain(s)
    }
  })

  it("INVARIÂNCIA — o CTA publica o total COMPLETO da população (F-21)", () => {
    const d = modelo()
    const texto = telaComoTexto(d)

    expect(d.travados.presente).toBe(true)
    expect(texto).toContain(`${d.travados.ctaRotulo} (${d.travados.ctaTotal})`)
    // O total é da população, não do corte: nunca menor que o que está listado.
    expect(d.travados.ctaTotal).toBeGreaterThanOrEqual(d.travados.linhas.length)
  })

  it("VARIÂNCIA — trocar o modelo troca a tela, e o texto antigo SOME", () => {
    const original = modelo()
    const textoOriginal = telaComoTexto(original)
    cleanup()
    const textoTrocado = telaComoTexto(comSentinelas(original))

    for (const sentinela of Object.values(SENTINELA)) {
      expect(textoTrocado, "a tela ignorou o modelo e renderizou literal").toContain(sentinela)
    }
    // O lado que pega o literal cravado no JSX: se a régua estivesse escrita no
    // componente, ela continuaria na tela mesmo depois de sumir do modelo.
    for (const antigo of [
      original.mapa.textoRodape,
      original.funil.notaRegua,
      original.notaPeriodo,
      original.faixaRodape,
    ]) {
      expect(textoTrocado, `"${antigo}" sobreviveu à troca: está cravado no JSX`).not.toContain(
        antigo,
      )
    }
    expect(textoTrocado).not.toBe(textoOriginal)
  })

  it("VARIÂNCIA — o numeral do CTA vem do modelo, não do número de linhas", () => {
    const original = modelo()
    cleanup()
    const texto = telaComoTexto(comSentinelas(original))

    expect(texto).toContain(`${original.travados.ctaRotulo} (4242)`)
    expect(texto).not.toContain(`${original.travados.ctaRotulo} (${original.travados.ctaTotal})`)
  })

  it("VARIÂNCIA — em `vazio` a tela diz a frase da §32 e para de publicar numeral", () => {
    const original = modelo()
    const textoOriginal = telaComoTexto(original)
    const linkGargalos = original.gargalos.linkRodape ?? ""
    expect(linkGargalos.length).toBeGreaterThan(0)
    expect(textoOriginal).toContain(linkGargalos)
    expect(textoOriginal).toContain(original.mapa.totalAlunosLabel)

    // O vazio vem do MOTOR (escopo sem ninguém), não de um objeto montado à
    // mão: um vazio fabricado no teste não passa pelo caminho que a rota real
    // percorre, e foi assim que a Visão geral mediu uma segunda implementação.
    cleanup()
    const vazia = computeMapaJornada({ ...entradaMapaFixture(), escopo: [] })
    const texto = telaComoTexto(vazia)

    expect(vazia.mapa.estado).toBe("vazio")
    expect(vazia.mapa.textoVazio).toBe("Não há pessoas neste recorte.")
    // A frase do DADO chega à tela — não o fallback genérico da UI.
    expect(texto).toContain("Não há pessoas neste recorte.")
    expect(texto).not.toContain("Ainda não há dados suficientes para este bloco.")
    // E o bloco para de publicar: sem link de rodapé, sem chip de contagem,
    // sem lista de zeros. Ausência é dita, não numerada (I-3).
    expect(texto).not.toContain(linkGargalos)
    expect(texto).not.toContain("0 alunos")
    expect(texto).not.toContain("(0%)")
  })

  it("I-3 / V-37 — a tela não publica estado degenerado", () => {
    const texto = telaComoTexto(modelo())

    for (const lixo of ["NaN", "undefined", "null", "Invalid Date", "0 de 0", "+ 0 alunos"]) {
      expect(texto, `a tela renderizou "${lixo}"`).not.toContain(lixo)
    }
  })

  it("DETECTOR — a varredura da tela acusa lixo plantado", () => {
    const d = modelo()
    cleanup()
    const texto = telaComoTexto({ ...d, faixaRodape: "Concluíram NaN de 0 de 0 pessoas." })

    // Sem este controle, o teste acima passaria mesmo com uma varredura cega —
    // que é como um `expect(...)` sem asserção atravessa uma revisão.
    expect(texto).toContain("NaN")
    expect(texto).toContain("0 de 0")
  })

  it("F-34b — nenhum vocabulário punitivo no texto RENDERIZADO", () => {
    const texto = telaComoTexto(modelo()).toLowerCase()

    for (const termo of TERMOS_PUNITIVOS) {
      expect(texto, `a tela usou o termo "${termo}"`).not.toContain(termo)
    }
  })

  it("DETECTOR — o mesmo scanner acusa vocabulário punitivo plantado na tela", () => {
    const d = modelo()
    cleanup()
    const texto = telaComoTexto({
      ...d,
      faixaRodape: "Cobrar quem tem o pior ritmo e publicar o ranking da equipe.",
    }).toLowerCase()

    const acusados = TERMOS_PUNITIVOS.filter((t) => texto.includes(t))
    expect(acusados.length, "scanner cego aprova qualquer texto").toBeGreaterThan(0)
    expect(acusados).toContain("cobrar")
    expect(acusados).toContain("ranking")
  })
})
