"use client"

// ---------------------------------------------------------------------------
// E6 — Fluxo de Ação Individual (Sheet lateral, NOT a tab).
// ---------------------------------------------------------------------------
// SHELL PLACEHOLDER (E4): the shell mounts this once and controls its open
// state; the Sheet reads `?student&action=` query params itself. This file
// renders the empty Sheet skeleton so the shell wiring works before E6 fills
// in the real fields. E6 replaces the body below, keeping the
// IndividualActionSheetProps contract.
//
// Real behaviour (E6): Aluno, Motivo, Último acesso, Progresso, Engajamento,
// Template sugerido, Origem da mensagem (server-trusted managerName), Canal,
// Prévia editável, [Acionar also: Status atual + Histórico recente]. Dispatch:
// POST /api/engagement/action. nudgeType derived server-side from ritmo (AC10).
// ---------------------------------------------------------------------------

import { Sheet, SheetContent, SheetHeader, SheetOverlay, SheetTitle, Skeleton } from "@eximia/ui"
import type { IndividualActionSheetProps } from "./types"

export function IndividualActionSheet({ open, onOpenChange, action }: IndividualActionSheetProps) {
  const title = action === "activate" ? "Acionar aluno" : "Lembrar aluno"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetOverlay />
      <SheetContent side="right" className="w-full max-w-md sm:w-[28rem]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {/* E6 fills this: student summary, editable preview, origin selector,
            channel, send button. Skeleton keeps the panel legible meanwhile. */}
        <div className="mt-4 space-y-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <p className="text-xs text-text-muted">Fluxo de ação individual será preenchido em E6.</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
