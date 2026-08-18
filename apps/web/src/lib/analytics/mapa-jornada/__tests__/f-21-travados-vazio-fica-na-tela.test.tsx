// ---------------------------------------------------------------------------
// F-21 na SUPERFÍCIE — o bloco §26 não some; o que some é o número dele.
// ---------------------------------------------------------------------------
// O DEFEITO QUE ESTE ARQUIVO PRENDE. `f-21-existencia-condicional.test.ts` mede
// a CAMADA: com 19% de concentração, `presente:false` + `estado:"vazio"`. Isso
// está certo e continua certo. O que ninguém media era o passo seguinte: o
// componente lia esse `presente:false` e devolvia `null`, e o card inteiro
// evaporava da linha 2 — as três colunas se redistribuíam e a tela mudava de
// forma sem dizer por quê.
//
// A DISTINÇÃO QUE O DEFEITO APAGAVA. A §26 diz que a existência do bloco
// depende de haver concentração real: isso governa o CONTEÚDO (não inventar
// concentração onde não há). A §32 governa a SUPERFÍCIE: estado vazio se
// comunica com TEXTO EXPLÍCITO, nunca com ausência. Um card que some deixa o
// gestor sem saber se não há concentração ou se a consulta quebrou — é a mesma
// classe do achado A-1 (falha apresentada como tela limpa), só que pela porta
// do layout em vez da porta do dado.
//
// POR QUE ELE MEDE A TELA E NÃO O OBJETO. Um campo obrigatório no tipo garante
// que o motor PRODUZ o `textoVazio`; não garante que o componente o RENDERIZA.
// A camada já estava correta quando o card sumia — `montarTravados` devolvia
// `estado:"vazio"` com a frase preenchida, e a frase morria no JSX. É a lição 3
// desta série outra vez: o dado certo, obrigatório no tipo, e mudo na tela.
//
// OS TRÊS ESTADOS ENTRAM AQUI DE PROPÓSITO. Um teste que só olhasse o vazio
// seria satisfeito por um card que renderiza sempre a mesma frase; um que só
// olhasse o erro não pegaria o colapso inverso. O título tem de estar nos três,
// e as DUAS frases (vazio e erro) nunca podem aparecer juntas.
// ---------------------------------------------------------------------------

import { MapaJornadaTab } from "@/components/analytics/mapa-jornada/mapa-jornada-tab"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { ChaveFonteMapa, FonteMapaJornada, MapaJornadaDados } from "../index"
import { computeMapaJornada, fonteDaEntradaMapa, montarMapaJornada } from "../index"
import type { EntradaMapaJornada } from "./contrato"
import { acrescentarPessoa, entradaBase } from "./contrato"

afterEach(cleanup)

/** O literal da referência visual, não a constante: se a constante mudar sem a
 *  referência mudar junto, é isto que tem de acusar. */
const TITULO = "Pessoas que travaram no mesmo ponto"
/** §32 — a frase de "não há concentração". */
const FRASE_VAZIO = "Nenhum gargalo relevante foi identificado neste período."
/** §32 — a frase de "a consulta falhou". Nunca a mesma da de cima. */
const FRASE_ERRO = "Não foi possível carregar este bloco agora."

function telaComoTexto(dados: MapaJornadaDados): string {
  const { container } = render(<MapaJornadaTab dados={dados} />)
  return (container.textContent ?? "").replace(/\s+/g, " ").trim()
}

/**
 * 4 pessoas no módulo âncora e roster 21 ⇒ 19%, um ponto abaixo do piso de
 * `CONCENTRACAO_MODULO_PCT`. Mesma entrada de `f-21-existencia-condicional`:
 * o vazio vem do MOTOR, não de um objeto montado à mão — um vazio fabricado no
 * teste não passa pelo caminho que a rota real percorre.
 */
function semConcentracao(): EntradaMapaJornada {
  let e = entradaBase()
  for (let i = 0; i < 7; i++) {
    e = acrescentarPessoa(e, `X${i}`, `Extra ${i} Silva`, "C1-solucao-de-problemas")
  }
  return e
}

function comFalhaEm(e: EntradaMapaJornada, chave: ChaveFonteMapa): FonteMapaJornada {
  const fonte = fonteDaEntradaMapa(e)
  return {
    ...fonte,
    falhas: { ...fonte.falhas, [chave]: { codigo: "PGRST000", mensagem: "falha sintética" } },
  }
}

describe("F-21 · superfície — o bloco §26 fica na tela em vazio e em erro", () => {
  it("ANTI-VACUIDADE — a entrada de 19% cai mesmo no ramo vazio, e o resto da tela está ok", () => {
    const d = computeMapaJornada(semConcentracao())

    // Se isto mudar, todo o resto deste arquivo passa a medir outra coisa.
    expect(d.travados.presente).toBe(false)
    expect(d.travados.estado).toBe("vazio")
    expect(d.travados.motivoVazio).toBe("sem-gargalos")
    expect(d.travados.textoVazio).toBe(FRASE_VAZIO)
    expect(d.travados.titulo).toBe(TITULO)

    // O card de gargalos está OK — logo a frase da §32 na tela só pode ter
    // vindo do §26, e não de um vizinho que também esvaziou.
    expect(d.gargalos.estado).toBe("ok")
    expect(d.mapa.estado).toBe("ok")
    expect(d.funil.estado).toBe("ok")
  })

  it("§32 — sem concentração, o card PERMANECE e diz o porquê", () => {
    const texto = telaComoTexto(computeMapaJornada(semConcentracao()))

    // O defeito: o card sumia inteiro e a linha 2 se redistribuía em silêncio.
    expect(texto, "o bloco §26 sumiu da tela em vez de dizer que está vazio").toContain(TITULO)
    expect(texto).toContain("Pessoas que estão paradas no mesmo módulo há mais tempo.")
    // A frase vem do DADO, não do fallback genérico da UI.
    expect(texto).toContain(FRASE_VAZIO)
    expect(texto).not.toContain("Ainda não há dados suficientes para este bloco.")
  })

  it("I-3 — em vazio o card para de publicar numeral, e não se veste de erro", () => {
    const texto = telaComoTexto(computeMapaJornada(semConcentracao()))

    // Ausência é dita, não numerada: o CTA com o total zerado seria "0 pessoas
    // para apoiar", que é uma afirmação, não um estado vazio.
    expect(texto).not.toContain("Ver pessoas (0)")
    expect(texto).not.toContain("Ver pessoas")
    // E "não há concentração" NUNCA se apresenta como falha de sistema.
    expect(texto).not.toContain(FRASE_ERRO)
  })

  it("DISCRIMINANTE — falha de leitura mostra o card com a frase de ERRO, não a de vazio", () => {
    const d = montarMapaJornada(comFalhaEm(entradaBase(), "percorrido"), { cursoFiltroNome: null })
    expect(d.travados.presente).toBe(false)
    expect(d.travados.estado).toBe("erro")

    const texto = telaComoTexto(d)

    expect(texto).toContain(TITULO)
    expect(texto).toContain(FRASE_ERRO)
    // O código cru do PostgREST entra: esconder é o que produziu o achado A-1.
    expect(texto).toContain("PGRST000")
    // As duas frases da §32 são excludentes — colapsá-las apresenta falha de
    // banco como boa notícia sobre a equipe.
    expect(texto).not.toContain(FRASE_VAZIO)
  })

  it("VARIÂNCIA — com concentração o mesmo card volta a publicar a lista e o CTA", () => {
    const d = computeMapaJornada(entradaBase())
    expect(d.travados.presente).toBe(true)
    expect(d.travados.estado).toBe("ok")

    const texto = telaComoTexto(d)

    expect(texto).toContain(TITULO)
    expect(texto).toContain(`${d.travados.ctaRotulo} (${d.travados.ctaTotal})`)
    // O título aparece nos três estados; as frases da §32, só nos seus.
    expect(texto).not.toContain(FRASE_VAZIO)
    expect(texto).not.toContain(FRASE_ERRO)
  })
})
