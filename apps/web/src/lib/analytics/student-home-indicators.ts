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
}

/** Minimal reflection shape the indicators read. */
export interface HomeReflectionRow {
  student_id: string
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
): StudentHomeIndicators | null {
  if (orgStudentIds.length === 0) return null
  const org = new Set(orgStudentIds)

  // Per-student session aggregates (count, completed count, last access ms).
  const completedByStudent = new Map<string, number>()
  const latestByStudent = new Map<string, number>()
  const sessionCount = new Map<string, number>()
  for (const s of sessionRows) {
    if (!org.has(s.student_id)) continue
    sessionCount.set(s.student_id, (sessionCount.get(s.student_id) ?? 0) + 1)
    if (s.status === "completed") {
      completedByStudent.set(s.student_id, (completedByStudent.get(s.student_id) ?? 0) + 1)
    }
    const t = new Date(s.created_at).getTime()
    if (!Number.isNaN(t)) {
      const prev = latestByStudent.get(s.student_id)
      if (prev === undefined || t > prev) latestByStudent.set(s.student_id, t)
    }
  }

  const reflectionsByStudent = new Map<string, number>()
  for (const r of reflectionRows) {
    if (!org.has(r.student_id)) continue
    reflectionsByStudent.set(r.student_id, (reflectionsByStudent.get(r.student_id) ?? 0) + 1)
  }

  const enrolledByStudent = new Map<string, number>()
  const completedCoursesByStudent = new Map<string, number>()
  for (const e of enrollments) {
    if (!org.has(e.student_id)) continue
    enrolledByStudent.set(e.student_id, (enrolledByStudent.get(e.student_id) ?? 0) + 1)
    if (e.status === "completed") {
      completedCoursesByStudent.set(
        e.student_id,
        (completedCoursesByStudent.get(e.student_id) ?? 0) + 1,
      )
    }
  }

  // Course/deadline progress + behind→pace (reused verbatim from the gestor).
  const orgEnrollments = enrollments.filter((e) => org.has(e.student_id))
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
  const subject = {
    lastAccessDays: lastAccessDaysOf(studentId),
    ritmoDisplay: displayFor(studentId),
    progressPct: progressOf(studentId),
    engagement: engagementOf(studentId),
    interactions: interactionsOf(studentId),
    reflections: reflectionsOf(studentId),
    // SH-F.5 — the trail ceiling; undefined → the cell degrades to the absolute.
    engagementMax,
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
