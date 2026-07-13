"use client"

import posthog from "posthog-js"
import { useEffect, useRef } from "react"
import { analytics } from "@/lib/analytics"

export function usePostHogIdentify(user: { id: string; role: string; tenantId: string } | null) {
  const identifiedRef = useRef<string | null>(null)

  useEffect(() => {
    if (user && identifiedRef.current !== user.id) {
      posthog.identify(user.id, {
        role: user.role,
        tenant_id: user.tenantId,
      })
      analytics.loggedIn(user.role, user.tenantId)
      identifiedRef.current = user.id
    }
  }, [user])
}
