// ---------------------------------------------------------------------------
// A MOLDURA das duas abas novas — o que ela promete tem de sobreviver ao clique.
// ---------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE. A rota `/analytics` está atrás do middleware
// (`middleware.ts`, `protectedPaths`), então um `curl` sem sessão devolve 307
// ANTES de a página existir — ele prova que a borda não quebrou, e mais nada.
// Nenhuma requisição sem sessão renderiza esta moldura. O que sobra para
// verificar a costura é isto: renderizar o componente e olhar o resultado.
//
// O QUE ESTÁ SOB TESTE, e é o que quebra em silêncio: a §3.4 da spec exige que
// os filtros permaneçam selecionados ao navegar entre as três abas. Isso não é
// uma propriedade da tela, é uma propriedade do HREF — um `?tab=padroes` cru
// substituiria a query inteira e apagaria `?periodo=`, `?curso=` e `?escopo=`. O
// gestor cairia noutra aba com OUTRO recorte, e nada na tela diria isso. Um
// número diferente com a mesma cara é o defeito mais caro desta série de telas.
//
// TODA ASSERÇÃO VEM EM PAR (presença + variância). Verificar só que o href
// contém `periodo=90` é satisfeito por um literal cravado no componente; por
// isso cada item também exige que o valor ANTIGO suma quando a entrada muda.
// ---------------------------------------------------------------------------

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MolduraAba } from "../moldura"

// `FiltrosEscopo` é `"use client"` e usa os três hooks de rota. Em jsdom não há
// roteador: o mock existe para o componente montar, não para ser verificado —
// o que este arquivo mede são os HREFS da barra de abas.
vi.mock("next/navigation", () => ({
  usePathname: () => "/analytics",
  useSearchParams: () => new URLSearchParams("periodo=90&escopo=hierarquia"),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(cleanup)

const CURSO = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
const QUERY = `periodo=90&escopo=hierarquia&curso=${CURSO}`

const CONTROLES = {
  periodoDias: 90,
  escopoEquipe: "hierarquia" as const,
  escopoEditavel: true,
  cursoId: CURSO,
  cursos: [{ id: CURSO, titulo: "Liderança na prática" }],
  falhaCursos: false,
}

function montar(aba: "padroes" | "mapa", query: string) {
  return render(
    <MolduraAba
      aba={aba}
      destino={{ pathname: "/analytics", query }}
      controles={{ ...CONTROLES, cursoId: query.includes(CURSO) ? CURSO : null }}
    />,
  )
}

/** O `href` do rótulo, lido da árvore renderizada — nunca recalculado aqui. */
function hrefDa(rotulo: string): string {
  return screen.getByRole("link", { name: rotulo }).getAttribute("href") ?? ""
}

describe("MolduraAba — a barra que as três abas compartilham", () => {
  it("serve os três destinos da trinca, com a aba pedida marcada", () => {
    montar("padroes", QUERY)

    expect(hrefDa("Visão geral")).toContain("tab=visao-geral")
    expect(hrefDa("Padrões e tendências")).toContain("tab=padroes")
    expect(hrefDa("Mapa da jornada")).toContain("tab=mapa")

    // A marcação é do item ATIVO, e só dele.
    expect(screen.getByRole("link", { name: "Padrões e tendências" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Mapa da jornada" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("move a marcação quando a aba muda — a barra não é um desenho fixo", () => {
    montar("mapa", QUERY)

    expect(screen.getByRole("link", { name: "Mapa da jornada" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Padrões e tendências" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("§3.4 · período, escopo e curso viajam para as OUTRAS duas abas", () => {
    montar("padroes", QUERY)

    for (const rotulo of ["Visão geral", "Padrões e tendências", "Mapa da jornada"]) {
      const href = hrefDa(rotulo)
      expect(href, rotulo).toContain("periodo=90")
      expect(href, rotulo).toContain("escopo=hierarquia")
      expect(href, rotulo).toContain(`curso=${CURSO}`)
    }
  })

  it("VARIÂNCIA · troca a query e os filtros antigos SOMEM dos destinos", () => {
    // O par da asserção acima: se os `href` fossem literais cravados no
    // componente, o bloco anterior passaria e este reprovaria.
    montar("mapa", "periodo=7")

    for (const rotulo of ["Visão geral", "Padrões e tendências", "Mapa da jornada"]) {
      const href = hrefDa(rotulo)
      expect(href, rotulo).toContain("periodo=7")
      expect(href, rotulo).not.toContain("periodo=90")
      expect(href, rotulo).not.toContain("escopo=hierarquia")
      expect(href, rotulo).not.toContain(CURSO)
    }
  })

  it("o `?tab=` da query de origem não sobrevive duplicado no destino", () => {
    // A rota monta `destino.query` já SEM o `tab`; mesmo assim, um `tab` que
    // vazasse para cá não pode gerar dois no mesmo href — o servidor leria o
    // primeiro e o gestor cairia na aba errada.
    montar("padroes", "tab=legado&periodo=30")

    const href = hrefDa("Mapa da jornada")
    expect(href.match(/tab=/g)).toHaveLength(1)
    expect(href).toContain("tab=mapa")
  })

  it("cada aba anuncia o próprio nome e o que responde", () => {
    const { unmount } = montar("padroes", QUERY)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Padrões e tendências")
    expect(screen.getByText(/comportamento da equipe se move/i)).toBeInTheDocument()
    unmount()

    montar("mapa", QUERY)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mapa da jornada")
    expect(screen.getByText(/onde cada pessoa está no percurso/i)).toBeInTheDocument()
  })
})
