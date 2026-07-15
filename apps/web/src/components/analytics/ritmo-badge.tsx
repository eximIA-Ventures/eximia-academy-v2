// ---------------------------------------------------------------------------
// RitmoBadge — SINGLE SOURCE OF TRUTH for the manager "Ritmo" pill + its colours
// ---------------------------------------------------------------------------
// Extracted from student-insights-table.tsx (Rodada 4, E12 2026-07-09) so the
// Engagement Center "Ver alunos" modal can render the EXACT same visual the
// manager sees in the main table — one component, one palette, one taxonomy.
// The table now re-exports these; nothing was duplicated.
//
// The DISPLAY state (concluido / no_ritmo / atrasado / sem_acesso / nao_iniciado)
// is derived from the canonical (ritmo, triagem, conclusão) WITHOUT touching the
// student-triage.ts engine — it is a presentation-level partition, computed the
// same way whether the caller is the table (StudentInsightRow) or a lighter
// projection (the engagement students route).

/**
 * Estado EXIBIDO na coluna/badge Ritmo: a mesma partição dos Destaques/cards
 * (uma taxonomia, uma verdade por linha), derivado display-level de
 * (ritmo, triagem, concluído) sem alterar o motor de student-triage.ts.
 */
export type RitmoDisplay = "concluido" | "no_ritmo" | "atrasado" | "sem_acesso" | "nao_iniciado"

/**
 * Minimal signal the display partition needs. Any caller (the heavy
 * StudentInsightRow or the light engagement projection) maps down to this shape.
 *   • ritmo/triagem come from student-triage.ts (computeStudentRitmo/Triagem)
 *   • coursesEnrolled/coursesCompleted decide the "concluído" override
 */
export interface RitmoDisplaySignal {
  ritmo?: "no_ritmo" | "atrasado" | "nao_iniciado"
  triagem?: "no_ritmo" | "atencao" | "sem_acesso"
  coursesEnrolled?: number
  coursesCompleted?: number
}

/**
 * Pure display partition, identical to the table's original getRitmoDisplay:
 *   1. all enrollments completed → "concluido" (never falls into atencao/sem_acesso)
 *   2. ritmo "nao_iniciado" → "nao_iniciado"
 *   3. triagem "sem_acesso" → "sem_acesso"
 *   4. otherwise the raw ritmo ("no_ritmo" | "atrasado")
 * Returns undefined when the caller never computed ritmo (no signal to show).
 */
export function ritmoDisplayFrom(s: RitmoDisplaySignal): RitmoDisplay | undefined {
  if (!s.ritmo) return undefined
  if ((s.coursesEnrolled ?? 0) > 0 && s.coursesCompleted === s.coursesEnrolled) return "concluido"
  if (s.ritmo === "nao_iniciado") return "nao_iniciado"
  if (s.triagem === "sem_acesso") return "sem_acesso"
  return s.ritmo
}

export const RITMO_SORT_RANK: Record<RitmoDisplay, number> = {
  atrasado: 0,
  nao_iniciado: 1,
  sem_acesso: 2,
  no_ritmo: 3,
  concluido: 4,
}

/** Cores dos estados com hex inline onde o token semântico não cobre
 * (âmbar do sem_acesso e o verde sólido do concluído), padrão da casa. */
export const RITMO_BADGE: Record<
  RitmoDisplay,
  { label: string; dot: string; text: string; bg: string }
> = {
  concluido: {
    label: "Concluído",
    dot: "#ffffff",
    text: "#ffffff",
    bg: "var(--color-semantic-success)",
  },
  no_ritmo: {
    label: "No ritmo",
    dot: "#10b981",
    text: "#10b981",
    bg: "rgba(16,185,129,0.13)",
  },
  atrasado: {
    label: "Atrasado",
    dot: "#ef4444",
    text: "#ef4444",
    bg: "rgba(239,68,68,0.13)",
  },
  sem_acesso: {
    label: "Sem acesso",
    dot: "var(--color-semantic-warning)",
    text: "var(--color-semantic-warning)",
    bg: "rgba(245,158,11,0.14)",
  },
  nao_iniciado: {
    label: "Não iniciado",
    dot: "#ef4444",
    text: "#ef4444",
    bg: "rgba(239,68,68,0.13)",
  },
}

export function RitmoBadge({ display }: { display?: RitmoDisplay }) {
  if (!display) return <span className="text-xs text-text-muted">-</span>
  const cfg = RITMO_BADGE[display]
  // Mockup R3: pill maior, texto colorido, sem dot.
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
    >
      {cfg.label}
    </span>
  )
}
