// ---------------------------------------------------------------------------
// Fonte de dados da Visão geral — a FRONTEIRA entre I/O e cálculo.
// ---------------------------------------------------------------------------
// Tudo que vem do banco chega aqui como linha crua, uma vez só, e daqui para
// frente o cálculo é puro e determinístico (nenhum `Date.now()`, nenhuma
// consulta). Duas consequências que não são de estilo:
//
//   • I-5 vira ESTRUTURAL. Existe um único `roster` e um único mapa de
//     carimbos; as duas janelas da comparação são fatiadas dele em memória.
//     Não há caminho de código em que o período anterior leia outro universo.
//
//   • I-4 vira VERIFICÁVEL. Toda falha de leitura vira um valor (`falhas`), não
//     um array vazio silencioso. Um bloco que dependia de uma leitura quebrada
//     sai em `estado: "erro"` em vez de exibir um número menor como se fosse
//     fato — que é o achado A-1 (79 de 87 páginas descartam o `error`).
//
// A janela das leituras é a MAIS LARGA de todas (180 dias do baseline §13), e
// não a do período: "intervalo habitual" calculado só dentro de 30 dias
// degenera, e "já iniciou a jornada" precisa do histórico inteiro. Uma leitura
// larga + fatias em memória custa menos que três idas ao banco.
// ---------------------------------------------------------------------------

import type { FalhaLeitura } from "./tipos"

/** Linha com carimbos de atividade (sessions, slide_reflections). */
export interface LinhaAtividade {
  student_id: string
  created_at: string | null
  updated_at: string | null
}

export interface LinhaSessao extends LinhaAtividade {
  /** NULL quando a sessão não é socrática (§8.4 marcador). */
  question_id: string | null
  chapter_id: string | null
}

export interface LinhaMatricula {
  student_id: string
  status: string | null
  created_at: string
  progress: { percentage?: number | string | null } | null
  course_id: string
}

export interface LinhaAluno {
  id: string
  full_name: string | null
  /** Nome de exibição padronizado; a UI de tabela usa `report_name ?? full_name`. */
  report_name: string | null
}

export interface LinhaParticipacao {
  student_id: string
  created_at: string | null
}

export interface LinhaAcionamento {
  recipient_id: string
  sent_at: string
}

export interface LinhaCapitulo {
  id: string
  course_id: string
  title: string | null
  order: number | null
}

/**
 * Chaves de leitura. Um bloco declara de quais depende; se alguma falhou, o
 * bloco sai em `erro` — nunca em `vazio`, e nunca com número parcial.
 */
export type ChaveFonte =
  | "roster"
  | "sessoes"
  | "reflexoes"
  | "matriculas"
  | "cursos"
  | "participacao"
  | "acionamentos"
  | "capitulos"

export type FalhasPorFonte = Readonly<Record<ChaveFonte, FalhaLeitura | null>>

export const SEM_FALHAS: FalhasPorFonte = {
  roster: null,
  sessoes: null,
  reflexoes: null,
  matriculas: null,
  cursos: null,
  participacao: null,
  acionamentos: null,
  capitulos: null,
}

/** Tudo que a tela precisa do banco, lido UMA vez. */
export interface FonteVisaoGeral {
  tenantId: string
  /** id do gestor dono da tela (filtro dos acionamentos, §12). */
  gestorId: string
  /** null = tenant inteiro (admin fora do contexto de time). */
  escopoAlunoIds: readonly string[] | null
  agoraMs: number
  periodoDias: number
  alunos: readonly LinhaAluno[]
  sessoes: readonly LinhaSessao[]
  reflexoes: readonly LinhaAtividade[]
  matriculas: readonly LinhaMatricula[]
  prazoPorCurso: ReadonlyMap<string, number | null>
  quizzes: readonly LinhaParticipacao[]
  cenarios: readonly LinhaParticipacao[]
  atividades: readonly LinhaParticipacao[]
  acionamentos: readonly LinhaAcionamento[]
  capitulos: readonly LinhaCapitulo[]
  falhas: FalhasPorFonte
}

/** Primeira falha entre as chaves informadas, ou null. */
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
