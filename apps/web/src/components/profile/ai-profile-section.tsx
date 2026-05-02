"use client"

import type { AILearningProfile } from "@eximia/shared"
import { AILearningPlaceholder } from "./ai-learning-placeholder"
import { LearningStyleCards } from "./learning-style-cards"
import { ProfileDisclaimer } from "./profile-disclaimer"
import { ProfileSummaryCard } from "./profile-summary-card"
import { StrengthsAndGrowth } from "./strengths-and-growth"

interface AIProfileSectionProps {
  profile: AILearningProfile | null
}

export function AIProfileSection({ profile }: AIProfileSectionProps) {
  if (!profile) return <AILearningPlaceholder />

  return (
    <div className="space-y-6">
      <ProfileSummaryCard
        summary={profile.summary}
        confidence={profile.confidence}
        sessionsAnalyzed={profile.sessions_analyzed}
        lastUpdated={profile.last_updated}
      />
      <LearningStyleCards
        engagementStyle={profile.engagement_style}
        detailOrientation={profile.detail_orientation}
        reasoningStyle={profile.reasoning_style}
      />
      <StrengthsAndGrowth strengths={profile.strengths} growthAreas={profile.growth_areas} />
      <ProfileDisclaimer />
    </div>
  )
}
