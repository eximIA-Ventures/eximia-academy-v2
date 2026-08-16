// ---------------------------------------------------------------------------
// Chave de dia UTC — invariante I-6.
// ---------------------------------------------------------------------------
// Regularidade (§8.2) e o baseline pessoal (§13) contam DIAS DISTINTOS. Se a
// chave do dia depender do fuso da máquina que renderiza, o mesmo dado produz
// contagens diferentes no servidor e no cliente e a métrica oscila sem ninguém
// ter tocado no banco.
//
// O idiom é o mesmo já usado em `lib/analytics/area-gestor.ts` (que documenta a
// escolha no comentário): `new Date(x).toISOString().slice(0, 10)`.
//
// PROIBIDO neste caminho, e o motivo: `toLocaleDateString`, `getDate()`,
// `getMonth()`, `getFullYear()`, `date-fns/format` sem TZ, `startOfDay` local e
// `startOfISOWeek` (que `api/analytics/manager/route.ts` importa — esse é o
// precedente a NÃO copiar). Todos leem o fuso do processo.
// ---------------------------------------------------------------------------

import { MS_DIA, MS_SEMANA } from "./parametros"

/** "2026-08-15" — estável em qualquer TZ do processo. */
export function chaveDiaUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Meia-noite UTC do dia que contém `ms`. */
export function inicioDoDiaUtcMs(ms: number): number {
  return Date.parse(`${chaveDiaUtc(ms)}T00:00:00.000Z`)
}

/**
 * Distância em dias UTC INTEIROS entre dois instantes.
 *
 * Os dois lados são normalizados para meia-noite UTC antes da subtração, senão
 * a mesma pessoa aparece com 0 dias por um cálculo (`agora − último` em ms) e 1
 * dia por outro (dia UTC do último vs dia UTC de agora) — a incoerência que o
 * §13 herda de misturar as duas réguas.
 */
export function diasUtcEntre(deMs: number, ateMs: number): number {
  return Math.round((inicioDoDiaUtcMs(ateMs) - inicioDoDiaUtcMs(deMs)) / MS_DIA)
}

/** Dias UTC distintos com carimbo dentro de `[loMs, hiMs)`. */
export function diasDistintosUtc(
  carimbos: readonly number[],
  loMs: number,
  hiMs: number,
): Set<string> {
  const dias = new Set<string>()
  for (const t of carimbos) {
    if (t >= loMs && t < hiMs) dias.add(chaveDiaUtc(t))
  }
  return dias
}

/** Todos os dias UTC distintos da série, ordenados. */
export function diasDistintosOrdenados(carimbos: readonly number[]): string[] {
  return [...new Set(carimbos.map(chaveDiaUtc))].sort()
}

export interface JanelasComparaveis {
  /** [atualInicio, atualFim) — o período selecionado. */
  atualInicio: number
  atualFim: number
  /** [anteriorInicio, anteriorFim) — MESMA duração, imediatamente antes (I-5). */
  anteriorInicio: number
  anteriorFim: number
  duracaoMs: number
}

/**
 * As duas janelas da comparação, derivadas de UMA duração.
 *
 * I-5 é estrutural aqui: não existe caminho de código em que a janela anterior
 * tenha duração diferente da atual, porque as duas saem do mesmo `duracaoMs`.
 * É o mesmo desenho da correção FORM-07 em `api/analytics/aggregate/route.ts`
 * (`prevStart = curStart − periodMs`).
 */
export function janelasComparaveis(agoraMs: number, periodoDias: number): JanelasComparaveis {
  const duracaoMs = periodoDias * MS_DIA
  const atualInicio = agoraMs - duracaoMs
  return {
    atualInicio,
    atualFim: agoraMs,
    anteriorInicio: atualInicio - duracaoMs,
    anteriorFim: atualInicio,
    duracaoMs,
  }
}

/** Quantas semanas CHEIAS cabem na janela (7d→1, 30d→4, 90d→12). */
export function semanasCheias(duracaoMs: number): number {
  return Math.floor(duracaoMs / MS_SEMANA)
}
