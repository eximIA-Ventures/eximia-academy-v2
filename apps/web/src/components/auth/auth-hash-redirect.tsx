"use client"

import { useEffect } from "react"

/**
 * Detects Supabase auth hash/query fragments on the landing page and
 * redirects to the correct auth page.
 *
 * Handles:
 * - Success: #access_token=...&type=recovery → /reset-password
 * - Success: #access_token=...&type=invite|signup → /accept-invite
 * - Error: ?error=access_denied&error_code=otp_expired → /login?error=...
 */
export function AuthHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    const search = window.location.search

    // Case 1: Supabase error redirect (expired token, access denied, etc.)
    const searchParams = new URLSearchParams(search)
    const errorCode = searchParams.get("error_code")
    if (errorCode) {
      const desc = searchParams.get("error_description") || "Link expirado ou inválido"
      window.location.replace(`/login?error=reset_failed&message=${encodeURIComponent(desc)}`)
      return
    }

    // Case 2: Successful auth redirect with hash fragment
    if (!hash || !hash.includes("access_token")) return

    const hashParams = new URLSearchParams(hash.substring(1))
    const type = hashParams.get("type")

    if (type === "recovery") {
      window.location.replace(`/reset-password${hash}`)
    } else if (type === "invite" || type === "signup") {
      window.location.replace(`/accept-invite${hash}`)
    }
  }, [])

  return null
}
