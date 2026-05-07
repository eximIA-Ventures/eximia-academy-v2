"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@eximia/ui"
import { ArrowRight, History } from "lucide-react"
import Link from "next/link"
import type { SessionListItem } from "@/types/analytics"

interface SessionHistoryTableProps {
  sessions: SessionListItem[]
}

export function SessionHistoryTable({ sessions }: SessionHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de Sessões</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Curso / Capítulo</TableHead>
                <TableHead>Prof.</TableHead>
                <TableHead>AI Det.</TableHead>
                <TableHead>QA</TableHead>
                <TableHead>Turnos</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-text-secondary">
                    {new Date(s.date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="text-text-primary">{s.courseTitle}</div>
                    <div className="text-xs text-text-muted">{s.chapterTitle}</div>
                  </TableCell>
                  <TableCell>{s.depthReached}/7</TableCell>
                  <TableCell>
                    {s.aiDetectionVerdict ? (
                      <Badge
                        variant={s.aiDetectionVerdict === "likely_ai" ? "error" : "success"}
                        badgeSize="sm"
                      >
                        {s.aiDetectionVerdict === "likely_ai" ? "IA" : "Human"}
                      </Badge>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.qaScore != null ? `${s.qaScore}%` : "—"}
                  </TableCell>
                  <TableCell className="text-text-secondary">{s.turnCount}</TableCell>
                  <TableCell>
                    <Link
                      href={`/analytics/sessions/${s.id}`}
                      className="text-cerrado-400 hover:text-cerrado-600"
                      aria-label={`Ver sessão de ${s.chapterTitle}`}
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm font-medium text-text-secondary">Nenhuma sessão encontrada</p>
            <p className="mt-1 text-xs text-text-muted">As sessões de aprendizagem aparecerão aqui.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
