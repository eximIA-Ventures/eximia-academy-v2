import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CAP_ANCORA,
  type SaidaMapa,
  apenas,
  calcular,
  diasAtras,
  entradaUmCurso,
} from "./contrato"

/**
 * F-04 · Estado da célula — EM ANDAMENTO (laranja).
 *
 * INVARIÂNCIA: sessão `abandoned` num capítulo sem telemetria ⇒ LARANJA, não
 *   cinza. A pessoa esteve lá; exigir `completed` trocaria a pergunta ("chegou
 *   até aqui?") por outra ("terminou?") e apagaria justamente quem começou e
 *   parou. Mesma régua de `sessionChaptersOf` e `whereStoppedChapterIdOf`.
 * VARIÂNCIA: as TRÊS transições exercitadas na MESMA fixture —
 *   cinza→laranja (chega uma reflexão), laranja→verde (completa o percorrido),
 *   laranja→cinza (some a única sessão).
 */
function celulas(r: SaidaMapa, alunoId: string): readonly string[] {
  return r.mapa.linhas.find((l) => l.alunoId === alunoId)?.celulas ?? []
}

const SO_P09 = () => apenas(entradaUmCurso(), ["P01", "P09"])

describe("F-04 · célula em andamento", () => {
  it("INVARIÂNCIA — sessão `abandoned` sem telemetria pinta laranja", async () => {
    const base = SO_P09()
    const r = await calcular({
      ...base,
      sessoes: [
        {
          alunoId: "P09",
          capituloId: CAPS_A[0] as string,
          status: "abandoned",
          criadaEmISO: diasAtras(3),
        },
      ],
    })
    expect(celulas(r, "P09")[0]).toBe("em-andamento")
  })

  it("VARIÂNCIA — cinza vira laranja quando chega uma reflexão", async () => {
    const base = SO_P09()
    const antes = await calcular(base)
    expect(celulas(antes, "P09")[1]).toBe("nao-iniciado")

    const depois = await calcular({
      ...base,
      reflexoes: [{ alunoId: "P09", slideId: `${CAPS_A[1]}-s0`, criadaEmISO: diasAtras(3) }],
    })
    expect(celulas(depois, "P09")[1]).toBe("em-andamento")
  })

  it("VARIÂNCIA — laranja vira verde quando o percorrido completa", async () => {
    const base = apenas(entradaUmCurso(), ["P01", "P05"])
    const antes = await calcular(base)
    expect(celulas(antes, "P05")[5]).toBe("em-andamento")

    const depois = await calcular({
      ...base,
      percorrido: [
        {
          alunoId: "P05",
          capituloId: CAP_ANCORA,
          maxSlideIndex: 3,
          slidesTotalNaPassagem: 4,
          chegouAoFimISO: diasAtras(90),
          ultimaVistaISO: diasAtras(90),
        },
      ],
    })
    expect(celulas(depois, "P05")[5]).toBe("concluido")
  })

  it("VARIÂNCIA — laranja vira cinza quando some a única sessão", async () => {
    const base = apenas(entradaUmCurso(), ["P01", "P05"])
    const r = await calcular({ ...base, sessoes: [] })
    expect(celulas(r, "P05")[5]).toBe("nao-iniciado")
  })
})
