import { describe, expect, it } from "vitest"
import { neutralDurations } from "../plan-math"
import {
  JOURNEY_PRESETS,
  applyBump,
  applyDrag,
  desiredDaysFromRatio,
  durationLabel,
  maxDaysAt,
  presetConsequence,
  presetDurations,
  snapDays,
  suggestionBase,
  weeksLabel,
} from "../timeline-engine"

// Constantes canônicas da demo (SPEC §2.2/§2.3): 8 módulos, teto 126, meta 105.
const FINAL = 126
// BASE = distribuição sugerida (×1) da demo — soma 119, cabe no teto.
const BASE = [7, 14, 14, 21, 14, 21, 14, 14]
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const wOn = { cascade: true, unit: "w" as const, finalDeadlineDays: FINAL }
const dOn = { cascade: true, unit: "d" as const, finalDeadlineDays: FINAL }

// ---------------------------------------------------------------------------
// proof-teto.js portado — os 7 casos numéricos do round 19 (teto duro), agora
// como asserções puras sobre o motor (sem Puppeteer/DOM). Numeração espelha o
// harness original.
// ---------------------------------------------------------------------------
describe("proof-teto (round 19) — teto duro do prazo final", () => {
  it("(1) Tranquilo aplicado → soma = 126 (último marco = prazo final), todo módulo >= 4", () => {
    const tranquilo = presetDurations(BASE, 1.3, FINAL)
    expect(sum(tranquilo)).toBe(FINAL)
    expect(Math.min(...tranquilo)).toBeGreaterThanOrEqual(4)
  })

  it("(2) dropdown Tranquilo mostra consequência clampada ('termina ~1 semana depois', não ~5)", () => {
    expect(presetConsequence(BASE, 1.3, FINAL)).toBe("termina ~1 semana depois")
  })

  it("(3) drag do M8 (i=7) muito além do limite → para no limite (soma <= 126)", () => {
    const desired = desiredDaysFromRatio(BASE, 7, 1, FINAL) // ponteiro na borda direita
    const out = applyDrag(BASE, 7, desired, dOn)
    expect(sum(out)).toBeLessThanOrEqual(FINAL)
  })

  it("(4) drag do M4 (i=3) com Auto-ajuste → cascata comprime seguintes (soma <= 126, nenhum < 4)", () => {
    const desired = desiredDaysFromRatio(BASE, 3, 1, FINAL)
    const out = applyDrag(BASE, 3, desired, dOn)
    expect(sum(out)).toBeLessThanOrEqual(FINAL)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(4)
  })

  it("(5) Auto-ajuste OFF, drag do M8 além → clamp no teto global (soma <= 126)", () => {
    const desired = desiredDaysFromRatio(BASE, 7, 1, FINAL)
    const out = applyDrag(BASE, 7, desired, { cascade: false, unit: "d", finalDeadlineDays: FINAL })
    expect(sum(out)).toBeLessThanOrEqual(FINAL)
  })

  it("(6) estado estourado (Tranquilo pré-teto, 153d) é clampado por fitToDeadline no load", () => {
    // porte do (6) do harness: o clamp no load é fitToDeadline (Trilha A), aqui
    // apenas confirmamos que o motor concorda com o teto ao reidratar.
    const stale = [9, 18, 18, 27, 18, 27, 18, 18] // soma 153
    const fitted = presetDurations(stale, 1, FINAL) // fator 1 = passa direto por fitToDeadline
    expect(sum(fitted)).toBe(FINAL)
    expect(Math.min(...fitted)).toBeGreaterThanOrEqual(4)
  })

  it("(7) stepper '+' repetido 30x no M8 nunca estoura o teto (soma <= 126)", () => {
    let days = neutralDurations(8, FINAL) // ponto de partida neutro
    for (let k = 0; k < 30; k++) {
      const r = applyBump(days, 7, +1, wOn)
      days = r.durations
    }
    expect(sum(days)).toBeLessThanOrEqual(FINAL)
  })
})

// ---------------------------------------------------------------------------
// maxDaysAt — teto duro por módulo
// ---------------------------------------------------------------------------
describe("maxDaysAt — teto por módulo", () => {
  it("último módulo pode ocupar toda a folga até o teto", () => {
    // início do M8 = soma dos 7 primeiros = 105 (BASE), teto por módulo = 126-105
    expect(maxDaysAt(BASE, 7, FINAL)).toBe(FINAL - 105)
  })
  it("módulo do meio reserva MIN para cada módulo seguinte", () => {
    // i=3: início = 7+14+14 = 35; módulos após = 4; reserva = 16
    expect(maxDaysAt(BASE, 3, FINAL)).toBe(FINAL - 35 - 16)
  })
})

// ---------------------------------------------------------------------------
// snapDays — semanas | dias
// ---------------------------------------------------------------------------
describe("snapDays — snap semanal vs fino", () => {
  it("modo dias: clamp fino, sem snap", () => {
    expect(snapDays(13, 4, 30, "d")).toBe(13)
    expect(snapDays(2, 4, 30, "d")).toBe(4)
    expect(snapDays(99, 4, 30, "d")).toBe(30)
  })
  it("modo semanas: snapa ao múltiplo de 7 dentro do range", () => {
    expect(snapDays(13, 4, 30, "w")).toBe(14) // 13 → 14
    expect(snapDays(10, 4, 30, "w")).toBe(7) // 10 → 7 (round)
  })
  it("range sem múltiplo de 7 viável degrada para clamp fino (nunca trava)", () => {
    // [8,13] não contém múltiplo de 7 (7<8, 14>13) → clamp fino
    expect(snapDays(11, 8, 13, "w")).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// applyDrag — cascata vs clamp entre vizinhos
// ---------------------------------------------------------------------------
describe("applyDrag — cascata (on) vs clamp entre vizinhos (off)", () => {
  it("Auto-ajuste OFF: só o par (i, i+1) muda; o vizinho absorve, soma preservada", () => {
    const before = [15, 15, 15, 15, 15, 15, 15, 15]
    const out = applyDrag(before, 2, 21, dOnOff().wOff) // encurta pra 21? na verdade alonga
    // pair = days[2]+days[3] = 30; nd clampado a [4, 26]; vizinho = 30-nd
    expect(out[2] + out[3]).toBe(before[2] + before[3])
    // módulos fora do par intactos
    expect(out.slice(0, 2)).toEqual(before.slice(0, 2))
    expect(out.slice(4)).toEqual(before.slice(4))
    expect(sum(out)).toBe(sum(before))
  })
  it("Auto-ajuste OFF: nunca reduz o vizinho abaixo de MIN", () => {
    const before = [15, 15, 15, 15, 15, 15, 15, 15]
    const out = applyDrag(before, 2, 999, dOnOff().wOff) // modo dias, estica além do par
    expect(Math.min(...out)).toBeGreaterThanOrEqual(4)
    expect(out[3]).toBe(4) // vizinho no mínimo
  })
  it("Auto-ajuste ON: encurtar o M1 não altera a soma total além do teto", () => {
    const before = neutralDurations(8, FINAL)
    const out = applyDrag(before, 0, 7, dOn)
    expect(out[0]).toBe(7)
    expect(sum(out)).toBeLessThanOrEqual(FINAL)
  })
})

// helper para o teste OFF acima (evita objeto solto no meio da asserção)
function dOnOff() {
  return { wOff: { cascade: false, unit: "d" as const, finalDeadlineDays: FINAL } }
}

// ---------------------------------------------------------------------------
// applyBump — guarda de movimento válido
// ---------------------------------------------------------------------------
describe("applyBump — no-op quando o snap não move na direção do clique", () => {
  it("'+' no M8 já no teto → changed:false, array intacto", () => {
    // leva o M8 ao teto primeiro
    let days = neutralDurations(8, FINAL)
    for (let k = 0; k < 20; k++) days = applyBump(days, 7, +1, wOn).durations
    const atCeiling = days.slice()
    const r = applyBump(atCeiling, 7, +1, wOn)
    expect(r.changed).toBe(false)
    expect(r.durations).toBe(atCeiling) // mesma referência (no-op)
  })
  it("'-' abaixo do mínimo → changed:false", () => {
    const days = [4, 20, 20, 20, 20, 14, 14, 14]
    const r = applyBump(days, 0, -1, dOn)
    expect(r.changed).toBe(false)
  })
  it("'+' válido no modo dias incrementa 1 dia", () => {
    const days = [10, 14, 14, 14, 14, 14, 14, 14]
    const r = applyBump(days, 0, +1, dOn)
    expect(r.changed).toBe(true)
    expect(r.durations[0]).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// presets — os 3 modelos, todos dentro do teto
// ---------------------------------------------------------------------------
describe("presetDurations / presetConsequence", () => {
  it("Moderado (×1) não muda (119d) e tem copy fixa", () => {
    expect(presetDurations(BASE, 1, FINAL)).toEqual(BASE)
    expect(presetConsequence(BASE, 1, FINAL)).toBe("o equilíbrio sugerido pela IA")
  })
  it("Intenso (×0.75) cabe e termina antes (~4 semanas)", () => {
    const intenso = presetDurations(BASE, 0.75, FINAL)
    expect(sum(intenso)).toBeLessThanOrEqual(FINAL)
    expect(presetConsequence(BASE, 0.75, FINAL)).toBe("termina ~4 semanas antes")
  })
  it("todo preset da lista fecha dentro do teto e nunca abaixo do mínimo", () => {
    for (const { factor } of JOURNEY_PRESETS) {
      const d = presetDurations(BASE, factor, FINAL)
      expect(sum(d)).toBeLessThanOrEqual(FINAL)
      expect(Math.min(...d)).toBeGreaterThanOrEqual(4)
    }
  })
})

// ---------------------------------------------------------------------------
// rótulos
// ---------------------------------------------------------------------------
describe("durationLabel / weeksLabel", () => {
  it("modo semanas: múltiplo exato sem decimal, não-múltiplo com vírgula", () => {
    expect(durationLabel(14, "w")).toBe("2 semanas")
    expect(durationLabel(7, "w")).toBe("1 semana")
    expect(durationLabel(10, "w")).toBe("1,4 semanas")
  })
  it("modo dias: singular/plural", () => {
    expect(durationLabel(1, "d")).toBe("1 dia")
    expect(durationLabel(15, "d")).toBe("15 dias")
  })
  it("weeksLabel independe do modo (intervalo por extenso)", () => {
    expect(weeksLabel(119)).toBe("17 semanas")
    expect(weeksLabel(120)).toBe("17,1 semanas")
  })
})

// ---------------------------------------------------------------------------
// desiredDaysFromRatio — geometria pixel→dia
// ---------------------------------------------------------------------------
describe("desiredDaysFromRatio — mapa ponteiro→duração", () => {
  it("ratio 0 (borda esquerda, 10d antes de T0) → duração negativa clampável ao mínimo", () => {
    // no M1, início = 0; ponteiro em -10d → desired = -10, o snap clampa a >= 4
    expect(desiredDaysFromRatio(BASE, 0, 0, FINAL)).toBe(-10)
  })
  it("ratio 1 no último módulo devolve duração muito acima do teto (será clampada)", () => {
    const d = desiredDaysFromRatio(BASE, 7, 1, FINAL)
    expect(d).toBeGreaterThan(FINAL - 105) // acima do maxDaysAt do M8
  })
})

// ---------------------------------------------------------------------------
// suggestionBase — base ×1 portável
// ---------------------------------------------------------------------------
describe("suggestionBase — distribuição base portável", () => {
  it("uniforme quando sem pesos, dentro do teto", () => {
    const base = suggestionBase(8, FINAL)
    expect(base.length).toBe(8)
    expect(sum(base)).toBeLessThanOrEqual(FINAL)
    expect(Math.min(...base)).toBeGreaterThanOrEqual(4)
  })
  it("pesos enviesam a distribuição (módulo mais pesado recebe mais dias)", () => {
    const base = suggestionBase(3, FINAL, [1, 4, 1])
    expect(base[1]).toBeGreaterThan(base[0])
    expect(base[1]).toBeGreaterThan(base[2])
  })
})
