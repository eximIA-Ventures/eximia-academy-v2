import { Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { StatusBadge } from "./status-badge"

interface RecentSession {
  sessionId: string
  chapterTitle: string
  status: "active" | "completed"
  completedAt?: string
}

interface RecentSessionsListProps {
  sessions: RecentSession[]
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps) {
  if (sessions.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sessões Recentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            className="flex items-center justify-between gap-3  pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {session.chapterTitle}
              </p>
              <p className="text-xs text-text-muted">
                {session.completedAt
                  ? formatDistanceToNow(new Date(session.completedAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "Em andamento"}
              </p>
            </div>
            <StatusBadge status={session.status} size="sm" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
