// ---------------------------------------------------------------------------
// Bucket de evidências em semanas UTC — usado pela série temporal da Tela 2
// (§18). Puro: recebe `agoraMs` de fora, nunca lê o relógio do sistema.
//
// Janela fixa de 10 semanas terminando em `agoraMs`, INDEPENDENTE de
// `periodoDias` (7/30/90). Decisão MVP documentada, não literal da spec: um
// gráfico de tendência semanal precisa de mais histórico do que os 7 dias do
// filtro mais curto permitem mostrar como linha — a spec não fixa o
// comprimento da janela do gráfico, só a granularidade (semanal, §18) e a
// exigência de leitura textual (§18.1).
// ---------------------------------------------------------------------------

import type { LinhaEvidencia } from "./fonte"

export const NUM_SEMANAS_SERIE = 10
const SEMANA_MS = 7 * 86_400_000

/** Início (segunda-feira 00:00 UTC) da semana que contém `ms`. */
function inicioDaSemanaUTC(ms: number): number {
  const d = new Date(ms)
  const diaSemana = d.getUTCDay() // 0=domingo..6=sábado
  const deltaParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1
  const meiaNoite = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return meiaNoite - deltaParaSegunda * 86_400_000
}

export interface JanelaSemana {
  inicioMs: number
  fimMs: number
  rotulo: string
}

/** As últimas `NUM_SEMANAS_SERIE` semanas, em ordem cronológica, terminando na semana de `agoraMs`. */
export function ultimasSemanas(agoraMs: number, quantidade = NUM_SEMANAS_SERIE): JanelaSemana[] {
  const inicioSemanaAtual = inicioDaSemanaUTC(agoraMs)
  const semanas: JanelaSemana[] = []
  for (let i = quantidade - 1; i >= 0; i--) {
    const inicioMs = inicioSemanaAtual - i * SEMANA_MS
    const fimMs = inicioMs + SEMANA_MS
    const d = new Date(inicioMs)
    const rotulo = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    semanas.push({ inicioMs, fimMs, rotulo })
  }
  return semanas
}

/** Evidências cujo `occurredAtMs` cai dentro de `[janela.inicioMs, janela.fimMs)`. */
export function evidenciasDaSemana(
  evidencias: readonly LinhaEvidencia[],
  janela: JanelaSemana,
): LinhaEvidencia[] {
  return evidencias.filter(
    (e) => e.occurredAtMs >= janela.inicioMs && e.occurredAtMs < janela.fimMs,
  )
}
