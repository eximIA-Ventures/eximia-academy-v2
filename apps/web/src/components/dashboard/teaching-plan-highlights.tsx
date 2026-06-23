import { AlertTriangle, Award, TrendingUp } from "lucide-react"

interface StudentPaceStatus {
  studentName: string
  courseTitle: string
  status: "ahead" | "on_track" | "behind"
  progressPct: number
  daysLeft: number
  daysAhead: number // negative = behind
}

interface TeachingPlanHighlightsProps {
  highlights: StudentPaceStatus[]
}

export function TeachingPlanHighlights({ highlights }: TeachingPlanHighlightsProps) {
  if (highlights.length === 0) return null

  const completedOnTime = highlights.filter((h) => h.status === "ahead" || h.status === "on_track")
  const behind = highlights.filter((h) => h.status === "behind")

  return (
    <div className="rounded-2xl bg-bg-card shadow-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Award size={18} className="text-accent-gold" />
        <h3 className="text-sm font-semibold text-text-primary">Destaques do Plano de Ensino</h3>
      </div>

      {completedOnTime.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-semantic-success/70">
            No ritmo ou adiantados
          </p>
          {completedOnTime.slice(0, 5).map((h, i) => (
            <div key={`ahead-${h.studentName}-${i}`} className="flex items-center gap-3 rounded-xl bg-semantic-success/5 px-3 py-2 ring-1 ring-semantic-success/10">
              <TrendingUp size={14} className="text-semantic-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{h.studentName}</p>
                <p className="text-xs text-text-muted truncate">{h.courseTitle} — {h.progressPct}% concluído, {h.daysLeft}d restantes</p>
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
            <div key={`behind-${h.studentName}-${i}`} className="flex items-center gap-3 rounded-xl bg-semantic-error/5 px-3 py-2 ring-1 ring-semantic-error/10">
              <AlertTriangle size={14} className="text-semantic-error shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{h.studentName}</p>
                <p className="text-xs text-text-muted truncate">{h.courseTitle} — {h.progressPct}% concluído, {Math.abs(h.daysAhead)}d atrasado</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
