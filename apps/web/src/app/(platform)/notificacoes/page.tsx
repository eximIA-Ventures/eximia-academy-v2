// ---------------------------------------------------------------------------
// Engagement Engine — student in-app inbox page (/notificacoes)
// ---------------------------------------------------------------------------
// Server component: bootstraps the inbox in one round-trip, then hands off to
// the client component for interactive mark-read / mark-acted / filter.
//
// Access: any authenticated role can view their own notifications.
// Admin and manager are not restricted here — they can also receive in-app
// notifications (system / announcements). The inbox data layer (RLS +
// inbox.ts) already scopes everything to the authenticated user.
// ---------------------------------------------------------------------------

import { getAuthProfile } from "@/lib/auth"
import { getInbox } from "@/lib/notifications/inbox"
import { redirect } from "next/navigation"
import { InboxClient } from "./_components/inbox-client"

export const metadata = {
  title: "Notificações",
}

// Revalidate on navigation — inbox data is user-specific and changes frequently.
export const dynamic = "force-dynamic"

export default async function NotificacoesPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect("/login")

  // Fetch initial inbox snapshot (list + unread count) server-side to avoid
  // a loading flash on first render. The client component will handle
  // subsequent mutations without a full page reload.
  const initialData = await getInbox({ limit: 50 })

  return <InboxClient initialData={initialData} />
}
