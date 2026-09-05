// ---------------------------------------------------------------------------
// D2 (LOOP-3 §3.4/§8) — o card de falha das 3 telas de Aprendizagem do Time
// imprimia LITERALMENTE a mensagem do motor de banco na cara do gestor:
//
//     "Não foi possível carregar a Aprendizagem do Time
//      column capabilities.title does not exist"
//
// Três defeitos num só: (1) vaza nome de tabela e de coluna, (2) está em
// inglês e em vocabulário de banco — não diz nada acionável a um gestor, e
// (3) é beco sem saída: nem "tentar de novo", nem caminho alternativo.
//
// O padrão certo JÁ EXISTE nesta base, na Autogestão: "Falta prova." + o
// motivo em português (`FaltaProva`, `design-autogestao.tsx`). Este teste
// espelha esse padrão em vez de inventar um terceiro idioma de erro.
//
// ESTADO ATUAL DA TELA: o schema foi reconciliado em 28/08 e o erro parou de
// APARECER. O que se corrige aqui é o TRATAMENTO — o caminho de erro continua
// vivo no código, e a próxima falha de leitura voltaria a vazar SQL. Sintoma
// que sumiu não é caminho que sumiu.
// ---------------------------------------------------------------------------

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { entradaFixture, entradaFixtureMapa, entradaFixturePadroes } from "../fixture"
import { MapaCapacidadesTab } from "../mapa-tab"
import { PadroesEvolucaoTab } from "../padroes-tab"
import { VisaoGeralAprendizagemTab } from "../visao-geral-tab"

// A saída "Tentar de novo" re-executa o componente de SERVIDOR
// (`router.refresh()`), então o card é cliente. Mesmo mock que
// `filtro-periodo.test.tsx` já usa nesta base.
const refresh = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/analytics",
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(cleanup)

/** A mensagem REAL que o Postgres devolveu na auditoria de 28/08. */
const MENSAGEM_CRUA = "column capabilities.title does not exist"
const FALHA = { codigo: "42703", mensagem: MENSAGEM_CRUA }

const TELAS = [
  {
    nome: "Visão Geral",
    render: () =>
      render(
        <VisaoGeralAprendizagemTab data={{ ...entradaFixture(), estado: "erro", erro: FALHA }} />,
      ),
  },
  {
    nome: "Padrões e Evolução",
    render: () =>
      render(
        <PadroesEvolucaoTab data={{ ...entradaFixturePadroes(), estado: "erro", erro: FALHA }} />,
      ),
  },
  {
    nome: "Mapa de Capacidades",
    render: () =>
      render(
        <MapaCapacidadesTab data={{ ...entradaFixtureMapa(), estado: "erro", erro: FALHA }} />,
      ),
  },
] as const

describe("D2 — a falha de leitura fala com o gestor, não com o DBA", () => {
  for (const tela of TELAS) {
    it(`${tela.nome}: NÃO imprime a mensagem crua do banco`, () => {
      tela.render()

      // A asserção dura: nenhum pedaço da mensagem do motor chega à tela.
      // Nome de tabela e de coluna são infraestrutura, não informação de
      // produto — e "does not exist" não diz a um gestor o que fazer.
      expect(document.body.textContent).not.toContain(MENSAGEM_CRUA)
      expect(document.body.textContent).not.toContain("capabilities")
      expect(document.body.textContent).not.toContain("does not exist")
    })

    it(`${tela.nome}: diz o que houve em português de gestor`, () => {
      tela.render()

      // Espelha o padrão da Autogestão: a tela declara a falha E promete que
      // nenhum número é exibido enquanto a leitura não for confiável — que é
      // exatamente a informação que muda a decisão de quem lê.
      expect(
        screen.getByText(/Nenhum número é exibido enquanto a leitura não for confiável/i),
      ).toBeInTheDocument()
    })

    it(`${tela.nome}: oferece saída — tentar de novo E caminho alternativo`, () => {
      tela.render()

      // Beco sem saída era metade do defeito. Duas saídas reais:
      // recarregar a leitura, ou ir ao domínio irmão que não depende deste
      // schema (Ativação da Jornada, `lib/analytics/dominios.ts`).
      expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /Ativação da Jornada/i })).toHaveAttribute(
        "href",
        "/analytics",
      )
    })
  }
})
