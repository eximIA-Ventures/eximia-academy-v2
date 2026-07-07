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

/** S12 (mockup R3): painel colorido cobrindo a coluna inteira, usado só no
 * modo triagem (Meu Time). O modo legado (instrutor) não usa este componente. */
function TriagePanel({
  icon,
  label,
  colorClass,
  panelClass,
  emptyText,
  children,
}: {
  icon: React.ReactNode
  label: string
  colorClass: string
  panelClass: string
  emptyText: string
  children: React.ReactNode[]
}) {
  return (
    <div className={`space-y-3 rounded-2xl p-4 ${panelClass}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className={`text-[11px] font-bold uppercase tracking-wide ${colorClass}`}>{label}</p>
      </div>
      {children.length === 0 ? (
        <p className="text-xs text-text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </div>
  )
}

function TriageItem({
  dotClass,
  name,
  detail,
}: {
  dotClass: string
  name: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
        <p className="text-xs text-text-muted truncate">{detail}</p>
      </div>
    </div>
  )
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
      <div>
        <div className="flex items-center gap-2">
          <Award size={18} className="text-accent-gold" />
          <h3 className="text-sm font-semibold text-text-primary">Destaques do Plano de Ensino</h3>
        </div>
        {triageMode && (
          <p className="mt-1 text-xs text-text-muted">
            Lista de ação calculada pelo progresso esperado para hoje vs. progresso real de aluno.
          </p>
        )}
      </div>

      <div
        className={`grid grid-cols-1 ${triageMode ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4 items-start`}
      >
        {triageMode ? (
          <>
            {/* S12 (mockup R3): 3 painéis coloridos cobrindo a coluna inteira. */}
            <TriagePanel
              icon={<TrendingUp size={14} className="text-semantic-success" />}
              label="No ritmo ou adiantados"
              colorClass="text-semantic-success"
              panelClass="bg-semantic-success/[0.06] ring-1 ring-semantic-success/15"
              emptyText="Nenhum aluno no ritmo neste recorte."
            >
              {completedOnTime.slice(0, 5).map((h, i) => (
                <TriageItem
                  key={`ahead-${h.studentName}-${i}`}
                  dotClass="bg-semantic-success"
                  name={h.studentName}
                  detail={`${h.courseTitle} — ${h.progressPct}% concluído, ${h.daysLeft}d restantes`}
                />
              ))}
            </TriagePanel>

            <TriagePanel
              icon={<AlertTriangle size={14} className="text-semantic-error" />}
              label="Atenção — atrasados"
              colorClass="text-semantic-error"
              panelClass="bg-semantic-error/[0.06] ring-1 ring-semantic-error/15"
              emptyText="Nenhum aluno atrasado neste recorte."
            >
              {behind.slice(0, 5).map((h, i) => (
                <TriageItem
                  key={`behind-${h.studentName}-${i}`}
                  dotClass="bg-semantic-error"
                  name={h.studentName}
                  detail={`${h.courseTitle} — ${h.progressPct}% concluído, ${Math.abs(h.daysAhead)}d atrasado`}
                />
              ))}
            </TriagePanel>

            <TriagePanel
              icon={<UserX size={14} className="text-accent-gold" />}
              label="Sem acesso recente"
              colorClass="text-accent-gold"
              panelClass="bg-accent-gold/[0.06] ring-1 ring-accent-gold/15"
              emptyText="Todos os alunos acessaram recentemente."
            >
              {noAccessItems.slice(0, 5).map((h, i) => (
                <TriageItem
                  key={`noaccess-${h.studentName}-${i}`}
                  dotClass="bg-accent-gold"
                  name={h.studentName}
                  detail={h.detail}
                />
              ))}
            </TriagePanel>
          </>
        ) : (
          <>
            {/* Modo legado (instrutor, 2 colunas): INTACTO, markup pré-S12. */}
            {completedOnTime.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-semantic-success/70">
                  No ritmo ou adiantados
                </p>
                {completedOnTime.slice(0, 5).map((h, i) => (
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
                ))}
              </div>
            )}

            {behind.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-semantic-error/70">
                  Atenção — atrasados
                </p>
                {behind.slice(0, 5).map((h, i) => (
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
