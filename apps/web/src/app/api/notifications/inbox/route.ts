// ---------------------------------------------------------------------------
// GET /api/notifications/inbox — student in-app inbox endpoint
// ---------------------------------------------------------------------------
// Lightweight read endpoint backing the header bell + inbox client refresh.
//   • GET            -> { unreadCount }                 (cheap, for the bell badge poll)
//   • GET ?full=1    -> { unreadCount, notifications }  (list + count, for the inbox panel)
//   • GET ?unread=1  -> only unread rows in the list
//
// Auth + tenant scoping + ownership are enforced inside the inbox lib (auth-scoped
// Supabase client + RLS). The route never accepts a recipient/tenant from the
// client; the recipient is always the authenticated user. Unauthenticated calls
// get 401. Read-only — mutations go through the inbox server actions.
// ---------------------------------------------------------------------------

import { listMyNotifications, unreadCount } from "@/lib/notifications/inbox"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Always evaluate per-request (depends on the authenticated cookie session).
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const full = url.searchParams.get("full") === "1"
  const unreadOnly = url.searchParams.get("unread") === "1"

  if (!full) {
    // Bell badge path — count only.
    const count = await unreadCount()
    return NextResponse.json({ unreadCount: count })
  }

  const [notifications, count] = await Promise.all([
    listMyNotifications({ unreadOnly }),
    unreadCount(),
  ])
  return NextResponse.json({ unreadCount: count, notifications })
}
