"use client"

import { analytics } from "@/lib/analytics"
import { Badge, Button, Input, Textarea } from "@eximia/ui"
import {
  Calendar,
  CheckCircle2,
  Mail,
  Search,
  Send,
  Users,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

interface Student {
  id: string
  email: string
  full_name: string
  role: string
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
}

export function NotificationsClient({ students, courses, trails, history }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [deadline, setDeadline] = useState("")
  const [linkedCourse, setLinkedCourse] = useState("")
  const [linkedTrail, setLinkedTrail] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [result, setResult] = useState<{ sent?: number; failed?: number; error?: string } | null>(null)

  // Filter students
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
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
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)))
    }
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
        router.refresh()
      } else {
        setResult({ error: data.error })
      }
    })
  }

  const canSend = subject.trim() && message.trim() && selectedIds.size > 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Notificações por E-mail</h1>
        <p className="text-sm text-text-muted mt-1">
          Envie lembretes e avisos para alunos via e-mail
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — compose */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-white/[0.06] bg-bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Compor mensagem
            </h2>

            <div className="space-y-1.5">
              <label htmlFor="subject" className="text-sm font-medium text-text-secondary">Assunto</label>
              <Input
                id="subject"
                placeholder="Ex: Lembrete — Módulo de Segurança até 15/05"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="message" className="text-sm font-medium text-text-secondary">Mensagem</label>
              <Textarea
                id="message"
                placeholder="Escreva a mensagem que será enviada aos destinatários..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="deadline" className="text-sm font-medium text-text-secondary">
                  Prazo de conclusão (opcional)
                </label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="course" className="text-sm font-medium text-text-secondary">
                  Vincular a curso (opcional)
                </label>
                <select
                  id="course"
                  value={linkedCourse}
                  onChange={(e) => {
                    setLinkedCourse(e.target.value)
                    if (e.target.value) setLinkedTrail("")
                  }}
                  className="w-full rounded-lg border border-white/[0.08] bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue-mid/50"
                >
                  <option value="">Nenhum curso</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Result feedback */}
            {result && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                  result.error
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {result.error ? (
                  <>
                    <XCircle size={16} />
                    <span>{result.error}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>
                      {result.sent} e-mail{result.sent !== 1 ? "s" : ""} enviado{result.sent !== 1 ? "s" : ""}
                      {result.failed ? `, ${result.failed} falhou` : ""}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSend}
                disabled={!canSend || isPending}
                isLoading={isPending}
                className="gap-2"
              >
                <Send size={16} />
                Enviar para {selectedIds.size} destinatário{selectedIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>

        {/* Right — recipient selector */}
        <div className="space-y-5">
          <div className="rounded-xl border border-white/[0.06] bg-bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                Destinatários
              </h2>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-medium text-accent-blue-light hover:underline"
              >
                {selectedIds.size === filtered.length ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1 -mx-2 px-2">
              {filtered.map((s) => {
                const isSelected = selectedIds.has(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-accent-blue-mid/10 ring-1 ring-accent-blue-mid/30"
                        : "hover:bg-bg-hover"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-accent-blue-mid border-accent-blue-mid"
                          : "border-white/20"
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.full_name}</p>
                      <p className="text-xs text-text-muted truncate">{s.email}</p>
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">Nenhum usuário encontrado</p>
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.06]">
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
        <div className="rounded-xl border border-white/[0.06] bg-bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Histórico de envios
          </h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-4 rounded-lg bg-bg-elevated/50 px-4 py-3"
              >
                <Mail size={16} className="shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.subject}</p>
                  <p className="text-xs text-text-muted">
                    {h.recipient_count} destinatário{h.recipient_count !== 1 ? "s" : ""}
                    {h.deadline && (
                      <span className="ml-2">
                        · Prazo: {new Date(h.deadline).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={h.status === "sent" ? "success" : "error"} badgeSize="sm">
                    {h.status === "sent" ? "Enviado" : "Falha"}
                  </Badge>
                  {h.sent_at && (
                    <span className="text-xs text-text-muted">
                      {new Date(h.sent_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
