"use client"

import { Avatar, Badge, Card, CardContent } from "@eximia/ui"
import { Calendar, GraduationCap } from "lucide-react"
import type { StudentHeader } from "@/types/analytics"

interface StudentProfileHeaderProps {
  header: StudentHeader
}

export function StudentProfileHeader({ header }: StudentProfileHeaderProps) {
  const initials = header.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const lastSession = header.lastSessionAt
    ? new Date(header.lastSessionAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Nenhuma"

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-6 p-6">
        {/* Avatar */}
        <Avatar src={header.avatarUrl ?? undefined} fallback={initials} size="lg" alt={header.fullName} />

        {/* Name + plan badge */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{header.fullName}</h1>
            {header.plan && <Badge variant="info">{header.plan}</Badge>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              Ultima sessao: {lastSession}
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap size={14} />
              {header.totalSessions} sessoes ({header.totalCompleted} completas)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
