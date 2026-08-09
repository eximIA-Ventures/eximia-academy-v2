import type { LoopStats } from "@/types/analytics"

/**
 * Pure aggregation step of the aggregate route's `computeLoopStats` ("O loop
 * que você causou", Uso da Plataforma). Split out so the "count students, not
 * notifications" rule is unit-testable without a Supabase mock — a route.ts
 * cannot export extra names beyond the HTTP verbs (Next.js App Router route
 * modules only allow GET/POST/... + a fixed config surface).
 *
 * A student with 2+ nudge rows in the scoped period counts ONCE in
 * `acionados`, and once in `voltaram` if ANY of their rows has `returned_at`
 * set. This is the fix for the unit bug: the caller used to sum per-template
 * `sent`/`returned` counts (notifications), which double-counts a student who
 * received more than one nudge in the period even though the card's copy
 * says "alunos acionados" (students), not "notificações enviadas".
 */
export function aggregateLoopStats(
  rows: Array<{ recipient_id: string; returned_at: string | null }>,
): LoopStats {
  if (rows.length === 0) return { acionados: 0, voltaram: 0, returnRatePct: 0 }

  const returnedByRecipient = new Map<string, boolean>()
  for (const r of rows) {
    const already = returnedByRecipient.get(r.recipient_id) ?? false
    returnedByRecipient.set(r.recipient_id, already || Boolean(r.returned_at))
  }
  const acionados = returnedByRecipient.size
  const voltaram = [...returnedByRecipient.values()].filter(Boolean).length
  return {
    acionados,
    voltaram,
    returnRatePct: acionados > 0 ? Math.round((voltaram / acionados) * 100) : 0,
  }
}
