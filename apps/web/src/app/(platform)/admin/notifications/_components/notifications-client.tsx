"use client"

import { analytics } from "@/lib/analytics"
import { Badge, Button, Input, Textarea } from "@eximia/ui"
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Trophy,
  Users,
  XCircle,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

interface Student {
  id: string
  email: string
  full_name: string
  role: string
  risk: "on_track" | "at_risk" | "inactive" | "never_accessed"
  daysSinceLastActivity: number | null
  sessionCount: number
  reflectionCount: number
}

interface Course {
  id: string
  title: string
}

interface Trail {
  id: string
  title: string
}

interface HistoryEntry {
  id: string
  subject: string
  recipient_count: number
  status: string
  sent_at: string | null
  deadline: string | null
  course_id: string | null
}

interface Props {
  students: Student[]
  courses: Course[]
  trails: Trail[]
  history: HistoryEntry[]
  preselectedIds?: string[]
  prefillSubject?: string
  prefillMessage?: string
}

/* ─── Quick Action Definitions ─── */
interface QuickAction {
  icon: typeof Mail
  label: string
  description: string
  subject: string
  message: string
  filter: (students: Student[]) => Student[]
  color: string
  dotColor: string
  iconColor: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Mail,
    label: "Nunca acessaram",
    description: "Convidar alunos que nunca entraram",
    subject: "Seu acesso à plataforma está disponível!",
    message: "Olá! Notamos que você ainda não acessou a plataforma de aprendizagem. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada de desenvolvimento!",
    filter: (s) => s.filter((x) => x.risk === "never_accessed"),
    color: "bg-red-50 dark:bg-red-500/[0.06] ring-red-100 dark:ring-red-500/10",
    dotColor: "bg-red-500",
    iconColor: "text-red-500",
  },
  {
    icon: Clock,
    label: "Inativos +14 dias",
    description: "Reengajar alunos que sumiram",
    subject: "Sentimos sua falta na plataforma!",
    message: "Olá! Faz mais de 14 dias desde seu último acesso à plataforma. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?",
    filter: (s) => s.filter((x) => x.risk === "inactive"),
    color: "bg-amber-50 dark:bg-amber-500/[0.06] ring-amber-100 dark:ring-amber-500/10",
    dotColor: "bg-amber-500",
    iconColor: "text-amber-500",
  },
  {
    icon: RotateCcw,
    label: "Sem reflexões",
    description: "Sessões feitas, reflexões pendentes",
    subject: "Suas reflexões estão pendentes",
    message: "Olá! Você completou suas sessões de aprendizagem, mas ainda não registrou suas reflexões. As reflexões são parte essencial do processo — reserve alguns minutos para consolidar o que aprendeu.",
    filter: (s) => s.filter((x) => x.sessionCount >= 2 && x.reflectionCount === 0),
    color: "bg-blue-50 dark:bg-blue-500/[0.06] ring-blue-100 dark:ring-blue-500/10",
    dotColor: "bg-blue-500",
    iconColor: "text-blue-500",
  },
  {
    icon: Trophy,
    label: "Reconhecer destaques",
    description: "Parabenizar os mais engajados",
    subject: "Parabéns pelo seu desempenho!",
    message: "Olá! Queremos reconhecer seu excelente engajamento na plataforma. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!",
    filter: (s) => s.filter((x) => x.sessionCount >= 3 && x.reflectionCount >= 2).sort((a, b) => (b.sessionCount + b.reflectionCount) - (a.sessionCount + a.reflectionCount)).slice(0, 5),
    color: "bg-emerald-50 dark:bg-emerald-500/[0.06] ring-emerald-100 dark:ring-emerald-500/10",
    dotColor: "bg-emerald-500",
    iconColor: "text-emerald-500",
  },
]

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  never_accessed: { label: "Nunca acessou", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
  inactive: { label: "Inativo", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  at_risk: { label: "Em risco", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" },
  on_track: { label: "Ativo", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
}

export function NotificationsClient({ students, courses, trails, history, preselectedIds, prefillSubject, prefillMessage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [subject, setSubject] = useState(prefillSubject ?? "")
  const [message, setMessage] = useState(prefillMessage ?? "")
  const [deadline, setDeadline] = useState("")
  const [linkedCourse, setLinkedCourse] = useState("")
  const [linkedTrail, setLinkedTrail] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(preselectedIds?.filter((id) => students.some((s) => s.id === id)) ?? []),
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [result, setResult] = useState<{ sent?: number; failed?: number; error?: string } | null>(null)
  const [activeQuickAction, setActiveQuickAction] = useState<number | null>(null)

  const hasPreselection = (preselectedIds?.length ?? 0) > 0

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    )
  }, [students, searchQuery])

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((s) => s.id)))
  }

  const applyQuickAction = (index: number) => {
    const action = QUICK_ACTIONS[index]
    const targets = action.filter(students)
    setSubject(action.subject)
    setMessage(action.message)
    setSelectedIds(new Set(targets.map((s) => s.id)))
    setActiveQuickAction(index)
  }

  const handleSend = () => {
    if (!subject.trim() || !message.trim() || selectedIds.size === 0) return
    setResult(null)
    startTransition(async () => {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          recipientIds: [...selectedIds],
          courseId: linkedCourse || undefined,
          trailId: linkedTrail || undefined,
          deadline: deadline || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ sent: data.sent, failed: data.failed })
        analytics.notificationSent(data.sent)
        setSubject("")
        setMessage("")
        setDeadline("")
        setLinkedCourse("")
        setLinkedTrail("")
        setSelectedIds(new Set())
        setActiveQuickAction(null)
        router.refresh()
      } else {
        setResult({ error: data.error })
      }
    })
  }

  const canSend = subject.trim() && message.trim() && selectedIds.size > 0

  // Risk summary counts
  const riskCounts = useMemo(() => ({
    never_accessed: students.filter((s) => s.risk === "never_accessed").length,
    inactive: students.filter((s) => s.risk === "inactive").length,
    at_risk: students.filter((s) => s.risk === "at_risk").length,
    on_track: students.filter((s) => s.risk === "on_track").length,
  }), [students])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notificações por E-mail</h1>
          <p className="text-sm text-text-muted mt-1">Envie lembretes e avisos para alunos via e-mail</p>
        </div>
        <div className="flex items-center gap-3">
          {[
            { label: "Nunca acessou", count: riskCounts.never_accessed, color: "bg-red-500" },
            { label: "Inativo", count: riskCounts.inactive, color: "bg-amber-500" },
            { label: "Em risco", count: riskCounts.at_risk, color: "bg-yellow-500" },
            { label: "Ativo", count: riskCounts.on_track, color: "bg-emerald-500" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <span className={`h-2 w-2 rounded-full ${r.color}`} />
              <span className="font-semibold tabular-nums">{r.count}</span>
              <span className="hidden sm:inline">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-selection banner from Analytics */}
      {hasPreselection && (
        <div className="flex items-center gap-3 rounded-xl bg-cerrado-600/[0.06] border border-cerrado-600/15 px-4 py-3">
          <div className="h-8 w-8 rounded-lg bg-cerrado-600 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">Ação rápida do Analytics</p>
            <p className="text-xs text-text-muted">{selectedIds.size} aluno(s) pré-selecionado(s). Revise a mensagem e clique em enviar.</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action, index) => {
          const Icon = action.icon
          const targets = action.filter(students)
          const isActive = activeQuickAction === index
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => applyQuickAction(index)}
              disabled={targets.length === 0}
              className={`relative rounded-xl p-4 text-left transition-all ring-1 ${
                isActive
                  ? `${action.color} ring-cerrado-600/30 shadow-md`
                  : targets.length > 0
                    ? `bg-white dark:bg-bg-card ring-gray-100 dark:ring-white/[0.06] hover:shadow-md hover:ring-gray-200`
                    : "bg-gray-50/50 dark:bg-bg-card/50 ring-gray-100/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-xl ${isActive ? `${action.dotColor}/10` : "bg-gray-100 dark:bg-white/[0.06]"} flex items-center justify-center shrink-0`}>
                  <Icon size={16} className={isActive ? action.iconColor : "text-text-muted"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">{action.label}</p>
                    {targets.length > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? `${action.dotColor} text-white` : "bg-gray-200 dark:bg-white/10 text-text-secondary"
                      }`}>
                        {targets.length}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">{action.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — compose */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl shadow-card bg-bg-card p-6 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Compor mensagem</h2>

            <div className="space-y-1.5">
              <label htmlFor="subject" className="text-sm font-medium text-text-secondary">Assunto</label>
              <Input id="subject" placeholder="Ex: Lembrete — Módulo de Segurança até 15/05" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="message" className="text-sm font-medium text-text-secondary">Mensagem</label>
              <Textarea id="message" placeholder="Escreva a mensagem que será enviada aos destinatários..." value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="deadline" className="text-sm font-medium text-text-secondary">Prazo (opcional)</label>
                <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="course" className="text-sm font-medium text-text-secondary">Curso (opcional)</label>
                <select
                  id="course"
                  value={linkedCourse}
                  onChange={(e) => { setLinkedCourse(e.target.value); if (e.target.value) setLinkedTrail("") }}
                  className="w-full rounded-lg shadow-card bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-cerrado-600/50"
                >
                  <option value="">Nenhum curso</option>
                  {courses.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
                </select>
              </div>
            </div>

            {result && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                result.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                {result.error ? <><XCircle size={16} /><span>{result.error}</span></> : <><CheckCircle2 size={16} /><span>{result.sent} e-mail{result.sent !== 1 ? "s" : ""} enviado{result.sent !== 1 ? "s" : ""}{result.failed ? `, ${result.failed} falhou` : ""}</span></>}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleSend} disabled={!canSend || isPending} isLoading={isPending} className="gap-2">
                <Send size={16} />
                Enviar para {selectedIds.size} destinatário{selectedIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>

        {/* Right — recipient selector */}
        <div className="space-y-5">
          <div className="rounded-xl shadow-card bg-bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Destinatários</h2>
              <button type="button" onClick={selectAll} className="text-xs font-medium text-cerrado-600 hover:underline">
                {selectedIds.size === filtered.length ? "Desmarcar" : "Selecionar todos"}
              </button>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-cerrado-600/[0.06] px-3 py-2">
                <Users size={12} className="text-cerrado-600" />
                <span className="text-[11px] font-semibold text-cerrado-600">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
                <button type="button" onClick={() => { setSelectedIds(new Set()); setActiveQuickAction(null) }} className="ml-auto text-[10px] text-text-muted hover:text-text-primary">Limpar</button>
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-0.5 -mx-2 px-2">
              {filtered.map((s) => {
                const isSelected = selectedIds.has(s.id)
                const riskInfo = RISK_BADGE[s.risk]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected ? "bg-cerrado-600/10 ring-1 ring-cerrado-600/30" : "hover:bg-bg-hover"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-cerrado-600 border-cerrado-600" : "border-border-medium"
                    }`}>
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{s.full_name}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${riskInfo.className}`}>
                          {riskInfo.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted truncate">{s.email}</p>
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">Nenhum usuário encontrado</p>
              )}
            </div>

            <div className="pt-2">
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <Users size={12} />
                {selectedIds.size} de {students.length} selecionado{selectedIds.size !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl shadow-card bg-bg-card p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Histórico de envios</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-4 rounded-lg bg-bg-elevated/50 px-4 py-3">
                <Mail size={16} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.subject}</p>
                  <p className="text-xs text-text-muted">
                    {h.recipient_count} destinatário{h.recipient_count !== 1 ? "s" : ""}
                    {h.deadline && <span className="ml-2">· Prazo: {new Date(h.deadline).toLocaleDateString("pt-BR")}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={h.status === "sent" ? "success" : "error"} badgeSize="sm">{h.status === "sent" ? "Enviado" : "Falha"}</Badge>
                  {h.sent_at && (
                    <span className="text-xs text-text-muted">
                      {new Date(h.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
