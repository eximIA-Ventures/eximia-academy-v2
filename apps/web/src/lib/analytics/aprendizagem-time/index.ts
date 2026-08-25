// ---------------------------------------------------------------------------
// Aprendizagem do Time — porta de entrada da camada de dados da Tela 1.
// Mesmo contrato arquitetural de `lib/analytics/visao-geral/index.ts`: UMA
// função, somente leitura, escopo resolvido por fora (nunca aqui).
// ---------------------------------------------------------------------------

import type { ClienteLeitura } from "./fonte-supabase"
import { lerFonteAprendizagem } from "./fonte-supabase"
import type { ContextoDeTela } from "./montagem"
import { montarVisaoGeralAprendizagem } from "./montagem"
import { montarMapaCapacidades } from "./montagem-mapa"
import { montarPadroesEvolucao } from "./montagem-padroes"
import type {
  MapaCapacidadesDados,
  PadroesEvolucaoDados,
  VisaoGeralAprendizagemDados,
} from "./tipos"

export interface ParametrosAprendizagemTime {
  db: ClienteLeitura
  tenantId: string
  /** Universo já resolvido por `resolverRecorteDaTrinca` — nunca resolvido aqui. */
  escopoAlunoIds: readonly string[] | null
  /** null = "Todos os cursos". */
  cursoId: string | null
  agoraMs: number
  periodoDias: 7 | 30 | 90
  contexto: ContextoDeTela
}

export async function carregarVisaoGeralAprendizagem(
  p: ParametrosAprendizagemTime,
): Promise<VisaoGeralAprendizagemDados> {
  const fonte = await lerFonteAprendizagem({
    db: p.db,
    tenantId: p.tenantId,
    escopoAlunoIds: p.escopoAlunoIds,
    cursoId: p.cursoId,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
  })

  return montarVisaoGeralAprendizagem(fonte, p.contexto)
}

export async function carregarPadroesEvolucao(
  p: ParametrosAprendizagemTime,
): Promise<PadroesEvolucaoDados> {
  const fonte = await lerFonteAprendizagem({
    db: p.db,
    tenantId: p.tenantId,
    escopoAlunoIds: p.escopoAlunoIds,
    cursoId: p.cursoId,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
  })

  return montarPadroesEvolucao(fonte, p.contexto)
}

export async function carregarMapaCapacidades(
  p: ParametrosAprendizagemTime,
): Promise<MapaCapacidadesDados> {
  const fonte = await lerFonteAprendizagem({
    db: p.db,
    tenantId: p.tenantId,
    escopoAlunoIds: p.escopoAlunoIds,
    cursoId: p.cursoId,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
  })

  return montarMapaCapacidades(fonte, p.contexto)
}

export { montarBase, amostraSuficiente, tendenciaDisponivel } from "./base"
export { lerFonteAprendizagem } from "./fonte-supabase"
export type { ClienteLeitura, ParametrosLeitura } from "./fonte-supabase"
export { montarVisaoGeralAprendizagem } from "./montagem"
export type { ContextoDeTela } from "./montagem"
export { montarPlacar } from "./placar"
export { montarMudancas } from "./mudancas"
export { montarAtencao } from "./atencao"
export { montarRecomendacoes } from "./recomendacoes"
export { montarCapacidadesEvolucao } from "./capacidades-evolucao"
export { montarGapsPrioritarios } from "./gaps-prioritarios"
export type { FonteAprendizagem, FalhasPorFonte, LinhaConceito } from "./fonte"
export { montarPadroesEvolucao } from "./montagem-padroes"
export { montarEvolucaoProfundidade } from "./serie-profundidade"
export { montarPadroesEmergentes } from "./padroes-emergentes"
export { montarOndeTrava } from "./onde-trava"
export { montarConceitosFrageis } from "./conceitos-frageis"
export { montarModulosEvolucao } from "./modulos-evolucao"
export { montarPadroesRecomendacoes } from "./padroes-recomendacoes"
export { ultimasSemanas, evidenciasDaSemana } from "./semanas"
export { montarMapaCapacidades } from "./montagem-mapa"
export { montarCapacidadesDoTime, prioridadeDe } from "./capacidades-do-time"
export { montarCapacidadeComMaiorGap } from "./capacidade-maior-gap"
export { montarMapaCapacidadeEquipe } from "./mapa-capacidade-equipe"
export { montarEvidenciasDisponiveis } from "./evidencias-disponiveis"
export { montarPessoasApoio } from "./pessoas-apoio"
export { montarIntervencoes } from "./intervencoes"
export * from "./tipos"
