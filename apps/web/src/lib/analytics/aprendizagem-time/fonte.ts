// ---------------------------------------------------------------------------
// Fonte de dados da Tela 1 (Visão Geral) de Aprendizagem do Time — a
// fronteira entre I/O e cálculo. Mesmo papel arquitetural de
// `lib/analytics/visao-geral/fonte.ts`: tudo que vem do banco chega aqui como
// linha crua, uma vez, e o cálculo a partir daqui é puro.
// ---------------------------------------------------------------------------

import type { FalhaLeitura } from "./tipos"

/** Uma capacidade ativa, escopada a um curso. */
export interface LinhaCapacidade {
  id: string
  courseId: string
  title: string
  slug: string
}

/**
 * Uma linha de `capability_assessments` — histórico de transição completo
 * (não só a corrente), para permitir reconstruir "qual era o estado no fim do
 * período anterior" sem uma segunda consulta por instante.
 */
export interface LinhaAvaliacao {
  studentId: string
  capabilityId: string
  newState: "not_evidenced" | "emerging" | "developing" | "demonstrated"
  isCurrent: boolean
  createdAtMs: number
}

/** Uma linha de `capability_evidence` — usada para as métricas §9.1-9.3 e a amostra §7. */
export interface LinhaEvidencia {
  studentId: string
  capabilityId: string | null
  /**
   * `concept_id` da evidência. Usado pelas Telas 2/3 como proxy de "módulo"
   * (§21-23 da spec) — este domínio não tem uma entidade "módulo" própria nas
   * 8 tabelas migradas, só `concepts` (ancorado a `chapter_id`/`course_id`).
   * Decisão documentada, não invenção: sem `concept_id` curado, os blocos que
   * dependem dele caem em `motivoVazio: "sem-capacidades-no-curso"` (mesma
   * disciplina de `gaps-prioritarios.ts`), nunca inventam um nome de módulo.
   */
  conceptId: string | null
  evidenceCategory: "cognitive" | "application" | "real_context"
  comprehension: "evidenced" | "partial" | "not_evidenced" | null
  depthLevel: number | null
  applicationLevel: "not_evidenced" | "simulated" | "contextualized" | "applied_real" | null
  occurredAtMs: number
}

/** Um conceito curricular ativo — usado pelas Telas 2/3 como rótulo de "módulo". */
export interface LinhaConceito {
  id: string
  courseId: string
  title: string
}

/** Um aluno em escopo — só o necessário pra rotular a matriz da Tela 3 (§33). */
export interface LinhaAluno {
  id: string
  /** `report_name ?? full_name` — mesma convenção de `visao-geral/fonte.ts`. */
  nome: string
}

export type ChaveFonte = "capacidades" | "avaliacoes" | "evidencias" | "conceitos" | "alunos"

export type FalhasPorFonte = Readonly<Record<ChaveFonte, FalhaLeitura | null>>

export const SEM_FALHAS: FalhasPorFonte = {
  capacidades: null,
  avaliacoes: null,
  evidencias: null,
  conceitos: null,
  alunos: null,
}

/** Tudo que as Telas 1-3 precisam do banco, lido uma vez. */
export interface FonteAprendizagem {
  tenantId: string
  /** Universo já resolvido pelo mesmo recorte da Ativação (`resolverRecorteDaTrinca`). */
  escopoAlunoIds: readonly string[] | null
  /** null = "Todos os cursos" — mas blocos por-capacidade-nomeada exigem um curso escolhido (§4.2). */
  cursoId: string | null
  agoraMs: number
  periodoDias: number
  capacidades: readonly LinhaCapacidade[]
  avaliacoes: readonly LinhaAvaliacao[]
  evidencias: readonly LinhaEvidencia[]
  /** Vazio quando `cursoId` é null (concepts são escopados a um curso — §4.2). */
  conceitos: readonly LinhaConceito[]
  /** Roster do escopo — só usado pela Tela 3 (§33). */
  alunos: readonly LinhaAluno[]
  falhas: FalhasPorFonte
}

export function primeiraFalha(
  falhas: FalhasPorFonte,
  chaves: readonly ChaveFonte[],
): FalhaLeitura | null {
  for (const chave of chaves) {
    const falha = falhas[chave]
    if (falha) return falha
  }
  return null
}
