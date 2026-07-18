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
  SenderIdentity,
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
  behind_teaching_plan: "behind_teaching_plan",
}

// ---------------------------------------------------------------------------
// Per-student roster signal — the minimal projection the risk logic needs.
// Computed from sessions + reflections, identical to the analytics roster.
// ---------------------------------------------------------------------------
export interface StudentSignal {
  id: string
  fullName: string | null
  email: string | null
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  daysSinceLastActivity: number | null
  /**
   * E2 (behind_teaching_plan): true when the student has an ACTIVE enrollment in
   * a course with a deadline whose progress % is below the expected pace for the
   * elapsed time. Byte-equivalent to the RPC `auth_team_engagement_signals`
   * `behind` CTE (20260703010000) and to `student-triage.ts` `ritmo==="atrasado"`.
   * NOT re-derived by hand — same formula, single source of truth.
   */
  behindSchedule: boolean
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
// Origin-aware greeting (E2 AC6, Engagement Center v2)
// ---------------------------------------------------------------------------
/**
 * Prefixes a rendered body with a greeting line reflecting the message ORIGIN,
 * per Section 11 of the refactor report:
 *   • manager  → "Olá, {primeiro_nome}. Aqui é {senderName}." (assinada pelo gestor)
 *   • platform → "Olá, {primeiro_nome}. A exímIA Academy percebeu ..." (institucional)
 *
 * The body passed in is the ALREADY-RENDERED text (template body or a free-form
 * manager message). We only decide the salutation prefix — the substantive body
 * is preserved verbatim. `firstName` comes from the recipient; `senderName` is
 * required when identity==='manager' (validated at the route, E3).
 */
// Leading-salutation matchers, used to make renderWithOrigin idempotent (E12
// Rodada 7 item 3). The composed preview the client shows (buildSuggestedMessage)
// AND the seed templates may already open with a greeting; without this guard the
// greeting is prefixed TWICE ("Olá X. ...\n\nOlá X! ..." — the double-greeting Hugo
// screenshotted). We strip ONLY the known salutation shapes, never real body copy:
//   1. The composed origin greeting followed by a blank line (paragraph form):
//        "Olá, {nome}. Aqui é {gestor}.\n\n"      (manager)
//        "Olá, {nome}. A exímIA Academy percebeu o seguinte:\n\n"  (platform)
//        "Olá, {nome}.\n\n"                        (manager, no signer)
//      → the salutation is its OWN paragraph; strip up to and including the break.
//   2. The legacy inline template greeting:  "Olá, {nome}! "  (rest on the SAME line)
//      → strip only up to and including the "! " that ends the salutation clause.
// Order matters: try the paragraph form first (it may contain a "." that shape 2
// would not stop at), then the inline "!" form.
const LEADING_GREETING_PARAGRAPH_RE = /^\s*Ol[aá][,!][^\n]*?\r?\n\s*\r?\n/i
const LEADING_GREETING_INLINE_RE = /^\s*Ol[aá][,!][^.!\n]*!\s*/i

function stripLeadingGreeting(body: string): string {
  if (LEADING_GREETING_PARAGRAPH_RE.test(body)) {
    return body.replace(LEADING_GREETING_PARAGRAPH_RE, "")
  }
  return body.replace(LEADING_GREETING_INLINE_RE, "")
}

/**
 * Prefixes a rendered body with a greeting line reflecting the message ORIGIN
 * (see the block comment above). E12 Rodada 7 item 3: this is now the SINGLE
 * source of truth for the salutation — if the incoming body ALREADY opens with a
 * greeting (a client-composed preview that carries buildSuggestedMessage's
 * salutation, or a legacy template body that embedded "Olá, {{primeiro_nome}}!"),
 * that leading salutation line is STRIPPED first, so exactly ONE greeting reaches
 * the student. The substantive body after the salutation is preserved verbatim.
 */
export function renderWithOrigin(
  body: string,
  senderIdentity: SenderIdentity,
  opts: { firstName: string; senderName?: string | null },
): string {
  const first = opts.firstName || "aluno"
  // Idempotency: drop a pre-existing leading "Olá, ..." salutation so we never
  // greet twice, regardless of whether it came from the template or the composer.
  const trimmedBody = stripLeadingGreeting(body).trim()
  if (senderIdentity === "manager") {
    const who = (opts.senderName ?? "").trim()
    const greeting = who ? `Olá, ${first}. Aqui é ${who}.` : `Olá, ${first}.`
    return `${greeting}\n\n${trimmedBody}`
  }
  // platform — institutional voice.
  return `Olá, ${first}. A exímIA Academy percebeu o seguinte:\n\n${trimmedBody}`
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
interface RawEnrollmentRow {
  student_id: string
  status: string | null
  created_at: string
  progress: { percentage?: number | string | null } | null
  course_id: string
}

interface RawCourseRow {
  id: string
  deadline_days: number | null
}

/**
 * Computes the set of student ids that are BEHIND their teaching plan — the same
 * definition as the RPC `auth_team_engagement_signals.behind` CTE
 * (20260703010000) and `student-triage.ts` `ritmo==="atrasado"`:
 *   active enrollment + course.deadline_days > 0 + progress% < expectedPct,
 *   expectedPct = LEAST(100, round(elapsedDays / deadline_days * 100)),
 *   elapsedDays = max(0, (now - created_at) / 86400).
 * deadline_days null/<=0 → never behind (same intentional guard as the SQL).
 * ANY qualifying enrollment flags the student.
 */
function computeBehindStudentIds(
  enrollments: RawEnrollmentRow[],
  courseById: Map<string, RawCourseRow>,
  now: number,
): Set<string> {
  const behind = new Set<string>()
  for (const e of enrollments) {
    if (e.status !== "active") continue
    const course = courseById.get(e.course_id)
    const deadlineDays = course?.deadline_days ?? null
    if (deadlineDays === null || deadlineDays <= 0) continue

    const createdMs = new Date(e.created_at).getTime()
    if (Number.isNaN(createdMs)) continue
    const elapsedDays = Math.max(0, (now - createdMs) / 86_400_000)
    const expectedPct = Math.min(100, Math.round((elapsedDays / deadlineDays) * 100))

    const rawPct = e.progress?.percentage
    const progressPct = typeof rawPct === "string" ? Number(rawPct) : (rawPct ?? 0)
    const pct = Number.isFinite(progressPct) ? (progressPct as number) : 0

    if (pct < expectedPct) behind.add(e.student_id)
  }
  return behind
}

/**
 * Fatia 15: exported so `api/engagement/campaign/route.ts` can resolve the
 * `no_reflection` campaign segment from the SAME roster signal source as
 * `generateNudgeSuggestions` below, instead of duplicating this sessions +
 * reflections + enrollments + courses read.
 */
export async function loadStudentSignals(
  db: ServiceClient,
  tenantId: string,
): Promise<StudentSignal[]> {
  const now = Date.now()

  const [studentsRes, sessionsRes, reflectionsRes, enrollmentsRes, coursesRes] = await Promise.all([
    db.from("users").select("id, full_name, email").eq("tenant_id", tenantId).eq("role", "student"),
    db.from("sessions").select("student_id, status, created_at").eq("tenant_id", tenantId),
    db.from("slide_reflections").select("student_id").eq("tenant_id", tenantId),
    db
      .from("enrollments")
      .select("student_id, status, created_at, progress, course_id")
      .eq("tenant_id", tenantId),
    db.from("courses").select("id, deadline_days").eq("tenant_id", tenantId),
  ])

  const students = (studentsRes.data ?? []) as {
    id: string
    full_name: string | null
    email: string | null
  }[]
  const sessions = (sessionsRes.data ?? []) as RawSessionRow[]
  const reflections = (reflectionsRes.data ?? []) as RawReflectionRow[]
  const enrollments = (enrollmentsRes.data ?? []) as RawEnrollmentRow[]
  const courses = (coursesRes.data ?? []) as RawCourseRow[]

  const courseById = new Map<string, RawCourseRow>()
  for (const c of courses) courseById.set(c.id, c)
  const behindStudentIds = computeBehindStudentIds(enrollments, courseById, now)

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
      behindSchedule: behindStudentIds.has(student.id),
    }
  })
}

/**
 * Classifies students into nudge cohorts using the EXACT roster / next-best-action
 * thresholds. Each entry carries the student set and a human-readable rationale.
 */
export function classifyNudgeCohorts(
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

  // behind_teaching_plan — E2: student is BEHIND the teaching plan pace and has
  // ALREADY started (totalSessions > 0). A never-accessed student is covered by
  // `never_accessed`, not here — this cohort mirrors `student-triage.ts`
  // `ritmo==="atrasado"` (behindSchedule) exclusive of `nao_iniciado`. Atraso is
  // `atencao` (vermelho), the worst state; the message tone reflects the urgency.
  const behindPlan = signals.filter((s) => s.behindSchedule && s.totalSessions > 0)
  if (behindPlan.length > 0) {
    cohorts.push({
      type: "behind_teaching_plan",
      studentIds: behindPlan.map((s) => s.id),
      rationale: `${behindPlan.length} aluno(s) atrás do Plano de Ensino (progresso abaixo do esperado para o prazo). Priorizar antes que o atraso acumule.`,
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
 * @param managerId  E2 (Engagement Center v2): OPTIONAL owning manager. When
 *   given, (a) every INSERT stamps `nudge_suggestions.manager_id = managerId`
 *   (auditoria), and (b) a cohort TYPE this manager DISMISSED within the last
 *   7 days is SUPPRESSED for THIS manager only (the per-manager+type dismissal
 *   window, distinct from the tenant-wide 24h cadence). `null`/`undefined` keeps
 *   the legacy tenant-wide behaviour (no manager stamp, no 7d suppression).
 * @returns the created rows + the cohort types that were skipped.
 */
export async function generateNudgeSuggestions(
  tenantId: string,
  allowedStudentIds?: string[] | null,
  managerId?: string | null,
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

  // Dismissal window (7d) por gestor+tipo — E2 AC4. Regra NOVA e distinta da
  // cadência de 24h acima (que é tenant-wide, por qualquer status). Aqui: se ESTE
  // gestor dispensou um TIPO nos últimos 7 dias, esse tipo é suprimido só para
  // ELE (o filtro é por manager_id). Um gestor diferente não é afetado. Só roda
  // quando managerId é fornecido (fluxo contextual E2+); no modo tenant-wide
  // legado (managerId null) não há supressão por gestor.
  const dismissedTypes = new Set<NudgeType>()
  if (managerId) {
    const dismissCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: dismissedRows, error: dismissErr } = await db
      .from("nudge_suggestions")
      .select("type")
      .eq("tenant_id", tenantId)
      .eq("manager_id", managerId)
      .eq("status", "dismissed")
      .gte("approved_at", dismissCutoff)
    if (dismissErr) {
      throw new Error(`Failed to read dismissal window: ${dismissErr.message}`)
    }
    for (const r of (dismissedRows ?? []) as { type: NudgeType }[]) dismissedTypes.add(r.type)
  }

  const toInsert: Array<{
    tenant_id: string
    type: NudgeType
    target_student_ids: string[]
    template_key: string | null
    rationale: string
    status: "pending"
    manager_id: string | null
  }> = []
  const skipped: NudgeType[] = []

  for (const cohort of cohorts) {
    if (cohort.studentIds.length === 0) continue
    // 24h cadence (tenant-wide) OR 7d per-manager dismissal → skip this cohort.
    if (recentTypes.has(cohort.type) || dismissedTypes.has(cohort.type)) {
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
      manager_id: managerId ?? null,
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
/**
 * E15 (D4): per-recipient variation. When present, `recipients` OVERRIDES the flat
 * `studentIds` + single `message`: the recipient set is `recipients.map(r =>
 * r.studentId)`, and each recipient may carry its own `message` (free-text override
 * — same override semantics as the batch `message`, applied per aluno) and/or
 * `templateKey` (a different seeded template for that line). A `variation` marker
 * ('template'|'override') is stamped into that row's `context.variation` (E14 D4
 * convention). The re-scope + tenant/role trava is UNCHANGED — it filters the
 * recipient set exactly as it filters `studentIds` today; the variation is only
 * the body/template resolution per surviving recipient. When `recipients` is
 * absent every existing caller (flat studentIds + single message) is byte-for-byte
 * unchanged.
 */
export interface CampaignRecipientVariation {
  studentId: string
  message?: string | null
  templateKey?: string | null
  variation?: "template" | "override"
}

export async function dispatchTeamNudge(params: {
  tenantId: string
  studentIds: string[]
  nudgeType: NudgeType
  templateKey?: string | null
  message?: string | null
  courseId?: string | null
  originManagerId: string
  /**
   * E15 (D4): optional per-recipient variation. When provided it is the source of
   * truth for BOTH the recipient set AND each line's message/template — the flat
   * `studentIds`/`message` are ignored for those with an entry here. A recipient in
   * `studentIds` without a `recipients` entry falls back to the flat message/template
   * (so a mixed payload still works). Absent → legacy behaviour, unchanged.
   */
  recipients?: CampaignRecipientVariation[] | null
  /**
   * E15 (E14): when this dispatch belongs to a campaign, its id — stamped into the
   * typed `notifications.campaign_id` FK column AND `context.campaign_id` (E13 §2.3
   * convention). null/absent for non-campaign dispatches (assisted approvals,
   * legacy call-sites) — unchanged.
   */
  campaignId?: string | null
  /**
   * E2 (Engagement Center v2): message ORIGIN. Defaults to 'platform' so the
   * existing call-site (api/analytics/manager/nudge) keeps its current behaviour
   * until E3/E6 pass it explicitly. When 'manager', `senderName` MUST be the
   * authenticated caller's name (validated at the route — never trusted from the
   * client payload). Persisted to notifications.sender_identity/sender_name.
   */
  senderIdentity?: SenderIdentity
  senderName?: string | null
  /**
   * Rodada 4 (E12, bug de confiança 2026-07-09): the CHANNEL the manager actually
   * chose in the Campanhas wizard. The in-app notification is ALWAYS created (it
   * is the student's inbox entry); this flag ONLY governs the EMAIL mirror:
   *   • 'email' (DEFAULT) → email mirror rides when the template supports it AND
   *     the student has an address — the legacy behaviour, so the existing
   *     call-sites (api/analytics/manager/nudge, api/engagement/action) that do
   *     NOT pass `channel` keep dispatching email exactly as before.
   *   • 'inapp' → the manager EXPLICITLY chose in-app only; the email mirror is
   *     SUPPRESSED even when the template supports email. This is the fix: before
   *     Rodada 4 the wizard's "In-app" choice was cosmetic (it only filtered the
   *     template list) and an email always went out anyway.
   *   • 'email_only' (E12 Rodada 7 item 2) → the manager chose e-mail WITHOUT
   *     in-app; the inbox row is SKIPPED and only the email mirror is sent. This
   *     is the missing third case now that in-app and e-mail are independent
   *     checkboxes (in-app / e-mail / both). It never suppresses the email.
   * Default 'email' preserves every current caller byte-for-byte; only the
   * Campanhas wizard and the Central de Envios pass this explicitly.
   */
  channel?: "inapp" | "email" | "email_only"
}): Promise<DispatchTeamNudgeResult> {
  const {
    tenantId,
    studentIds,
    nudgeType,
    templateKey,
    message,
    courseId,
    originManagerId,
    senderIdentity = "platform",
    senderName = null,
    channel = "email",
    recipients = null,
    campaignId = null,
  } = params
  // Channel gates (E12 Rodada 7 item 2 — independent in-app / e-mail):
  //   • emailAllowed  → the e-mail mirror rides (every channel except pure "inapp").
  //   • inAppAllowed  → the inbox row is written (every channel except "email_only").
  // The default "email" keeps BOTH true, byte-for-byte the legacy behaviour.
  const emailAllowed = channel !== "inapp"
  const inAppAllowed = channel !== "email_only"
  const db = createServiceClient()

  // E15 (D4): per-recipient variation. When `recipients` is provided it is the
  // authoritative recipient set + per-line message/template; a plain `studentIds`
  // entry with no variation falls back to the batch message/template. The union of
  // both (deduped) is the requested set the re-scope trava then filters — the
  // variation NEVER widens the set, it only annotates the lines. The map is keyed
  // by studentId; the trava below is byte-for-byte the same filter as before.
  const variationByStudent = new Map<string, CampaignRecipientVariation>()
  for (const r of recipients ?? []) {
    if (r && typeof r.studentId === "string") variationByStudent.set(r.studentId, r)
  }
  const requestedIds = [...new Set([...studentIds, ...variationByStudent.keys()])]
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

  // E15 (D4): per-line templateKey override. A recipient variation may point at a
  // DIFFERENT seeded template than the batch default. We resolve those lazily and
  // cache by key (the batch `template` seeds the cache). A per-line key that fails
  // to resolve / is inactive falls back to the batch template (never throws for one
  // line — the batch template is always valid here). Only used when `recipients`
  // carries a distinct templateKey; the flat path never touches this.
  const templateCache = new Map<string, NotificationTemplateRow>()
  templateCache.set(template.key, template)
  const resolveLineTemplate = async (key: string | null | undefined) => {
    if (!key || key === template.key) return template
    const cached = templateCache.get(key)
    if (cached) return cached
    const { data: row } = await db
      .from("notification_templates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("key", key)
      .single()
    const t = row as NotificationTemplateRow | null
    if (!t || !t.is_active) return template // fall back to the batch template
    templateCache.set(key, t)
    return t
  }

  // 2. Re-fetch + re-scope the recipients to the tenant, asserting the STUDENT
  //    HAT. NEVER trust the passed id array as authoritative for tenant
  //    membership, even though the route already filtered to the team, this is
  //    defence-in-depth.
  //
  //    MULTI-CHAPÉU FIX (Iteração 3, 2026-07-03): assert the student hat via
  //    user_roles, NOT the singular users.role column. A manager can legitimately
  //    nudge a multi-hat member of their team (e.g. Caio, users.role='manager' +
  //    student hat) whom the corrected engagement buckets now surface; filtering
  //    by users.role='student' here would silently drop him as recipientsSkipped.
  //    db is the service client (RLS-immune), so reading a third party's hat is
  //    fine; requestedIds already came from the route's team re-scope trava.
  const { data: hatRows } = await db
    .from("user_roles")
    .select("user_id")
    .eq("role", "student")
    .in("user_id", requestedIds)
  const studentHatIds = [...new Set((hatRows ?? []).map((r) => r.user_id as string))]
  const { data: studentRows } = studentHatIds.length
    ? await db
        .from("users")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId)
        .in("id", studentHatIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] }
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
    // E15 (D4): resolve this recipient's variation. `lineTemplate` may differ from
    // the batch template (per-line templateKey); `lineMessage` is the per-line
    // free-text override (falling back to the batch `message`). `variationMarker`
    // records the provenance for context.variation (E14 D4 convention).
    const variation = variationByStudent.get(student.id)
    const lineTemplate = variation ? await resolveLineTemplate(variation.templateKey) : template
    // Per-line message override precedence: the recipient's own `message`, else the
    // batch `message`, else the template body. A non-empty override → 'override'.
    const rawLineMessage =
      variation && typeof variation.message === "string" && variation.message.trim()
        ? variation.message
        : message
    const hasOverrideText = Boolean(rawLineMessage?.trim())
    const variationMarker: "template" | "override" =
      variation?.variation ?? (hasOverrideText ? "override" : "template")

    const vars: RenderVars = {
      primeiro_nome: firstNameOf(student.full_name),
    }
    if (courseName) vars.curso = courseName

    const rendered = renderTemplate(lineTemplate, vars)
    // A free-form `message` (batch or per-line) OVERRIDES the template body (in-app
    // text); the template still supplies the title + email channel metadata.
    const baseBody = rawLineMessage?.trim() ? rawLineMessage.trim() : rendered.bodyInapp
    // E2 AC6: adapt the greeting to the ORIGIN. The manager voice signs with
    // senderName; the platform voice is institutional. The substantive body is
    // preserved — only the salutation prefix differs.
    const bodyInapp = renderWithOrigin(baseBody ?? "", senderIdentity, {
      firstName: firstNameOf(student.full_name),
      senderName,
    })
    const context = {
      nudge_type: nudgeType,
      sent_by_manager: originManagerId,
      idempotency_key: idempotencyKey,
      ...(courseId ? { course_id: courseId } : {}),
      // E14 §2.3: mirror the campaign id into context for query convenience; the
      // typed campaign_id column below is the authoritative link.
      ...(campaignId ? { campaign_id: campaignId, variation: variationMarker } : {}),
    }

    // In-app row — this IS the student's inbox entry. Written for every channel
    // EXCEPT "email_only" (E12 Rodada 7 item 2), where the manager chose e-mail
    // without the in-app inbox entry. When skipped, we still proceed to the email
    // mirror below (the send is not a no-op).
    if (inAppAllowed) {
      const { error: inAppErr } = await db.from("notifications").insert({
        tenant_id: tenantId,
        recipient_id: student.id,
        template_id: lineTemplate.id,
        channel: "inapp" as const,
        origin: "nudge" as const,
        title: rendered.title,
        body: bodyInapp,
        cta_url: null as string | null,
        context,
        status: "sent" as const,
        sender_identity: senderIdentity,
        sender_name: senderIdentity === "manager" ? senderName : null,
        // E14: link the notification to its campaign (typed FK column).
        campaign_id: campaignId,
        sent_at: nowIso,
      })
      if (inAppErr) {
        console.error("[engagement] team-nudge in-app insert failed:", inAppErr.message)
        recipientsSkipped++
        continue
      }
      inAppCreated++
    }

    // Email MIRROR — only when the manager DID NOT restrict to in-app AND the
    // template enables email AND the student has an address. `emailAllowed` is the
    // Rodada 4 fix: an explicit "In-app" choice in the wizard now truly suppresses
    // the email that the template would otherwise trigger.
    if (emailAllowed && lineTemplate.channel_email && student.email) {
      // The email body mirrors the origin-adapted in-app text (same greeting),
      // but the FROM stays the platform address for deliverability (decision #4);
      // senderName in the email envelope reflects the human origin label.
      const emailSenderLabel =
        senderIdentity === "manager" && senderName ? senderName : lineTemplate.name
      const html = buildNotificationEmail({
        subject: rendered.emailSubject || rendered.title,
        body: bodyInapp || "",
        senderName: emailSenderLabel,
      })
      const ok = await sendEmail({
        to: student.email,
        subject: rendered.emailSubject || rendered.title,
        // Free message OR manager origin → use the composed html (origin-aware);
        // pure template + platform → keep the template's own email html.
        html: hasOverrideText || senderIdentity === "manager" ? html : rendered.emailHtml || html,
      })
      if (ok) emailsSent++
      else emailsFailed++

      // Persist a mirror row regardless of send outcome (status reflects it).
      const { error: emailRowErr } = await db.from("notifications").insert({
        tenant_id: tenantId,
        recipient_id: student.id,
        template_id: lineTemplate.id,
        channel: "email" as const,
        origin: "nudge" as const,
        title: rendered.emailSubject || rendered.title,
        body: hasOverrideText || senderIdentity === "manager" ? html : rendered.emailHtml || html,
        cta_url: null,
        context,
        status: ok ? ("sent" as const) : ("queued" as const),
        sender_identity: senderIdentity,
        sender_name: senderIdentity === "manager" ? senderName : null,
        campaign_id: campaignId,
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
