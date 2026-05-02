"use client"

import { fetchFeatureAccess } from "@/lib/actions/feature-access"
import type { PlanName } from "@/lib/feature-gate"
import { useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureAccessState {
  allowed: boolean
  quota: number | null
  used: number
  loading: boolean
  currentPlan: PlanName | null
  requiredPlan: PlanName | null
}

// ---------------------------------------------------------------------------
// Session-level cache (survives re-renders, cleared on page navigation)
// ---------------------------------------------------------------------------

const sessionCache = new Map<string, { allowed: boolean; quota: number | null; used: number; currentPlan: PlanName; requiredPlan: PlanName | null }>()

// ---------------------------------------------------------------------------
// Hook: useFeatureAccess
// ---------------------------------------------------------------------------

export function useFeatureAccess(featureKey: string): FeatureAccessState {
  const [state, setState] = useState<FeatureAccessState>(() => {
    const cached = sessionCache.get(featureKey)
    if (cached) {
      return {
        allowed: cached.allowed,
        quota: cached.quota,
        used: cached.used,
        loading: false,
        currentPlan: cached.currentPlan,
        requiredPlan: cached.requiredPlan,
      }
    }
    return {
      allowed: false,
      quota: null,
      used: 0,
      loading: true,
      currentPlan: null,
      requiredPlan: null,
    }
  })

  const featureKeyRef = useRef(featureKey)
  featureKeyRef.current = featureKey

  useEffect(() => {
    // If already cached, skip fetch
    if (sessionCache.has(featureKey)) return

    let cancelled = false

    async function load() {
      try {
        const result = await fetchFeatureAccess(featureKey)

        // Cache the result for the session
        sessionCache.set(featureKey, {
          allowed: result.allowed,
          quota: result.quota,
          used: result.used,
          currentPlan: result.currentPlan,
          requiredPlan: result.requiredPlan,
        })

        if (!cancelled && featureKeyRef.current === featureKey) {
          setState({
            allowed: result.allowed,
            quota: result.quota,
            used: result.used,
            loading: false,
            currentPlan: result.currentPlan,
            requiredPlan: result.requiredPlan,
          })
        }
      } catch (error) {
        console.error(`Error fetching feature access for "${featureKey}":`, error)
        if (!cancelled && featureKeyRef.current === featureKey) {
          setState((prev) => ({ ...prev, loading: false }))
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [featureKey])

  return state
}
