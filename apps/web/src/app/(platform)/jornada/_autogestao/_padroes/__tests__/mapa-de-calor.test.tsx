// ---------------------------------------------------------------------------
// `CardGradeHorarios` / `CardCalendarioAtividade` — os dois blocos novos do
// mapa de calor de atividade, Autogestão da minha Jornada, Tela 2.
// ---------------------------------------------------------------------------
// Teste DIRETO dos componentes (sem passar por `PainelPadroes`/sessão — os
// dois são apresentação pura, mesmo padrão de `cartoes.tsx`), com um
// `ResultadoMapaDeCalor` construído à mão. A costura com `painel.tsx` (que
// `carimbosDeAtividade`/`montarMapaDeCalorAtividade` são chamados com os
// argumentos certos) é responsabilidade de `painel.test.tsx`.
// ---------------------------------------------------------------------------

import type {
  CalendarioMapaDeCalor,
  GradeMapaDeCalor,
  ResultadoMapaDeCalor,
} from "@/lib/analytics/autogestao/tipos"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CardCalendarioAtividade, CardGradeHorarios } from "../mapa-de-calor"

afterEach(cleanup)

const SEM_LASTRO: ResultadoMapaDeCalor = {
  lastro: "ausente",
  motivo: "você ainda tem poucos registros de atividade para revelar um padrão de dias e horários",
}

/** Grade 7×12 densa, com UMA célula alta (terça, 20h–22h) e UMA baixa (quinta, 10h–12h). */
function gradeFixture(): GradeMapaDeCalor {
  return {
    celulas: Array.from({ length: 7 }, (_, diaSemana) =>
      Array.from({ length: 12 }, (_, faixa) => {
        let contagem = 0
        if (diaSemana === 2 && faixa === 10) contagem = 9 // terça, 20h–22h — a mais alta
        if (diaSemana === 4 && faixa === 5) contagem = 1 // quinta, 10h–12h — a mais baixa
        return { diaSemana, faixa, contagem }
      }),
    ),
    maximo: 9,
  }
}

function calendarioFixture(): CalendarioMapaDeCalor {
  const semana = (indice: number, rotulo: string, contagemAlta: number, contagemBaixa: number) => ({
    indice,
    inicioMs: indice * 604_800_000,
    fimMs: (indice + 1) * 604_800_000,
    rotulo,
    dias: Array.from({ length: 7 }, (_, i) => ({
      diaUtc: `2026-06-${String(indice * 7 + i + 1).padStart(2, "0")}`,
      contagem: i === 1 ? contagemAlta : i === 4 ? contagemBaixa : 0,
    })),
  })
  return {
    semanas: [semana(0, "2 – 8 jun", 6, 1), semana(1, "9 – 15 jun", 6, 1)],
    maximo: 6,
  }
}

function comLastro(): ResultadoMapaDeCalor {
  return { grade: gradeFixture(), calendario: calendarioFixture() }
}

describe("CardGradeHorarios — grade dia × faixa", () => {
  it("SEM LASTRO — declara a ausência com o motivo real, nunca desenha a grade", () => {
    const { container } = render(<CardGradeHorarios resultado={SEM_LASTRO} />)

    expect(screen.getByText("Meus horários de estudo")).toBeInTheDocument()
    expect(screen.getByText("Falta prova.")).toBeInTheDocument()
    expect(screen.getByText(/você ainda tem poucos registros de atividade/)).toBeInTheDocument()
    expect(container.querySelector("[data-celula-horario]")).not.toBeInTheDocument()
  })

  it("COM LASTRO — desenha as 84 células (7 dias × 12 faixas), sempre densas", () => {
    const { container } = render(<CardGradeHorarios resultado={comLastro()} />)

    expect(container.querySelectorAll("[data-celula-horario]")).toHaveLength(7 * 12)
  })

  it("rótulo de dia (à esquerda) e de faixa (no topo) estão presentes", () => {
    render(<CardGradeHorarios resultado={comLastro()} />)

    for (const dia of ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]) {
      expect(screen.getAllByText(dia).length).toBeGreaterThan(0)
    }
    // Faixas de 2h: rótulo do topo é a hora de início ("0".."22").
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getByText("22")).toBeInTheDocument()
  })

  it("uma célula de contagem alta é distinguível de uma de contagem baixa por algo além da cor", () => {
    const { container } = render(<CardGradeHorarios resultado={comLastro()} />)

    const alta = container.querySelector('[data-celula-horario][aria-label*="9 atividades"]')
    const baixa = container.querySelector('[data-celula-horario][aria-label*="1 atividade"]')
    expect(alta).toBeTruthy()
    expect(baixa).toBeTruthy()
    // O `title` (acessível ao passar o mouse, sem depender de percepção de
    // cor) carrega o MESMO texto do `aria-label` — o valor é alcançável por
    // dois canais que não são tom de cor.
    expect(alta?.getAttribute("title")).toContain("9 atividades")
    expect(baixa?.getAttribute("title")).toContain("1 atividade")
    // E o nível de intensidade (que governa a cor) realmente difere — a
    // célula mais alta da amostra ocupa o tom mais escuro DESTA grade.
    //
    // NÃO se crava um número aqui (2026-08-24). A escala é por QUANTIL sobre os
    // valores positivos DISTINTOS presentes: uma grade com dois valores (1 e 9)
    // tem dois níveis, não cinco. O componente recusa fabricar 4 limiares
    // repetidos para fingir variação que a amostra não tem — e essa recusa é o
    // comportamento correto, não um defeito a contornar.
    //
    // Cravar "4" testaria a fixture, não a regra: bastaria a fixture ganhar um
    // terceiro valor para o teste quebrar sem que nada tivesse piorado. O que
    // importa é a ORDEM (alta acima de baixa) e o TOPO relativo (a maior da
    // amostra ocupa o último nível existente).
    const nivelAlta = Number(alta?.getAttribute("data-nivel"))
    const nivelBaixa = Number(baixa?.getAttribute("data-nivel"))
    expect(nivelAlta).toBeGreaterThan(nivelBaixa)
    expect(nivelBaixa).toBeGreaterThan(0)

    const niveis = [...container.querySelectorAll("[data-celula-horario]")]
      .map((c) => Number(c.getAttribute("data-nivel")))
      .filter((n) => Number.isFinite(n))
    expect(nivelAlta).toBe(Math.max(...niveis))
  })

  it("uma célula com contagem zero é distinguível de uma com contagem alta pelo `aria-label`/`title`", () => {
    const { container } = render(<CardGradeHorarios resultado={comLastro()} />)

    const zerada = container.querySelector('[data-celula-horario][data-nivel="0"]')
    expect(zerada).toBeTruthy()
    expect(zerada?.getAttribute("aria-label")).toContain("0 atividades")
  })
})

describe("CardCalendarioAtividade — semana × dia", () => {
  it("SEM LASTRO — declara a ausência com o motivo real, nunca desenha o calendário", () => {
    const { container } = render(<CardCalendarioAtividade resultado={SEM_LASTRO} />)

    expect(screen.getByText("Meu calendário de atividade")).toBeInTheDocument()
    expect(screen.getByText("Falta prova.")).toBeInTheDocument()
    expect(container.querySelector("[data-celula-calendario]")).not.toBeInTheDocument()
  })

  it("COM LASTRO — desenha 7 dias por semana, para todas as semanas do resultado", () => {
    const { container } = render(<CardCalendarioAtividade resultado={comLastro()} />)

    expect(container.querySelectorAll("[data-celula-calendario]")).toHaveLength(2 * 7)
  })

  it("uma célula de contagem alta é distinguível de uma de contagem baixa por algo além da cor", () => {
    const { container } = render(<CardCalendarioAtividade resultado={comLastro()} />)

    const alta = container.querySelector('[data-celula-calendario][aria-label*="6 atividades"]')
    const baixa = container.querySelector('[data-celula-calendario][aria-label*="1 atividade"]')
    expect(alta).toBeTruthy()
    expect(baixa).toBeTruthy()
    expect(alta?.getAttribute("data-nivel")).not.toBe(baixa?.getAttribute("data-nivel"))
  })
})
