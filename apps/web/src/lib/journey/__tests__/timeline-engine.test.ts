import { describe, expect, it } from "vitest"
import { MIN_DAYS_PER_MODULE, type RemainingWindow, neutralDurations } from "../plan-math"
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

// ===========================================================================
// JRN-E — mecânica consciente do progresso, sobre progresso ESPARSO
//
// O aluno real do lançamento (JRN-E §1.2) tem os módulos 0,1,2,4 concluídos e o
// **3 intocado no meio**. Todo teste abaixo usa esse padrão de propósito: um
// fixture de prefixo ("os N primeiros") passaria mesmo num desenho que quebra
// para este aluno, e não provaria nada.
// ===========================================================================

/** Janela do aluno real: 4 concluídos NÃO-prefixo, 67 dias restantes. */
const SPARSE: RemainingWindow = {
  anchorDate: "2026-03-01",
  remainingDays: 67,
  expired: false,
  frozenIndices: [0, 1, 2, 4],
  remainingIndices: [3, 5, 6, 7],
}
const FROZEN_ZERO = (d: number[]) => SPARSE.frozenIndices.map((i) => d[i])
const LIVE_SUM = (d: number[]) => SPARSE.remainingIndices.reduce((a, i) => a + d[i], 0)
/** Estado inicial coerente com a janela: concluídos em 0, vivos repartindo 67. */
const START = [0, 0, 0, 20, 0, 20, 15, 12]

describe("JRN-E — janela restante com concluídos ESPARSOS (0,1,2,4)", () => {
  it("maxDaysAt: concluído não tem teto (é 0); vivo reserva MIN só para os VIVOS seguintes", () => {
    for (const i of SPARSE.frozenIndices) {
      expect(maxDaysAt(START, i, 999, SPARSE)).toBe(0)
    }
    // i=3 é o 1º vivo: 67 − 0 (antes) − 3 vivos depois × 4 = 55
    expect(maxDaysAt(START, 3, 999, SPARSE)).toBe(67 - 0 - 3 * MIN_DAYS_PER_MODULE)
    // i=5 é o 2º vivo: início = 20 (o módulo 3), 2 vivos depois
    expect(maxDaysAt(START, 5, 999, SPARSE)).toBe(67 - 20 - 2 * MIN_DAYS_PER_MODULE)
    // o módulo 4 (concluído) entre 3 e 5 NÃO entra na conta: se entrasse com
    // qualquer duração, este número mudaria.
  })

  it("applyDrag em concluído é no-op absoluto (mesmos valores)", () => {
    for (const i of SPARSE.frozenIndices) {
      const out = applyDrag(START, i, 40, {
        cascade: true,
        unit: "d",
        finalDeadlineDays: 999,
        window: SPARSE,
      })
      expect(out).toEqual(START)
    }
  })

  it("applyDrag em vivo pula os concluídos e nunca fura o teto", () => {
    const out = applyDrag(START, 3, 999, {
      cascade: true,
      unit: "d",
      finalDeadlineDays: 999,
      window: SPARSE,
    })
    expect(FROZEN_ZERO(out)).toEqual([0, 0, 0, 0])
    expect(LIVE_SUM(out)).toBeLessThanOrEqual(SPARSE.remainingDays)
    for (const i of SPARSE.remainingIndices) {
      expect(out[i]).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
    }
  })

  it("applyDrag com Auto-ajuste OFF: o vizinho que absorve é o próximo VIVO, não o concluído", () => {
    const opts = { cascade: false, unit: "d" as const, finalDeadlineDays: 999, window: SPARSE }
    const out = applyDrag(START, 3, 30, opts)
    // o par é (3, 5) — o 4 está no meio, concluído, e continua em 0
    expect(out[4]).toBe(0)
    expect(out[3] + out[5]).toBe(START[3] + START[5])
    expect(out[6]).toBe(START[6])
    expect(out[7]).toBe(START[7])
  })

  it("applyBump em concluído é no-op; em vivo respeita o teto da janela", () => {
    for (const i of SPARSE.frozenIndices) {
      const r = applyBump(START, i, +1, {
        cascade: true,
        unit: "w",
        finalDeadlineDays: 999,
        window: SPARSE,
      })
      expect(r.changed).toBe(false)
      expect(r.durations).toBe(START)
    }
    let days = START.slice()
    for (let k = 0; k < 30; k++) {
      days = applyBump(days, 7, +1, {
        cascade: true,
        unit: "w",
        finalDeadlineDays: 999,
        window: SPARSE,
      }).durations
    }
    expect(LIVE_SUM(days)).toBeLessThanOrEqual(SPARSE.remainingDays)
    expect(FROZEN_ZERO(days)).toEqual([0, 0, 0, 0])
  })

  it("applyBump no ÚLTIMO vivo cai no ramo cascata mesmo com concluído depois dele", () => {
    // janela em que o último módulo (7) está concluído: o último VIVO é o 6.
    const tailFrozen: RemainingWindow = {
      ...SPARSE,
      frozenIndices: [0, 1, 2, 4, 7],
      remainingIndices: [3, 5, 6],
    }
    const d = [0, 0, 0, 20, 0, 20, 15, 0]
    const r = applyBump(d, 6, +1, {
      cascade: false,
      unit: "w",
      finalDeadlineDays: 999,
      window: tailFrozen,
    })
    // com cascade OFF num módulo que NÃO é o último vivo, haveria par; aqui é o
    // último vivo, então o ramo é o do teto duro — e o teto segura.
    const sum = tailFrozen.remainingIndices.reduce((a, i) => a + r.durations[i], 0)
    expect(sum).toBeLessThanOrEqual(tailFrozen.remainingDays)
    expect(r.durations[7]).toBe(0)
  })

  it("presetDurations: os 3 modelos travam os concluídos em 0 e cabem na janela", () => {
    const base = suggestionBase(8, 999, [3, 5, 4, 5, 6, 5, 4, 3], SPARSE)
    expect(FROZEN_ZERO(base)).toEqual([0, 0, 0, 0])
    for (const { factor } of JOURNEY_PRESETS) {
      const d = presetDurations(base, factor, 999, SPARSE)
      expect(FROZEN_ZERO(d)).toEqual([0, 0, 0, 0])
      expect(LIVE_SUM(d)).toBeLessThanOrEqual(SPARSE.remainingDays)
      for (const i of SPARSE.remainingIndices) {
        expect(d[i]).toBeGreaterThanOrEqual(MIN_DAYS_PER_MODULE)
      }
    }
  })

  it("presetConsequence reflete o valor REAL clampado dentro da janela", () => {
    const base = suggestionBase(8, 999, undefined, SPARSE)
    // Tranquilo (×1.3) não cabe inteiro em 67 dias: a consequência é o clamp,
    // nunca a promessa não-clampada.
    const tranquiloSum = LIVE_SUM(presetDurations(base, 1.3, 999, SPARSE))
    expect(tranquiloSum).toBeLessThanOrEqual(SPARSE.remainingDays)
    expect(presetConsequence(base, 1, 999, SPARSE)).toBe("o equilíbrio sugerido pela IA")
  })

  it("suggestionBase distribui só entre os vivos, com peso, dentro da janela", () => {
    const base = suggestionBase(8, 999, [1, 1, 1, 9, 1, 1, 1, 1], SPARSE)
    expect(base).toHaveLength(8)
    expect(FROZEN_ZERO(base)).toEqual([0, 0, 0, 0])
    expect(LIVE_SUM(base)).toBeLessThanOrEqual(SPARSE.remainingDays)
    // o módulo 3 tem peso 9 contra 1 dos outros vivos
    expect(base[3]).toBeGreaterThan(base[5])
  })

  it("teto duro: nenhuma sequência de arraste + preset + arraste consegue furá-lo", () => {
    let d = START.slice()
    const opts = { cascade: true, unit: "d" as const, finalDeadlineDays: 999, window: SPARSE }
    const base = suggestionBase(8, 999, undefined, SPARSE)
    for (let round = 0; round < 5; round++) {
      for (const i of [3, 5, 6, 7]) d = applyDrag(d, i, 999, opts)
      d = presetDurations(base, 1.3, 999, SPARSE)
      for (const i of [7, 6, 5, 3]) d = applyDrag(d, i, 999, opts)
      expect(LIVE_SUM(d)).toBeLessThanOrEqual(SPARSE.remainingDays)
      expect(FROZEN_ZERO(d)).toEqual([0, 0, 0, 0])
    }
  })

  it("janela IMPOSSÍVEL (teto vencido): vivos no mínimo, concluídos em 0, sem explodir", () => {
    const expired: RemainingWindow = { ...SPARSE, remainingDays: 0, expired: true }
    const d = applyDrag(START, 3, 999, {
      cascade: true,
      unit: "d",
      finalDeadlineDays: 999,
      window: expired,
    })
    for (const i of expired.remainingIndices) expect(d[i]).toBe(MIN_DAYS_PER_MODULE)
    for (const i of expired.frozenIndices) expect(d[i]).toBe(0)
  })

  it("desiredDaysFromRatio com eixo de trilho: o início vem de trackStarts, não da soma dos dias", () => {
    // com concluídos ocupando largura visual, a soma das durações NÃO é a
    // posição do módulo no trilho — passar trackStarts é o que evita o drag
    // "pulando" quando há buraco no meio.
    const trackStarts = [0, 6, 12, 18, 38, 44, 64, 79]
    const plain = desiredDaysFromRatio(START, 5, 0.5, 100)
    const tracked = desiredDaysFromRatio(START, 5, 0.5, 100, trackStarts)
    expect(tracked).not.toBe(plain)
    // ponteiro no meio da janela [-10, 142] → dia 66; menos o início 44 = 22
    expect(tracked).toBe(Math.round(-10 + 0.5 * 152) - 44)
  })
})
