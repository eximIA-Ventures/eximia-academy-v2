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
import { SeletorVistaJornada } from "../seletor-vista"

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
})
