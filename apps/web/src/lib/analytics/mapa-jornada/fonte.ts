// ---------------------------------------------------------------------------
// Fonte de dados do Mapa da jornada — a FRONTEIRA entre I/O e cálculo.
// ---------------------------------------------------------------------------
// Oito leituras (R1..R8 do CONTRATO-mapa.md), UMA passada, e daqui para frente
// o cálculo é puro: nenhum `Date.now()`, nenhuma consulta.
//
// Por que uma fonte PRÓPRIA e não a da Visão geral: aquela carrega acionamentos
// (§12) e participação (§8.4) que esta tela não usa, e NÃO carrega as quatro
// leituras que esta tela precisa (`chapter_view_progress`, `chapter_slides`,
// `courses.title`, `chapters.status`). Reusar de saída pagaria duas consultas
// inúteis e ainda ficaria sem as que importam.
//
// I-4 vira VERIFICÁVEL aqui pelo mesmo mecanismo da tela anterior: toda falha
// de leitura vira VALOR (`falhas`), nunca um array vazio silencioso. Cada bloco
// declara de quais das oito chaves depende e sai em `estado:"erro"` — nunca em
// `vazio`, e nunca com numeral parcial (F-32).
//
// I-7 / achado A-6: `slide_reflections.response` EXISTE em produção e é o texto
// verbatim da reflexão. NENHUMA linha desta fonte o projeta. A reflexão entra
// só como par `(student_id, slide_id)`, que é presença, não conteúdo.
// ---------------------------------------------------------------------------

import type { FalhaLeitura } from "@/lib/analytics/visao-geral/tipos"

/** R1 · `users`. */
export interface LinhaAlunoMapa {
  id: string
  full_name: string | null
  report_name: string | null
}

/** R2 · `enrollments`. Sem `progress`: achado A-4 (é `{}` nas linhas reais). */
export interface LinhaMatriculaMapa {
  student_id: string
  course_id: string
  status: string | null
  created_at: string
}

/** R3 · `courses`. */
export interface LinhaCursoMapa {
  id: string
  title: string | null
  deadline_days: number | null
}

/** R4 · `chapters`. `order` é 0-based no schema (o rótulo da coluna é +1). */
export interface LinhaCapituloMapa {
  id: string
  course_id: string
  title: string | null
  order: number | null
  status: string | null
}

/** R5 · `chapter_slides`. Denominador móvel + `slideById` do piso. */
export interface LinhaSlideMapa {
  id: string
  chapter_id: string
  order: number | null
}

/** R6 · `chapter_view_progress`. `last_viewed_at` é o que F-19 mede. */
export interface LinhaPercorridoMapa {
  student_id: string
  chapter_id: string
  max_slide_index: number
  slides_total_at_last_view: number
  reached_last_slide_at: string | null
  last_viewed_at: string | null
}

/** R7 · `sessions`. Vitalícia, sem filtro de data (a fatia é em memória). */
export interface LinhaSessaoMapa {
  student_id: string
  chapter_id: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

/** R8 · `slide_reflections`. NUNCA `response` nem `ai_response` (I-7 / A-6). */
export interface LinhaReflexaoMapa {
  student_id: string
  slide_id: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Chaves de leitura. Um bloco declara de quais depende; se alguma falhou, o
 * bloco sai em `erro` — nunca em `vazio`, e nunca com número parcial (F-32).
 */
export type ChaveFonteMapa =
  | "roster"
  | "matriculas"
  | "cursos"
  | "capitulos"
  | "slides"
  | "percorrido"
  | "sessoes"
  | "reflexoes"

export type FalhasPorFonteMapa = Readonly<Record<ChaveFonteMapa, FalhaLeitura | null>>

export const SEM_FALHAS_MAPA: FalhasPorFonteMapa = {
  roster: null,
  matriculas: null,
  cursos: null,
  capitulos: null,
  slides: null,
  percorrido: null,
  sessoes: null,
  reflexoes: null,
}

export const TODAS_AS_CHAVES: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "cursos",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

/** Tudo que a tela precisa do banco, lido UMA vez. */
export interface FonteMapaJornada {
  tenantId: string
  /** `null` = tenant inteiro (admin fora do contexto de time). */
  escopoAlunoIds: readonly string[] | null
  agoraMs: number
  periodoDias: number
  alunos: readonly LinhaAlunoMapa[]
  matriculas: readonly LinhaMatriculaMapa[]
  cursos: readonly LinhaCursoMapa[]
  capitulos: readonly LinhaCapituloMapa[]
  slides: readonly LinhaSlideMapa[]
  percorrido: readonly LinhaPercorridoMapa[]
  sessoes: readonly LinhaSessaoMapa[]
  reflexoes: readonly LinhaReflexaoMapa[]
  falhas: FalhasPorFonteMapa
}

/** Primeira falha entre as chaves informadas, ou `null`. */
export function primeiraFalhaMapa(
  falhas: FalhasPorFonteMapa,
  chaves: readonly ChaveFonteMapa[],
): FalhaLeitura | null {
  for (const chave of chaves) {
    const falha = falhas[chave]
    if (falha) return falha
  }
  return null
}
