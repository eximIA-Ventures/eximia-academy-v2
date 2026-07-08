import { AlertTriangle, Award, TrendingUp, UserX } from "lucide-react"

interface StudentPaceStatus {
  studentName: string
  courseTitle: string
  status: "ahead" | "on_track" | "behind"
  progressPct: number
  daysLeft: number
  daysAhead: number // negative = behind
  /** S12-fix: true só nas entries sintéticas de concluído sem enrollment
   * ativo (partitionHighlights), sublinha fixa "concluído" em vez do
   * progresso/dias padrão. */
  concluido?: boolean
  /** Aluno que nunca teve sessão (não iniciado): a coluna vermelha renderiza
   * "Nunca acessou · Xd atrasado" no lugar de "0% concluído · ...". */
  neverAccessed?: boolean
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
   * S8 (Onda 2): terceira lista, "Sem acesso" (triagem sem_acesso, por ALUNO,
   * enquanto highlights é por aluno·curso). Quando a prop é fornecida (mesmo []),
   * o card entra em modo 3 colunas com empty state por coluna. Quando undefined
   * (visão do instrutor), o layout 2 colunas atual é preservado sem mudança.
   */
  noAccess?: NoAccessHighlight[]
}

/** S12 (mockup R4): painel colorido cobrindo a coluna inteira, usado só no
 * modo triagem (Meu Time). O modo legado (instrutor) não usa este componente.
 * Cores fora do tema oklch da casa: hex inline via style, padrão do repo
 * (ver subteam-chip.tsx). */
function TriagePanel({
  icon,
  label,
  bg,
  border,
  headerColor,
  emptyText,
  children,
}: {
  icon: React.ReactNode
  label: string
  bg: string
  border: string
  headerColor: string
  emptyText: string
  children: React.ReactNode[]
}) {
  return (
    <div
      className="space-y-3 rounded-xl p-4"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <p
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: headerColor }}
        >
          {label}
        </p>
      </div>
      {children.length === 0 ? (
        <p className="text-[11px] text-text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </div>
  )
}

function TriageItem({
  dotColor,
  name,
  detail,
}: {
  dotColor: string
  name: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
        <p className="text-[11px] text-text-muted truncate">{detail}</p>
      </div>
    </div>
  )
}

/** Deriva o texto de exibição do mockup a partir do `detail` cravado por S8
 * ("Nunca acessou" | "Xd sem acesso"), sem mudar o shape da prop. */
function formatNoAccessDetail(detail: string): string {
  if (detail === "Nunca acessou") return "nunca acessou"
  const match = detail.match(/^(\d+)d sem acesso$/)
  if (match) return `último acesso há ${match[1]} dias`
  return detail
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
            Lista de ação calculada pelo progresso esperado para hoje vs. progresso real do aluno.
          </p>
        )}
      </div>

      <div
        className={`grid grid-cols-1 ${triageMode ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4 items-start`}
      >
        {triageMode ? (
          <>
            {/* S12 (mockup R4): 3 painéis com fundo colorido inteiro (hex inline). */}
            <TriagePanel
              icon={<TrendingUp size={14} style={{ color: "#22c55e" }} />}
              label="No ritmo ou adiantados"
              bg="rgba(16,185,129,0.09)"
              border="rgba(16,185,129,0.30)"
              headerColor="#22c55e"
              emptyText="Ninguém no ritmo neste recorte."
            >
              {completedOnTime.slice(0, 5).map((h, i) => (
                <TriageItem
                  key={`ahead-${h.studentName}-${i}`}
                  dotColor="#10b981"
                  name={h.studentName}
                  detail={
                    h.concluido
                      ? "curso concluído"
                      : `${h.progressPct}% concluído · ${h.daysLeft}d restantes`
                  }
                />
              ))}
            </TriagePanel>

            {/* Ordem Hugo 2026-07-07: gravidade crescente verde -> AMARELO -> VERMELHO */}
            <TriagePanel
              icon={<UserX size={14} style={{ color: "#f59e0b" }} />}
              label="Sem acesso recente"
              bg="rgba(245,158,11,0.10)"
              border="rgba(245,158,11,0.32)"
              headerColor="#f59e0b"
              emptyText="Todos acessando."
            >
              {noAccessItems.slice(0, 5).map((h, i) => (
                <TriageItem
                  key={`noaccess-${h.studentName}-${i}`}
                  dotColor="#f59e0b"
                  name={h.studentName}
                  detail={formatNoAccessDetail(h.detail)}
                />
              ))}
            </TriagePanel>

            <TriagePanel
              icon={<AlertTriangle size={14} style={{ color: "#ef4444" }} />}
              label="Atenção - atrasados"
              bg="rgba(239,68,68,0.09)"
              border="rgba(239,68,68,0.30)"
              headerColor="#ef4444"
              emptyText="Ninguém atrasado."
            >
              {behind.slice(0, 5).map((h, i) => (
                <TriageItem
                  key={`behind-${h.studentName}-${i}`}
                  dotColor="#ef4444"
                  name={h.studentName}
                  detail={
                    h.neverAccessed
                      ? `Nunca acessou${h.daysAhead !== 0 ? ` · ${Math.abs(h.daysAhead)}d atrasado` : ""}`
                      : `${h.progressPct}% concluído · ${Math.abs(h.daysAhead)}d atrasado`
                  }
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
