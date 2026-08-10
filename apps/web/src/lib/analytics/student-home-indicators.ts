// ---------------------------------------------------------------------------
// student-home-indicators — the 4 OPERATIONAL "Meu ritmo" indicators, org-wide
// ---------------------------------------------------------------------------
// Hugo (2026-07-12): the student home compares Você vs the ORGANIZATION average
// on the SAME operational indicators the gestor sees in the "Tabela simplificada":
//   Último acesso · Ritmo · Progresso · Engajamento.
//
// This is PURE + testable, and REUSES the gestor's single-source computations
// (no reinvention): `computeBehindAndProgress` (progress + behind→pace),
// `computeStudentRitmo` / `computeStudentTriagem` / `ritmoDisplayFrom` (ritmo
// badge), and the engagement formula `completedSessions*2 + reflections`.
//
// Modeling decisions cravadas by Hugo (2026-07-12):
//   D1 (recência média): the org "Último acesso" average is the mean recency of
//       students who HAVE accessed; never-accessed students are EXCLUDED (missing
//       data, not bad recency). null when nobody accessed.
//   D2 ("% em dia"): the org "Ritmo" cell is (no_ritmo + concluído) / total org
//       students — "concluído" counts as healthy. Label "% em dia".
//   D3 (progresso): course/deadline-based progress (progressByStudent), the same
//       number the gestor shows, NOT the chapter-based completionPct.
// ---------------------------------------------------------------------------

import { ritmoDisplayFrom } from "@/components/analytics/ritmo-badge"
import { countReflectionBlocks } from "@/lib/analytics/reflection-potential"
import { type EnrollmentRow, computeBehindAndProgress } from "@/lib/notifications/engagement-triage"
import {
  type StudentPace,
  type TriageInput,
  computeStudentRitmo,
  computeStudentTriagem,
} from "@/lib/student-triage"
import type { StudentHomeIndicators } from "@/types/analytics"

// ---------------------------------------------------------------------------
// SH-F.5 — the "Você" engagement CEILING N (fraction "X de N"). PURE helpers,
// derived FRESH per request from the student's own trail (never cached). N casa
// 1:1 com o numerador: N = capítulos da trilha × 2 + slides-com-reflexão (cada
// capítulo → no máximo 1 interação concluível; cada slide → no máximo 1 reflexão).
// ---------------------------------------------------------------------------

/** An enrollment row, minimally, for the trail derivation. */
export interface TrailEnrollment {
  student_id: string
  status: string | null
  course_id: string
}
/** A chapter row (id + owning course) — the tenant catalog. */
export interface TrailChapter {
  id: string
  course_id: string | null
}
/** A slide row, minimally — only its markdown text is read. */
export interface TrailSlide {
  text_content: string | null
}

/**
 * The chapter ids of the STUDENT's own trail: chapters of the courses the student
 * is enrolled in (status active/completed) that are NOT archived (∈ activeCourseIds).
 * Pure — derived per request from the org catalog + the student's enrollments.
 */
export function trailChapterIdsOf(
  studentId: string,
  enrollments: TrailEnrollment[],
  chapters: TrailChapter[],
  activeCourseIds: Set<string>,
): string[] {
  const trailCourseIds = new Set<string>()
  for (const e of enrollments) {
    if (e.student_id !== studentId) continue
    if (e.status !== "active" && e.status !== "completed") continue
    if (!activeCourseIds.has(e.course_id)) continue
    trailCourseIds.add(e.course_id)
  }
  return chapters
    .filter((ch) => ch.course_id !== null && trailCourseIds.has(ch.course_id))
    .map((ch) => ch.id)
}

/**
 * Count of trail slides that have AT LEAST ONE reflection prompt (each such slide
 * caps at 1 reflection — plano §2.1). Reuses `countReflectionBlocks` (não reinventa).
 */
export function countReflectionPossibleSlides(slides: TrailSlide[]): number {
  return slides.filter((s) => countReflectionBlocks(s.text_content) > 0).length
}

/** N (Você) = capítulos da trilha × 2 + slides-com-reflexão. Pure. */
export function computeEngagementMax(
  trailChapterCount: number,
  reflectionPossibleSlides: number,
): number {
  return trailChapterCount * 2 + reflectionPossibleSlides
}

/**
 * SH-1.5 Round 2 (Hugo 2026-07-18) — the CLASS-side fraction denominators: the
 * MEAN per-student trail ceilings across the whole org population, so the "Turma"
 * cell of Interações/Reflexões/Engajamento renders "X/Y" just like the Você side.
 *
 * For EACH comparable student we derive their OWN trail ceilings, exactly the way
 * the subject's are derived in `computeStudentComparison` (REUSE, don't reinvent):
 *   • interactionsMax = |trail chapters| (each chapter caps at 1 interaction);
 *   • reflectionsMax  = |trail slides with ≥1 reflection prompt|;
 *   • engagementMax   = computeEngagementMax(interactionsMax, reflectionsMax).
 * Then each Avg is the ROUNDED mean over ALL org students (denominator = org size,
 * so students with an empty trail contribute 0 — the honest mean, parallel to how
 * the reference block already averages interactions/reflections over the total).
 *
 * PURE + no N+1: the caller pre-loads the reflection-possible-slide count PER
 * CHAPTER once (from a single `chapter_slides` union scan) and passes it in
 * `reflectionSlidesByChapter`; this function only sums/averages already-loaded
 * data. `orgStudentIds` empty → all three are 0.
 */
export function computeOrgTrailMaxAverages(
  orgStudentIds: string[],
  enrollments: TrailEnrollment[],
  chapters: TrailChapter[],
  activeCourseIds: Set<string>,
  /** chapter_id → count of that chapter's reflection-possible slides (pre-derived once). */
  reflectionSlidesByChapter: Map<string, number>,
): {
  interactionsMaxAvg: number
  reflectionsMaxAvg: number
  engagementMaxAvg: number
} {
  const total = orgStudentIds.length
  if (total === 0) {
    return { interactionsMaxAvg: 0, reflectionsMaxAvg: 0, engagementMaxAvg: 0 }
  }
  let interactionsSum = 0
  let reflectionsSum = 0
  for (const id of orgStudentIds) {
    const trailChapterIds = trailChapterIdsOf(id, enrollments, chapters, activeCourseIds)
    interactionsSum += trailChapterIds.length
    let reflectionSlides = 0
    for (const chId of trailChapterIds) {
      reflectionSlides += reflectionSlidesByChapter.get(chId) ?? 0
    }
    reflectionsSum += reflectionSlides
  }
  const interactionsMaxAvg = Math.round(interactionsSum / total)
  const reflectionsMaxAvg = Math.round(reflectionsSum / total)
  // Same helper the Você side uses — the class ceiling is the weighted sum of the
  // two ROUNDED averages, so the displayed "Y" reconciles with its own breakdown.
  const engagementMaxAvg = computeEngagementMax(interactionsMaxAvg, reflectionsMaxAvg)
  return { interactionsMaxAvg, reflectionsMaxAvg, engagementMaxAvg }
}

// ---------------------------------------------------------------------------
// SH-1.5 — engagement RANK (REGRA DE NEGÓCIO CRÍTICA, AC7/AC12). The ONLY way a
// student earns "1º da turma – Parabéns!" is a REAL rank of 1 across ALL
// comparable org students, computed on the backend from the SAME engagement
// formula (interactions*2 + reflections). Pure + tie-strict: an exclusive
// #1 means the student's engagement is STRICTLY greater than every other
// comparable student's — a shared max top (2+ students tied) yields NO exclusive
// #1 (AC12, safest default: never claim "você é O mais engajado" on a tie).
// ---------------------------------------------------------------------------

/**
 * TRUE only when `studentEngagement` is STRICTLY greater than every entry in
 * `otherEngagements` (the engagement scores of the OTHER comparable org students,
 * the subject's own score excluded by the caller). A shared maximum → false (AC12).
 * Pure — no identity, no scores of others leak out; the caller passes only raw
 * numbers and receives a single boolean about the OWN student.
 */
export function isTopEngagementRank(
  studentEngagement: number,
  otherEngagements: number[],
): boolean {
  for (const other of otherEngagements) {
    if (other >= studentEngagement) return false
  }
  return true
}

/**
 * SH-1.5 Round 2 (Hugo 2026-07-18) — the student's POSITION in the engagement
 * ranking (e.g. "3º de 15"), the number the "Você" Engajamento cell now shows
 * instead of the raw score. STANDARD COMPETITION RANKING ("1224"): a tie SHARES
 * the same position, so `rank = 1 + (how many OTHERS score STRICTLY higher)` and
 * `total = otherEngagements.length + 1` (the subject counts once). Being the sole
 * top → rank 1; sharing the top with one peer → both rank 1 (never 1 and 2).
 *
 * DISTINCT from {@link isTopEngagementRank} (a boolean gate for the "1º da turma"
 * copy, which stays STRICT/tie-false): the display rank INCLUDES ties in position,
 * whereas the celebratory copy requires a strict, unshared #1. Both are kept — the
 * boolean still gates leituraFor's exclusive-#1 claim; this returns the shown position.
 *
 * Pure + LGPD-safe: receives/returns ONLY numbers about the OWN student — no
 * identity, no ordered list, no peer score ever leaves this function.
 */
export function engagementRankOf(
  studentEngagement: number,
  otherEngagements: number[],
): { rank: number; total: number } {
  let strictlyAbove = 0
  for (const other of otherEngagements) {
    if (other > studentEngagement) strictlyAbove += 1
  }
  return { rank: 1 + strictlyAbove, total: otherEngagements.length + 1 }
}

/** Minimal session shape the indicators read (a subset of SessionRow). */
export interface HomeSessionRow {
  student_id: string
  status: string | null
  created_at: string
  /**
   * Last turn of the session (bumped by `claim_session_turn` on EVERY message).
   * Sessions are REUSED when the student comes back to a chapter (createSession
   * redirects to the existing active row instead of inserting), so `created_at`
   * alone under-counts access — the Rinaldo case: created 21d ago, chatted today,
   * home said "há 21 dias". Optional: absent → falls back to created_at.
   */
  updated_at?: string | null
}

/** Minimal reflection shape the indicators read. */
export interface HomeReflectionRow {
  student_id: string
  /** Writing/editing a reflection is platform access too. Optional (see above). */
  created_at?: string | null
  updated_at?: string | null
}

const DAY_MS = 86_400_000

/**
 * AJUSTE 2 (Hugo 2026-07-14) — the SUBJECT's "current visit" window: any activity
 * stamp within the last hour belongs to the visit happening NOW (aligned with the
 * last-seen bump TTL, lib/last-seen.ts). The "Você" cell shows the most recent
 * access OUTSIDE this window — the PREVIOUS visit — because on a self-view
 * "último acesso: hoje" is tautological (the student is looking at the page).
 */
const CURRENT_VISIT_WINDOW_MS = 3_600_000

/**
 * Build the 4 operational indicators for `studentId` (Você) and the ORG average,
 * over the already-loaded tenant-wide rows. Pure. `orgStudentIds` is the whole
 * organization population (role=student, tenant-scoped, NO area filter — M2).
 */
export function buildStudentHomeIndicators(
  studentId: string,
  orgStudentIds: string[],
  sessionRows: HomeSessionRow[],
  reflectionRows: HomeReflectionRow[],
  enrollments: EnrollmentRow[],
  deadlineByCourse: Map<string, number | null>,
  now: number,
  /** SH-F.5 — the "Você" engagement ceiling N (fraction "X de N"). Additive/optional. */
  engagementMax?: number,
  /**
   * "Onde você está" — the NAME of the last module/chapter the subject COMPLETED
   * (e.g. "Módulo 3: Precificação"). Derived subject-scoped by the caller; null when
   * nothing was completed → the cell falls back to "Começando". Additive/optional.
   */
  lastCompletedLabel?: string | null,
  /**
   * FOLLOW-UP B (Hugo 2026-07-14) — users.last_seen_at per student, in epoch ms:
   * pure navigation (login/browse without chat or reflection) is access too.
   * Enters the SAME max as sessions/reflections, for the subject AND the D1 org
   * mean. Additive/optional: absent (or pre-migration empty) → behaves as before.
   */
  lastSeenByStudent?: Map<string, number>,
  /**
   * SH-1.5 — per-row fraction denominators (Você-only): `interactionsMax` = trail
   * chapter count, `reflectionsMax` = trail slides with a reflection prompt. DISTINCT
   * from `engagementMax` (the weighted sum). Additive/optional: absent → the cell
   * degrades to the absolute. Derived FRESH per request by the caller (never cached).
   * APPENDED at the end of the signature (after `lastSeenByStudent`) so the existing
   * positional call sites and tests are byte-for-byte unaffected (Art. IV, no regression).
   */
  perRowMax?: { interactionsMax?: number; reflectionsMax?: number },
  /**
   * SH-1.5 Round 2 (Hugo 2026-07-18) — the CLASS-side fraction denominators (mean
   * trail ceilings across the org), so the "Turma" cell of Interações/Reflexões/
   * Engajamento reads "X/Y" too. Merged into `reference`. Additive/optional and
   * APPENDED last: absent → the reference fields stay undefined and the Turma cell
   * degrades to the absolute, exactly as before (no regression).
   */
  orgTrailMaxAverages?: {
    interactionsMaxAvg?: number
    reflectionsMaxAvg?: number
    engagementMaxAvg?: number
  },
  /**
   * B.6 (feat-percorrido-na-tela-do-aluno, Hugo 2026-07-31) — o Percorrido: "você
   * passou pelos slides" (`chapter_view_progress`), a MESMA leitura já em
   * produção na tabela do GESTOR (`view-progress-read.ts`), agora também na
   * tela do aluno. APPENDED at the end of the signature, same additive pattern
   * as every other optional param here: absent → `subject`/`reference`
   * .percorridoPct stay `undefined`, zero regression. When present,
   * `subjectPct`/`orgAvgPct` carry `null` to mean "sem dado" (never a silent 0
   * — B9, mesma regra da tabela do gestor).
   */
  percorrido?: {
    /** Você: null quando não há linha de `chapter_view_progress` para este aluno. */
    subjectPct: number | null
    /** Turma: média (0..100) só entre os alunos COM dado; null se ninguém tem. */
    orgAvgPct: number | null
  },
): StudentHomeIndicators | null {
  if (orgStudentIds.length === 0) return null
  const org = new Set(orgStudentIds)

  // BUG-1 — the SUBJECT (Você) must be able to read its OWN rows even when it is
  // NOT part of `orgStudentIds`. `orgStudentIds` is the tenant population role=
  // 'student' only, but `view=student` is a self-view open to EVERY role (see
  // manager-groups/gate.ts canAccessView + route.ts): a multi-hat caller
  // (leader/manager/instructor who also studies) has sessions/reflections with
  // student_id = auth.uid() (RLS-guarded) yet is absent from the student roster.
  // The per-student aggregate maps below therefore key over `scope = org ∪
  // {studentId}` so the subject is never filtered out. The MEAN/reference loops
  // further down still iterate strictly over `orgStudentIds` (the denominator is
  // unchanged), so the subject stays OUT of the class average — it only gains the
  // right to see its own numbers.
  const scope = new Set(org)
  scope.add(studentId)

  // Per-student session aggregates (count, completed count, last access ms).
  // "Último acesso" = the student's most recent ACTIVITY across the loaded
  // signals: session created_at AND updated_at (a reused session's turns only
  // move updated_at) plus reflection created_at/updated_at. All extra fields are
  // optional — rows carrying only created_at behave exactly as before.
  const completedByStudent = new Map<string, number>()
  const latestByStudent = new Map<string, number>()
  const sessionCount = new Map<string, number>()
  // AJUSTE 2 — every activity stamp of the SUBJECT, individually (not just the
  // max): the "Você" cell needs the PREVIOUS visit, i.e. the most recent stamp
  // OUTSIDE the current-visit window. Collected alongside the existing loops.
  // `latestByStudent`/`subjectStamps` stay fed by ALL THREE signals (session +
  // reflection + last_seen_at) — ritmo/triagem (`displayFor` below) and every
  // OTHER consumer of "any access" keep reading these two untouched.
  const subjectStamps: number[] = []
  // SH-2.2 (Hugo 2026-07-19, caso Angelo) — "Última atividade"/"Última sessão de
  // estudo" must reflect REAL STUDY (a course session or a reflection), never a
  // bare login/page view. This SECOND, narrower pair mirrors `latestByStudent`/
  // `subjectStamps` above but only ever receives session/reflection stamps —
  // `lastSeenByStudent` (pure navigation) never reaches it. Angelo: 0% progresso,
  // 0/8 interações, 1/41 reflexões, mas a "Última atividade" mostrava "hoje" e
  // "ativo acima da média" — porque ele tinha só ABERTO o app hoje (bump de
  // last_seen_at), sem estudar. `subjectLastAccessDays`/`lastAccessDaysOf` abaixo
  // passam a ler exclusivamente destas duas estruturas.
  const studyLatestByStudent = new Map<string, number>()
  const subjectStudyStamps: number[] = []
  const bumpLatest = (id: string, iso: string | null | undefined, isStudySignal: boolean) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return
    if (id === studentId) subjectStamps.push(t)
    const prev = latestByStudent.get(id)
    if (prev === undefined || t > prev) latestByStudent.set(id, t)
    if (isStudySignal) {
      if (id === studentId) subjectStudyStamps.push(t)
      const prevStudy = studyLatestByStudent.get(id)
      if (prevStudy === undefined || t > prevStudy) studyLatestByStudent.set(id, t)
    }
  }
  for (const s of sessionRows) {
    if (!scope.has(s.student_id)) continue
    sessionCount.set(s.student_id, (sessionCount.get(s.student_id) ?? 0) + 1)
    if (s.status === "completed") {
      completedByStudent.set(s.student_id, (completedByStudent.get(s.student_id) ?? 0) + 1)
    }
    bumpLatest(s.student_id, s.created_at, true)
    bumpLatest(s.student_id, s.updated_at, true)
  }

  const reflectionsByStudent = new Map<string, number>()
  for (const r of reflectionRows) {
    if (!scope.has(r.student_id)) continue
    reflectionsByStudent.set(r.student_id, (reflectionsByStudent.get(r.student_id) ?? 0) + 1)
    bumpLatest(r.student_id, r.created_at, true)
    bumpLatest(r.student_id, r.updated_at, true)
  }

  // users.last_seen_at — pure-navigation access joins `latestByStudent` (ritmo/
  // triagem, "any access") but NEVER `studyLatestByStudent` (SH-2.2): a bare
  // login must never read as "Última atividade"/"Última sessão de estudo".
  if (lastSeenByStudent) {
    for (const [id, ms] of lastSeenByStudent) {
      if (!scope.has(id) || !Number.isFinite(ms)) continue
      if (id === studentId) subjectStamps.push(ms)
      const prev = latestByStudent.get(id)
      if (prev === undefined || ms > prev) latestByStudent.set(id, ms)
    }
  }

  const enrolledByStudent = new Map<string, number>()
  const completedCoursesByStudent = new Map<string, number>()
  for (const e of enrollments) {
    if (!scope.has(e.student_id)) continue
    enrolledByStudent.set(e.student_id, (enrolledByStudent.get(e.student_id) ?? 0) + 1)
    if (e.status === "completed") {
      completedCoursesByStudent.set(
        e.student_id,
        (completedCoursesByStudent.get(e.student_id) ?? 0) + 1,
      )
    }
  }

  // Course/deadline progress + behind→pace (reused verbatim from the gestor).
  // Scoped to `scope` (org ∪ subject) so the subject's OWN progress/pace is
  // derived; the reference loop below still means over `orgStudentIds` only.
  const orgEnrollments = enrollments.filter((e) => scope.has(e.student_id))
  const { behind, progressByStudent, expectedPctByStudent } = computeBehindAndProgress(
    orgEnrollments,
    deadlineByCourse,
    now,
  )
  const paceByStudent = new Map<string, StudentPace>()
  for (const id of behind) paceByStudent.set(id, "behind")

  /** The gestor's ritmo DISPLAY for one student (concluido/no_ritmo/...). */
  const displayFor = (id: string) => {
    const totalSessions = sessionCount.get(id) ?? 0
    const latest = latestByStudent.get(id)
    const row: TriageInput = {
      id,
      totalSessions,
      lastSessionDate: latest !== undefined ? new Date(latest).toISOString() : null,
      courseProgressPct: Math.round(progressByStudent.get(id) ?? 0),
      coursesEnrolled: enrolledByStudent.get(id) ?? 0,
      coursesCompleted: completedCoursesByStudent.get(id) ?? 0,
    }
    const ritmo = computeStudentRitmo(row, paceByStudent)
    const triagem = computeStudentTriagem(row, ritmo, now)
    return ritmoDisplayFrom({
      ritmo,
      triagem,
      coursesEnrolled: row.coursesEnrolled,
      coursesCompleted: row.coursesCompleted,
    })
  }

  const interactionsOf = (id: string) => completedByStudent.get(id) ?? 0
  const reflectionsOf = (id: string) => reflectionsByStudent.get(id) ?? 0
  const engagementOf = (id: string) => interactionsOf(id) * 2 + reflectionsOf(id)
  const progressOf = (id: string) => Math.round(progressByStudent.get(id) ?? 0)
  // SH-2.2 (Hugo 2026-07-19) — reads `studyLatestByStudent` (session/reflection
  // only), NOT `latestByStudent` (which also includes bare login/last_seen_at).
  // The org "Turma" mean for "Última atividade"/"Última sessão de estudo" must
  // sit on the SAME yardstick as the "Você" cell below — both measure REAL STUDY.
  const lastAccessDaysOf = (id: string): number | null => {
    const latest = studyLatestByStudent.get(id)
    if (latest === undefined) return null
    return Math.floor(Math.max(0, now - latest) / DAY_MS)
  }

  // --- Você (subject) ---
  // AJUSTE 2 (Hugo 2026-07-14) — the "Você" cell shows the PREVIOUS visit, not
  // the most recent: on a self-view the caller is auth.uid() looking at the page
  // RIGHT NOW, so "último acesso: hoje" carries zero information. Rule: the most
  // recent subject stamp OUTSIDE the current-visit window (last 60 min). null →
  // no PREVIOUS study activity → the UI renders the empty-state copy (SH-2.2:
  // "Ainda sem sessão de estudo", not the old "Primeiro acesso" — under the new
  // semantics null no longer means literally "first ever login", it means "no
  // REAL study session recorded yet", which can be true even after many logins).
  // SH-2.2 — reads `subjectStudyStamps` (session/reflection only), NOT
  // `subjectStamps` (which also includes login/last_seen_at): a bare login must
  // never surface as the student's "Última atividade"/"Última sessão de estudo"
  // (caso Angelo — ver Change Log da SH-2.2). ritmo/triagem keep reading
  // `latestByStudent`/`subjectStamps` untouched, out of this story's scope.
  const subjectLastAccessDays = (() => {
    const windowStart = now - CURRENT_VISIT_WINDOW_MS
    let previous: number | undefined
    for (const t of subjectStudyStamps) {
      if (t >= windowStart) continue // current visit — not informative here
      if (previous === undefined || t > previous) previous = t
    }
    if (previous === undefined) return null
    return Math.floor(Math.max(0, now - previous) / DAY_MS)
  })()
  // SH-1.5 (AC7/AC12) — REAL engagement rank of the subject among the COMPARABLE
  // org population. "Comparable" = `orgStudentIds` (role=student, tenant-scoped, no
  // area filter — M2), exactly the reference population. Reuses `engagementOf` (the
  // SAME formula over the SAME maps already built above) — NOT a parallel count.
  // isTopEngagement is TRUE only when the subject is STRICTLY the single top
  // (a tie at the top → false, AC12). LGPD: only a boolean of the OWN student is
  // exposed; the scores of others never leave this function. The subject may be a
  // multi-hat caller absent from `orgStudentIds` (BUG-1) — it is compared against
  // the org population regardless (its own score already read via `engagementOf`).
  const subjectEngagement = engagementOf(studentId)
  const otherEngagements: number[] = []
  for (const id of orgStudentIds) {
    if (id === studentId) continue
    otherEngagements.push(engagementOf(id))
  }
  const isTopEngagement = isTopEngagementRank(subjectEngagement, otherEngagements)
  // SH-1.5 Round 2 — the DISPLAY rank ("3º de 15"), computed over the SAME
  // engagement maps already used for isTopEngagement (no duplicated aggregation).
  // Ties share a position (standard competition ranking); the boolean above stays
  // strict for the exclusive-"1º da turma" copy — the two are intentionally different.
  const { rank: engagementRank, total: engagementTotalStudents } = engagementRankOf(
    subjectEngagement,
    otherEngagements,
  )

  const subject = {
    lastAccessDays: subjectLastAccessDays,
    ritmoDisplay: displayFor(studentId),
    progressPct: progressOf(studentId),
    engagement: subjectEngagement,
    interactions: interactionsOf(studentId),
    reflections: reflectionsOf(studentId),
    // SH-F.5 — the trail ceiling; undefined → the cell degrades to the absolute.
    engagementMax,
    // SH-1.5 — per-row fraction denominators (Você-only); absent → cell degrades.
    interactionsMax: perRowMax?.interactionsMax,
    reflectionsMax: perRowMax?.reflectionsMax,
    // SH-1.5 (AC7) — REAL rank; true unlocks "1º da turma" copy, false → fallback.
    isTopEngagement,
    // SH-1.5 Round 2 — the DISPLAY position of the "Você" Engajamento cell ("3º de
    // N"). Only numbers about the OWN student cross the boundary (LGPD).
    engagementRank,
    engagementTotalStudents,
    // "Onde você está" — last completed module/chapter name; null → "Começando".
    lastCompletedLabel: lastCompletedLabel ?? null,
    // SH-2.7 (Hugo 2026-07-19, caso Rinaldo) — "ritmo esperado" (% da trilha que já
    // deveria estar concluído, dado elapsedDays/deadlineDays da matrícula líder do
    // aluno), propagado de `computeBehindAndProgress` (achado da SH-2.4/Prisma, até
    // aqui descartado). Usado como FREIO absoluto no tom `win` de Progresso/
    // Interações/Reflexões — undefined quando não há trilha com deadline computável
    // (degrada graciosamente para a comparação puramente relativa de sempre).
    expectedProgressPct: expectedPctByStudent.get(studentId),
    // B.6 — undefined quando `percorrido` não foi passado (chamador antigo,
    // sem regressão); `null` explícito quando foi tentado e não há dado.
    percorridoPct: percorrido?.subjectPct,
  }

  // --- Média da organização (reference), per the D1/D2/D3 decisions ---
  const total = orgStudentIds.length

  // D1 — recency mean over ACCESSED students only.
  let recencySum = 0
  let accessedCount = 0
  // D2 — "% em dia" = (no_ritmo + concluído) / total.
  let emDiaCount = 0
  // D3 + engagement breakdown — means over ALL org students.
  let progressSum = 0
  let interactionsSum = 0
  let reflectionsSum = 0
  for (const id of orgStudentIds) {
    const days = lastAccessDaysOf(id)
    if (days !== null) {
      recencySum += days
      accessedCount += 1
    }
    const display = displayFor(id)
    if (display === "no_ritmo" || display === "concluido") emDiaCount += 1
    progressSum += progressOf(id)
    interactionsSum += interactionsOf(id)
    reflectionsSum += reflectionsOf(id)
  }

  const interactionsAvg = Math.round(interactionsSum / total)
  const reflectionsAvg = Math.round(reflectionsSum / total)
  const reference = {
    lastAccessAvgDays: accessedCount > 0 ? Math.round(recencySum / accessedCount) : null,
    ritmoEmDiaPct: Math.round((emDiaCount / total) * 100),
    progressAvgPct: Math.round(progressSum / total),
    // engagementAvg is DERIVED from the two ROUNDED parts (not rounded
    // independently), so the manchete identity "número = 2*interações + reflexões"
    // holds on the Média row exactly, just like on the Você row and the gestor.
    // Math is sound: avg(2i + r) === 2*avg(i) + avg(r); the only difference vs a
    // separately-rounded average is a rounding artifact, and the DISPLAYED number
    // must reconcile with the DISPLAYED breakdown (verifiable-by-eye).
    engagementAvg: 2 * interactionsAvg + reflectionsAvg,
    interactionsAvg,
    reflectionsAvg,
    // SH-1.5 Round 2 — CLASS-side fraction denominators (mean trail ceilings).
    // Absent → undefined, and the Turma cell degrades to the absolute (no regression).
    interactionsMaxAvg: orgTrailMaxAverages?.interactionsMaxAvg,
    reflectionsMaxAvg: orgTrailMaxAverages?.reflectionsMaxAvg,
    engagementMaxAvg: orgTrailMaxAverages?.engagementMaxAvg,
    // B.6 — see `subject.percorridoPct` above for the undefined/null distinction.
    percorridoAvgPct: percorrido?.orgAvgPct,
  }

  return { subject, reference }
}
