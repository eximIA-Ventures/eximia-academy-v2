import { AlertTriangle, Award, TrendingUp, UserX } from "lucide-react"

interface StudentPaceStatus {
  studentName: string
  courseTitle: string
  status: "ahead" | "on_track" | "behind"
  progressPct: number
  daysLeft: number
  daysAhead: number // negative = behind
}

export interface NoAccessHighlight {
  studentName: string
  /** "Nunca acessou" ou "Xd sem acesso" (X = dias inteiros desde a última sessão) */
  detail: string
}

interface TeachingPlanHighlightsProps {
  highlights: StudentPaceStatus[]
  /**
   * Iteração 2 (2026-07-02): when true, an EMPTY `highlights` list renders a
   * discreet empty state instead of `null`, so a manager in the "Meu Time"
   * context (Diretos or Hierarquia) understands the recorte is legitimately
   * empty, not broken. Only set by team-context callers
   * (manager-dashboard-page.tsx via teamRecortePanel presence) — the
   * organization-context manager view keeps the old `null`-on-empty
   * behaviour, where "no highlights" is simply a normal, unscoped state.
   */
  showEmptyState?: boolean
  /**
   * S8 (Onda 2): terceira lista, "Sem acesso recente" (triagem sem_acesso, por ALUNO,
   * enquanto highlights é por aluno·curso). Quando a prop é fornecida (mesmo []),
   * o card entra em modo 3 colunas com empty state por coluna. Quando undefined
   * (visão do instrutor), o layout 2 colunas atual é preservado sem mudança.
   */
  noAccess?: NoAccessHighlight[]
}

export function TeachingPlanHighlights({
  highlights,
  showEmptyState,
  noAccess,
}: TeachingPlanHighlightsProps) {
  const triageMode = noAccess !== undefined
  const noAccessItems = noAccess ?? []

  // Empty state GLOBAL: só quando NENHUMA lista tem itens.
  if (highlights.length === 0 && noAccessItems.length === 0) {
    if (!showEmptyState) return null
    return (
      <div className="rounded-2xl bg-bg-card shadow-card p-5">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-accent-gold" />
          <h3 className="text-sm font-semibold text-text-primary">Destaques do Plano de Ensino</h3>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Nenhum aluno com plano de ensino ativo neste recorte.
        </p>
      </div>
    )
  }

  const completedOnTime = highlights.filter((h) => h.status === "ahead" || h.status === "on_track")
  const behind = highlights.filter((h) => h.status === "behind")

  return (
    <div className="rounded-2xl bg-bg-card shadow-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Award size={18} className="text-accent-gold" />
        <h3 className="text-sm font-semibold text-text-primary">Destaques do Plano de Ensino</h3>
      </div>

      <div
        className={`grid grid-cols-1 ${triageMode ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4 items-start`}
      >
        {(triageMode || completedOnTime.length > 0) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-semantic-success/70">
              No ritmo ou adiantados
            </p>
            {completedOnTime.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhum aluno no ritmo neste recorte.</p>
            ) : (
              completedOnTime.slice(0, 5).map((h, i) => (
                <div
                  key={`ahead-${h.studentName}-${i}`}
                  className="flex items-center gap-3 rounded-xl bg-semantic-success/5 px-3 py-2 ring-1 ring-semantic-success/10"
                >
                  <TrendingUp size={14} className="text-semantic-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {h.studentName}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {h.courseTitle} — {h.progressPct}% concluído, {h.daysLeft}d restantes
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {(triageMode || behind.length > 0) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-semantic-error/70">
              Atenção — atrasados
            </p>
            {behind.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhum aluno atrasado neste recorte.</p>
            ) : (
              behind.slice(0, 5).map((h, i) => (
                <div
                  key={`behind-${h.studentName}-${i}`}
                  className="flex items-center gap-3 rounded-xl bg-semantic-error/5 px-3 py-2 ring-1 ring-semantic-error/10"
                >
                  <AlertTriangle size={14} className="text-semantic-error shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {h.studentName}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {h.courseTitle} — {h.progressPct}% concluído, {Math.abs(h.daysAhead)}d
                      atrasado
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {triageMode && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-gold/70">
              Sem acesso recente
            </p>
            {noAccessItems.length === 0 ? (
              <p className="text-xs text-text-muted">Todos os alunos acessaram recentemente.</p>
            ) : (
              noAccessItems.slice(0, 5).map((h, i) => (
                <div
                  key={`noaccess-${h.studentName}-${i}`}
                  className="flex items-center gap-3 rounded-xl bg-bg-elevated px-3 py-2 ring-1 ring-border-subtle"
                >
                  <UserX size={14} className="text-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {h.studentName}
                    </p>
                    <p className="text-xs text-text-muted truncate">{h.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
