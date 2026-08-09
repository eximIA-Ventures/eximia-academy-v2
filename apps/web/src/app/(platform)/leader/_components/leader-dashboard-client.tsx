"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  MessageSquareText,
  PartyPopper,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"
import { ReflectionDetailModal } from "./reflection-detail-modal"

/* --------------------------------- Types --------------------------------- */

interface TeamMember {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
  coursesEnrolled: string[]
  totalEnrollments: number
  completedEnrollments: number
  completionPct: number
  totalSessions: number
  lastActiveDate: string | null
  status: "active" | "inactive" | "never"
  reflectionsCount: number
}

interface RecentReflection {
  id: string
  studentId: string
  studentName: string
  chapterTitle: string
  response: string
  fullResponse: string
  createdAt: string
}

interface RecentCompletion {
  studentName: string
  courseTitle: string
  completedAt: string
}

interface SummaryData {
  totalMembers: number
  activeLearners: number
  completionRate: number
  avgSessionsPerMember: number
}

interface LeaderDashboardClientProps {
  leaderName: string
  areas: Array<{ id: string; name: string; slug: string }>
  summary: SummaryData
  teamData: TeamMember[]
  recentReflections: RecentReflection[]
  recentCompletions: RecentCompletion[]
  tenantId: string
}

/* -------------------------------- Helpers -------------------------------- */

function statusLabel(status: "active" | "inactive" | "never") {
  switch (status) {
    case "active":
      return { text: "Ativo", color: "bg-emerald-500/15 text-emerald-400" }
    case "inactive":
      return { text: "Inativo (7+ dias)", color: "bg-amber-500/15 text-amber-400" }
    case "never":
      return { text: "Nunca acessou", color: "bg-red-500/15 text-red-400" }
  }
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Nunca"
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Hoje"
  if (days === 1) return "Ontem"
  if (days < 7) return `${days} dias atras`
  if (days < 30) return `${Math.floor(days / 7)} semanas atras`
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })
}

/* ------------------------------- Component ------------------------------- */

export function LeaderDashboardClient({
  leaderName,
  areas,
  summary,
  teamData,
  recentReflections,
  recentCompletions,
  tenantId,
}: LeaderDashboardClientProps) {
  const [selectedReflection, setSelectedReflection] = useState<RecentReflection | null>(null)
  const [commentSent, setCommentSent] = useState<Set<string>>(new Set())

  const handleSendComment = useCallback(
    async (reflectionId: string, comment: string) => {
      try {
        const res = await fetch("/api/leader/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reflectionId, comment }),
        })
        if (res.ok) {
          setCommentSent((prev) => new Set(prev).add(reflectionId))
          setSelectedReflection(null)
        }
      } catch {
        // Silently handle error for now
      }
    },
    [],
  )

  return (
    <div className="space-y-6">
      {/* Area badge */}
      {areas.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Suas unidades:</span>
          {areas.map((area) => (
            <Badge key={area.id} variant="default" badgeSize="sm">
              {area.name}
            </Badge>
          ))}
        </div>
      )}

      {/* ======================== Summary Cards ======================== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={<Users size={18} className="text-cerrado-400" />}
          label="Membros da equipe"
          value={summary.totalMembers}
        />
        <SummaryCard
          icon={<Sparkles size={18} className="text-emerald-400" />}
          label="Aprendizes ativos"
          value={summary.activeLearners}
          subtitle={
            summary.totalMembers > 0
              ? `${Math.round((summary.activeLearners / summary.totalMembers) * 100)}% da equipe`
              : undefined
          }
        />
        <SummaryCard
          icon={<Trophy size={18} className="text-amber-400" />}
          label="Taxa de conclusao"
          value={`${summary.completionRate}%`}
        />
        <SummaryCard
          icon={<MessageSquareText size={18} className="text-blue-400" />}
          label="Sessoes por membro"
          value={summary.avgSessionsPerMember}
        />
      </div>

      {/* ======================== Main Content Grid ======================== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Progress Table — 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users size={16} />
                Progresso da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teamData.length === 0 ? (
                <p className="text-sm text-text-muted py-8 text-center">
                  Nenhum membro encontrado na sua unidade.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle text-left">
                        <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Membro
                        </th>
                        <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Cursos
                        </th>
                        <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                          Conclusao
                        </th>
                        <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-center">
                          Sessoes
                        </th>
                        <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Ultima atividade
                        </th>
                        <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {teamData.map((member) => {
                        const st = statusLabel(member.status)
                        return (
                          <tr key={member.id} className="hover:bg-bg-hover/50 transition-colors">
                            <td className="py-3 pr-4">
                              <Link
                                href={`/analytics/students/${member.id}`}
                                className="group flex items-center gap-2"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cerrado-500/15 text-xs font-semibold text-cerrado-400">
                                  {member.fullName
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <span className="text-text-primary font-medium group-hover:text-cerrado-500 transition-colors">
                                  {member.fullName}
                                </span>
                              </Link>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-text-secondary text-xs">
                                {member.totalEnrollments > 0
                                  ? member.coursesEnrolled.slice(0, 2).join(", ") +
                                    (member.coursesEnrolled.length > 2
                                      ? ` +${member.coursesEnrolled.length - 2}`
                                      : "")
                                  : "Nenhum curso"}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="h-1.5 w-16 rounded-full bg-bg-hover overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-cerrado-500 transition-all"
                                    style={{ width: `${member.completionPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-text-muted">
                                  {member.completionPct}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-center text-text-secondary">
                              {member.totalSessions}
                            </td>
                            <td className="py-3 pr-4 text-xs text-text-muted">
                              {formatRelativeDate(member.lastActiveDate)}
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${st.color}`}
                              >
                                {st.text}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Completions */}
          {recentCompletions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PartyPopper size={16} className="text-amber-400" />
                  Conquistas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentCompletions.map((completion, i) => (
                    <div
                      key={`${completion.studentName}-${completion.courseTitle}-${i}`}
                      className="flex items-center gap-3 rounded-lg bg-emerald-500/5 px-3 py-2"
                    >
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-emerald-400"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-text-primary">
                          {completion.studentName}
                        </span>
                        <span className="text-sm text-text-muted">
                          {" "}
                          concluiu{" "}
                        </span>
                        <span className="text-sm font-medium text-cerrado-500">
                          {completion.courseTitle}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {formatDate(completion.completedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly Challenge — Phase 2 scaffold */}
          <Card className="border-dashed border-border-subtle/50 opacity-60">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cerrado-500/10">
                <Sparkles size={20} className="text-cerrado-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Desafio Semanal
                </p>
                <p className="text-xs text-text-muted">
                  Em breve: lance desafios praticos para sua equipe e acompanhe
                  quem participa.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ======================== Right Column ======================== */}
        <div className="space-y-6">
          {/* Reflections Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart size={16} className="text-rose-400" />
                Reflexoes da Equipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReflections.length === 0 ? (
                <div className="py-6 text-center">
                  <BookOpen
                    size={28}
                    className="mx-auto mb-2 text-text-muted/40"
                  />
                  <p className="text-xs text-text-muted">
                    As reflexoes dos membros da sua equipe aparecerao aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentReflections.map((reflection) => (
                    <button
                      key={reflection.id}
                      type="button"
                      onClick={() => setSelectedReflection(reflection)}
                      className="w-full rounded-lg bg-bg-hover/40 p-3 text-left transition-colors hover:bg-bg-hover"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-text-primary">
                          {reflection.studentName}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatDate(reflection.createdAt)}
                        </span>
                      </div>
                      <p className="text-[10px] text-cerrado-500 mb-1">
                        {reflection.chapterTitle}
                      </p>
                      <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                        {reflection.response}
                      </p>
                      {commentSent.has(reflection.id) && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 size={10} />
                          Incentivo enviado
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick tips for leaders */}
          <Card className="bg-cerrado-500/5 border-cerrado-500/20">
            <CardContent className="py-4">
              <p className="text-xs font-semibold text-cerrado-400 uppercase tracking-wider mb-2">
                Dica do Lider Educador
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Leia as reflexoes da sua equipe e deixe um incentivo. Quando o
                aluno sabe que alguem se importa com seu aprendizado, o
                engajamento transforma.
              </p>
              <p className="text-[10px] text-text-muted mt-2 italic">
                — Roberto Tranjan, Metanoia
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reflection Detail Modal */}
      {selectedReflection && (
        <ReflectionDetailModal
          reflection={selectedReflection}
          onClose={() => setSelectedReflection(null)}
          onSendComment={handleSendComment}
          alreadySent={commentSent.has(selectedReflection.id)}
        />
      )}
    </div>
  )
}

/* ======================== Summary Card ======================== */

function SummaryCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  subtitle?: string
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        {subtitle && (
          <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
