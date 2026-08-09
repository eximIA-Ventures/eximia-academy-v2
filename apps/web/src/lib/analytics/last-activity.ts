// ---------------------------------------------------------------------------
// last-activity — single-source "when was this row activity?" helper.
// ---------------------------------------------------------------------------
// The socratic session is REUSED when the student comes back to a chapter
// (createSession redirects to the existing active row) and every chat turn bumps
// ONLY `updated_at` via `claim_session_turn` — `created_at` stays frozen at the
// first visit. Reflections can also be edited later. Any "último acesso"
// computation that reads a single timestamp therefore under-counts access (the
// Rinaldo case: created 21d ago, chatted today, screens said "há 21 dias").
//
// One row's activity = the LATEST of its stamps. All fields optional: a row
// carrying only `created_at` behaves exactly like the legacy computation.
// ---------------------------------------------------------------------------

/** Any row with activity timestamps (sessions, slide_reflections, ...). */
export interface ActivityStampRow {
  created_at?: string | null
  updated_at?: string | null
}

/** The row's most recent activity in epoch ms, or null when no stamp parses. */
export function latestActivityMs(row: ActivityStampRow): number | null {
  let best: number | null = null
  for (const iso of [row.created_at, row.updated_at]) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) continue
    if (best === null || t > best) best = t
  }
  return best
}

/** The most recent activity across all rows, or null when none has a stamp. */
export function latestActivityMsOf(rows: ActivityStampRow[]): number | null {
  let best: number | null = null
  for (const row of rows) {
    const t = latestActivityMs(row)
    if (t !== null && (best === null || t > best)) best = t
  }
  return best
}
