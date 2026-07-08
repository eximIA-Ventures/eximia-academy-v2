"use client"

// ---------------------------------------------------------------------------
// E9 — Aba Templates.
// ---------------------------------------------------------------------------
// SHELL PLACEHOLDER (E4): renders one skeleton section per intent category so
// the shell works before E9 fills in the real template cards + edit form. E9
// replaces the body below, keeping the TemplatesTabProps contract.
//
// Real behaviour (E9): list tenant templates grouped by human `intent` (never
// the raw `key`), each card with Nome, Intenção, Tom, Canais, Prévia, Variáveis,
// Status, Última edição, Editar. Source: GET /api/engagement/templates; edit via
// PATCH /api/engagement/templates/{id} (admin/manager only, key immutable).
// ---------------------------------------------------------------------------

import type { TemplateIntent } from "@/types/notifications"
import { EmptyState, Skeleton } from "@eximia/ui"
import { FileText } from "lucide-react"
import type { TemplatesTabProps } from "./types"

// Human labels for each intent category (E9 AC1/AC2 — never show the raw enum).
const INTENT_LABELS: Record<TemplateIntent, string> = {
  primeiro_acesso: "Primeiro acesso",
  retomada: "Retomada de uso",
  atraso_plano: "Atraso no Plano de Ensino",
  reflexao_pendente: "Reflexão pendente",
  reconhecimento: "Reconhecimento de destaque",
  manual: "Mensagem manual",
}

export function TemplatesTab({ canEditTemplates, intentOrder }: TemplatesTabProps) {
  if (!canEditTemplates) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<FileText size={28} />}
        title="Templates indisponíveis"
        description="Apenas gestores e administradores podem ver e editar templates."
      />
    )
  }

  return (
    <div className="space-y-6">
      {intentOrder.map((intent) => (
        <section key={intent} className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{INTENT_LABELS[intent]}</h3>
          {/* Placeholder cards per intent; E9 replaces with real template cards. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1].map((card) => (
              <div key={card} className="rounded-2xl bg-bg-card p-5 shadow-card space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-text-muted">Gestão de templates será preenchida em E9.</p>
    </div>
  )
}
