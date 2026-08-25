// ---------------------------------------------------------------------------
// Fábricas de fixture para os testes da Autogestão — não é um `.test.ts`.
// ---------------------------------------------------------------------------
import type {
  FonteAutogestao,
  LinhaCapitulo,
  LinhaPlano,
  LinhaProgressoCapitulo,
  LinhaReflexao,
  LinhaSessao,
  ModuloDuracaoPlano,
} from "../fonte"
import { SEM_FALHAS_AUTOGESTAO } from "../fonte"

export const MS_DIA = 86_400_000

/** "Agora" fixo para todos os testes — 2026-08-21T12:00:00Z, uma quinta-feira. */
export const AGORA_MS = Date.parse("2026-08-21T12:00:00.000Z")
export const AGORA = new Date(AGORA_MS)

/** N dias atrás de `AGORA_MS`, em ISO — o vocabulário que os testes usam para semear. */
export function haDias(n: number, deMs: number = AGORA_MS): string {
  return new Date(deMs - n * MS_DIA).toISOString()
}

export function emDias(n: number, deMs: number = AGORA_MS): string {
  return new Date(deMs + n * MS_DIA).toISOString()
}

/** "2026-08-19" — a CHAVE de dia UTC (sem hora), o vocabulário de `dias distintos`. */
export function diaChave(n: number, deMs: number = AGORA_MS): string {
  return haDias(n, deMs).slice(0, 10)
}

let contador = 0
function proximoId(prefixo: string): string {
  contador += 1
  return `${prefixo}-${contador}`
}

export function capitulo(order: number, overrides: Partial<LinhaCapitulo> = {}): LinhaCapitulo {
  return {
    id: overrides.id ?? `capitulo-${order}`,
    order,
    title: overrides.title ?? `Módulo ${order}`,
    ...overrides,
  }
}

export function sessao(overrides: Partial<LinhaSessao> & { created_at: string }): LinhaSessao {
  return {
    id: overrides.id ?? proximoId("sessao"),
    chapter_id: overrides.chapter_id ?? null,
    status: overrides.status ?? null,
    created_at: overrides.created_at,
    completed_at: overrides.completed_at ?? null,
    turn_number: overrides.turn_number ?? null,
    interactions_remaining: overrides.interactions_remaining ?? null,
  }
}

export function reflexao(
  overrides: Partial<LinhaReflexao> & { created_at: string },
): LinhaReflexao {
  return { created_at: overrides.created_at }
}

export function progresso(
  overrides: Partial<LinhaProgressoCapitulo> & { chapter_id: string },
): LinhaProgressoCapitulo {
  return {
    chapter_id: overrides.chapter_id,
    max_slide_index: overrides.max_slide_index ?? null,
    slides_total_at_last_view: overrides.slides_total_at_last_view ?? null,
    reached_last_slide_at: overrides.reached_last_slide_at ?? null,
    first_viewed_at: overrides.first_viewed_at ?? null,
    last_viewed_at: overrides.last_viewed_at ?? null,
  }
}

export function moduloDuracao(chapterId: string, days: number): ModuloDuracaoPlano {
  return { chapterId, days }
}

export function plano(overrides: Partial<LinhaPlano> = {}): LinhaPlano {
  return {
    id: overrides.id ?? "plano-1",
    status: overrides.status ?? "active",
    moduleDurations: overrides.moduleDurations ?? [],
    startDateISO: overrides.startDateISO ?? haDias(0),
    finalDeadlineDateISO: overrides.finalDeadlineDateISO ?? null,
    recalculatedAtISO: overrides.recalculatedAtISO ?? null,
    baseline: overrides.baseline ?? null,
  }
}

export function fonteBase(overrides: Partial<FonteAutogestao> = {}): FonteAutogestao {
  return {
    tenantId: "tenant-1",
    studentId: "student-1",
    courseId: "course-1",
    periodoDias: 30,
    sessoes: [],
    reflexoes: [],
    progresso: [],
    capitulos: [],
    plano: null,
    fusoHorarioMinutosOffset: 0,
    duracaoMediaPorSlideMinutos: null,
    falhas: SEM_FALHAS_AUTOGESTAO,
    ...overrides,
  }
}

/** N capítulos `1..n`, todos com título padrão — o caso comum dos testes de progresso. */
export function capitulos(n: number): LinhaCapitulo[] {
  return Array.from({ length: n }, (_, i) => capitulo(i + 1))
}
