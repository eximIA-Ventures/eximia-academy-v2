"use client"

import { MailQuestion, ShieldCheck, UserCheck, Users } from "lucide-react"
import type { DisplayStatusFilter } from "./filters"

/**
 * Os contadores do topo da tela de Usuários — agora CLICÁVEIS (CFG-6.1, AC8).
 *
 * Um número que não leva a lugar nenhum obriga o admin a reconstruir à mão o
 * filtro que produziria aquele número (e o de "Convites pendentes" ele nem
 * conseguiria: o estado é derivado, não existe como opção no `<select>`). Cada
 * card passa a ser o caminho mais curto para a lista que ele resume, e o
 * caminho de volta é o mesmo card ou o chip removível ao lado da busca.
 *
 * "Convites pendentes" só aparece quando o estado pôde ser lido:
 * `pendingInvites === null` significa "o Auth não respondeu", e um "0" no lugar
 * disso seria uma afirmação falsa ("nenhum convite pendente") no exato momento
 * em que não sabemos (CFG-2.2, AC9).
 */
export function UserStatsGrid({
  total,
  active,
  admins,
  pendingInvites = null,
  activeStatusFilter = null,
  activeRoleFilter = "",
  onClearAll,
  onStatusSelected,
  onAdminsSelected,
}: {
  total: number
  active: number
  admins: number
  pendingInvites?: number | null
  activeStatusFilter?: DisplayStatusFilter | null
  activeRoleFilter?: string
  onClearAll?: () => void
  onStatusSelected?: (filter: DisplayStatusFilter | null) => void
  onAdminsSelected?: () => void
}) {
  const stats: {
    icon: typeof Users
    title: string
    value: string
    description: string
    color: string
    selected: boolean
    onSelect?: () => void
  }[] = [
    {
      icon: Users,
      title: "Usuários",
      value: String(total),
      description: "Total de usuários",
      color: "cerrado-600",
      selected: !activeStatusFilter && !activeRoleFilter,
      onSelect: onClearAll,
    },
    {
      icon: UserCheck,
      title: "Ativos",
      value: String(active),
      description: "Usuários ativos",
      color: "accent-gold",
      selected: activeStatusFilter === "active",
      onSelect: onStatusSelected
        ? () => onStatusSelected(activeStatusFilter === "active" ? null : "active")
        : undefined,
    },
    {
      icon: ShieldCheck,
      title: "Administradores",
      value: String(admins),
      description: "Com acesso total",
      color: "varzea",
      selected: activeRoleFilter === "admin",
      onSelect: onAdminsSelected,
    },
    ...(pendingInvites === null
      ? []
      : [
          {
            icon: MailQuestion,
            title: "Convites pendentes",
            value: String(pendingInvites),
            description: "Convites pendentes",
            color: "accent-gold",
            selected: activeStatusFilter === "invite_pending",
            onSelect: onStatusSelected
              ? () =>
                  onStatusSelected(
                    activeStatusFilter === "invite_pending" ? null : "invite_pending",
                  )
              : undefined,
          },
        ]),
  ]

  return (
    <div className={`grid gap-4 ${pendingInvites === null ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
      {stats.map((stat) => {
        const Icon = stat.icon
        const content = (
          <>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${stat.color}/15`}
            >
              <Icon size={20} className={`text-${stat.color}`} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-[10px] text-text-muted uppercase tracking-[0.15em]">
                {stat.description}
              </p>
              <p className="font-bold text-text-primary text-xl">{stat.value}</p>
            </div>
          </>
        )

        const shell = `flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card${
          stat.selected ? " ring-2 ring-cerrado-600" : ""
        }`

        // Sem handler (uso fora da tela de usuários) o card continua sendo um
        // bloco estático: nada vira botão morto.
        if (!stat.onSelect) {
          return (
            <div key={stat.title} className={shell}>
              {content}
            </div>
          )
        }

        return (
          <button
            key={stat.title}
            type="button"
            aria-pressed={stat.selected}
            onClick={stat.onSelect}
            className={`${shell} text-left transition-shadow hover:shadow-elevated`}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
