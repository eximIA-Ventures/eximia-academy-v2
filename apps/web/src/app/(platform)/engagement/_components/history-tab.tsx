"use client"

// ---------------------------------------------------------------------------
// E8 — Aba Histórico.
// ---------------------------------------------------------------------------
// SHELL PLACEHOLDER (E4): renders a skeleton table so the shell works before E8
// fills in the scoped history table + filters. E8 replaces the body below,
// keeping the HistoryTabProps contract.
//
// Real behaviour (E8): scoped table (8 columns — Destinatário, Motivo, Mensagem/
// template, Origem, Canal, Status, Data, Resultado) + 6 filters (Aluno, Tipo,
// Origem, Canal, Status, Período). Source: GET /api/engagement/history (already
// scoped by recipient_id ∈ allowedStudentIds — never leaks another team).
// ---------------------------------------------------------------------------

import { Skeleton } from "@eximia/ui"
import type { HistoryTabProps } from "./types"

export function HistoryTab(_props: HistoryTabProps) {
  // E4 shell: the history read is client-side (carries query-string filters), so
  // E8 owns the fetch. Until then, a skeleton table communicates "loading".
  return (
    <div className="rounded-2xl bg-bg-card p-5 shadow-card space-y-4">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">Histórico de comunicações será preenchido em E8.</p>
    </div>
  )
}
