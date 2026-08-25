// ---------------------------------------------------------------------------
// Fonte de dados da Autogestão — a FRONTEIRA entre I/O e cálculo.
// ---------------------------------------------------------------------------
// Mesma fronteira que o analytics do gestor (`visao-geral/fonte.ts`): tudo que
// vem do banco chega aqui como linha crua, uma vez só; daqui para frente o
// cálculo é puro e determinístico. `montagem.ts` recebe esta fonte MAIS um
// `agora: Date` injetado separadamente — não `Date.now()` embutido na fonte —
// porque o contrato desta rodada pediu o relógio como parâmetro explícito da
// função de montagem, não como campo de dado.
//
// A LEITURA é a MAIS LARGA disponível (histórico inteiro do aluno no curso, não
// só a janela do filtro de período), pelo mesmo motivo do gestor: "Retomando"
// (spec §6) e "Onde costumo perder ritmo" (§25) precisam saber se HOUVE uma
// pausa ≥14 dias em QUALQUER ponto do histórico, não só dentro dos últimos N
// dias selecionados no filtro. `periodoDias` entra separado e serve só para
// fatiar em memória o que a Tela 1 compara (atual vs. anterior).
//
// ESCOPO: um único (student, course) por leitura — spec §4.1 exige seleção de
// curso específico quando há mais de uma matrícula ativa; quem monta a rota
// resolve isso ANTES de chamar esta camada. Não há multi-curso aqui.
// ---------------------------------------------------------------------------

import type { FalhaLeitura } from "./tipos"

/** `sessions` — regularidade, ritmo, sessão em aberto, retomadas, sinais de horário. */
export interface LinhaSessao {
  id: string
  chapter_id: string | null
  status: string | null
  created_at: string
  completed_at: string | null
  turn_number: number | null
  interactions_remaining: number | null
}

/** `chapter_view_progress` — progresso por módulo, última atividade, mapa da jornada. */
export interface LinhaProgressoCapitulo {
  chapter_id: string
  max_slide_index: number | null
  slides_total_at_last_view: number | null
  reached_last_slide_at: string | null
  first_viewed_at: string | null
  last_viewed_at: string | null
}

/** `slide_reflections` — reflexões realizadas. */
export interface LinhaReflexao {
  created_at: string
}

/** `chapters` — módulos ordenados do curso (ordem e título). */
export interface LinhaCapitulo {
  id: string
  order: number | null
  title: string | null
}

/** `study_plans.module_durations[]` — `[{ chapterId, days }]`, literal do banco. */
export interface ModuloDuracaoPlano {
  chapterId: string
  days: number
}

/** `study_plans.baseline` — instantâneo capturado no último ajuste do plano. */
export interface BaselineDoPlano {
  capturedAt: string
  progressPct: number
  sessionsDone: number
  reflectionsDone: number
  completedChapterIds: readonly string[]
}

/**
 * `study_plans` — o plano individual. `null` no `FonteAutogestao.plano` é o
 * caminho MAJORITÁRIO (5 planos ativos para 302 matrículas medidos em
 * 2026-08-21), não um caso de borda a empurrar para depois.
 */
export interface LinhaPlano {
  id: string
  status: string | null
  moduleDurations: readonly ModuloDuracaoPlano[]
  startDateISO: string | null
  finalDeadlineDateISO: string | null
  recalculatedAtISO: string | null
  /** `null` quando o plano nunca foi recalculado — nenhum ajuste a mostrar (§13). */
  baseline: BaselineDoPlano | null
}

export type ChaveFonteAutogestao = "sessoes" | "reflexoes" | "progresso" | "capitulos" | "plano"

export type FalhasPorFonteAutogestao = Readonly<Record<ChaveFonteAutogestao, FalhaLeitura | null>>

export const SEM_FALHAS_AUTOGESTAO: FalhasPorFonteAutogestao = {
  sessoes: null,
  reflexoes: null,
  progresso: null,
  capitulos: null,
  plano: null,
}

/** Tudo que a montagem precisa do banco, para (aluno, curso), lido UMA vez. */
export interface FonteAutogestao {
  tenantId: string
  studentId: string
  courseId: string
  /** 7 | 30 | 90 — só governa a comparação de janelas da Tela 1 (§10). */
  periodoDias: 7 | 30 | 90
  /** Histórico completo disponível, não recortado ao `periodoDias`. */
  sessoes: readonly LinhaSessao[]
  reflexoes: readonly LinhaReflexao[]
  progresso: readonly LinhaProgressoCapitulo[]
  /** Todos os módulos do curso, ordenados por `order` (spec §22). */
  capitulos: readonly LinhaCapitulo[]
  plano: LinhaPlano | null
  /**
   * Offset em minutos do fuso do TENANT em relação a UTC (ex.: −180 para
   * BRT). Usado pelos sinais de horário/dia da semana (contrato 1.20/1.21,
   * "hora local do tenant") E pelo mapa de calor de atividade
   * (`mapa-de-calor.ts`). Fingir precisão com `Intl`/fuso do PROCESSO
   * (I-6) continua proibido — o offset é sempre um número FIXO vindo do
   * tenant, nunca do ambiente que roda o código.
   *
   * `lerFonteAutogestao` (`fonte-supabase.ts`, `resolverFusoHorarioMinutos`)
   * SEMPRE resolve um número aqui — settings do tenant, senão
   * `TENANT_FUSO_HORARIO_PADRAO_MINUTOS` (Brasília, UTC−3 fixo). O tipo
   * permanece `number | null | undefined` porque OUTROS construtores desta
   * fonte (ex.: `scripts/gauntlet/provar-elo4-nucleo.ts`, que monta um
   * `FonteAutogestao` CONHECIDO sem ir ao banco) podem legitimamente não
   * resolver o fuso — `null`/ausente aí trata como UTC, o mesmo caminho
   * honesto de sempre para quem não passou pela leitura real.
   */
  fusoHorarioMinutosOffset?: number | null
  /**
   * Duração média por slide, em minutos, MEDIDA por quem monta a fonte a
   * partir do histórico de sessões (fora do escopo desta camada: aqui não há
   * como derivar "tempo por slide" só de `created_at`/`completed_at` sem
   * também conhecer quantos slides cada sessão cobriu). `null` = sem amostra
   * suficiente para medir — a estimativa de tempo restante (3.5) sai SEM
   * LASTRO nesse caso, nunca com um número inventado.
   */
  duracaoMediaPorSlideMinutos: number | null
  falhas: FalhasPorFonteAutogestao
}

/** Primeira falha entre as chaves informadas, ou null. */
export function primeiraFalha(
  falhas: FalhasPorFonteAutogestao,
  chaves: readonly ChaveFonteAutogestao[],
): FalhaLeitura | null {
  for (const chave of chaves) {
    const falha = falhas[chave]
    if (falha) return falha
  }
  return null
}
