// ---------------------------------------------------------------------------
// `SeletorVistaJornada` — o nível ACIMA das 3 abas, CONTRATO-DE-DADOS.md
// §NAVEGAÇÃO N.3.
// ---------------------------------------------------------------------------
// Mesmo padrão de `moldura-nav.test.tsx`: toda asserção em par presença+
// variância — um `href` que contém a substring certa por acaso não prova a
// costura entre as duas vistas.
// ---------------------------------------------------------------------------

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { SeletorVistaJornada, lerVistaJornada } from "../seletor-vista"

afterEach(cleanup)

const QUERY = "curso=course-1&periodo=30"

function hrefDe(rotulo: string): string {
  return screen.getByRole("link", { name: rotulo }).getAttribute("href") ?? ""
}

describe("SeletorVistaJornada — para onde as 2 vistas apontam", () => {
  it("no PLANO: 'Autogestão' leva a `/jornada?vista=autogestao`, preservando curso/período", () => {
    render(<SeletorVistaJornada vistaAtiva="plano" queryAtual={QUERY} />)

    const href = hrefDe("Autogestão")
    expect(href.startsWith("/jornada?")).toBe(true)
    expect(href).toContain("vista=autogestao")
    expect(href).toContain("curso=course-1")
    expect(href).toContain("periodo=30")
  })

  it("na AUTOGESTÃO: 'Meu Plano' leva a `/jornada?vista=plano`, preservando curso/período", () => {
    render(<SeletorVistaJornada vistaAtiva="autogestao" queryAtual={QUERY} />)

    const href = hrefDe("Meu Plano")
    expect(href.startsWith("/jornada?")).toBe(true)
    expect(href).toContain("vista=plano")
    expect(href).toContain("curso=course-1")
    expect(href).toContain("periodo=30")
  })

  it("VARIÂNCIA · `aba` não sobrevive à troca de vista (cada vista decide a própria entrada)", () => {
    render(<SeletorVistaJornada vistaAtiva="plano" queryAtual={`${QUERY}&aba=padroes`} />)
    expect(hrefDe("Autogestão")).not.toContain("aba=")
  })

  it("a vista ATIVA é marcada com `aria-current`, a outra não", () => {
    render(<SeletorVistaJornada vistaAtiva="plano" queryAtual={QUERY} />)
    expect(screen.getByRole("link", { name: "Meu Plano" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Autogestão" })).not.toHaveAttribute("aria-current")
    cleanup()

    render(<SeletorVistaJornada vistaAtiva="autogestao" queryAtual={QUERY} />)
    expect(screen.getByRole("link", { name: "Autogestão" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Meu Plano" })).not.toHaveAttribute("aria-current")
  })

  // 2026-08-21 — decisão do dono: Autogestão vira o PRIMEIRO item do seletor,
  // refletindo que também é o default de `/jornada` sem `?vista=`.
  it("VARIÂNCIA · 'Autogestão' é o PRIMEIRO item, 'Meu Plano' o segundo, nas duas vistas ativas", () => {
    render(<SeletorVistaJornada vistaAtiva="plano" queryAtual={QUERY} />)
    const rotulos = screen.getAllByRole("link").map((link) => link.textContent)
    expect(rotulos).toEqual(["Autogestão", "Meu Plano"])
    cleanup()

    render(<SeletorVistaJornada vistaAtiva="autogestao" queryAtual={QUERY} />)
    const rotulosNaAutogestao = screen.getAllByRole("link").map((link) => link.textContent)
    expect(rotulosNaAutogestao).toEqual(["Autogestão", "Meu Plano"])
  })
})

describe("lerVistaJornada — o default de `/jornada` sem `?vista=` (decisão do dono, 2026-08-21)", () => {
  it("ausente cai em Autogestão, não mais em Plano", () => {
    expect(lerVistaJornada(undefined)).toBe("autogestao")
  })

  it("PAR VERMELHO: `vista=plano` EXATO é honrado — o default é só para a ausência", () => {
    expect(lerVistaJornada("plano")).toBe("plano")
  })

  it("`vista=autogestao` explícito também é Autogestão (redundante com o default, mas honrado)", () => {
    expect(lerVistaJornada("autogestao")).toBe("autogestao")
  })

  it("valor desconhecido (`?vista=lixo`) cai no mesmo default de Autogestão, nunca em branco", () => {
    expect(lerVistaJornada("lixo")).toBe("autogestao")
  })

  it("string vazia cai em Autogestão", () => {
    expect(lerVistaJornada("")).toBe("autogestao")
  })
})
