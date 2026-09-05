// ---------------------------------------------------------------------------
// D6 / F-V-20 — a linha "Atualizado há …" sob o seletor de período.
// ---------------------------------------------------------------------------
// `CRITERIOS-FIDELIDADE.md`, F-V-20: *"Há a linha **'Atualizado há Xh'** com
// ícone de recarregar, sob o seletor"* — reprova quando ausente. A auditoria
// de 28/08 mediu `/Atualizado h[áa]/i` no `innerText` das 3 telas e obteve
// `false` (LOOP-3 §4.1). A régua é imutável: a tela é que se ajusta a ela.
//
// SOBRE O "Xh" DA RÉGUA. A régua declara, no próprio cabeçalho, que *"os
// valores literais continuam NÃO sendo critério"* — o que ela mede é a
// presença da linha e do ícone. E o "3h" da referência do dono não existe
// aqui: estas páginas são renderizadas por requisição (auth por cookie, sem
// cache estático), então o dado na tela foi lido NESTA requisição. Escrever
// "há 3h" seria inventar uma defasagem que não aconteceu — o mesmo defeito
// que `FaltaProva` existe para impedir em toda esta tela. Por isso a linha
// diz a verdade ("há instantes" no caminho de hoje) e aceita um carimbo real
// quando um dia houver cache para reportar.
//
// A moldura é COMPARTILHADA pelas 3 abas, como o próprio seletor (F-V-18) —
// então a linha nasce nas 3 de uma vez, não só na Tela 1.
// ---------------------------------------------------------------------------

import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MolduraAutogestao } from "../moldura"

// `FiltroPeriodoAutogestao` é `"use client"` e usa usePathname/useRouter.
// Mock para o componente montar — igual a `moldura-nav.test.tsx`.
vi.mock("next/navigation", () => ({
  usePathname: () => "/jornada",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

afterEach(cleanup)

const QUERY = "vista=autogestao&tenant=cory-alimentos&estudante=aluno-1&periodo=30"

function montar(props: Partial<{ atualizadoEm: Date; agora: Date }> = {}) {
  return render(
    <MolduraAutogestao abaAtiva="visao-geral" queryAtual={QUERY} periodoDias={30} {...props}>
      <div>conteúdo</div>
    </MolduraAutogestao>,
  )
}

describe("F-V-20 — a linha 'Atualizado há …' sob o seletor de período", () => {
  it("a linha existe, e diz 'Atualizado há'", () => {
    montar()
    expect(screen.getByText(/Atualizado h[áa]/i)).toBeInTheDocument()
  })

  it("a linha traz o ícone de recarregar ao lado", () => {
    montar()
    const linha = screen.getByTestId("atualizado-em")
    expect(within(linha).getByTestId("icone-recarregar")).toBeInTheDocument()
  })

  it("fica SOB o seletor de período, não em outro canto da moldura", () => {
    montar()
    const seletor = screen.getByLabelText("Filtrar por período")
    const linha = screen.getByTestId("atualizado-em")
    // O par que prova a POSIÇÃO e não só a presença: os dois vivem na mesma
    // coluna à direita do cabeçalho, e a linha vem DEPOIS do seletor no fluxo.
    const coluna = seletor.closest("[data-slot='coluna-periodo']")
    expect(coluna).not.toBeNull()
    expect(coluna?.contains(linha)).toBe(true)
    expect(seletor.compareDocumentPosition(linha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("com carimbo real, reporta a defasagem MEDIDA — nunca um número fixo", () => {
    // PAR DE VARIÂNCIA: sem este teste, uma string cravada ("Atualizado há
    // 3h") passaria nos três anteriores. Aqui a leitura tem 3 horas de idade
    // declaradas, e a linha tem que dizer isso.
    const agora = new Date("2026-08-21T12:00:00Z")
    const atualizadoEm = new Date("2026-08-21T09:00:00Z")
    montar({ atualizadoEm, agora })
    expect(screen.getByTestId("atualizado-em").textContent).toMatch(/Atualizado h[áa] 3\s*h/i)
  })

  it("sem defasagem a reportar (leitura desta requisição), diz 'há instantes'", () => {
    const agora = new Date("2026-08-21T12:00:00Z")
    montar({ atualizadoEm: agora, agora })
    expect(screen.getByTestId("atualizado-em").textContent).toMatch(/Atualizado h[áa] instantes/i)
  })
})
