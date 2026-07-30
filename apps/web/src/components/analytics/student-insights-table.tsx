"use client"

import {
  DIRECT_TEAM_KEY,
  TeamFilterDropdown,
  type TeamFilterOption,
  effectiveTeamSelection,
  useTeamFilterParam,
} from "@/app/(platform)/dashboard/_components/team-filter-dropdown"
import { SubteamChip } from "@/components/dashboard/subteam-chip"
import { Card, CardContent, CardHeader, CardTitle, Input } from "@eximia/ui"
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowUpRight,
  BellRing,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  MessageSquare,
  Search,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import React, { useMemo, useState } from "react"

import {
  RITMO_BADGE,
  RITMO_SORT_RANK,
  RitmoBadge,
  type RitmoDisplay,
  ritmoDisplayFrom,
} from "@/components/analytics/ritmo-badge"
import { computeStudentAction } from "@/lib/student-triage"
import type { StudentRitmo, StudentTriagem } from "@/lib/student-triage"

export interface RecentReflectionRow {
  slideOrder: number
  chapterTitle: string
  response: string
  createdAt: string
}

export interface RecentSessionRow {
  sessionId?: string
  chapterTitle: string
  interactionType?: string
  status: string
  turns?: number
  createdAt: string
  studentMessages?: string[]
  chapterOrder?: number
}

export interface StudentInsightRow {
  id: string
  full_name: string
  email: string
  subteam?: { id: string; name: string; colorIndex?: number; path?: string[] }
  lastSessionDate: string | null
  totalSessions: number
  completedSessions: number
  sessionsWithMessages?: number
  totalMessages?: number
  coursesEnrolled: number
  coursesCompleted: number
  courseProgressPct?: number
  /**
   * Percorrido x Elaborado — exposição real por módulo. `null`/ausente = SEM
   * DADO, e a célula escreve "sem dado", nunca "0%": a métrica nasce vazia e
   * um zero mentiria sobre quem estudou antes da instrumentação existir.
   */
  viewProgressPct?: number | null
  /** O capítulo mudou desde a passagem do aluno (não rebaixa, só sinaliza). */
  viewHasNewContent?: boolean
  reflectionsCount: number
  recentReflections?: RecentReflectionRow[]
  recentSessions?: RecentSessionRow[]
  /** Onda 2 (S7): triagem canônica server-side. Opcional para não quebrar chamadores existentes. */
  ritmo?: StudentRitmo
  triagem?: StudentTriagem
}

interface StudentInsightsTableProps {
  students: StudentInsightRow[]
  showSubteam?: boolean
  /** When false, rows do not expand into raw interactions/reflections (manager view, LGPD). */
  expandable?: boolean
  /**
   * S9 (Onda 2): "manager" hides Sessões/Cursos, adds Ritmo, and HARD-DISABLES
   * row expansion and profile links regardless of `expandable` (LGPD, D-C).
   * Default "instructor".
   */
  variant?: "instructor" | "manager"
  /**
   * S10 (Onda 2): enables the "Ação" column (individual nudge). Only takes
   * effect with variant="manager". Default false.
   */
  canNudge?: boolean
}

type SortKey =
  | "full_name"
  | "lastSessionDate"
  | "totalSessions"
  | "coursesEnrolled"
  | "courseProgressPct"
  | "engagement"
  | "ritmo"

function getEngagementScore(s: StudentInsightRow): number {
  return s.completedSessions * 2 + s.reflectionsCount
}
type SortDir = "asc" | "desc"

const ENGAGEMENT_HELP =
  "Engajamento = interações concluídas x2 + reflexões. Interações acontecem ao final dos módulos; reflexões são registros ao longo dos slides."

/**
 * Adapter fino sobre `ritmoDisplayFrom` (fonte única em ritmo-badge.tsx). Resolve
 * as dissonâncias vistas pelo Hugo (2026-07-07): concluído não é "No ritmo", e
 * quem sumiu 14+ dias mostra "Sem acesso" coerente com a Ação "Acionar" da mesma
 * linha. A partição em si vive no módulo compartilhado, para o modal "Ver alunos"
 * de Ações de Engajamento renderizar o MESMO visual (Rodada 4, E12).
 */
function getRitmoDisplay(s: StudentInsightRow): RitmoDisplay | undefined {
  return ritmoDisplayFrom({
    ritmo: s.ritmo,
    triagem: s.triagem,
    coursesEnrolled: s.coursesEnrolled,
    coursesCompleted: s.coursesCompleted,
  })
}

function getRitmoRank(s: StudentInsightRow): number {
  const display = getRitmoDisplay(s)
  return display ? RITMO_SORT_RANK[display] : 5
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Nunca"
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return "Agora"
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffHrs < 24) return `há ${diffHrs}h`
  if (diffDays === 1) return "há 1 dia"
  if (diffDays < 30) return `há ${diffDays} dias`
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `há ${months} ${months === 1 ? "mês" : "meses"}`
  }
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function getActivityIndicator(dateStr: string | null): { color: string; label: string } {
  if (!dateStr) return { color: "bg-neutral-500", label: "Inativo" }
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diffDays <= 7) return { color: "bg-semantic-success", label: "Ativo" }
  if (diffDays <= 30) return { color: "bg-accent-gold", label: "Recente" }
  return { color: "bg-semantic-error", label: "Inativo" }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Concluída"
    case "in_progress":
      return "Em andamento"
    case "started":
      return "Iniciada"
    default:
      return status
  }
}

function formatStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-semantic-success"
    case "in_progress":
      return "text-accent-gold"
    default:
      return "text-text-muted"
  }
}

/** CSV-escapa um valor (aspas duplas + campos com vírgula/quebra de linha). */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function actionLabel(row: StudentInsightRow): string {
  const action = computeStudentAction(row.triagem, row.totalSessions)
  if (!action) return "-"
  if (action.kind === "none") return "No ritmo"
  return action.kind === "lembrar" ? "Lembrar" : "Acionar"
}

/**
 * S12 (D-3, mockup R3): monta o CSV das rows FILTRADAS/visíveis da variant
 * manager, client-side (sem query nova, sem servidor). Colunas = as da
 * tabela manager: Nome, Time (se houver), Último acesso, Ritmo, Progresso,
 * Engajamento (score + sessões/reflexões), Ação (derivada da triagem). Pura
 * (sem I/O), separada de `exportManagerCsv` para ser testável isoladamente.
 */
export function buildManagerCsv(rows: StudentInsightRow[], showSubteam: boolean): string {
  const headers = [
    "Nome",
    ...(showSubteam ? ["Time"] : []),
    "Último acesso",
    "Ritmo",
    "Progresso",
    "Percorrido",
    "Engajamento",
    "Interações concluídas",
    "Reflexões",
    "Ação",
  ]
  const lines = [headers.map(csvCell).join(",")]
  for (const row of rows) {
    const teamCell = row.subteam
      ? (row.subteam.path?.join(" > ") ?? row.subteam.name) || "Sem nome"
      : "Direto"
    const cells = [
      row.full_name,
      ...(showSubteam ? [teamCell] : []),
      formatRelativeTime(row.lastSessionDate),
      (() => {
        const d = getRitmoDisplay(row)
        return d ? RITMO_BADGE[d].label : "-"
      })(),
      `${row.courseProgressPct ?? 0}%`,
      row.viewProgressPct == null ? "sem dado" : `${Math.round(row.viewProgressPct)}%`,
      String(getEngagementScore(row)),
      String(row.completedSessions),
      String(row.reflectionsCount),
      actionLabel(row),
    ]
    lines.push(cells.map(csvCell).join(","))
  }
  return lines.join("\n")
}

/** Dispara o download do CSV via blob (efeito colateral, sem lógica própria). */
function exportManagerCsv(rows: StudentInsightRow[], showSubteam: boolean) {
  const blob = new Blob([buildManagerCsv(rows, showSubteam)], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "detalhes-dos-alunos.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export function StudentInsightsTable({
  students,
  showSubteam = false,
  expandable = true,
  variant = "instructor",
  canNudge = false,
}: StudentInsightsTableProps) {
  const isManager = variant === "manager"
  // LGPD hard guard (D-C): manager NEVER expands, whatever the prop says.
  const canExpand = expandable && !isManager
  const showAction = isManager && canNudge
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("full_name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  // S12 (mockup R3, D-2): Email sai da variant manager, base cai de 6 para 5.
  const columnCount = (isManager ? 5 : 7) + (showSubteam ? 1 : 0) + (showAction ? 1 : 0)

  // E10: a coluna Ação (variant manager) deixa de disparar o nudge in-place e
  // vira PONTE para Ações de Engajamento (Sheet pré-preenchido). Lembrar →
  // ?action=remind, Acionar → ?action=activate (SEM carregar nudgeType — a
  // derivação de behind_teaching_plan é server-side em E6/E3, decisão do
  // orquestrador). "No ritmo" vira BOTÃO DE AÇÃO DIRETA → ?action=recognize
  // (Parabenizar), sem dropdown (feedback Hugo 2026-07-09). O popover de
  // confirmação + POST direto de S10 seguem REMOVIDOS nesta visão.
  const router = useRouter()

  function goToEngagement(studentId: string, action: "remind" | "activate" | "recognize" | null) {
    const suffix = action ? `&action=${action}` : ""
    router.push(`/engagement?student=${encodeURIComponent(studentId)}${suffix}`)
  }

  // Distinct teams present in the roster, for the filter dropdown. Keyed by
  // subteam id (or DIRECT_TEAM_KEY for students with no subteam), keeping the
  // first subteam object seen (for the chip) plus a headcount. Only
  // meaningful in showSubteam mode. Sorted separately by colorIndex (an extra
  // field beyond TeamFilterOption, kept locally for the sort only).
  const teamOptions = useMemo(() => {
    const map = new Map<string, TeamFilterOption & { colorIndex: number }>()
    for (const s of students) {
      const key = s.subteam?.id ?? DIRECT_TEAM_KEY
      const existing = map.get(key)
      if (existing) {
        existing.count = (existing.count ?? 0) + 1
      } else {
        const label = s.subteam
          ? s.subteam.path && s.subteam.path.length > 0
            ? s.subteam.path.join(" › ")
            : s.subteam.name?.trim() || "Sem nome"
          : "Direto"
        map.set(key, {
          key,
          label,
          count: 1,
          colorIndex: s.subteam?.colorIndex ?? 999,
          subteam: s.subteam,
        })
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.colorIndex !== b.colorIndex) return a.colorIndex - b.colorIndex
      return a.label.localeCompare(b.label)
    })
  }, [students])

  // S6 (Onda 2): estado do filtro de time vive em ?teams= (única fonte de
  // verdade, compartilhada com o dropdown do recorte "Quem estou
  // analisando?"). effectiveTeams descarta ids obsoletos/desconhecidos do
  // param (interseção com teamOptions), nunca trava a tabela vazia por causa
  // de um ?teams= forjado ou stale.
  const { selected: selectedTeams } = useTeamFilterParam()
  const effectiveTeams = useMemo(
    () => effectiveTeamSelection(selectedTeams, teamOptions),
    [selectedTeams, teamOptions],
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "full_name" || key === "ritmo" ? "asc" : "desc")
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = students
    if (q) {
      result = result.filter(
        (s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
      )
    }

    // Team multi-select filter (effective selection empty = all teams).
    if (effectiveTeams.size > 0) {
      result = result.filter((s) => effectiveTeams.has(s.subteam?.id ?? DIRECT_TEAM_KEY))
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortKey) {
        case "full_name":
          return dir * a.full_name.localeCompare(b.full_name)
        case "lastSessionDate": {
          const aTime = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : 0
          const bTime = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : 0
          return dir * (aTime - bTime)
        }
        case "totalSessions":
          return dir * (a.totalSessions - b.totalSessions)
        case "engagement":
          return dir * (getEngagementScore(a) - getEngagementScore(b))
        case "coursesEnrolled":
          return dir * (a.coursesEnrolled - b.coursesEnrolled)
        case "courseProgressPct":
          return dir * ((a.courseProgressPct ?? 0) - (b.courseProgressPct ?? 0))
        case "ritmo":
          return dir * (getRitmoRank(a) - getRitmoRank(b))
        default:
          return 0
      }
    })

    return result
  }, [students, search, sortKey, sortDir, effectiveTeams])

  // Single top performer: index of the first student matching maxScore (stable
  // tie-break by filtered order). Avoids tagging every tied student as TOP.
  const { maxScore, topIndex } = useMemo(() => {
    let max = 0
    let idx = -1
    filtered.forEach((s, i) => {
      const score = getEngagementScore(s)
      if (score > max) {
        max = score
        idx = i
      }
    })
    return { maxScore: max, topIndex: idx }
  }, [filtered])

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(colKey)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
    >
      {label}
      <ArrowUpDown
        size={12}
        className={sortKey === colKey ? "text-cerrado-600" : "text-text-muted/40"}
      />
    </button>
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {/* Mockup R3: título forte, sem ícone, na variant manager */}
              {isManager ? (
                <h2 className="text-xl font-bold tracking-tight text-text-primary">
                  Tabela simplificada
                </h2>
              ) : (
                <CardTitle className="flex items-center gap-2">
                  <Users size={18} />
                  Detalhes dos Alunos
                </CardTitle>
              )}
              {isManager && (
                <p className="mt-1 text-xs text-text-muted">
                  A tabela vira apoio para investigação individual.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isManager && (
                <button
                  type="button"
                  onClick={() => exportManagerCsv(filtered, showSubteam)}
                  style={{
                    backgroundColor: "var(--color-bg-card)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-text-primary shadow-card transition-all hover:shadow-elevated"
                >
                  <Download size={14} />
                  Exportar
                </button>
              )}
              {isManager ? (
                <div className="relative w-full sm:w-56">
                  <Search
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    placeholder="Buscar aluno"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      backgroundColor: "var(--color-bg-card)",
                      border: "1px solid var(--color-border-subtle)",
                    }}
                    className="w-full rounded-full py-2 pl-9 pr-4 text-xs font-medium text-text-primary shadow-card outline-none transition-all placeholder:text-text-muted focus:shadow-elevated"
                  />
                </div>
              ) : (
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className={isManager ? "px-5 pb-5" : "p-0"}>
          {/* Mockup R3: "micro-tabela" emoldurada dentro do card (manager) */}
          <div
            className={isManager ? "overflow-hidden rounded-xl" : undefined}
            style={isManager ? { border: "1px solid var(--color-border-subtle)" } : undefined}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={
                      isManager
                        ? {
                            backgroundColor: "var(--color-bg-elevated)",
                            borderBottom: "1px solid var(--color-border-subtle)",
                          }
                        : undefined
                    }
                  >
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Nome" colKey="full_name" />
                    </th>
                    {showSubteam && (
                      <th className="px-4 py-3 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Time
                          </span>
                          <TeamFilterDropdown options={teamOptions} variant="funnel" />
                        </div>
                      </th>
                    )}
                    {!isManager && (
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Email
                        </span>
                      </th>
                    )}
                    <th className="px-4 py-3 text-left">
                      <SortHeader label="Último Acesso" colKey="lastSessionDate" />
                    </th>
                    {isManager && (
                      <th className="px-4 py-3 text-left">
                        <SortHeader label="Ritmo" colKey="ritmo" />
                      </th>
                    )}
                    {!isManager && (
                      <th className="px-4 py-3 text-center">
                        <SortHeader label="Sessões" colKey="totalSessions" />
                      </th>
                    )}
                    {isManager && (
                      <th className="px-4 py-3 text-left">
                        {/* S12 (mockup R3): "Progresso" na manager, "Progressão" na instrutor */}
                        <SortHeader label="Progresso" colKey="courseProgressPct" />
                      </th>
                    )}
                    <th className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1">
                        {/* S12 (mockup R3): "Engaj." na manager, "Engajamento" na instrutor */}
                        <SortHeader
                          label={isManager ? "Engaj." : "Engajamento"}
                          colKey="engagement"
                        />
                        <span title={ENGAGEMENT_HELP} aria-label={ENGAGEMENT_HELP}>
                          <Info
                            size={12}
                            className="text-text-muted/60 hover:text-text-muted cursor-help"
                          />
                        </span>
                      </span>
                    </th>
                    {!isManager && (
                      <th className="px-4 py-3 text-center">
                        <SortHeader label="Cursos" colKey="coursesEnrolled" />
                      </th>
                    )}
                    {!isManager && (
                      <th className="px-4 py-3 text-center">
                        <SortHeader label="Progressão" colKey="courseProgressPct" />
                      </th>
                    )}
                    {showAction && (
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Ação
                        </span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columnCount}
                        className="py-8 text-center text-sm text-text-muted"
                      >
                        {search
                          ? "Nenhum aluno encontrado para esta busca."
                          : "Nenhum aluno cadastrado."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((student, rowIndex) => {
                      const activity = getActivityIndicator(student.lastSessionDate)
                      const progress =
                        student.coursesEnrolled > 0
                          ? Math.round((student.coursesCompleted / student.coursesEnrolled) * 100)
                          : 0
                      const isExpanded = expandedId === student.id
                      const hasDetails =
                        canExpand &&
                        ((student.recentSessions?.length ?? 0) > 0 ||
                          (student.recentReflections?.length ?? 0) > 0)

                      return (
                        <React.Fragment key={student.id}>
                          <tr
                            className="transition-colors hover:bg-bg-hover"
                            style={
                              isManager && rowIndex > 0
                                ? { borderTop: "1px solid var(--color-border-subtle)" }
                                : undefined
                            }
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {hasDetails && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : student.id)}
                                    className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
                                  </button>
                                )}
                                {!hasDetails && <span className="w-[14px]" />}
                                {canExpand ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : student.id)}
                                    className="font-medium text-text-primary hover:text-cerrado-600 transition-colors text-left"
                                  >
                                    {student.full_name || "Sem nome"}
                                  </button>
                                ) : (
                                  <span
                                    className={
                                      isManager
                                        ? "text-[15px] font-bold text-text-primary"
                                        : "font-medium text-text-primary"
                                    }
                                    title={isManager ? student.email : undefined}
                                  >
                                    {student.full_name || "Sem nome"}
                                  </span>
                                )}
                              </div>
                            </td>
                            {showSubteam && (
                              <td className="px-4 py-3">
                                <SubteamChip subteam={student.subteam} />
                              </td>
                            )}
                            {!isManager && (
                              <td className="px-4 py-3 text-text-secondary text-xs">
                                {student.email}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${activity.color}`}
                                  title={activity.label}
                                />
                                <span className="text-xs text-text-secondary">
                                  {formatRelativeTime(student.lastSessionDate)}
                                </span>
                              </div>
                            </td>
                            {!isManager && (
                              <td className="px-4 py-3 text-center">
                                <span className="text-text-primary font-medium">
                                  {student.completedSessions}
                                </span>
                                <span className="text-text-muted">/{student.totalSessions}</span>
                              </td>
                            )}
                            {isManager && (
                              <td className="px-4 py-4 text-left">
                                <RitmoBadge display={getRitmoDisplay(student)} />
                              </td>
                            )}
                            {isManager && (
                              <td className="px-4 py-4 text-left">
                                {(() => {
                                  const pct = student.courseProgressPct ?? 0
                                  // Mockup R3: % bold à esquerda + barra LARGA na
                                  // horizontal; semântica: vermelha se atrasado,
                                  // verde caso contrário; 0% = trilho vazio.
                                  const barColor =
                                    student.ritmo === "atrasado" ? "#ef4444" : "#10b981"
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-3">
                                        <span className="w-11 shrink-0 text-sm font-bold tabular-nums text-text-primary">
                                          {pct}%
                                        </span>
                                        <div
                                          style={{ backgroundColor: "var(--color-bg-hover)" }}
                                          className="h-2 w-full min-w-[110px] max-w-[220px] overflow-hidden rounded-full"
                                        >
                                          {pct > 0 && (
                                            <div
                                              className="h-full rounded-full transition-all"
                                              style={{ width: `${pct}%`, backgroundColor: barColor }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                      {/* Percorrido x Elaborado: a linha de cima é o
                                          DECLARADO (o clique em "Módulo Concluído"); esta
                                          é o PERCORRIDO real. O contraste entre as duas é
                                          o produto. Sem rótulo na pessoa: dois números, o
                                          gestor conclui. */}
                                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                        <span className="uppercase tracking-wider">Percorrido</span>
                                        {student.viewProgressPct == null ? (
                                          <span title="A medição de exposição começou depois; não há histórico para este aluno.">
                                            sem dado
                                          </span>
                                        ) : (
                                          <span className="font-semibold tabular-nums text-text-primary">
                                            {Math.round(student.viewProgressPct)}%
                                          </span>
                                        )}
                                        {student.viewHasNewContent && (
                                          <span title="O conteúdo mudou desde a passagem deste aluno.">
                                            · conteúdo novo
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </td>
                            )}
                            {/* Engajamento: score combinado (sessões×2 + reflexões) */}
                            <td
                              className={
                                isManager ? "px-4 py-4 text-center" : "px-4 py-3 text-center"
                              }
                            >
                              {(() => {
                                const score = getEngagementScore(student)
                                const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
                                const isTop = rowIndex === topIndex && maxScore > 0
                                if (score === 0) {
                                  // Mockup R3: manager mostra "Inativo" + subtexto
                                  // (instructor mantém o badge).
                                  if (isManager)
                                    return (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="font-bold text-text-muted">Inativo</span>
                                        <span className="text-[10px] text-text-muted">
                                          Nenhuma atividade recente
                                        </span>
                                      </div>
                                    )
                                  return (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-semantic-error/10 text-semantic-error font-medium">
                                      Inativo
                                    </span>
                                  )
                                }
                                // Mockup R3 (manager): número grande CENTRALIZADO +
                                // sublinha por extenso, sem a mini-barra. O "★ TOP"
                                // vive no slot direito de um grid de 3 colunas: o
                                // score fica no centro geométrico da célula e o
                                // badge nunca o empurra (fix do desalinhamento,
                                // feedback Hugo 2026-07-07).
                                if (isManager)
                                  return (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
                                        <span />
                                        <span className="text-lg font-bold tabular-nums text-text-primary">
                                          {score}
                                        </span>
                                        {isTop ? (
                                          <span className="ml-1.5 w-fit rounded-full bg-cerrado-600/10 px-1.5 py-0.5 text-[9px] font-bold text-cerrado-600">
                                            ★ TOP
                                          </span>
                                        ) : (
                                          <span />
                                        )}
                                      </div>
                                      <span className="text-[11px] text-text-muted tabular-nums">
                                        {student.completedSessions} interações ·{" "}
                                        {student.reflectionsCount} reflexões
                                      </span>
                                    </div>
                                  )
                                return (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="flex items-baseline gap-1">
                                      <span
                                        className={`font-bold text-lg tabular-nums ${isTop ? "text-cerrado-600" : "text-text-primary"}`}
                                      >
                                        {score}
                                      </span>
                                      {isTop && (
                                        <span className="text-[9px] font-bold text-cerrado-600 bg-cerrado-600/10 px-1.5 py-0.5 rounded-full">
                                          ★ TOP
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className="w-full max-w-[80px] h-1 rounded-full overflow-hidden"
                                      style={{ backgroundColor: "var(--color-bg-hover)" }}
                                    >
                                      <div
                                        className="h-full rounded-full bg-cerrado-600 transition-all"
                                        style={{
                                          width: `${pct}%`,
                                          opacity: 0.3 + (pct / 100) * 0.7,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[9px] text-text-muted tabular-nums">
                                      {student.completedSessions} sess · {student.reflectionsCount}{" "}
                                      refl
                                    </span>
                                  </div>
                                )
                              })()}
                            </td>
                            {!isManager && (
                              <td className="px-4 py-3 text-center">
                                <span className="text-text-primary font-medium">
                                  {student.coursesCompleted}
                                </span>
                                <span className="text-text-muted">/{student.coursesEnrolled}</span>
                              </td>
                            )}
                            {/* Progressão no curso: média de % de avanço nas matrículas (distinta do engajamento) */}
                            {!isManager && (
                              <td className="px-4 py-3 text-center">
                                {(() => {
                                  const pct = student.courseProgressPct ?? 0
                                  return (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="font-semibold tabular-nums text-text-primary">
                                        {pct}%
                                      </span>
                                      <div
                                        className="w-full max-w-[80px] h-1.5 rounded-full overflow-hidden"
                                        style={{ backgroundColor: "var(--color-bg-hover)" }}
                                      >
                                        <div
                                          className="h-full rounded-full bg-varzea transition-all"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  )
                                })()}
                              </td>
                            )}
                            {showAction && (
                              <td className="px-4 py-4 text-left">
                                {(() => {
                                  const action = computeStudentAction(
                                    student.triagem,
                                    student.totalSessions,
                                  )
                                  if (!action)
                                    return (
                                      <span aria-hidden="true" className="text-text-muted">
                                        –
                                      </span>
                                    )
                                  // E10 + feedback Hugo (2026-07-09): "No ritmo"
                                  // deixa de abrir dropdown (Ver detalhe/Parabenizar/
                                  // Nada) e vira BOTÃO DE AÇÃO DIRETA no mesmo padrão
                                  // sólido de Lembrar/Acionar. Clique único = navegar
                                  // ao Centro com action=recognize (Parabenizar). A
                                  // setinha (ArrowUpRight) no canto sinaliza "vai para
                                  // outra tela", padrão do repo (plans-client).
                                  if (action.kind === "none")
                                    return (
                                      <button
                                        type="button"
                                        aria-label={`Parabenizar ${student.full_name} em Ações de Engajamento`}
                                        title={`Parabenizar ${student.full_name} em Ações de Engajamento`}
                                        onClick={() => goToEngagement(student.id, "recognize")}
                                        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110"
                                        style={{ backgroundColor: "#10b981" }}
                                      >
                                        No ritmo
                                        <ArrowUpRight size={14} />
                                      </button>
                                    )
                                  const isLembrar = action.kind === "lembrar"
                                  // E10: Lembrar/Acionar navegam para o Centro
                                  // (Sheet pré-preenchido). SEM carregar nudgeType
                                  // (AC4). aria-label honesto: a ação agora ABRE
                                  // o Centro para lembrar/acionar, não dispara o
                                  // envio in-place (a ponte substitui o POST
                                  // direto por navegação).
                                  return (
                                    <button
                                      type="button"
                                      aria-label={`${isLembrar ? "Lembrar" : "Acionar"} ${student.full_name} em Ações de Engajamento`}
                                      onClick={() =>
                                        goToEngagement(
                                          student.id,
                                          isLembrar ? "remind" : "activate",
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110"
                                      style={{
                                        backgroundColor: isLembrar
                                          ? "var(--color-semantic-warning)"
                                          : "var(--color-semantic-error)",
                                      }}
                                    >
                                      {isLembrar ? (
                                        <BellRing size={14} />
                                      ) : (
                                        <AlertTriangle size={14} />
                                      )}
                                      {isLembrar ? "Lembrar" : "Acionar"}
                                    </button>
                                  )
                                })()}
                              </td>
                            )}
                          </tr>
                          {canExpand && isExpanded && (
                            <tr className="">
                              <td colSpan={columnCount} className="px-4 py-4 bg-bg-surface">
                                <StudentExpandedContent
                                  student={student}
                                  expandedSession={expandedSession}
                                  setExpandedSession={setExpandedSession}
                                />
                                <div className="mt-3 pl-6">
                                  <Link
                                    href={`/analytics/students/${student.id}`}
                                    className="text-xs font-medium text-cerrado-600 hover:text-cerrado-400 transition-colors"
                                  >
                                    Ver perfil completo &rarr;
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

/** Expanded row content — clicking a session filters reflections to that chapter */
function StudentExpandedContent({
  student,
  expandedSession,
  setExpandedSession,
}: {
  student: StudentInsightRow
  expandedSession: string | null
  setExpandedSession: (key: string | null) => void
}) {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null)

  const sortedSessions = [...(student.recentSessions ?? [])].sort(
    (a, b) => (a.chapterOrder ?? 999) - (b.chapterOrder ?? 999),
  )

  // Filter reflections by selected chapter
  const reflections = student.recentReflections ?? []
  const filteredReflections = selectedChapter
    ? reflections.filter((r) => r.chapterTitle === selectedChapter)
    : reflections
  const sortedReflections = [...filteredReflections].sort((a, b) => a.slideOrder - b.slideOrder)

  // Group by chapter
  const grouped = new Map<string, RecentReflectionRow[]>()
  for (const ref of sortedReflections) {
    const list = grouped.get(ref.chapterTitle) ?? []
    list.push(ref)
    grouped.set(ref.chapterTitle, list)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 pl-6">
      {/* Left: Interações */}
      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          <BookOpen size={12} />
          Interações por Módulo
        </h4>
        {sortedSessions.length === 0 ? (
          <p className="text-xs text-text-muted">Nenhuma interação registrada.</p>
        ) : (
          <div className="space-y-2">
            {sortedSessions.map((session, i) => {
              const sessionKey = session.sessionId ?? `${student.id}-${session.chapterTitle}-${i}`
              const isSessionExpanded = expandedSession === sessionKey
              const isChapterSelected = selectedChapter === session.chapterTitle
              const hasMessages = session.studentMessages && session.studentMessages.length > 0
              return (
                <div
                  key={sessionKey}
                  className={`rounded-lg bg-bg-surface shadow-card overflow-hidden transition-all ${isChapterSelected ? "ring-2 ring-cerrado-600/40" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedSession(isSessionExpanded ? null : sessionKey)
                      setSelectedChapter(isChapterSelected ? null : session.chapterTitle)
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {hasMessages &&
                          (isSessionExpanded ? (
                            <ChevronDown size={10} className="text-text-muted shrink-0" />
                          ) : (
                            <ChevronRight size={10} className="text-text-muted shrink-0" />
                          ))}
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted font-medium uppercase">
                          {session.interactionType === "quiz"
                            ? "Quiz"
                            : session.interactionType === "scenario"
                              ? "Cenário"
                              : session.interactionType === "assignment"
                                ? "Atividade"
                                : "Socrático"}
                        </span>
                        <p className="text-xs font-medium text-text-primary truncate">
                          {session.chapterTitle}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold shrink-0 ${formatStatusColor(session.status)}`}
                      >
                        {formatStatusLabel(session.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted">
                      {new Date(session.createdAt).toLocaleDateString("pt-BR")}
                      {(session.turns ?? 0) > 0 && ` · ${session.turns} turnos`}
                      {hasMessages &&
                        !isSessionExpanded &&
                        ` · ${session.studentMessages?.length} msgs`}
                    </p>
                  </button>
                  {isSessionExpanded && hasMessages && (
                    <div className="px-3 pb-3 space-y-2 pt-2 bg-bg-surface">
                      {session.studentMessages?.map((msg, j) => {
                        return (
                          // biome-ignore lint/suspicious/noArrayIndexKey: mensagens ordenadas da sessão sem id próprio; sessionKey + índice é estável
                          <div
                            key={`${sessionKey}-msg-${j}`}
                            className="rounded-md bg-varzea/5 border border-varzea/10 px-3 py-2"
                          >
                            <p className="text-[11px] text-text-secondary leading-relaxed">{msg}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {isSessionExpanded && !hasMessages && (
                    <div className="px-3 pb-3 pt-2">
                      <p className="text-[10px] text-text-muted italic">
                        Sem mensagens registradas nesta interação.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: Reflexões — filtered by selected chapter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            <MessageSquare size={12} />
            {selectedChapter ? "Reflexões" : "Reflexões por Módulo"}
          </h4>
          {selectedChapter && (
            <button
              type="button"
              onClick={() => setSelectedChapter(null)}
              className="text-[10px] text-cerrado-600 hover:text-cerrado-400 font-medium"
            >
              Ver todas
            </button>
          )}
        </div>
        {sortedReflections.length === 0 ? (
          <p className="text-xs text-text-muted">
            {selectedChapter
              ? `Nenhuma reflexão em "${selectedChapter}".`
              : "Nenhuma reflexão registrada."}
          </p>
        ) : (
          <div className="space-y-3">
            {[...grouped.entries()].map(([chapterTitle, refs]) => (
              <div key={chapterTitle}>
                <p className="text-[10px] font-semibold text-cerrado-600 mb-1.5">
                  {chapterTitle}
                  <span className="text-text-muted font-normal ml-1">
                    ({refs.length} reflexões)
                  </span>
                </p>
                <div className="space-y-1 pl-2 border-l-2 border-cerrado-600/20">
                  {refs.map((ref) => (
                    <div key={ref.slideOrder} className="rounded-md bg-bg-surface px-2.5 py-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] text-text-muted">Slide {ref.slideOrder}</span>
                        <span className="text-[9px] text-text-muted">
                          {new Date(ref.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        {ref.response}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
