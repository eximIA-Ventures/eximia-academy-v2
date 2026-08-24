// ---------------------------------------------------------------------------
// Cálculo puro compartilhado pelos blocos da Tela 1 — nenhum I/O, nenhum
// `Date.now()` (tudo entra por `fonte.agoraMs`). Espelha o papel de
// `lib/analytics/visao-geral/base.ts`: a fonte crua vira agregados
// reutilizáveis, e cada bloco lê daqui em vez de recalcular.
// ---------------------------------------------------------------------------

import type { FonteAprendizagem, LinhaAvaliacao, LinhaCapacidade, LinhaEvidencia } from "./fonte"
import type { EstadoMaturidade } from "./tipos"

export interface Janelas {
  atualInicio: number
  atualFim: number
  anteriorInicio: number
  anteriorFim: number
}

export interface BaseCalculo {
  janelas: Janelas
  capacidades: readonly LinhaCapacidade[]
  /** Evidências ocorridas no período atual, na ordem de leitura. */
  evidenciasPeriodoAtual: readonly LinhaEvidencia[]
  evidenciasPeriodoAnterior: readonly LinhaEvidencia[]
  /** Quem produziu ao menos uma evidência no período atual — o "aprendiz elegível" da §7. */
  alunosElegiveisPeriodoAtual: ReadonlySet<string>
  alunosElegiveisPeriodoAnterior: ReadonlySet<string>
  /** Estado CORRENTE por `studentId:capabilityId` (a linha `is_current`). */
  estadoAtualPorPar: ReadonlyMap<string, EstadoMaturidade>
  /** Estado que estava vigente no FIM do período anterior — reconstruído do histórico, para o delta §9.4/§14. */
  estadoAnteriorPorPar: ReadonlyMap<string, EstadoMaturidade>
}

export function montarJanelas(agoraMs: number, periodoDias: number): Janelas {
  const atualFim = agoraMs
  const atualInicio = atualFim - periodoDias * 86_400_000
  const anteriorFim = atualInicio
  const anteriorInicio = anteriorFim - periodoDias * 86_400_000
  return { atualInicio, atualFim, anteriorInicio, anteriorFim }
}

function estadoVigenteEm(
  historico: readonly LinhaAvaliacao[],
  instanteMs: number,
): EstadoMaturidade | null {
  let ultima: LinhaAvaliacao | null = null
  for (const a of historico) {
    if (a.createdAtMs <= instanteMs && (!ultima || a.createdAtMs > ultima.createdAtMs)) ultima = a
  }
  return ultima?.newState ?? null
}

export function montarBase(fonte: FonteAprendizagem): BaseCalculo {
  const janelas = montarJanelas(fonte.agoraMs, fonte.periodoDias)

  const evidenciasPeriodoAtual = fonte.evidencias.filter(
    (e) => e.occurredAtMs >= janelas.atualInicio && e.occurredAtMs <= janelas.atualFim,
  )
  const evidenciasPeriodoAnterior = fonte.evidencias.filter(
    (e) => e.occurredAtMs >= janelas.anteriorInicio && e.occurredAtMs < janelas.anteriorFim,
  )

  const alunosElegiveisPeriodoAtual = new Set(evidenciasPeriodoAtual.map((e) => e.studentId))
  const alunosElegiveisPeriodoAnterior = new Set(evidenciasPeriodoAnterior.map((e) => e.studentId))

  const estadoAtualPorPar = new Map<string, EstadoMaturidade>()
  const historicoPorPar = new Map<string, LinhaAvaliacao[]>()
  for (const a of fonte.avaliacoes) {
    const chave = `${a.studentId}:${a.capabilityId}`
    if (a.isCurrent) estadoAtualPorPar.set(chave, a.newState)
    const lista = historicoPorPar.get(chave) ?? []
    lista.push(a)
    historicoPorPar.set(chave, lista)
  }

  const estadoAnteriorPorPar = new Map<string, EstadoMaturidade>()
  for (const [chave, historico] of historicoPorPar) {
    const estado = estadoVigenteEm(historico, janelas.anteriorFim)
    if (estado) estadoAnteriorPorPar.set(chave, estado)
  }

  return {
    janelas,
    capacidades: fonte.capacidades,
    evidenciasPeriodoAtual,
    evidenciasPeriodoAnterior,
    alunosElegiveisPeriodoAtual,
    alunosElegiveisPeriodoAnterior,
    estadoAtualPorPar,
    estadoAnteriorPorPar,
  }
}

// ===========================================================================
// Guardas de amostra e tendência — §7 da spec, literais.
// ===========================================================================

export const AMOSTRA_MIN_APRENDIZES = 3
export const AMOSTRA_MIN_EVIDENCIAS = 5
export const TENDENCIA_MIN_PERIODOS = 2

export function amostraSuficiente(alunosElegiveis: number, evidenciasAvaliaveis: number): boolean {
  return alunosElegiveis >= AMOSTRA_MIN_APRENDIZES && evidenciasAvaliaveis >= AMOSTRA_MIN_EVIDENCIAS
}

/** Só há tendência declarável com pelo menos 2 períodos comparáveis (§7). */
export function tendenciaDisponivel(periodosComparaveis: number): boolean {
  return periodosComparaveis >= TENDENCIA_MIN_PERIODOS
}

// ===========================================================================
// Métricas de evidência — §9.1-9.3, reaproveitadas por placar.ts e mudancas.ts.
// ===========================================================================

/** §9.1: % de evidências avaliáveis com compreensão suficiente ("evidenced"). */
export function pctCompreensao(evidencias: readonly LinhaEvidencia[]): number | null {
  const avaliaveis = evidencias.filter((e) => e.comprehension !== null)
  if (avaliaveis.length === 0) return null
  const ok = avaliaveis.filter((e) => e.comprehension === "evidenced").length
  return Math.round((ok / avaliaveis.length) * 100)
}

/** §9.2: % de evidências com profundidade nível 4+ (aplicação/análise/síntese/insight). Threshold documentado como configurável pela spec. */
export const LIMIAR_PROFUNDIDADE_ALTA = 4

export function pctProfundidade(evidencias: readonly LinhaEvidencia[]): number | null {
  const comNivel = evidencias.filter((e) => e.depthLevel !== null)
  if (comNivel.length === 0) return null
  const altas = comNivel.filter((e) => (e.depthLevel ?? 0) >= LIMIAR_PROFUNDIDADE_ALTA).length
  return Math.round((altas / comNivel.length) * 100)
}

/** §9.3: % de APRENDIZES (não de evidências) com ao menos uma aplicação contextualizada ou real. */
export function pctAplicacao(
  evidencias: readonly LinhaEvidencia[],
  elegiveis: ReadonlySet<string>,
): number | null {
  if (elegiveis.size === 0) return null
  const comAplicacao = new Set(
    evidencias
      .filter(
        (e) => e.applicationLevel === "contextualized" || e.applicationLevel === "applied_real",
      )
      .map((e) => e.studentId),
  )
  let contam = 0
  for (const id of elegiveis) if (comAplicacao.has(id)) contam++
  return Math.round((contam / elegiveis.size) * 100)
}

/** Profundidade média (1-7) — usada como dimensão de evolução do placar (§9.4, decisão MVP documentada em placar.ts). */
export function profundidadeMedia(evidencias: readonly LinhaEvidencia[]): number | null {
  const niveis = evidencias.map((e) => e.depthLevel).filter((n): n is number => n !== null)
  if (niveis.length === 0) return null
  return niveis.reduce((a, b) => a + b, 0) / niveis.length
}
