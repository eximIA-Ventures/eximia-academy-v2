"use server"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Server actions da Jornada (contrato §5). Padrão do repo
// (trails/actions.ts): "use server", createClient(), .auth.getUser(), perfil de
// users. Toda escrita passa por normalizeDurations (min 4, clamp ao teto). RLS
// de study_plans faz o enforcement final. Fallback gracioso quando a migration
// ainda não foi aplicada (tabela ausente → { ok:false } legível, sem exceção).
// ---------------------------------------------------------------------------

import { normalizeDurations } from "@/lib/journey/plan-math"
import type {
  JourneyActionResult,
  JourneyPlan,
  JourneyPreferences,
  SaveJourneyInput,
} from "@/lib/journey/types"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const MS_PER_DAY = 86_400_000

function isoDatePlusDays(startIso: string, days: number): string {
  return new Date(new Date(startIso).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10)
}

function mapRow(row: Record<string, unknown>): JourneyPlan {
  const prefs = (row.preferences ?? {}) as Partial<JourneyPreferences>
  return {
    id: String(row.id),
    enrollmentId: String(row.enrollment_id),
    studentId: String(row.student_id),
    courseId: String(row.course_id),
    tenantId: String(row.tenant_id),
    status: row.status as JourneyPlan["status"],
    moduleDurations: (row.module_durations as number[]) ?? [],
    preset: (row.preset as number | null) ?? null,
    preferences: { cascade: prefs.cascade ?? true, unit: prefs.unit ?? "w" },
    startDate: String(row.start_date).slice(0, 10),
    finalDeadlineDate: row.final_deadline_date
      ? String(row.final_deadline_date).slice(0, 10)
      : null,
    managerDeadlineDate: row.manager_deadline_date
      ? String(row.manager_deadline_date).slice(0, 10)
      : null,
    recalculatedAt: (row.recalculated_at as string | null) ?? null,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  }
}

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
    }
> {
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, course_id, tenant_id")
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
  }
}

/** Valida durações e monta o payload de escrita (compartilhado save/update). */
function buildWritePayload(
  input: SaveJourneyInput,
  ctx: {
    moduleCount: number
    finalDeadlineDays: number | null
    managerDeadlineDays: number | null
  },
  startDate: string,
): { error: string } | Record<string, unknown> {
  const moduleCount = ctx.moduleCount > 0 ? ctx.moduleCount : input.moduleDurations.length
  // sem deadline computável, o teto é a própria soma (não clampa) — degradação
  // igual ao resto do produto (daysLeft null).
  const finalDeadlineDays =
    ctx.finalDeadlineDays ??
    input.moduleDurations.reduce((a, b) => a + Math.max(4, Math.floor(b)), 0)
  let durations: number[]
  try {
    durations = normalizeDurations(input.moduleDurations, moduleCount, finalDeadlineDays)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Durações inválidas" }
  }
  const prefs: JourneyPreferences = {
    cascade: input.preferences?.cascade ?? true,
    unit: input.preferences?.unit ?? "w",
  }
  return {
    module_durations: durations,
    preset: input.preset,
    preferences: prefs,
    final_deadline_date:
      ctx.finalDeadlineDays != null ? isoDatePlusDays(startDate, ctx.finalDeadlineDays) : null,
    manager_deadline_date:
      ctx.managerDeadlineDays != null ? isoDatePlusDays(startDate, ctx.managerDeadlineDays) : null,
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
    // jornada ativa já existente para esta enrollment?
    const { data: existing } = await supabase
      .from("study_plans")
      .select("id, start_date")
      .eq("enrollment_id", input.enrollmentId)
      .eq("status", "active")
      .maybeSingle()

    const startDate =
      (existing?.start_date as string | undefined) ?? new Date().toISOString().slice(0, 10)
    const payload = buildWritePayload(input, ctx, startDate)
    if ("error" in payload) return { ok: false, error: (payload as { error: string }).error }

    if (existing) {
      const { data, error } = await supabase
        .from("study_plans")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
      if (error) return { ok: false, error: error.message }
      revalidatePath("/jornada")
      return { ok: true, plan: mapRow(data as Record<string, unknown>) }
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
      })
      .select("*")
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath("/jornada")
    return { ok: true, plan: mapRow(data as Record<string, unknown>) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao salvar a jornada" }
  }
}

/** Lê a jornada ativa do aluno autenticado. null quando não há jornada. */
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

/** Atualiza durações/preset/preferências da jornada ativa (Revisar jornada). */
export async function updateJourneyPlan(input: SaveJourneyInput): Promise<JourneyActionResult> {
  // Semântica idêntica ao upsert quando já existe; reusa saveJourneyPlan.
  return saveJourneyPlan(input)
}
