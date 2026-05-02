"use client"

import type { AILearningProfile } from "@eximia/shared"
import { Anchor, Brain, Fingerprint, Lightbulb, Users } from "lucide-react"
import { useState } from "react"
import { AiProfileCard } from "./ai-profile-card"
import { AIProfileSection } from "./ai-profile-section"
import { AssessmentCard } from "./assessment-card"
import { BigFiveQuestionnaire } from "./big-five-questionnaire"
import { BigFiveResults } from "./big-five-results"
import { CareerAnchorsQuestionnaire } from "./career-anchors-questionnaire"
import { CareerAnchorsResults } from "./career-anchors-results"
import { DISCQuestionnaire } from "./disc-questionnaire"
import { DISCResults } from "./disc-results"
import { EnneagramQuestionnaire } from "./enneagram-questionnaire"
import { EnneagramResults } from "./enneagram-results"
import { LearningRecommendations } from "./learning-recommendations"
import { MultipleIntelligencesQuestionnaire } from "./multiple-intelligences-questionnaire"
import { MultipleIntelligencesResults } from "./multiple-intelligences-results"
import type {
  BigFiveResult,
  CareerAnchorsResult,
  DISCResult,
  EnneagramResult,
  MultipleIntelligencesResult,
} from "./scoring"

type ActiveView =
  | "hub"
  | "big_five_quiz"
  | "big_five_result"
  | "enneagram_quiz"
  | "enneagram_result"
  | "disc_quiz"
  | "disc_result"
  | "multiple_intelligences_quiz"
  | "multiple_intelligences_result"
  | "career_anchors_quiz"
  | "career_anchors_result"

interface SelfKnowledgeHubProps {
  profile: Record<string, unknown>
  userId: string
}

function getAssessmentStatus(
  profile: Record<string, unknown>,
  type: string,
): "not_started" | "in_progress" | "completed" {
  if (profile[type]) return "completed"
  if (profile[`${type}_progress`]) return "in_progress"
  return "not_started"
}

const RESULT_VIEW_MAP: Record<string, ActiveView> = {
  big_five: "big_five_result",
  enneagram: "enneagram_result",
  disc: "disc_result",
  multiple_intelligences: "multiple_intelligences_result",
  career_anchors: "career_anchors_result",
}

export function SelfKnowledgeHub({ profile, userId }: SelfKnowledgeHubProps) {
  const [activeView, setActiveView] = useState<ActiveView>("hub")
  const [currentProfile, setCurrentProfile] = useState(profile)

  const bigFiveStatus = getAssessmentStatus(currentProfile, "big_five")
  const enneagramStatus = getAssessmentStatus(currentProfile, "enneagram")
  const discStatus = getAssessmentStatus(currentProfile, "disc")
  const miStatus = getAssessmentStatus(currentProfile, "multiple_intelligences")
  const anchorsStatus = getAssessmentStatus(currentProfile, "career_anchors")

  const handleComplete = (type: string, result: unknown) => {
    setCurrentProfile((prev) => {
      const updated = { ...prev, [type]: result }
      delete updated[`${type}_progress`]
      return updated
    })
    setActiveView(RESULT_VIEW_MAP[type] ?? "hub")
  }

  const goBack = () => setActiveView("hub")

  // Questionnaire views
  if (activeView === "big_five_quiz") {
    return (
      <div className="mt-4">
        <BigFiveQuestionnaire
          userId={userId}
          savedProgress={
            currentProfile.big_five_progress as { answers: Record<string, number> } | undefined
          }
          onComplete={(result) => handleComplete("big_five", result)}
          onBack={goBack}
        />
      </div>
    )
  }
  if (activeView === "enneagram_quiz") {
    return (
      <div className="mt-4">
        <EnneagramQuestionnaire
          userId={userId}
          savedProgress={
            currentProfile.enneagram_progress as { answers: Record<string, number> } | undefined
          }
          onComplete={(result) => handleComplete("enneagram", result)}
          onBack={goBack}
        />
      </div>
    )
  }
  if (activeView === "disc_quiz") {
    return (
      <div className="mt-4">
        <DISCQuestionnaire
          userId={userId}
          savedProgress={
            currentProfile.disc_progress as { answers: Record<string, string> } | undefined
          }
          onComplete={(result) => handleComplete("disc", result)}
          onBack={goBack}
        />
      </div>
    )
  }
  if (activeView === "multiple_intelligences_quiz") {
    return (
      <div className="mt-4">
        <MultipleIntelligencesQuestionnaire
          userId={userId}
          savedProgress={
            currentProfile.multiple_intelligences_progress as
              | { answers: Record<string, number> }
              | undefined
          }
          onComplete={(result) => handleComplete("multiple_intelligences", result)}
          onBack={goBack}
        />
      </div>
    )
  }
  if (activeView === "career_anchors_quiz") {
    return (
      <div className="mt-4">
        <CareerAnchorsQuestionnaire
          userId={userId}
          savedProgress={
            currentProfile.career_anchors_progress as
              | { answers: Record<string, number> }
              | undefined
          }
          onComplete={(result) => handleComplete("career_anchors", result)}
          onBack={goBack}
        />
      </div>
    )
  }

  // Result views (with null guards — redirect to hub if data missing)
  if (activeView === "big_five_result") {
    if (!currentProfile.big_five) {
      setActiveView("hub")
      return null
    }
    return (
      <div className="mt-4">
        <BigFiveResults result={currentProfile.big_five as BigFiveResult} onBack={goBack} />
      </div>
    )
  }
  if (activeView === "enneagram_result") {
    if (!currentProfile.enneagram) {
      setActiveView("hub")
      return null
    }
    return (
      <div className="mt-4">
        <EnneagramResults result={currentProfile.enneagram as EnneagramResult} onBack={goBack} />
      </div>
    )
  }
  if (activeView === "disc_result") {
    if (!currentProfile.disc) {
      setActiveView("hub")
      return null
    }
    return (
      <div className="mt-4">
        <DISCResults result={currentProfile.disc as DISCResult} onBack={goBack} />
      </div>
    )
  }
  if (activeView === "multiple_intelligences_result") {
    if (!currentProfile.multiple_intelligences) {
      setActiveView("hub")
      return null
    }
    return (
      <div className="mt-4">
        <MultipleIntelligencesResults
          result={currentProfile.multiple_intelligences as MultipleIntelligencesResult}
          onBack={goBack}
        />
      </div>
    )
  }
  if (activeView === "career_anchors_result") {
    if (!currentProfile.career_anchors) {
      setActiveView("hub")
      return null
    }
    return (
      <div className="mt-4">
        <CareerAnchorsResults
          result={currentProfile.career_anchors as CareerAnchorsResult}
          onBack={goBack}
        />
      </div>
    )
  }

  // Hub view with categories
  return (
    <div className="mt-6 space-y-8">
      {/* Category: Personalidade */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Personalidade
        </h3>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <AssessmentCard
            title="Big Five (OCEAN)"
            description="Descubra seus tracos de personalidade nas 5 grandes dimensoes"
            estimatedTime="5 minutos"
            status={bigFiveStatus}
            icon={Brain}
            onStart={() => setActiveView("big_five_quiz")}
            onViewResult={() => setActiveView("big_five_result")}
          />
          <AssessmentCard
            title="Eneagrama"
            description="Identifique seu tipo de personalidade entre os 9 perfis do Eneagrama"
            estimatedTime="5 minutos"
            status={enneagramStatus}
            icon={Fingerprint}
            onStart={() => setActiveView("enneagram_quiz")}
            onViewResult={() => setActiveView("enneagram_result")}
          />
        </div>
      </section>

      {/* Category: Comportamento & Carreira */}
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Comportamento & Carreira
        </h3>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AssessmentCard
            title="DISC"
            description="Entenda seu perfil comportamental: Dominancia, Influencia, Estabilidade e Conformidade"
            estimatedTime="7 minutos"
            status={discStatus}
            icon={Users}
            onStart={() => setActiveView("disc_quiz")}
            onViewResult={() => setActiveView("disc_result")}
          />
          <AssessmentCard
            title="Inteligências Múltiplas"
            description="Descubra suas 8 inteligencias dominantes segundo a teoria de Gardner"
            estimatedTime="10 minutos"
            status={miStatus}
            icon={Lightbulb}
            onStart={() => setActiveView("multiple_intelligences_quiz")}
            onViewResult={() => setActiveView("multiple_intelligences_result")}
          />
          <AssessmentCard
            title="Âncoras de Carreira"
            description="Identifique os valores e motivacoes que guiam suas escolhas profissionais"
            estimatedTime="10 minutos"
            status={anchorsStatus}
            icon={Anchor}
            onStart={() => setActiveView("career_anchors_quiz")}
            onViewResult={() => setActiveView("career_anchors_result")}
          />
        </div>
      </section>

      {/* AI Learning Profile — sessoes socraticas (Epic 10) */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-text-muted">
          <Brain className="h-4 w-4" />
          Como a IA me ve
        </h3>
        <AIProfileSection
          profile={currentProfile.ai_learning_profile as AILearningProfile | null}
        />
      </section>

      {/* AI Profile — assessments (Epic 9) */}
      <AiProfileCard profile={currentProfile} />
      <LearningRecommendations profile={currentProfile} />
    </div>
  )
}
