"use client"

import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@eximia/ui"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  BookOpen,
  CheckCircle2,
  History,
  Lightbulb,
  Play,
  Search,
  Layers,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

interface SessionItem {
  id: string
  status: "active" | "completed" | "abandoned"
  turnNumber: number
  depthReached: number
  breakthroughs: number
  courseId: string
  courseTitle: string
  chapterId: string
  chapterTitle: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

interface Stats {
  total: number
  completed: number
  avgDepth: number
  breakthroughs: number
}

interface SessionsDashboardClientProps {
  sessions: SessionItem[]
  stats: Stats
  userRole: string
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  completed: "Concluida",
  abandoned: "Abandonada",
}

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-accent-blue-mid/15 text-accent-blue-light ring-1 ring-accent-blue-mid/20",
  completed: "bg-semantic-success/15 text-semantic-success ring-1 ring-semantic-success/20",
  abandoned: "bg-text-muted/15 text-text-muted ring-1 ring-white/[0.06]",
}

export function SessionsDashboardClient({
  sessions,
  stats,
  userRole,
}: SessionsDashboardClientProps) {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")

  const filtered = useMemo(() => {
    let list = sessions

    if (tab === "active") list = list.filter((s) => s.status === "active")
    else if (tab === "completed") list = list.filter((s) => s.status === "completed")

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.courseTitle.toLowerCase().includes(q) ||
          s.chapterTitle.toLowerCase().includes(q),
      )
    }

    return list
  }, [sessions, tab, search])

  const statCards = [
    {
      label: "Total de Sessões",
      value: stats.total,
      icon: BookOpen,
      iconBg: "bg-accent-blue-mid/15",
      textColor: "text-accent-blue-light",
    },
    {
      label: "Concluídas",
      value: stats.completed,
      icon: CheckCircle2,
      iconBg: "bg-semantic-success/15",
      textColor: "text-semantic-success",
    },
    {
      label: "Profundidade Média",
      value: `${stats.avgDepth}/7`,
      icon: Layers,
      iconBg: "bg-purple-500/15",
      textColor: "text-purple-400",
    },
    {
      label: "Breakthroughs",
      value: stats.breakthroughs,
      icon: Lightbulb,
      iconBg: "bg-accent-gold/15",
      textColor: "text-accent-gold",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-card via-bg-card to-bg-card ring-1 ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
          >
            <div className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg}`}>
                <stat.icon size={20} className={stat.textColor} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                  {stat.label}
                </p>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="active">Ativas</TabsTrigger>
            <TabsTrigger value="completed">Concluidas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:ml-auto sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            placeholder="Buscar curso ou capitulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Session list */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value={tab} className="mt-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent-blue-deep/10 via-bg-card to-bg-card py-16 ring-1 ring-white/[0.06]">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-blue-mid/10">
                <History className="h-8 w-8 text-accent-blue-light/60" />
              </div>
              <p className="mt-4 text-sm font-medium text-text-secondary">Nenhuma sessao encontrada</p>
              <p className="mt-1 text-xs text-text-muted">Inicie uma sessao de estudo para ve-la aqui.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  userRole={userRole}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SessionCard({
  session,
  userRole,
}: {
  session: SessionItem
  userRole: string
}) {
  const depthPercent = Math.round((session.depthReached / 7) * 100)

  return (
    <div className="group rounded-2xl bg-gradient-to-br from-bg-card via-bg-card to-bg-card ring-1 ring-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:ring-accent-blue-mid/20">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary transition-colors group-hover:text-accent-blue-light">
            {session.courseTitle}
          </p>
          <p className="truncate text-sm text-text-muted">{session.chapterTitle}</p>
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted">
            {formatDistanceToNow(new Date(session.updatedAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>

        {/* Depth bar */}
        <div className="flex w-full items-center gap-3 sm:w-48">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              <span>Prof.</span>
              <span>{session.depthReached}/7</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-accent-blue-mid to-accent-blue-light transition-all duration-500"
                style={{ width: `${depthPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-bg-elevated/80 px-2.5 py-1 text-[10px] font-semibold text-text-muted ring-1 ring-white/[0.06] backdrop-blur-sm">
            {session.turnNumber} turnos
          </span>
          <Badge
            className={`text-[10px] font-semibold ${STATUS_CLASSES[session.status] ?? STATUS_CLASSES.abandoned}`}
          >
            {STATUS_LABELS[session.status] ?? session.status}
          </Badge>
        </div>

        {/* Action */}
        <div className="shrink-0">
          {session.status === "active" ? (
            <Link
              href={`/courses/${session.courseId}/chapters/${session.chapterId}/session`}
              className={buttonVariants({ size: "sm" })}
            >
              <Play size={14} className="mr-1.5" />
              Continuar
            </Link>
          ) : userRole !== "student" ? (
            <Link
              href={`/analytics/sessions/${session.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver detalhes
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
