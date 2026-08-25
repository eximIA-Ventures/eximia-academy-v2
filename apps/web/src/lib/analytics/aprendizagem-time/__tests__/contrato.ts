import type {
  FonteAprendizagem,
  LinhaAluno,
  LinhaAvaliacao,
  LinhaCapacidade,
  LinhaConceito,
  LinhaEvidencia,
} from "../fonte"
import { SEM_FALHAS } from "../fonte"
import type { ContextoDeTela } from "../montagem"

export const AGORA_MS = new Date("2026-08-20T12:00:00.000Z").getTime()
export const DIA_MS = 86_400_000

export function capacidade(overrides: Partial<LinhaCapacidade> = {}): LinhaCapacidade {
  return {
    id: "cap-1",
    courseId: "curso-1",
    title: "Uso de evidência",
    slug: "uso-de-evidencia",
    ...overrides,
  }
}

export function avaliacao(overrides: Partial<LinhaAvaliacao> = {}): LinhaAvaliacao {
  return {
    studentId: "aluno-1",
    capabilityId: "cap-1",
    newState: "developing",
    isCurrent: true,
    createdAtMs: AGORA_MS - 5 * DIA_MS,
    ...overrides,
  }
}

export function evidencia(overrides: Partial<LinhaEvidencia> = {}): LinhaEvidencia {
  return {
    studentId: "aluno-1",
    capabilityId: "cap-1",
    conceptId: null,
    evidenceCategory: "cognitive",
    comprehension: "evidenced",
    depthLevel: 4,
    applicationLevel: "not_evidenced",
    occurredAtMs: AGORA_MS - 5 * DIA_MS,
    ...overrides,
  }
}

export function conceito(overrides: Partial<LinhaConceito> = {}): LinhaConceito {
  return {
    id: "conceito-1",
    courseId: "curso-1",
    title: "Definir Problema",
    ...overrides,
  }
}

export function aluno(overrides: Partial<LinhaAluno> = {}): LinhaAluno {
  return { id: "aluno-1", nome: "Aluno 1", ...overrides }
}

export const CONTEXTO_DE_TELA: ContextoDeTela = {
  tenantNome: "Academy",
  gestorNome: "Mariana Costa",
  gestorPapel: "Gestora",
  escopoEquipe: "diretos",
  cursoFiltroNome: "Análise e Solução de Problemas",
}

/** 3 alunos, 2 evidências cada no período atual — bate o piso de amostra (§7: >=3 alunos, >=5 evidências). */
export function entradaBase(overrides: Partial<FonteAprendizagem> = {}): FonteAprendizagem {
  const capacidades = [capacidade()]
  const alunos = ["aluno-1", "aluno-2", "aluno-3"]
  const evidencias: LinhaEvidencia[] = []
  const avaliacoes: LinhaAvaliacao[] = []
  for (const id of alunos) {
    evidencias.push(
      evidencia({ studentId: id, occurredAtMs: AGORA_MS - 3 * DIA_MS }),
      evidencia({ studentId: id, occurredAtMs: AGORA_MS - 6 * DIA_MS }),
    )
    avaliacoes.push(avaliacao({ studentId: id }))
  }
  return {
    tenantId: "tenant-1",
    escopoAlunoIds: null,
    cursoId: "curso-1",
    agoraMs: AGORA_MS,
    periodoDias: 30,
    capacidades,
    avaliacoes,
    evidencias,
    conceitos: [],
    alunos: [],
    falhas: SEM_FALHAS,
    ...overrides,
  }
}
