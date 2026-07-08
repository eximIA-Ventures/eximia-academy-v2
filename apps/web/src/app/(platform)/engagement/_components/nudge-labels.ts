// ---------------------------------------------------------------------------
// Engagement Center v2 — human labels for cohort/nudge types (E7/E8).
// ---------------------------------------------------------------------------
// Shared between the Campaigns tab (E7 — group heading + "motivo de inclusão")
// and the History tab (E8 — the "Motivo"/"Tipo de ação" column/filter). The UI
// never shows the raw `NudgeType` enum value; it shows these human strings, the
// same discipline the report (Seção 14) requires for template keys.
//
// Owned by the E7/E8/E9 dev (Dex). New file, not a shared shell contract.
// ---------------------------------------------------------------------------

import type { NudgeType } from "@/types/notifications"

/** Human label for a cohort/nudge type (group heading + inclusion reason). */
export const NUDGE_TYPE_LABEL: Record<NudgeType, string> = {
  never_accessed: "Nunca acessaram",
  inactive: "Inativos há mais de 14 dias",
  behind_teaching_plan: "Atrasados no Plano de Ensino",
  no_reflection: "Sem reflexão recente",
  top_performer: "Destaques positivos",
  announcement: "Comunicado",
  custom: "Mensagem personalizada",
}

/**
 * Short reason of inclusion shown per recipient in the campaign review screen
 * (E7 AC5). Derived from the group's type — the report (Seção 12) treats the
 * GROUP reason as sufficient per-recipient motivo, so we reuse it verbatim.
 */
export const NUDGE_TYPE_REASON: Record<NudgeType, string> = {
  never_accessed: "Nunca acessou a plataforma",
  inactive: "Sem acesso há mais de 14 dias",
  behind_teaching_plan: "Atrasado no Plano de Ensino",
  no_reflection: "Sem reflexão recente",
  top_performer: "Destaque positivo do recorte",
  announcement: "Incluído no comunicado",
  custom: "Selecionado manualmente",
}

/** Safe lookup that never throws on an unknown value coming off the wire. */
export function nudgeTypeLabel(type: string): string {
  return NUDGE_TYPE_LABEL[type as NudgeType] ?? type
}

export function nudgeTypeReason(type: string): string {
  return NUDGE_TYPE_REASON[type as NudgeType] ?? type
}
