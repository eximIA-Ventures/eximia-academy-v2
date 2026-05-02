"use server"

import { getAuthProfile } from "@/lib/auth"
import { type FeatureCheckResult, getFeatureAccess } from "@/lib/feature-gate"

export async function fetchFeatureAccess(featureKey: string): Promise<FeatureCheckResult> {
  const { profile } = await getAuthProfile()

  if (!profile?.tenant_id) {
    return {
      allowed: false,
      featureKey,
      quota: null,
      used: 0,
      currentPlan: "essencial",
      requiredPlan: null,
    }
  }

  return getFeatureAccess(profile.tenant_id, featureKey)
}
