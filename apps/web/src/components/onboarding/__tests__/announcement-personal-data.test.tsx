// ---------------------------------------------------------------------------
// Novidade 1 (`percorrido-vs-conclusao`) — o bloco "No seu caso" e os dois
// cartões falam do dado REAL de quem está lendo.
//
// O DEFEITO que estes testes prendem (Hugo, com print, 2026-08-05): o modal
// afirmava "Percorrido em 100% e Conclusão em 50%… falta fechar 4 módulos"
// para TODA pessoa, porque os três números eram literais — a frase em
// `PERCORRIDO_PAGES[0].destaque` e o par `v: "100%"` / `v: "50%"` dentro de
// `Cartoes()`. Um aluno com 42% e 10% via, na mesma tela, a tabela "Meu ritmo"
// dizendo a verdade e o modal dizendo outra coisa.
//
// A régua destes testes é a MESMA da tabela: inteiro arredondado seguido de
// "%", e a contagem de módulos vinda de `openModulesText` — a função que a
// linha Conclusão já usa. Se as duas superfícies divergirem, uma delas mente.
//
// B9 (convenção da casa, `student-home-indicators.ts`): sem dado é `null`
// EXPLÍCITO, nunca um 0 fabricado. Aqui isso vira: o bloco some, e o cartão
// fica sem número — jamais um percentual inventado.
// ---------------------------------------------------------------------------

import type { StudentProgressSnapshot } from "@/lib/onboarding/types"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PERCORRIDO_PAGES } from "../announcement-content"
import { AnnouncementModal } from "../announcement-modal"

/** Aluno bem atrás: percorreu pouco e fechou menos ainda. */
const ATRASADO: StudentProgressSnapshot = {
  percorridoPct: 42,
  conclusaoPct: 10,
  totalModules: 8,
}

/** Aluno que percorreu tudo e fechou metade — o caso que virou literal. */
const PERCORREU_TUDO: StudentProgressSnapshot = {
  percorridoPct: 100,
  conclusaoPct: 50,
  totalModules: 6,
}

/** Nada medido para esta pessoa. */
const SEM_DADO: StudentProgressSnapshot = {
  percorridoPct: null,
  conclusaoPct: null,
  totalModules: null,
}

function renderNovidade1(stats: StudentProgressSnapshot | null) {
  return render(
    <AnnouncementModal
      pagina={PERCORRIDO_PAGES[0]}
      stats={stats}
      passo={1}
      total={1}
      selo="Novidade 1 de 2"
      onAvancar={vi.fn()}
      onPular={vi.fn()}
      rotuloPular="Pular"
    />,
  )
}

/** O texto do bloco "No seu caso", ou `null` quando o bloco não existe. */
function destaqueTexto(): string | null {
  const marcador = screen.queryByText(/No seu caso:/)
  return marcador?.parentElement?.textContent ?? null
}

describe("Novidade 1 — os números são os do aluno, não uma frase fixa", () => {
  it("um aluno de 42%/10% vê 42% e 10%, nunca o par 100%/50%", () => {
    renderNovidade1(ATRASADO)

    expect(screen.getByText("42%")).toBeInTheDocument()
    expect(screen.getByText("10%")).toBeInTheDocument()
    expect(screen.queryByText("100%")).not.toBeInTheDocument()
    expect(screen.queryByText("50%")).not.toBeInTheDocument()
  })

  it("a frase 'No seu caso' cita os percentuais reais e a contagem real de módulos", () => {
    renderNovidade1(ATRASADO)

    const texto = destaqueTexto()
    expect(texto).toContain("Percorrido em 42%")
    expect(texto).toContain("Conclusão em 10%")
    // 10% de 8 módulos ≈ 1 fechado → 7 abertos. A conta é `openModulesText`,
    // a mesma da linha Conclusão da tabela "Meu ritmo".
    expect(texto).toContain("7 de 8 módulos ainda abertos")
    // O número literal do defeito, com o denominador que ele nem tinha.
    expect(texto).not.toContain("falta fechar 4 módulos")
  })

  it("um SEGUNDO aluno, com outros números, vê outra frase — a prova de que é computado", () => {
    renderNovidade1(PERCORREU_TUDO)

    const texto = destaqueTexto()
    expect(texto).toContain("Percorrido em 100%")
    expect(texto).toContain("Conclusão em 50%")
    // 50% de 6 → 3 fechados, 3 abertos. O "4" antigo era de outra pessoa.
    expect(texto).toContain("3 de 6 módulos ainda abertos")
    expect(texto).not.toContain("4 módulos")
  })

  it("quem já fechou tudo não é convidado a fechar mais nada", () => {
    renderNovidade1({ percorridoPct: 100, conclusaoPct: 100, totalModules: 6 })

    const texto = destaqueTexto()
    expect(texto).toContain("Todos os módulos fechados")
    expect(texto).not.toContain("ainda abertos")
    expect(texto).not.toContain("caminho mais curto")
  })
})

describe("Novidade 1 — sem dado degrada, nunca fabrica número (B9)", () => {
  it("sem percorrido e sem conclusão, o bloco 'No seu caso' não existe", () => {
    renderNovidade1(SEM_DADO)

    expect(screen.queryByText(/No seu caso:/)).not.toBeInTheDocument()
  })

  it("sem dado, os cartões ficam sem percentual — nenhum 0% inventado", () => {
    const { container } = renderNovidade1(SEM_DADO)

    // Os dois cartões continuam explicando o conceito…
    expect(screen.getByText("Percorrido")).toBeInTheDocument()
    expect(screen.getByText("Conclusão")).toBeInTheDocument()
    // …mas nenhum número aparece na tela.
    expect(container.textContent).not.toMatch(/\d+%/)
  })

  it("stats ausente (chamador que ainda não passa o dado) também não inventa nada", () => {
    const { container } = renderNovidade1(null)

    expect(screen.queryByText(/No seu caso:/)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\d+%/)
  })

  it("percorrido medido e conclusão medida entram cada um no seu cartão, mesmo sem denominador", () => {
    renderNovidade1({ percorridoPct: 75, conclusaoPct: 25, totalModules: null })

    expect(screen.getByText("75%")).toBeInTheDocument()
    expect(screen.getByText("25%")).toBeInTheDocument()
    const texto = destaqueTexto()
    expect(texto).toContain("Percorrido em 75%")
    expect(texto).toContain("Conclusão em 25%")
    // Sem total de módulos não há contagem afirmável — e nenhuma é inventada.
    expect(texto).not.toMatch(/módulos ainda abertos/)
  })
})

describe("Novidade 1 — o conteúdo não carrega mais número de pessoa nenhuma", () => {
  it("`destaque` é derivado do dado, não uma string pronta", () => {
    expect(typeof PERCORRIDO_PAGES[0].destaque).toBe("function")
  })
})

describe("Nenhum número de exemplo sobrou no caminho de produção", () => {
  /**
   * O `?onboarding=percorrido` mostrava um snapshot canned de 100%/50% até o
   * Hugo decidir, em 2026-08-05, que a demonstração deve refletir o progresso
   * REAL de quem confere. A constante que carregava esses números foi removida
   * de `lib/onboarding/preview.ts`.
   *
   * Este teste é o guarda do buraco que ela deixou: se alguém reintroduzir um
   * par de números de exemplo em qualquer lugar do módulo de conteúdo, ele
   * falha. A prova de que a demonstração agora lê dado real vive em
   * `lib/onboarding/__tests__/progress-snapshot.test.ts`, onde o artefato da
   * demonstração é alimentado ao resolvedor de verdade.
   */
  it("o conteúdo da novidade 1 não contém percentual nem contagem literal", () => {
    const pagina = PERCORRIDO_PAGES[0]
    const textoEstatico = `${pagina.corpo} ${pagina.botao}`

    expect(textoEstatico).not.toMatch(/\d+%/)
    expect(textoEstatico).not.toMatch(/\d+\s+módulos?/)
  })
})
