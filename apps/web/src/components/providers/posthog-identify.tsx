"use client"

import { usePostHogIdentify } from "@/hooks/use-posthog-identify"

export function PostHogIdentify({
  user,
}: {
  user: { id: string; role: string; tenantId: string } | null
}) {
  usePostHogIdentify(user)
  return null
}
