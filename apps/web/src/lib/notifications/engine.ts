// ---------------------------------------------------------------------------
// Engagement Engine — suggestion generation + approval/dispatch core
// ---------------------------------------------------------------------------
// This is BACKEND-1 of the Engagement Engine. It owns three responsibilities,
// all server-only and tenant-scoped:
//
//   1. SUGGESTION GENERATION (generateNudgeSuggestions)
//      Reuses the EXACT roster risk logic from the analytics roster /
//      next-best-action (never_accessed; inactive >14d; no_reflection =
//      completedSessions>=2 && reflectionsCount===0; top_performer =
//      completedSessions>=3 && reflectionsCount>=2). Produces `pending`
//      nudge_suggestions rows grouped by type.
//
//   2. TEMPLATE RENDERING (renderTemplate / renderTemplateString)
//      Substitutes {{primeiro_nome}}, {{curso}}, … from per-student context.
//
//   3. APPROVAL + DISPATCH (approveSuggestion / dismissSuggestion)
//      On approve: for every target student, creates an in-app notifications
//      row (channel='inapp', origin='nudge', status='sent') with rendered
//      content, AND — when the template asks for email — a channel='email'
//      MIRROR row dispatched via Resend.
//
// SECURITY (lição da sessão, enforced here):
//   • Every public entry point re-validates auth + role server-side.
//   • Tenant is ALWAYS resolved server-side and passed explicitly; never taken
//     from the client. Every query/insert is .eq("tenant_id", tenantId).
//   • Writes use the service client (RLS-bypassing) so the .eq("tenant_id")
//     filter and these guards are the only thing keeping rows scoped — every
//     write therefore carries tenant_id and validates membership.
//   • The student set in a suggestion is re-fetched and re-scoped to the
//     tenant before any notification is created — a stale/forged
//     target_student_ids array can never reach a foreign tenant's student.
// ---------------------------------------------------------------------------

import { buildNotificationEmail } from "@/lib/email-template"
import { createServiceClient } from "@/lib/supabase/service"
import type {
  NotificationRow,
  NotificationTemplateRow,
  NudgeSuggestionRow,
  NudgeType,
} from "@/types/notifications"
import type { SupabaseClient } from "@supabase/supabase-js"

// Loose service-client shape (matches createServiceClient) so we can query the
// engagement tables — which are not in the generated Database type yet — without
// fighting the generics. Mirrors the pattern used by pedagogical-actions.
// biome-ignore lint/suspicious/noExplicitAny: matches createServiceClient's loose typing
type ServiceClient = SupabaseClient<any, "public", any>

const INACTIVE_DAYS_THRESHOLD = 14
const NO_REFLECTION_MIN_SESSIONS = 2
const TOP_PERFORMER_MIN_SESSIONS = 3
const TOP_PERFORMER_MIN_REFLECTIONS = 2
const TOP_PERFORMER_LIMIT = 3

const FROM_EMAIL = "eximIA Academy <noreply@eximiaventures.com.br>"

// ---------------------------------------------------------------------------
// NudgeType → seeded template_key map
// ---------------------------------------------------------------------------
// The migration seeds template keys that differ slightly from the NudgeType
// enum (notably 'inactive' → 'inactive_14d'). This is the single source of
// truth for that mapping. 'announcement'/'custom' have no auto template.
// ---------------------------------------------------------------------------
export const NUDGE_TYPE_TEMPLATE_KEY: Record<NudgeType, string | null> = {
  never_accessed: "never_accessed",
  inactive: "inactive_14d",
  no_reflection: "session_no_reflection",
  top_performer: "top_performer_recognition",
  announcement: "announcement_generic",
  custom: null,
}

// ---------------------------------------------------------------------------
// Per-student roster signal — the minimal projection the risk logic needs.
// Computed from sessions + reflections, identical to the analytics roster.
// ---------------------------------------------------------------------------
interface StudentSignal {
  id: string
  fullName: string | null
  email: string | null
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  daysSinceLastActivity: number | null
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

/** Variables available to template substitution, per recipient/context. */
export interface RenderVars {
  primeiro_nome?: string
  curso?: string
  [key: string]: string | undefined
}

/**
 * Replaces every {{key}} occurrence in `input` with `vars[key]`. Unknown keys
 * are left untouched (so a malformed template degrades visibly, not silently).
 * Whitespace inside the braces is tolerated: {{ primeiro_nome }}.
 */
export function renderTemplateString(input: string | null | undefined, vars: RenderVars): string {
  if (!input) return ""
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined || value === null ? match : value
  })
}

/** Derives the first name from a full name (used for {{primeiro_nome}}). */
export function firstNameOf(fullName: string | null | undefined): string {
  if (!fullName) return "aluno"
  const trimmed = fullName.trim()
  if (!trimmed) return "aluno"
  return trimmed.split(/\s+/)[0]
}

interface RenderedNotification {
  title: string
  bodyInapp: string
  emailSubject: string
  emailHtml: string
}

/** Renders a template's in-app + email content for a given recipient/context. */
export function renderTemplate(
  template: NotificationTemplateRow,
  vars: RenderVars,
): RenderedNotification {
  return {
    title: renderTemplateString(template.title, vars),
    bodyInapp: renderTemplateString(template.body_inapp, vars),
    emailSubject: renderTemplateString(template.email_subject, vars),
    emailHtml: renderTemplateString(template.email_html, vars),
  }
}

// ---------------------------------------------------------------------------
// 1. SUGGESTION GENERATION
// ---------------------------------------------------------------------------

interface RawSessionRow {
  student_id: string
  status: string | null
  created_at: string
}

interface RawReflectionRow {
  student_id: string
}

/**
 * Pulls the tenant's students + their session/reflection signals and reduces
 * them to the StudentSignal projection. Pure DB read, tenant-scoped, no PII
 * leaves the function. Mirrors analytics/page.tsx roster construction.
 */
async function loadStudentSignals(db: ServiceClient, tenantId: string): Promise<StudentSignal[]> {
  const now = Date.now()

  const [studentsRes, sessionsRes, reflectionsRes] = await Promise.all([
    db.from("users").select("id, full_name, email").eq("tenant_id", tenantId).eq("role", "student"),
    db.from("sessions").select("student_id, status, created_at").eq("tenant_id", tenantId),
    db.from("slide_reflections").select("student_id").eq("tenant_id", tenantId),
  ])

  const students = (studentsRes.data ?? []) as {
    id: string
    full_name: string | null
    email: string | null
  }[]
  const sessions = (sessionsRes.data ?? []) as RawSessionRow[]
  const reflections = (reflectionsRes.data ?? []) as RawReflectionRow[]

  const sessionsByStudent = new Map<string, RawSessionRow[]>()
  for (const s of sessions) {
    const list = sessionsByStudent.get(s.student_id) ?? []
    list.push(s)
    sessionsByStudent.set(s.student_id, list)
  }
  const reflectionCountByStudent = new Map<string, number>()
  for (const r of reflections) {
    reflectionCountByStudent.set(
      r.student_id,
      (reflectionCountByStudent.get(r.student_id) ?? 0) + 1,
    )
  }

  return students.map((student) => {
    const mySessions = sessionsByStudent.get(student.id) ?? []
    const completedSessions = mySessions.filter((s) => s.status === "completed").length

    let daysSinceLastActivity: number | null = null
    if (mySessions.length > 0) {
      const latest = Math.max(...mySessions.map((s) => new Date(s.created_at).getTime()))
      daysSinceLastActivity = Math.floor((now - latest) / 86_400_000)
    }

    return {
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      totalSessions: mySessions.length,
      completedSessions,
      reflectionsCount: reflectionCountByStudent.get(student.id) ?? 0,
      daysSinceLastActivity,
    }
  })
}

/**
 * Classifies students into nudge cohorts using the EXACT roster / next-best-action
 * thresholds. Each entry carries the student set and a human-readable rationale.
 */
function classifyNudgeCohorts(
  signals: StudentSignal[],
): Array<{ type: NudgeType; studentIds: string[]; rationale: string }> {
  const cohorts: Array<{ type: NudgeType; studentIds: string[]; rationale: string }> = []

  // never_accessed — no sessions at all.
  const neverAccessed = signals.filter((s) => s.totalSessions === 0)
  if (neverAccessed.length > 0) {
    cohorts.push({
      type: "never_accessed",
      studentIds: neverAccessed.map((s) => s.id),
      rationale: `${neverAccessed.length} aluno(s) nunca acessaram a plataforma. Um lembrete pode iniciar a jornada.`,
    })
  }

  // inactive — has accessed, but >14 days since last activity.
  const inactive = signals.filter(
    (s) =>
      s.daysSinceLastActivity !== null &&
      s.daysSinceLastActivity > INACTIVE_DAYS_THRESHOLD &&
      s.totalSessions > 0,
  )
  if (inactive.length > 0) {
    cohorts.push({
      type: "inactive",
      studentIds: inactive.map((s) => s.id),
      rationale: `${inactive.length} aluno(s) inativos há mais de ${INACTIVE_DAYS_THRESHOLD} dias. Reengajar antes da evasão.`,
    })
  }

  // no_reflection — completed >=2 sessions but wrote 0 reflections.
  const noReflection = signals.filter(
    (s) => s.completedSessions >= NO_REFLECTION_MIN_SESSIONS && s.reflectionsCount === 0,
  )
  if (noReflection.length > 0) {
    cohorts.push({
      type: "no_reflection",
      studentIds: noReflection.map((s) => s.id),
      rationale: `${noReflection.length} aluno(s) completaram sessões mas não registraram reflexões. Reforçar o hábito de consolidar o aprendizado.`,
    })
  }

  // top_performer — completed >=3 sessions and >=2 reflections; top 3 by engagement.
  const topPerformers = signals
    .filter(
      (s) =>
        s.completedSessions >= TOP_PERFORMER_MIN_SESSIONS &&
        s.reflectionsCount >= TOP_PERFORMER_MIN_REFLECTIONS,
    )
    .sort(
      (a, b) =>
        b.completedSessions + b.reflectionsCount - (a.completedSessions + a.reflectionsCount),
    )
    .slice(0, TOP_PERFORMER_LIMIT)
  if (topPerformers.length > 0) {
    cohorts.push({
      type: "top_performer",
      studentIds: topPerformers.map((s) => s.id),
      rationale: `${topPerformers.length} aluno(s) em destaque. Reconhecer engajamento reforça a motivação.`,
    })
  }

  return cohorts
}

export interface GenerateSuggestionsResult {
  created: NudgeSuggestionRow[]
  skipped: NudgeType[]
}

/**
 * Generates `pending` nudge suggestions for a tenant from the current roster
 * risk signals. Idempotent-friendly: if a `pending` suggestion of the same
 * `type` already exists, that cohort is SKIPPED (so re-running does not create
 * duplicate pending rows for the admin to triage).
 *
 * @param tenantId  server-resolved tenant. Never from the client.
 * @param allowedStudentIds  OPTIONAL caller-scope filter (see
 *   resolveCallerStudentScope). When a non-null array is given, the tenant
 *   roster is INTERSECTED with it BEFORE cohort classification, so a
 *   manager/instructor only ever generates suggestions for students within their
 *   own reach. `null`/`undefined` preserves the tenant-wide behaviour
 *   (admin/super_admin). An empty array yields zero cohorts (fail-closed).
 * @returns the created rows + the cohort types that were skipped.
 */
export async function generateNudgeSuggestions(
  tenantId: string,
  allowedStudentIds?: string[] | null,
): Promise<GenerateSuggestionsResult> {
  const db = createServiceClient()

  const signals = await loadStudentSignals(db, tenantId)
  // Caller-scope intersection (app-layer trava): restrict the roster to the
  // caller's reachable students BEFORE classifying cohorts. null/undefined =
  // tenant-wide (unchanged). A non-null array (incl. []) scopes the cohorts.
  const scopedSignals =
    allowedStudentIds == null
      ? signals
      : (() => {
          const allowed = new Set(allowedStudentIds)
          return signals.filter((s) => allowed.has(s.id))
        })()
  const cohorts = classifyNudgeCohorts(scopedSignals)

  // Cadência (24h): pula cohorts que já tiveram uma sugestão gerada nas últimas
  // 24h — em QUALQUER status (pending/approved/dismissed). Isso evita re-sugerir
  // um cohort logo após aprovar/dispensar e torna a geração PROATIVA (chamada ao
  // abrir o painel) idempotente: o mesmo cohort só volta a ser sugerido quando o
  // sinal persiste após a janela. Antes o dedup olhava só 'pending', o que
  // re-sugeriria imediatamente tudo que fosse dispensado.
  const cadenceCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentSuggestions, error: recentErr } = await db
    .from("nudge_suggestions")
    .select("type")
    .eq("tenant_id", tenantId)
    .gte("suggested_at", cadenceCutoff)
  // A coluna de timestamp da tabela é `suggested_at` (não `created_at`). Se a
  // leitura da janela de cadência falhar, NÃO seguir — uma falha silenciosa aqui
  // zera o dedup e a geração proativa criaria sugestões duplicadas a cada chamada.
  if (recentErr) {
    throw new Error(`Failed to read cadence window: ${recentErr.message}`)
  }
  const recentTypes = new Set((recentSuggestions ?? []).map((r: { type: NudgeType }) => r.type))

  const toInsert: Array<{
    tenant_id: string
    type: NudgeType
    target_student_ids: string[]
    template_key: string | null
    rationale: string
    status: "pending"
  }> = []
  const skipped: NudgeType[] = []

  for (const cohort of cohorts) {
    if (cohort.studentIds.length === 0) continue
    if (recentTypes.has(cohort.type)) {
      skipped.push(cohort.type)
      continue
    }
    toInsert.push({
      tenant_id: tenantId,
      type: cohort.type,
      target_student_ids: cohort.studentIds,
      template_key: NUDGE_TYPE_TEMPLATE_KEY[cohort.type],
      rationale: cohort.rationale,
      status: "pending",
    })
  }

  if (toInsert.length === 0) {
    return { created: [], skipped }
  }

  const { data: inserted, error } = await db.from("nudge_suggestions").insert(toInsert).select("*")
  if (error) {
    throw new Error(`Failed to insert nudge suggestions: ${error.message}`)
  }

  return { created: (inserted ?? []) as NudgeSuggestionRow[], skipped }
}

// ---------------------------------------------------------------------------
// 2./3. APPROVAL + DISPATCH
// ---------------------------------------------------------------------------

/** Tenant's most-active course title, used for the {{curso}} variable. */
async function resolveTenantCourseName(
  db: ServiceClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await db
    .from("courses")
    .select("title")
    .eq("tenant_id", tenantId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
  return (data?.[0]?.title as string | undefined) ?? null
}

/** Sends a single email via Resend (direct REST, mirroring the legacy nudge route). */
async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn("[engagement] RESEND_API_KEY not configured — email mirror skipped")
    return false
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })
    if (!res.ok) {
      console.error("[engagement] Resend non-OK:", res.status, await res.text().catch(() => ""))
      return false
    }
    return true
  } catch (err) {
    console.error("[engagement] Resend error:", err)
    return false
  }
}

export interface ApproveSuggestionResult {
  suggestionId: string
  inAppCreated: number
  emailsSent: number
  emailsFailed: number
  recipientsSkipped: number // targets no longer valid (left tenant, no email for email-mirror, etc.)
}

/**
 * Materialises a `pending` suggestion into notifications. Validation order:
 *   1. suggestion exists, belongs to `tenantId`, and is still `pending`.
 *   2. the template (suggestion.template_key) exists, is active, in the tenant.
 *   3. target_student_ids are RE-FETCHED and RE-SCOPED to the tenant (a forged
 *      or stale array can never address a foreign tenant's student).
 *   4. the suggestion is ATOMICALLY CLAIMED (pending → approved) BEFORE any
 *      dispatch — a compare-and-set so only one concurrent caller wins and the
 *      loser throws without sending anything (no double notifications/emails).
 * Then, per surviving recipient: insert an in-app row (status='sent'), and —
 * when the template enables email — insert an email mirror row and dispatch it
 * via Resend (the mirror row status reflects send success).
 *
 * Runs with the SERVICE client (writes returned_at-capable rows, sends email).
 * The CALLER must have already authorised the admin/manager + tenant (the route
 * / action does this). tenantId and approvedBy are server-trusted inputs.
 *
 * `allowedStudentIds` (OPTIONAL caller-scope filter — see
 * resolveCallerStudentScope): when a non-null array is given, the re-fetched
 * tenant students are FILTERED to it BEFORE the dispatch loop, so a
 * manager/instructor only ever notifies students within their own reach;
 * targets outside the scope are counted in `recipientsSkipped` and never
 * dispatched. `null`/`undefined` preserves the tenant-wide behaviour
 * (admin/super_admin). An empty array notifies nobody (fail-closed).
 */
export async function approveSuggestion(params: {
  tenantId: string
  suggestionId: string
  approvedBy: string
  allowedStudentIds?: string[] | null
}): Promise<ApproveSuggestionResult> {
  const { tenantId, suggestionId, approvedBy, allowedStudentIds } = params
  const db = createServiceClient()

  // 1. Load + validate the suggestion (tenant + pending).
  const { data: suggestion, error: sErr } = await db
    .from("nudge_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("tenant_id", tenantId)
    .single()
  if (sErr || !suggestion) {
    throw new Error("Sugestão não encontrada")
  }
  const sug = suggestion as NudgeSuggestionRow
  if (sug.status !== "pending") {
    throw new Error("Sugestão já foi processada")
  }
  if (!sug.template_key) {
    throw new Error("Sugestão sem template associado")
  }

  // 2. Load + validate the template (tenant + active).
  const { data: templateRow, error: tErr } = await db
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("key", sug.template_key)
    .single()
  if (tErr || !templateRow) {
    throw new Error("Template não encontrado")
  }
  const template = templateRow as NotificationTemplateRow
  if (!template.is_active) {
    throw new Error("Template inativo")
  }

  // 3. Re-fetch + re-scope the target students to the tenant. NEVER trust the
  //    stored id array as authoritative for membership.
  const targetIds = Array.isArray(sug.target_student_ids) ? sug.target_student_ids : []
  let validStudents: { id: string; full_name: string | null; email: string | null }[] = []
  if (targetIds.length > 0) {
    const { data: studentRows } = await db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .eq("role", "student")
      .in("id", targetIds)
    validStudents = (studentRows ?? []) as typeof validStudents
  }

  // Caller-scope intersection (app-layer trava): when the route passes a non-null
  // scope, drop any target outside the caller's reach BEFORE dispatching. Out-of-
  // scope targets fall through to `recipientsSkipped` (tallied below as
  // targetIds.length - validStudents.length). null/undefined = tenant-wide
  // (admin/super_admin) — unchanged.
  if (allowedStudentIds != null) {
    const allowed = new Set(allowedStudentIds)
    validStudents = validStudents.filter((s) => allowed.has(s.id))
  }

  const courseName = template.variables.includes("curso")
    ? await resolveTenantCourseName(db, tenantId)
    : null
  const nowIso = new Date().toISOString()

  // 4. ATOMIC CLAIM (compare-and-set) BEFORE any dispatch. A single UPDATE
  //    transitions pending → approved only if the row is still pending; the
  //    .eq("status", "pending") + .select().single() means exactly ONE caller
  //    can win the claim. A concurrent double-click / retry that loses the race
  //    affects no row → we throw BEFORE dispatching, so notifications and emails
  //    are sent at most once. (Mirrors dismissSuggestion's pattern.)
  const { data: claimed, error: claimErr } = await db
    .from("nudge_suggestions")
    .update({ status: "approved", approved_by: approvedBy, approved_at: nowIso })
    .eq("id", sug.id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .select("id")
    .single()
  if (claimErr || !claimed) {
    throw new Error("Sugestão já foi processada")
  }

  let inAppCreated = 0
  let emailsSent = 0
  let emailsFailed = 0
  let recipientsSkipped = 0

  for (const student of validStudents) {
    const vars: RenderVars = {
      primeiro_nome: firstNameOf(student.full_name),
    }
    if (courseName) vars.curso = courseName

    const rendered = renderTemplate(template, vars)
    const context = { suggestion_id: sug.id, nudge_type: sug.type }

    // In-app row — this IS the student's inbox entry.
    const inAppRow = {
      tenant_id: tenantId,
      recipient_id: student.id,
      template_id: template.id,
      channel: "inapp" as const,
      origin: "nudge" as const,
      title: rendered.title,
      body: rendered.bodyInapp,
      cta_url: null as string | null,
      context,
      status: "sent" as const,
      sent_at: nowIso,
    }
    const { error: inAppErr } = await db.from("notifications").insert(inAppRow)
    if (inAppErr) {
      console.error("[engagement] in-app insert failed:", inAppErr.message)
      recipientsSkipped++
      continue
    }
    inAppCreated++

    // Email MIRROR — only when the template enables email and the student has one.
    if (template.channel_email && student.email) {
      const html = buildNotificationEmail({
        subject: rendered.emailSubject || rendered.title,
        body: rendered.bodyInapp || "",
        senderName: template.name,
      })
      const ok = await sendEmail({
        to: student.email,
        subject: rendered.emailSubject || rendered.title,
        html: rendered.emailHtml || html,
      })
      if (ok) emailsSent++
      else emailsFailed++

      // Persist a mirror row regardless of send outcome (status reflects it).
      await db.from("notifications").insert({
        tenant_id: tenantId,
        recipient_id: student.id,
        template_id: template.id,
        channel: "email" as const,
        origin: "nudge" as const,
        title: rendered.emailSubject || rendered.title,
        body: rendered.emailHtml || html,
        cta_url: null,
        context,
        status: ok ? ("sent" as const) : ("queued" as const),
        sent_at: ok ? nowIso : null,
      })
    }
  }

  // Tally recipients that were dropped because they no longer belong to the tenant.
  recipientsSkipped += targetIds.length - validStudents.length

  // NOTE: the suggestion was already transitioned to `approved` by the atomic
  // claim above (step 4), so no trailing status update is needed here.

  return {
    suggestionId: sug.id,
    inAppCreated,
    emailsSent,
    emailsFailed,
    recipientsSkipped,
  }
}

// ---------------------------------------------------------------------------
// DIRECT TEAM DISPATCH (manager team dashboard — no suggestion row)
// ---------------------------------------------------------------------------

export interface DispatchTeamNudgeResult {
  inAppCreated: number
  emailsSent: number
  emailsFailed: number
  emailRowsFailed: number
  recipientsSkipped: number // targets that no longer resolve to a tenant student
  total: number // students that survived the tenant + role re-scope
}

/**
 * Dispatches a nudge DIRECTLY to a set of students from the manager team
 * dashboard — WITHOUT a `nudge_suggestions` row and WITHOUT an atomic claim (the
 * front-end disables the button during the POST, so there is no double-submit to
 * guard against here; the route is the authorisation + scope trava).
 *
 * Reuses the SAME per-recipient loop as `approveSuggestion`: re-fetch + re-scope
 * the students to the tenant (role=student), resolve the template (by
 * `templateKey` or by `NUDGE_TYPE_TEMPLATE_KEY[nudgeType]`), render it, insert an
 * in-app `origin='nudge'` row, and — when the template enables email and the
 * student has an address — insert + send a Resend email MIRROR.
 *
 * SECURITY: writes use the SERVICE client (RLS-bypassing), so the `.eq("tenant_id")`
 * filter here AND the group-scoped RLS (migration 20260630000000) are the two
 * things keeping rows scoped. The CALLER (the route) MUST have already authorised
 * the manager AND filtered `studentIds` to the manager's own team — this function
 * trusts that the passed ids are already team-bound and only re-asserts the tenant
 * + role boundary. `tenantId` and `originManagerId` are server-trusted inputs.
 *
 * A `custom`/`announcement` dispatch may omit a seeded template by passing a
 * `templateKey`; if neither a resolvable template_key nor a `message` is given we
 * fall back to the announcement template. When `message` is provided it OVERRIDES
 * the template body (the manager's free-form text), keeping the template only for
 * channel/email metadata.
 */
export async function dispatchTeamNudge(params: {
  tenantId: string
  studentIds: string[]
  nudgeType: NudgeType
  templateKey?: string | null
  message?: string | null
  courseId?: string | null
  originManagerId: string
}): Promise<DispatchTeamNudgeResult> {
  const { tenantId, studentIds, nudgeType, templateKey, message, courseId, originManagerId } =
    params
  const db = createServiceClient()

  const requestedIds = [...new Set(studentIds)]
  if (requestedIds.length === 0) {
    return {
      inAppCreated: 0,
      emailsSent: 0,
      emailsFailed: 0,
      emailRowsFailed: 0,
      recipientsSkipped: 0,
      total: 0,
    }
  }

  // 1. Resolve the template. Prefer an explicit templateKey; otherwise map from
  //    the nudgeType; fall back to the generic announcement template (so a free
  //    `message` always has channel/email metadata to ride on).
  const effectiveKey = templateKey || NUDGE_TYPE_TEMPLATE_KEY[nudgeType] || "announcement_generic"
  const { data: templateRow, error: tErr } = await db
    .from("notification_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("key", effectiveKey)
    .single()
  if (tErr || !templateRow) {
    throw new Error("Template não encontrado")
  }
  const template = templateRow as NotificationTemplateRow
  if (!template.is_active) {
    throw new Error("Template inativo")
  }

  // 2. Re-fetch + re-scope the recipients to the tenant (role=student). NEVER
  //    trust the passed id array as authoritative for tenant membership — even
  //    though the route already filtered to the team, this is defence-in-depth.
  const { data: studentRows } = await db
    .from("users")
    .select("id, full_name, email")
    .eq("tenant_id", tenantId)
    .eq("role", "student")
    .in("id", requestedIds)
  const validStudents = (studentRows ?? []) as {
    id: string
    full_name: string | null
    email: string | null
  }[]

  const courseName = template.variables.includes("curso")
    ? await resolveTenantCourseName(db, tenantId)
    : null
  const nowIso = new Date().toISOString()
  const idempotencyKey = `team-nudge:${originManagerId}:${nudgeType}:${nowIso}`

  let inAppCreated = 0
  let emailsSent = 0
  let emailsFailed = 0
  let emailRowsFailed = 0
  let recipientsSkipped = 0

  for (const student of validStudents) {
    const vars: RenderVars = {
      primeiro_nome: firstNameOf(student.full_name),
    }
    if (courseName) vars.curso = courseName

    const rendered = renderTemplate(template, vars)
    // A free-form `message` from the manager OVERRIDES the template body (in-app
    // text); the template still supplies the title + email channel metadata.
    const bodyInapp = message?.trim() ? message.trim() : rendered.bodyInapp
    const context = {
      nudge_type: nudgeType,
      sent_by_manager: originManagerId,
      idempotency_key: idempotencyKey,
      ...(courseId ? { course_id: courseId } : {}),
    }

    // In-app row — this IS the student's inbox entry.
    const { error: inAppErr } = await db.from("notifications").insert({
      tenant_id: tenantId,
      recipient_id: student.id,
      template_id: template.id,
      channel: "inapp" as const,
      origin: "nudge" as const,
      title: rendered.title,
      body: bodyInapp,
      cta_url: null as string | null,
      context,
      status: "sent" as const,
      sent_at: nowIso,
    })
    if (inAppErr) {
      console.error("[engagement] team-nudge in-app insert failed:", inAppErr.message)
      recipientsSkipped++
      continue
    }
    inAppCreated++

    // Email MIRROR — only when the template enables email and the student has one.
    if (template.channel_email && student.email) {
      const html = buildNotificationEmail({
        subject: rendered.emailSubject || rendered.title,
        body: bodyInapp || "",
        senderName: template.name,
      })
      const ok = await sendEmail({
        to: student.email,
        subject: rendered.emailSubject || rendered.title,
        html: message?.trim() ? html : rendered.emailHtml || html,
      })
      if (ok) emailsSent++
      else emailsFailed++

      // Persist a mirror row regardless of send outcome (status reflects it).
      const { error: emailRowErr } = await db.from("notifications").insert({
        tenant_id: tenantId,
        recipient_id: student.id,
        template_id: template.id,
        channel: "email" as const,
        origin: "nudge" as const,
        title: rendered.emailSubject || rendered.title,
        body: message?.trim() ? html : rendered.emailHtml || html,
        cta_url: null,
        context,
        status: ok ? ("sent" as const) : ("queued" as const),
        sent_at: ok ? nowIso : null,
      })
      if (emailRowErr) emailRowsFailed++
    }
  }

  // Targets that vanished in the tenant/role re-scope (left tenant, not a student).
  recipientsSkipped += requestedIds.length - validStudents.length

  return {
    inAppCreated,
    emailsSent,
    emailsFailed,
    emailRowsFailed,
    recipientsSkipped,
    total: validStudents.length,
  }
}

/**
 * Marks a `pending` suggestion as `dismissed`. Tenant-scoped; the caller must
 * have authorised the admin/manager. No notifications are created.
 */
export async function dismissSuggestion(params: {
  tenantId: string
  suggestionId: string
  dismissedBy: string
}): Promise<{ suggestionId: string; status: "dismissed" }> {
  const { tenantId, suggestionId, dismissedBy } = params
  const db = createServiceClient()

  const { data: updated, error } = await db
    .from("nudge_suggestions")
    .update({
      status: "dismissed",
      approved_by: dismissedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .select("id")
    .single()

  if (error || !updated) {
    throw new Error("Sugestão não encontrada ou já processada")
  }
  return { suggestionId, status: "dismissed" }
}

// ---------------------------------------------------------------------------
// Helper: list pending suggestions (tenant-scoped). Used by the GET route.
// ---------------------------------------------------------------------------
export async function listPendingSuggestions(tenantId: string): Promise<NudgeSuggestionRow[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("nudge_suggestions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("suggested_at", { ascending: false })
  if (error) {
    throw new Error(`Failed to list suggestions: ${error.message}`)
  }
  return (data ?? []) as NudgeSuggestionRow[]
}

// Re-export a couple of types used by the route/action layer for convenience.
export type { NotificationRow, NudgeSuggestionRow }
