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
   * FOLLOW-UP B — SELF-view signal for the SUBJECT ONLY: the home caller is
   * auth.uid() navigating right now, so the current request IS access. Bumps
   * only the "Você" last-access cell — NEVER the org reference (the reference
   * must stay identical for every viewer, SH-F.3). Optional.
   */
  subjectLastSeenMs?: number,
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
  const bumpLatest = (id: string, iso: string | null | undefined) => {
    if (!iso) return
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return
    const prev = latestByStudent.get(id)
    if (prev === undefined || t > prev) latestByStudent.set(id, t)
  }
  for (const s of sessionRows) {
    if (!scope.has(s.student_id)) continue
    sessionCount.set(s.student_id, (sessionCount.get(s.student_id) ?? 0) + 1)
    if (s.status === "completed") {
      completedByStudent.set(s.student_id, (completedByStudent.get(s.student_id) ?? 0) + 1)
    }
    bumpLatest(s.student_id, s.created_at)
    bumpLatest(s.student_id, s.updated_at)
  }

  const reflectionsByStudent = new Map<string, number>()
  for (const r of reflectionRows) {
    if (!scope.has(r.student_id)) continue
    reflectionsByStudent.set(r.student_id, (reflectionsByStudent.get(r.student_id) ?? 0) + 1)
    bumpLatest(r.student_id, r.created_at)
    bumpLatest(r.student_id, r.updated_at)
  }

  // users.last_seen_at — pure-navigation access joins the same max.
  if (lastSeenByStudent) {
    for (const [id, ms] of lastSeenByStudent) {
      if (!scope.has(id) || !Number.isFinite(ms)) continue
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
  const { behind, progressByStudent } = computeBehindAndProgress(
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
  const lastAccessDaysOf = (id: string): number | null => {
    const latest = latestByStudent.get(id)
    if (latest === undefined) return null
    return Math.floor(Math.max(0, now - latest) / DAY_MS)
  }

  // --- Você (subject) ---
  // Self-view: the subject's last access is the max of the stored signals and
  // the current visit (subjectLastSeenMs). Computed LOCALLY — latestByStudent is
  // never mutated, so the org mean below stays viewer-independent.
  const subjectLastAccessDays = (() => {
    const stored = latestByStudent.get(studentId)
    const self =
      subjectLastSeenMs !== undefined && Number.isFinite(subjectLastSeenMs)
        ? subjectLastSeenMs
        : undefined
    const latest =
      stored === undefined ? self : self === undefined ? stored : Math.max(stored, self)
    if (latest === undefined) return null
    return Math.floor(Math.max(0, now - latest) / DAY_MS)
  })()
  const subject = {
    lastAccessDays: subjectLastAccessDays,
    ritmoDisplay: displayFor(studentId),
    progressPct: progressOf(studentId),
    engagement: engagementOf(studentId),
    interactions: interactionsOf(studentId),
    reflections: reflectionsOf(studentId),
    // SH-F.5 — the trail ceiling; undefined → the cell degrades to the absolute.
    engagementMax,
    // "Onde você está" — last completed module/chapter name; null → "Começando".
    lastCompletedLabel: lastCompletedLabel ?? null,
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
  }

  return { subject, reference }
}
