"use client"

import posthog from "posthog-js"
import { useEffect } from "react"

export function usePostHogIdentify(user: { id: string; role: string; tenantId: string } | null) {
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        role: user.role,
        tenant_id: user.tenantId,
      })
    }
  }, [user])
}
