// ---------------------------------------------------------------------------
// E6 — server-side derivation of a student's nudgeType from their REAL ritmo.
// ---------------------------------------------------------------------------
// AC10: when the Individual Action Sheet is opened from the table bridge (E10,
// `?student&action=activate`), the `action` verb does NOT carry a nudgeType. The
// template is derived SERVER-SIDE from the student's actual ritmo — NOT from
// `computeStudentAction` (which only receives `triagem`, not `ritmo`, and can't
// distinguish `atrasado` from `nao_iniciado`).
//
// Derivation rule (E6 AC10, verbatim from the story):
//   ritmo === "atrasado"                        → "behind_teaching_plan"
//   ritmo === "nao_iniciado" | totalSessions===0 → "never_accessed"
//   otherwise                                    → "inactive"
//
// This is a PURE function so it is unit-tested in isolation (the 3 cases). It
// does NOT modify `student-triage.ts`; it CONSUMES the `StudentRitmo` type and
// (in the route) the `computeStudentRitmo` output — single source of truth.
// ---------------------------------------------------------------------------

import type { StudentRitmo } from "@/lib/student-triage"
import type { NudgeType } from "@/types/notifications"

/**
 * Maps a student's real ritmo (+ session count) to the nudgeType whose template
 * the Sheet should pre-fill. See AC10.
 *
 * `totalSessions === 0` is an explicit fallback for the "never accessed" case
 * even when ritmo was not resolved to `nao_iniciado` (defensive: a student with
 * zero sessions is, by definition, someone who never started).
 */
export function deriveNudgeTypeFromRitmo(ritmo: StudentRitmo, totalSessions: number): NudgeType {
  if (ritmo === "atrasado") return "behind_teaching_plan"
  if (ritmo === "nao_iniciado" || totalSessions === 0) return "never_accessed"
  return "inactive"
}
