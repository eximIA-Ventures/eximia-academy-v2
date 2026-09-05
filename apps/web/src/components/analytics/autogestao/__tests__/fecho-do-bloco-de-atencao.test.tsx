// ---------------------------------------------------------------------------
// D7 / F-V-11 — o rótulo do link que fecha "O que merece minha atenção?".
// ---------------------------------------------------------------------------
// `CRITERIOS-FIDELIDADE.md`, F-V-11: *"O bloco de atenção termina com o link
// **'Ver todos os pontos de atenção →'**"* — reprova quando ausente. A
// auditoria de 28/08 (LOOP-3 §4.1) mediu a frase por busca textual e obteve
// `false`: o build trazia "Ver meu mapa da jornada ›".
//
// A DIVERGÊNCIA ERA DELIBERADA, e está registrada em `visao-geral-tab.tsx`:
// `montagem.ts` §11 produz no máximo 3 itens e a lista renderiza TODOS, então
// um "ver todos" não revelaria nada além do que já está na tela. O argumento
// é bom — e mesmo assim a régua é imutável e fica FORA do alcance de quem é
// medido por ela. Quem decide relaxar F-V-11 é o dono da régua, não esta
// tela. A tensão foi reportada em `FIX-D-telas.md` em vez de virar edição de
// critério.
//
// O DESTINO NÃO MUDA: continua a aba "Meu Mapa da Jornada", onde os módulos
// abertos que originam estes pontos aparecem por extenso. É um lugar que
// existe de verdade — o rótulo passa a ser o da régua, a porta continua sendo
// uma porta.
// ---------------------------------------------------------------------------

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { VisaoGeralAutogestaoTab } from "../visao-geral-tab"
import { visaoGeralCompleta } from "./fixture"

afterEach(cleanup)

const ROTULO_DA_REGUA = "Ver todos os pontos de atenção"

describe("F-V-11 — o fecho do bloco de atenção", () => {
  it("com itens: o link de fecho usa o rótulo da régua", () => {
    render(<VisaoGeralAutogestaoTab dados={visaoGeralCompleta()} />)

    const link = screen.getByRole("link", { name: new RegExp(ROTULO_DA_REGUA, "i") })
    expect(link).toHaveAttribute("href", "/jornada?vista=autogestao&aba=mapa")
  })

  it("o rótulo antigo não sobrevive ao lado do novo", () => {
    // Par de variância: sem isto, ADICIONAR um segundo link passaria no teste
    // acima e deixaria dois fechos concorrentes no mesmo bloco.
    render(<VisaoGeralAutogestaoTab dados={visaoGeralCompleta()} />)
    expect(screen.queryByText(/Ver meu mapa da jornada/i)).not.toBeInTheDocument()
  })

  it("SEM itens: nenhum fecho é oferecido", () => {
    // O invariante que já existia e não pode se perder na troca de rótulo: um
    // "ver todos" pendurado sob "nada precisa da sua atenção agora" convidaria
    // a navegar para conferir um vazio.
    render(
      <VisaoGeralAutogestaoTab
        dados={visaoGeralCompleta({
          atencao: {
            estado: "vazio",
            erro: null,
            textoVazio: "Nada precisa da sua atenção agora.",
            motivoVazio: null,
            itens: [],
          },
        })}
      />,
    )
    expect(screen.queryByText(new RegExp(ROTULO_DA_REGUA, "i"))).not.toBeInTheDocument()
  })
})
