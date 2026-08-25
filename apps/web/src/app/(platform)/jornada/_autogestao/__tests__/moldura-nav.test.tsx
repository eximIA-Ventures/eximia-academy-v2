// ---------------------------------------------------------------------------
// `MolduraAutogestao` — os HREFS das 3 abas, no produto e sob override.
// ---------------------------------------------------------------------------
// Nasce do achado do dono navegando os harnesses `/gauntlet-preview/
// autogestao-*`: as 3 abas levavam para `/jornada`, a rota REAL atrás de
// login, e o clique saía do preview direto para o muro de auth. A correção
// foi uma prop `hrefDeAba` OPCIONAL — este arquivo é a prova dupla que a
// mudança é estritamente aditiva:
//
//   1) SEM `hrefDeAba` (o caso do produto, `_visao-geral/painel.tsx` e
//      irmãos), o `href` de cada aba continua `/jornada?...`, byte a byte
//      igual ao de antes desta mudança — nenhum teste do produto podia
//      confirmar isso até aqui, e por isso é o par vermelho que faltava.
//   2) COM `hrefDeAba` (o caso dos 3 harnesses de preview), o `href` segue o
//      override, não mais `/jornada`.
//
// Mesmo padrão de `analytics/_trinca/__tests__/moldura.test.tsx`: toda
// asserção em par presença+variância, porque um `href` que contém a
// substring certa por acaso (ou por literal cravado) não prova a costura.
// ---------------------------------------------------------------------------

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MolduraAutogestao } from "../moldura"

// `FiltroPeriodoAutogestao` (dentro da moldura) é `"use client"` e usa
// usePathname/useRouter/useTransition. Em jsdom não há roteador: o mock
// existe para o componente montar, não para ser verificado — o que este
// arquivo mede são os `href` da barra de abas, não o filtro de período.
vi.mock("next/navigation", () => ({
  usePathname: () => "/jornada",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(cleanup)

const QUERY = "vista=autogestao&tenant=cory-alimentos&estudante=aluno-1&periodo=30"

function montar(hrefDeAba?: (aba: "visao-geral" | "padroes" | "mapa") => string) {
  return render(
    <MolduraAutogestao abaAtiva="padroes" queryAtual={QUERY} periodoDias={30} hrefDeAba={hrefDeAba}>
      <div>conteúdo</div>
    </MolduraAutogestao>,
  )
}

/** O `href` do rótulo, lido da árvore renderizada — nunca recalculado aqui. */
function hrefDa(rotulo: string): string {
  return screen.getByRole("link", { name: rotulo }).getAttribute("href") ?? ""
}

describe("MolduraAutogestao — para onde as 3 abas apontam", () => {
  it("PAR VERMELHO · produto (sem `hrefDeAba`): as 3 abas continuam em `/jornada`, preservando a query", () => {
    montar()

    for (const rotulo of ["Visão Geral", "Meus Padrões e Tendências", "Meu Mapa da Jornada"]) {
      const href = hrefDa(rotulo)
      expect(href.startsWith("/jornada?"), rotulo).toBe(true)
      expect(href, rotulo).toContain("vista=autogestao")
      expect(href, rotulo).toContain("tenant=cory-alimentos")
      expect(href, rotulo).toContain("estudante=aluno-1")
      expect(href, rotulo).toContain("periodo=30")
    }

    expect(hrefDa("Visão Geral")).toContain("aba=visao-geral")
    expect(hrefDa("Meus Padrões e Tendências")).toContain("aba=padroes")
    expect(hrefDa("Meu Mapa da Jornada")).toContain("aba=mapa")
  })

  it("VARIÂNCIA · override presente: nenhuma aba aponta mais para `/jornada`", () => {
    montar((aba) => `/gauntlet-preview/autogestao-${aba}?${QUERY}`)

    for (const rotulo of ["Visão Geral", "Meus Padrões e Tendências", "Meu Mapa da Jornada"]) {
      const href = hrefDa(rotulo)
      expect(href, rotulo).not.toContain("/jornada")
      expect(href, rotulo).toContain("/gauntlet-preview/autogestao-")
    }

    expect(hrefDa("Visão Geral")).toBe(`/gauntlet-preview/autogestao-visao-geral?${QUERY}`)
    expect(hrefDa("Meus Padrões e Tendências")).toBe(
      `/gauntlet-preview/autogestao-padroes?${QUERY}`,
    )
    expect(hrefDa("Meu Mapa da Jornada")).toBe(`/gauntlet-preview/autogestao-mapa?${QUERY}`)
  })

  it("N.3 · a moldura embute o caminho de VOLTA ao Plano ('Meu Plano', `vista=plano`)", () => {
    montar()
    const href = hrefDa("Meu Plano")
    expect(href.startsWith("/jornada?")).toBe(true)
    expect(href).toContain("vista=plano")
    expect(href).toContain("tenant=cory-alimentos")
    expect(href).toContain("estudante=aluno-1")
    expect(href).toContain("periodo=30")
    // `aba` não sobrevive à volta — o plano não tem abas.
    expect(href).not.toContain("aba=")
  })

  it("a aba ATIVA continua marcada, com ou sem override", () => {
    montar()
    expect(screen.getByRole("link", { name: "Meus Padrões e Tendências" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    cleanup()

    montar((aba) => `/gauntlet-preview/autogestao-${aba}`)
    expect(screen.getByRole("link", { name: "Meus Padrões e Tendências" })).toHaveAttribute(
      "aria-current",
      "page",
    )
  })
})
