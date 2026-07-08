"use client"

// ---------------------------------------------------------------------------
// E7 — Aba Campanhas.
// ---------------------------------------------------------------------------
// SHELL PLACEHOLDER (E4): renders the auto-generated cohort list as a skeleton/
// empty state so the shell works before E7 fills in the preview→review→confirm
// wizard. E7 replaces the body below, keeping the CampaignsTabProps contract.
//
// Real behaviour (E7): list the auto-generated contextual cohorts of the
// current recorte (never empty cohorts), then the mandatory flow: Ver alunos →
// Template → Origem → Canal → Preview → REVISÃO OBRIGATÓRIA → Enviar. Dispatch:
// POST /api/engagement/campaign (preview then confirm), cap 200 recipients.
// ---------------------------------------------------------------------------

import { EmptyState, Skeleton } from "@eximia/ui"
import { Megaphone } from "lucide-react"
import type { CampaignsTabProps } from "./types"

export function CampaignsTab({ initialCohorts, canManageCampaigns }: CampaignsTabProps) {
  if (!canManageCampaigns) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Megaphone size={28} />}
        title="Campanhas indisponíveis"
        description="Apenas gestores e administradores podem enviar campanhas coletivas."
      />
    )
  }

  if (initialCohorts.length === 0) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Megaphone size={28} />}
        title="Nenhum grupo para acionar"
        description="Não há grupos de alunos elegíveis para campanha no recorte atual."
      />
    )
  }

  return (
    <div className="space-y-3">
      {initialCohorts.map((c) => (
        // Placeholder row: preserves cohort + count until E7 renders the real
        // campaign group card with the preview→review→confirm flow.
        <div
          key={c.id}
          className="flex items-center justify-between rounded-2xl bg-bg-card p-5 shadow-card"
        >
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-40" />
            <p className="text-xs text-text-muted">
              {c.targetStudentIds.length} aluno{c.targetStudentIds.length === 1 ? "" : "s"} neste
              grupo
            </p>
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
