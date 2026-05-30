"use client"

import { Mail, MessageSquare, RotateCcw, Trophy, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import type { StudentRosterEntry } from "./student-roster"
import type { UnitStats } from "./unit-comparison"

interface NextBestActionProps {
  rosterStudents: StudentRosterEntry[]
  unitStats: UnitStats[]
}

interface Action {
  priority: "high" | "medium" | "low"
  text: string
  count: number
  actionLabel: string
  actionIcon: typeof Mail
  studentIds?: string[]
  emailSubject?: string
  emailMessage?: string
}

function generateActions(roster: StudentRosterEntry[], units: UnitStats[]): Action[] {
  const actions: Action[] = []

  const neverAccessed = roster.filter((s) => s.risk === "never_accessed")
  if (neverAccessed.length > 0) {
    actions.push({
      priority: "high", count: neverAccessed.length,
      text: "nunca acessaram a plataforma",
      actionLabel: "Enviar nudge",
      actionIcon: Mail,
      studentIds: neverAccessed.map((s) => s.id),
      emailSubject: "Seu acesso à plataforma está disponível!",
      emailMessage: "Olá! Notamos que você ainda não acessou a plataforma de aprendizagem. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada de desenvolvimento!",
    })
  }

  const inactive = roster.filter((s) => s.daysSinceLastActivity !== null && s.daysSinceLastActivity > 14 && s.risk !== "never_accessed")
  if (inactive.length > 0) {
    actions.push({
      priority: "high", count: inactive.length,
      text: "inativos há mais de 14 dias",
      actionLabel: "Notificar",
      actionIcon: MessageSquare,
      studentIds: inactive.map((s) => s.id),
      emailSubject: "Sentimos sua falta na plataforma!",
      emailMessage: "Olá! Faz mais de 14 dias desde seu último acesso à plataforma. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?",
    })
  }

  const noRefl = roster.filter((s) => s.completedSessions >= 2 && s.reflectionsCount === 0)
  if (noRefl.length > 0) {
    actions.push({
      priority: "medium", count: noRefl.length,
      text: "sem reflexões após sessões",
      actionLabel: "Lembrar",
      actionIcon: RotateCcw,
      studentIds: noRefl.map((s) => s.id),
      emailSubject: "Suas reflexões estão pendentes",
      emailMessage: "Olá! Você completou suas sessões de aprendizagem, mas ainda não registrou suas reflexões. As reflexões são parte essencial do processo — reserve alguns minutos para consolidar o que aprendeu.",
    })
  }

  const top = roster
    .filter((s) => s.completedSessions >= 3 && s.reflectionsCount >= 2)
    .sort((a, b) => (b.completedSessions + b.reflectionsCount) - (a.completedSessions + a.reflectionsCount))
    .slice(0, 3)
  if (top.length > 0) {
    actions.push({
      priority: "low", count: top.length,
      text: "destaques para reconhecer",
      actionLabel: "Parabenizar",
      actionIcon: Trophy,
      studentIds: top.map((s) => s.id),
      emailSubject: "Parabéns pelo seu desempenho!",
      emailMessage: "Olá! Queremos reconhecer seu excelente engajamento na plataforma. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!",
    })
  }

  return actions
}

const PRIORITY_BG: Record<string, string> = {
  high: "bg-red-50 dark:bg-red-500/[0.06]",
  medium: "bg-amber-50 dark:bg-amber-500/[0.06]",
  low: "bg-emerald-50 dark:bg-emerald-500/[0.06]",
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
}

export function NextBestAction({ rosterStudents, unitStats }: NextBestActionProps) {
  const router = useRouter()
  const actions = generateActions(rosterStudents, unitStats)

  if (actions.length === 0) return null

  function handleAction(action: Action) {
    if (action.studentIds && action.studentIds.length > 0) {
      const params = new URLSearchParams()
      params.set("ids", action.studentIds.join(","))
      if (action.emailSubject) params.set("subject", action.emailSubject)
      if (action.emailMessage) params.set("message", action.emailMessage)
      router.push(`/admin/notifications?${params.toString()}`)
    }
  }

  return (
    <div className="pt-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded-md bg-cerrado-600 flex items-center justify-center">
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-text-primary">Próxima Melhor Ação</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map((action, i) => {
          const Icon = action.actionIcon
          return (
            <div
              key={i}
              className={`rounded-xl ${PRIORITY_BG[action.priority]} p-3.5 flex items-center gap-3`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_BADGE[action.priority]}`}>
                    {action.count}
                  </span>
                  <p className="text-[11px] font-medium text-text-primary truncate">{action.text}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAction(action)}
                className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 bg-cerrado-600 text-white hover:bg-cerrado-700 active:scale-[0.96] transition-all shadow-sm shadow-cerrado-600/20"
              >
                <Icon size={11} />
                {action.actionLabel}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
