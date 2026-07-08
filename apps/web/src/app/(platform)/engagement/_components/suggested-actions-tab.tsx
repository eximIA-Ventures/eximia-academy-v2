"use client"

// ---------------------------------------------------------------------------
// E5 — Aba Ações Sugeridas (default tab of the Engagement Center).
// ---------------------------------------------------------------------------
// SHELL PLACEHOLDER (E4): this file renders a dignified skeleton/empty state so
// the shell works end-to-end before E5 fills in the real suggestion cards.
// E5 replaces the body below, keeping the SuggestedActionsTabProps contract.
//
// Real behaviour (E5): render one SuggestionCard per live cohort of the current
// recorte (never_accessed, inactive, behind_teaching_plan, no_reflection,
// top_performer), each with quem/por que/qual ação + Ver alunos / Revisar
// mensagem / Enviar / Dispensar. Source: initialSuggestions (server) refetched
// from GET /api/engagement/overview. Never render an empty cohort card (AC3).
// ---------------------------------------------------------------------------

import { EmptyState, Skeleton } from "@eximia/ui"
import { Inbox } from "lucide-react"
import type { SuggestedActionsTabProps } from "./types"

export function SuggestedActionsTab({ initialSuggestions, context }: SuggestedActionsTabProps) {
  // E4 shell: nothing loads asynchronously yet — the server already handed us
  // `initialSuggestions`. When there are none, show the exact empty-state copy
  // from the report (Seção 15); otherwise a placeholder skeleton grid that E5
  // replaces with real SuggestionCards.
  if (initialSuggestions.length === 0) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Inbox size={28} />}
        title="Nenhuma ação pendente no momento"
        description={
          context.tenantWide
            ? "Nenhum aluno em risco no momento."
            : "Seu time não possui alunos em risco dentro do recorte atual."
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {initialSuggestions.map((s) => (
        // Placeholder card: preserves layout + count so the shell reads as
        // "loading suggestions" until E5 renders the full SuggestionCard.
        <div key={s.id} className="rounded-2xl bg-bg-card p-5 shadow-card space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="pt-2">
            <p className="text-xs text-text-muted">
              {s.targetStudentIds.length} aluno{s.targetStudentIds.length === 1 ? "" : "s"} neste
              recorte
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
