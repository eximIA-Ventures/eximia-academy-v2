// ---------------------------------------------------------------------------
// Cards Mestre-Detalhe (fatia 4/6, doc 03 §4 decisão 2) — the individual
// "porquê" a student appears in the "Atenção" card's no_reflection cohort.
// ---------------------------------------------------------------------------
// `no_reflection` is ORTHOGONAL to the canonical `triagem` (student-triage.ts)
// — a student can be `triagem === "no_ritmo"` (or "sem_acesso") AND still show
// up in Atenção purely because they completed sessions without reflecting.
// When that is the ONLY reason they are here (their real triagem is not
// already "atencao"), the modal needs a per-student explanation; when triagem
// IS already "atencao", the cohort title already explains it (redundant).
//
// Condition mirrors engine.ts's no_reflection cohort filter (NOT
// reimplemented, just the read-side check): completedSessions >= 2 &&
// reflectionsCount === 0.
// ---------------------------------------------------------------------------

import type { StudentTriagem } from "@/lib/student-triage"

const NO_REFLECTION_MIN_SESSIONS = 2

/**
 * Individual explanation for a student inside the "Atenção" card's
 * `no_reflection` cohort. Returns `null` when no extra phrase is needed:
 *   • the no_reflection condition doesn't hold for this student, or
 *   • their real `triagem` is already "atencao" (the cohort title already
 *     explains it — an extra phrase would be redundant), or
 *   • `triagem` is unresolved (nothing to compose a claim from).
 */
export function deriveAttentionReason(input: {
  triagem: StudentTriagem | undefined
  completedSessions: number
  reflectionsCount: number
}): string | null {
  const { triagem, completedSessions, reflectionsCount } = input
  const isNoReflection = completedSessions >= NO_REFLECTION_MIN_SESSIONS && reflectionsCount === 0
  if (!isNoReflection || !triagem || triagem === "atencao") return null

  if (triagem === "no_ritmo") return "No ritmo, mas sem interações recentes de reflexão."
  return "Sem acesso recente, e também sem reflexões registradas." // triagem === "sem_acesso"
}
