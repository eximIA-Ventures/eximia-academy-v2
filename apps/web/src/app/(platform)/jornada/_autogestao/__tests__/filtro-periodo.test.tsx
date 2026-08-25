// ---------------------------------------------------------------------------
// `FiltroPeriodoAutogestao` — trava de regressão para a navegação por URL.
// ---------------------------------------------------------------------------
// Nasce de uma MUTAÇÃO deliberada durante o handoff do dropdown (F-V-18,
// CRITERIOS-FIDELIDADE.md): trocar o `router.push` para navegar SEM
// reescrever `?periodo=` nem preservar o resto da query fez os 136 testes
// existentes da suíte passarem inalterados — nenhum deles exercitava o CLIQUE
// na opção do controle. Este arquivo fecha esse buraco: prova que escolher
// uma opção do dropdown preserva `vista`/`aba`/`tenant`/`estudante`/`agora` e
// escreve o `periodo` novo, e que o rótulo do gatilho reflete o valor ativo.
// ---------------------------------------------------------------------------
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FiltroPeriodoAutogestao } from "../filtro-periodo"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/jornada",
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}))

beforeEach(() => {
  push.mockClear()
})

const QUERY_COMPLETA =
  "vista=autogestao&aba=visao-geral&tenant=cory-alimentos&estudante=aluno-1&agora=2026-08-21T12%3A00%3A00.000Z&periodo=30"

describe("FiltroPeriodoAutogestao", () => {
  it("o gatilho mostra o rótulo do período ativo", () => {
    render(<FiltroPeriodoAutogestao periodoDias={30} queryAtual={QUERY_COMPLETA} />)
    expect(screen.getByText("Últimos 30 dias")).toBeInTheDocument()
  })

  it("abrindo o dropdown, as 3 opções ficam alcançáveis", () => {
    render(<FiltroPeriodoAutogestao periodoDias={30} queryAtual={QUERY_COMPLETA} />)
    fireEvent.click(screen.getByLabelText("Filtrar por período"))

    expect(screen.getByRole("menuitem", { name: /Últimos 7 dias/ })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Últimos 30 dias/ })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Últimos 90 dias/ })).toBeInTheDocument()
  })

  // PAR VERMELHO — a prova que a mutação do handoff derrubaria: escolher "7
  // dias" precisa gravar `periodo=7` E preservar TODO o resto da query
  // (vista, aba, tenant, estudante, agora). Um `router.push(pathname)` sem
  // querystring (a mutação testada manualmente) faz esta asserção falhar.
  it("escolher uma opção reescreve `?periodo=` preservando o resto da query", () => {
    render(<FiltroPeriodoAutogestao periodoDias={30} queryAtual={QUERY_COMPLETA} />)
    fireEvent.click(screen.getByLabelText("Filtrar por período"))
    fireEvent.click(screen.getByRole("menuitem", { name: /Últimos 7 dias/ }))

    expect(push).toHaveBeenCalledTimes(1)
    const [url, options] = push.mock.calls[0]
    const [pathname, querystring] = url.split("?")
    const parametros = new URLSearchParams(querystring)

    expect(pathname).toBe("/jornada")
    expect(parametros.get("periodo")).toBe("7")
    expect(parametros.get("vista")).toBe("autogestao")
    expect(parametros.get("aba")).toBe("visao-geral")
    expect(parametros.get("tenant")).toBe("cory-alimentos")
    expect(parametros.get("estudante")).toBe("aluno-1")
    expect(parametros.get("agora")).toBe("2026-08-21T12:00:00.000Z")
    expect(options).toEqual({ scroll: false })
  })

  it("valor inválido cai no default (30 dias) sem quebrar o rótulo", () => {
    // @ts-expect-error — exercitando o fallback defensivo do componente.
    render(<FiltroPeriodoAutogestao periodoDias={15} queryAtual={QUERY_COMPLETA} />)
    expect(screen.getByText("Últimos 30 dias")).toBeInTheDocument()
  })
})
