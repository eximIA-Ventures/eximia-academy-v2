import type { TriageSummary } from "@/lib/student-triage"
import { AlertTriangle, TrendingUp, UserX, Users } from "lucide-react"

interface TriageCardsProps {
  summary: TriageSummary
}

interface TriageCardSpec {
  key: string
  icon: React.ReactNode
  label: string
  value: number
  pct?: number
  /** Cor do número grande, HEX inline (classes de cor Tailwind não são
   * confiáveis neste tema v4, ver subteam-chip.tsx); undefined = cor padrão. */
  valueColor?: string
  sublabel: string
  iconBg: string
  iconColor: string
}

/**
 * S12 (mockup R3): 4 cards de triagem no visual exato do mockup, grid
 * responsivo, ícone circular colorido, número grande com "(pct%)" inline e
 * sublabel pequeno. Substitui o uso de SummaryCards para esta seção (o
 * mockup tem um layout próprio, distinto do card genérico de KPI).
 */
export function TriageCards({ summary }: TriageCardsProps) {
  const cards: TriageCardSpec[] = [
    {
      key: "analisados",
      icon: <Users size={20} />,
      label: "Alunos analisados",
      value: summary.analisados,
      valueColor: undefined,
      sublabel: "recorte atual",
      iconBg: "#eff6ff",
      iconColor: "#3b82f6",
    },
    {
      key: "no-ritmo",
      icon: <TrendingUp size={20} />,
      label: "No ritmo",
      value: summary.noRitmo,
      pct: summary.noRitmoPct,
      valueColor: "#059669",
      sublabel: "ou adiantados",
      iconBg: "#ecfdf5",
      iconColor: "#059669",
    },
    {
      key: "atencao",
      icon: <AlertTriangle size={20} />,
      label: "Atenção",
      value: summary.atencao,
      pct: summary.atencaoPct,
      valueColor: "#dc2626",
      sublabel: "abaixo do esperado",
      iconBg: "#fef2f2",
      iconColor: "#dc2626",
    },
    {
      key: "sem-acesso",
      icon: <UserX size={20} />,
      label: "Sem acesso",
      value: summary.semAcesso,
      pct: summary.semAcessoPct,
      valueColor: undefined,
      sublabel: "nunca entraram ou 14+ dias",
      iconBg: "#fffbeb",
      iconColor: "#d97706",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="flex items-start gap-3 rounded-xl bg-bg-surface p-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: card.iconBg, color: card.iconColor }}
            aria-hidden="true"
          >
            {card.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted">{card.label}</p>
            <p className="text-[28px] font-bold leading-tight text-text-primary">
              <span style={card.valueColor ? { color: card.valueColor } : undefined}>
                {card.value}
              </span>
              {typeof card.pct === "number" && (
                <span className="text-sm font-normal text-text-muted"> ({card.pct}%)</span>
              )}
            </p>
            <p className="text-[11px] text-text-muted">{card.sublabel}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
