"use server"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Server actions da Jornada (contrato §5). Padrão do repo
// (trails/actions.ts): "use server", createClient(), .auth.getUser(), perfil de
// users. Toda escrita passa por normalizeDurations (min 4, clamp ao teto). RLS
// de study_plans faz o enforcement final. Fallback gracioso quando a migration
// ainda não foi aplicada (tabela ausente → { ok:false } legível, sem exceção).
// ---------------------------------------------------------------------------

import { SAFE_JOURNEY_SAVE_ERROR, logInfraError } from "@/lib/journey/graceful-errors"
import { fetchJourneyCourseContext, mapRowToJourneyPlan } from "@/lib/journey/journey-plan-data"
import {
  type RemainingWindow,
  cohortDeadlineDate,
  computeRemainingWindow,
  normalizeDurations,
  normalizeRemainingDurations,
} from "@/lib/journey/plan-math"
import type {
  JourneyActionResult,
  JourneyBaseline,
  JourneyCourseContext,
  JourneyModuleDuration,
  JourneyPlan,
  JourneyPreferences,
  SaveJourneyInput,
} from "@/lib/journey/types"
import { computeBehindAndProgress } from "@/lib/notifications/engagement-triage"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Âncora dos prazos de coorte (`final_deadline_date` / `manager_deadline_date`).
 * Defensivo: matrícula sem `created_at` legível (o tipo permite; nunca observado
 * em produção) cai para `fallbackIso` em vez de gravar "Invalid Date" no banco.
 */
function resolveDeadlineAnchor(enrollmentDate: string | null, fallbackIso: string): string {
  if (!enrollmentDate) return fallbackIso
  return Number.isNaN(new Date(enrollmentDate).getTime()) ? fallbackIso : enrollmentDate
}

/** JRN-E — o mapper de leitura (`journey-plan-data.ts`) passou a ser a fonte
 *  única também aqui. Antes existia um segundo mapper nesta camada; com os
 *  campos novos (durações ancoradas, âncora de replanejamento, baseline) manter
 *  dois seria garantir que leitura e escrita divergissem. */
const mapRow = mapRowToJourneyPlan

type AuthedStudent =
  | { ok: false; error: string }
  | { ok: true; userId: string; tenantId: string; role: string }

/** Resolve o usuário autenticado + perfil (role, tenant_id). */
async function authedStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AuthedStudent> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Não autorizado" }
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()
  if (!profile) return { ok: false, error: "Perfil não encontrado" }
  return {
    ok: true,
    userId: user.id,
    tenantId: profile.tenant_id as string,
    role: profile.role as string,
  }
}

/** Carrega enrollment do aluno + os dois prazos do curso, para validar/snapshot. */
async function resolveEnrollmentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentId: string,
  studentId: string,
): Promise<
  | { error: string }
  | {
      courseId: string
      tenantId: string
      moduleCount: number
      finalDeadlineDays: number | null
      managerDeadlineDays: number | null
      /** `enrollments.created_at` — âncora dos prazos de coorte (ver buildWritePayload). */
      enrollmentDate: string | null
      /** `enrollments.status` + `enrollments.progress` crus — JRN-E: entram em
       *  `computeBehindAndProgress` para o baseline usar EXATAMENTE o mesmo
       *  `progressPct` que o dashboard lê (area-gestor.ts, subject escopado por
       *  curso), sem reimplementar a fórmula. */
      enrollmentStatus: string | null
      enrollmentProgress: { percentage?: number | string | null } | null
    }
> {
  // `created_at` é a MESMA fonte que alimenta `leading.startDate` em
  // plan-dashboard-data.ts → `context.startDate` do construtor. Ler daqui é o que
  // faz o banco gravar exatamente a data que a tela prometeu ao aluno.
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, course_id, tenant_id, created_at, status, progress")
    .eq("id", enrollmentId)
    .eq("student_id", studentId)
    .maybeSingle()
  if (!enrollment) return { error: "Matrícula não encontrada" }

  const courseId = enrollment.course_id as string

  // deadlines (defensivo contra manager_deadline_days ausente)
  let finalDeadlineDays: number | null = null
  let managerDeadlineDays: number | null = null
  const withManager = await supabase
    .from("courses")
    .select("deadline_days, manager_deadline_days")
    .eq("id", courseId)
    .maybeSingle()
  if (!withManager.error && withManager.data) {
    finalDeadlineDays = (withManager.data as { deadline_days: number | null }).deadline_days ?? null
    managerDeadlineDays =
      (withManager.data as { manager_deadline_days: number | null }).manager_deadline_days ?? null
  } else {
    const base = await supabase
      .from("courses")
      .select("deadline_days")
      .eq("id", courseId)
      .maybeSingle()
    finalDeadlineDays =
      (base.data as { deadline_days: number | null } | null)?.deadline_days ?? null
  }

  const { count } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("status", "published")

  return {
    courseId,
    tenantId: enrollment.tenant_id as string,
    moduleCount: count ?? 0,
    finalDeadlineDays,
    managerDeadlineDays,
    enrollmentDate: (enrollment as { created_at?: string | null }).created_at ?? null,
    enrollmentStatus: (enrollment as { status?: string | null }).status ?? null,
    enrollmentProgress:
      (enrollment as { progress?: { percentage?: number | string | null } | null }).progress ??
      null,
  }
}

type EnrollmentContext = {
  courseId: string
  moduleCount: number
  finalDeadlineDays: number | null
  managerDeadlineDays: number | null
  enrollmentDate: string | null
  enrollmentStatus: string | null
  enrollmentProgress: { percentage?: number | string | null } | null
}

/**
 * JRN-E — fotografia do "ponto de partida" no instante da PRIMEIRA confirmação.
 *
 * Nenhum número aqui é novo: `progressPct` sai de `computeBehindAndProgress`
 * (o MESMO motor que produz `subject.progressPct` escopado por curso em
 * area-gestor.ts, que por sua vez vira `diagnostic.progressNow`), e
 * sessões/reflexões saem das contagens reais por capítulo que o próprio
 * contexto da jornada já carregou. Sem essa igualdade de fonte, o delta do
 * dashboard (`lifetime − baseline`) seria a subtração de duas réguas distintas.
 */
function buildBaseline(
  context: JourneyCourseContext,
  ctx: EnrollmentContext,
  studentId: string,
  nowMs: number,
): JourneyBaseline {
  const { progressByStudent } = computeBehindAndProgress(
    [
      {
        student_id: studentId,
        status: ctx.enrollmentStatus,
        created_at: ctx.enrollmentDate ?? new Date(nowMs).toISOString(),
        progress: ctx.enrollmentProgress,
        course_id: ctx.courseId,
      },
    ],
    new Map([[ctx.courseId, ctx.finalDeadlineDays]]),
    nowMs,
  )
  let sessionsDone = 0
  let reflectionsDone = 0
  const completedChapterIds: string[] = []
  for (const m of context.modules) {
    sessionsDone += m.progress.sessionsDone
    reflectionsDone += m.progress.reflectionsDone
    if (m.progress.frozen) completedChapterIds.push(m.chapterId)
  }
  return {
    capturedAt: new Date(nowMs).toISOString(),
    progressPct: Math.round(progressByStudent.get(studentId) ?? 0),
    sessionsDone,
    reflectionsDone,
    completedChapterIds,
  }
}

/**
 * Valida durações e monta o payload de escrita (compartilhado save/update).
 *
 * ┌─ DUAS DATAS DIFERENTES, DE PROPÓSITO (Hugo, 2026-07-25) ────────────────────┐
 * │ Não "conserte" isto igualando as duas âncoras. Elas são distintas por        │
 * │ decisão de produto, e já houve um bug real por confundi-las:                 │
 * │                                                                             │
 * │  • `start_date`  = HOJE (o dia em que o aluno monta a jornada). A jornada    │
 * │    começa quando o aluno a monta; é a origem do cronograma dos módulos.      │
 * │                                                                             │
 * │  • `final_deadline_date` / `manager_deadline_date` = ÂNCORA DE COORTE, ou    │
 * │    seja, DATA DA MATRÍCULA (`enrollments.created_at`) + os dias do curso.    │
 * │    O teto duro é da coorte, não do clique.                                   │
 * │                                                                             │
 * │ Por que: antes, os prazos eram `new Date()` + dias, enquanto o construtor    │
 * │ MOSTRAVA matrícula + dias. Caso real medido em produção: matrícula em        │
 * │ 2026-05-21, deadline_days 180, 65 dias decorridos. A tela prometia 17/nov;   │
 * │ o save gravava 21/jan. Cada dia de demora do aluno em clicar empurrava o     │
 * │ teto duro um dia para frente — o teto era furável por procrastinação.        │
 * │ Ancorar na matrícula torna o teto imune ao momento do clique E a revisões.   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
function buildWritePayload(
  input: SaveJourneyInput,
  ctx: {
    moduleCount: number
    finalDeadlineDays: number | null
    managerDeadlineDays: number | null
    enrollmentDate: string | null
  },
  startDate: string,
  /**
   * JRN-E — janela restante + ordem dos capítulos publicados. Presente sempre
   * que o contexto do curso é computável; null é a MESMA degradação que o resto
   * do produto já tem (curso sem deadline legível), e aí a régua antiga
   * (`normalizeDurations`) continua valendo.
   */
  remaining: { window: RemainingWindow; chapterIds: string[]; planningAnchorDate: string } | null,
): { error: string } | Record<string, unknown> {
  const moduleCount = ctx.moduleCount > 0 ? ctx.moduleCount : input.moduleDurations.length
  // sem deadline computável, o teto é a própria soma (não clampa) — degradação
  // igual ao resto do produto (daysLeft null).
  const finalDeadlineDays =
    ctx.finalDeadlineDays ??
    input.moduleDurations.reduce((a, b) => a + Math.max(4, Math.floor(b)), 0)
  let durations: number[]
  try {
    // A régua nova zera o que está concluído e clampa os vivos na janela que
    // RESTA — um cliente que mandar dias num módulo concluído tem esse valor
    // descartado no servidor, não aceito.
    durations = remaining
      ? normalizeRemainingDurations(input.moduleDurations, remaining.window)
      : normalizeDurations(input.moduleDurations, moduleCount, finalDeadlineDays)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Durações inválidas" }
  }
  // D6 — a verdade persistida é ANCORADA POR CAPÍTULO. O array posicional puro
  // deslizava todas as durações quando um capítulo era publicado, despublicado
  // ou reordenado. A coluna é jsonb, então a forma nova entra sem DDL.
  const persistedDurations: JourneyModuleDuration[] | number[] =
    remaining && remaining.chapterIds.length === durations.length
      ? remaining.chapterIds.map((chapterId, i) => ({ chapterId, days: durations[i] }))
      : durations
  const prefs: JourneyPreferences = {
    cascade: input.preferences?.cascade ?? true,
    unit: input.preferences?.unit ?? "w",
  }
  // Âncora de coorte. `startDate` (hoje) é só o fallback defensivo para a
  // matrícula sem created_at legível — NÃO é a regra.
  //
  // Borda deliberada: matrícula antiga o bastante para o teto já ter vencido
  // grava a data REAL, no passado. Não estendemos o prazo automaticamente (isso
  // furaria o invariante que este bloco existe para proteger) e não rejeitamos o
  // save (um teto vencido é inevitável no meio da jornada de qualquer aluno, e o
  // read-path já convive com ele; recusar na escrita e tolerar na leitura seria
  // incoerente). O dado fica honesto e a UI mostra o conflito.
  const deadlineAnchor = resolveDeadlineAnchor(ctx.enrollmentDate, startDate)
  return {
    module_durations: persistedDurations,
    preset: input.preset,
    preferences: prefs,
    // Âncora do replanejamento do que RESTA (D2), na coluna que já existia —
    // zero coluna nova para isto. Distinta de `start_date` (T0 da jornada) e
    // do teto de coorte (matrícula + dias).
    recalculated_at: remaining?.planningAnchorDate ?? startDate,
    final_deadline_date:
      ctx.finalDeadlineDays != null
        ? cohortDeadlineDate(deadlineAnchor, ctx.finalDeadlineDays)
        : null,
    manager_deadline_date:
      ctx.managerDeadlineDays != null
        ? cohortDeadlineDate(deadlineAnchor, ctx.managerDeadlineDays)
        : null,
  }
}

/**
 * Cria/upsert da jornada ativa (status 'active'). Substitui o setConfirmed(true)
 * local-only de "Começar minha jornada".
 */
export async function saveJourneyPlan(input: SaveJourneyInput): Promise<JourneyActionResult> {
  const supabase = await createClient()
  const auth = await authedStudent(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }

  const ctx = await resolveEnrollmentContext(supabase, input.enrollmentId, auth.userId)
  if ("error" in ctx) return { ok: false, error: ctx.error }

  try {
    // JRN-E — o progresso REAL vem do servidor, nunca do cliente. É o mesmo
    // contexto que o construtor recebeu, relido aqui: quem valida a escrita
    // precisa saber quais módulos estão concluídos e quanto da janela resta.
    //
    // O try/catch é DELIBERADO e não é decorativo: a leitura do progresso é um
    // ENRIQUECIMENTO da escrita, não um pré-requisito dela. Se ela falhar
    // (schema cache, RLS, capítulo sumindo no meio do request), o aluno tem que
    // conseguir salvar a jornada dele mesmo assim, pela régua antiga — perder o
    // trabalho do aluno para melhorar a validação seria o pior dos dois mundos.
    let context: JourneyCourseContext | null = null
    try {
      context = await fetchJourneyCourseContext(supabase, auth.userId, ctx.courseId)
    } catch (e) {
      logInfraError("saveJourneyPlan:progressContext", e)
    }
    const remaining = context
      ? {
          window: computeRemainingWindow(
            context.modules,
            context.planningAnchorDate,
            context.cohortDeadlineDate,
          ),
          chapterIds: context.modules.map((m) => m.chapterId),
          planningAnchorDate: context.planningAnchorDate,
        }
      : null

    // jornada ativa já existente para esta enrollment? `baseline` entra no
    // select para distinguir 1ª confirmação de revisão (AC-E1.7). Defensivo:
    // enquanto a migration do JRN-E não for aplicada, a coluna não existe e o
    // select falha — aí caímos no select antigo e o baseline degrada para null.
    let existing: Record<string, unknown> | null = null
    let baselineColumnExists = true
    const withBaseline = await supabase
      .from("study_plans")
      .select("id, start_date, baseline")
      .eq("enrollment_id", input.enrollmentId)
      .eq("status", "active")
      .maybeSingle()
    if (withBaseline.error) {
      baselineColumnExists = false
      logInfraError("saveJourneyPlan:baselineColumnMissing", withBaseline.error)
      const base = await supabase
        .from("study_plans")
        .select("id, start_date")
        .eq("enrollment_id", input.enrollmentId)
        .eq("status", "active")
        .maybeSingle()
      existing = (base.data as Record<string, unknown> | null) ?? null
    } else {
      existing = (withBaseline.data as Record<string, unknown> | null) ?? null
    }

    // Revisão preserva o start_date original (a jornada não recomeça ao ser
    // revisada); jornada nova começa hoje. Desde a âncora de coorte, este valor
    // NÃO alimenta mais os prazos — é só a origem do cronograma dos módulos.
    const startDate =
      (existing?.start_date as string | undefined) ?? new Date().toISOString().slice(0, 10)
    const payload = buildWritePayload(input, ctx, startDate, remaining)
    if ("error" in payload) return { ok: false, error: (payload as { error: string }).error }

    // D3 — o baseline é gravado UMA vez, na primeira confirmação. Revisar a
    // jornada NÃO reescreve o ponto de partida: se reescrevesse, todo o
    // progresso feito dentro da jornada seria reabsorvido como "veio de antes"
    // e o realizado voltaria a zero a cada revisão.
    const alreadyHasBaseline = existing != null && existing.baseline != null
    const baselinePatch =
      baselineColumnExists && context && !alreadyHasBaseline
        ? { baseline: buildBaseline(context, ctx, auth.userId, Date.now()) }
        : {}
    const chapterIds = remaining?.chapterIds ?? []

    if (existing) {
      const { data, error } = await supabase
        .from("study_plans")
        .update({ ...payload, ...baselinePatch })
        .eq("id", existing.id as string)
        .select("*")
        .single()
      // Erro de infra (tabela fora do schema cache, RLS, conexão) → log server-
      // side + mensagem segura, nunca o `error.message` cru na tela do usuário.
      if (error) {
        logInfraError("updateJourneyPlan", error)
        return { ok: false, error: SAFE_JOURNEY_SAVE_ERROR }
      }
      revalidatePath("/jornada")
      return { ok: true, plan: mapRow(data as Record<string, unknown>, chapterIds) }
    }

    const { data, error } = await supabase
      .from("study_plans")
      .insert({
        enrollment_id: input.enrollmentId,
        student_id: auth.userId,
        course_id: ctx.courseId,
        tenant_id: ctx.tenantId,
        status: "active",
        start_date: startDate,
        ...payload,
        ...baselinePatch,
      })
      .select("*")
      .single()
    if (error) {
      logInfraError("saveJourneyPlan", error)
      return { ok: false, error: SAFE_JOURNEY_SAVE_ERROR }
    }
    revalidatePath("/jornada")
    return { ok: true, plan: mapRow(data as Record<string, unknown>, chapterIds) }
  } catch (e) {
    // Qualquer exceção inesperada nesta camada degrada graciosamente.
    logInfraError("saveJourneyPlan:throw", e)
    return { ok: false, error: SAFE_JOURNEY_SAVE_ERROR }
  }
}

/** Lê a jornada ativa do aluno autenticado. null quando não há jornada.
 *
 *  JRN-E — este leitor não conhece a ordem publicada dos capítulos, então a
 *  projeção `moduleDurations` sai na ordem em que foi PERSISTIDA. Quem precisa
 *  do realinhamento contra os capítulos de hoje usa `fetchJourneyState`
 *  (journey-plan-data.ts), que tem o contexto do curso em mãos. */
export async function loadJourneyPlan(enrollmentId?: string): Promise<JourneyPlan | null> {
  const supabase = await createClient()
  const auth = await authedStudent(supabase)
  if (!auth.ok) return null
  try {
    let q = supabase
      .from("study_plans")
      .select("*")
      .eq("student_id", auth.userId)
      .eq("status", "active")
    if (enrollmentId) q = q.eq("enrollment_id", enrollmentId)
    const { data, error } = await q.maybeSingle()
    if (error || !data) return null
    return mapRow(data as Record<string, unknown>)
  } catch {
    return null
  }
}

/**
 * Atualiza durações/preset/preferências da jornada ativa (Revisar jornada).
 * Revisar NÃO re-ancora nada: os prazos saem de `enrollments.created_at`, que é
 * imutável, então reabrir e salvar de novo não move o teto (coberto por teste).
 */
export async function updateJourneyPlan(input: SaveJourneyInput): Promise<JourneyActionResult> {
  // Semântica idêntica ao upsert quando já existe; reusa saveJourneyPlan.
  return saveJourneyPlan(input)
}
