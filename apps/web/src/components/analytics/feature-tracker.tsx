"use client"

import { analytics } from "@/lib/analytics"
import { useEffect } from "react"

export function FeatureTracker({ feature }: { feature: string }) {
  useEffect(() => {
    analytics.featureViewed(feature)
  }, [feature])

  return null
}
