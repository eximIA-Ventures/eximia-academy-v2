"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { StudentAnalyticsResponse } from "@/types/analytics"
import { KolbScatterPlot } from "./kolb-scatter-plot"
import { LearnerProfileCard } from "./learner-profile-card"
import { DivergenceTable } from "./divergence-table"
import { CognitivePatternBars } from "./cognitive-pattern-bars"
import { DepthProgressionChart } from "./depth-progression-chart"
import { SessionHistoryTable } from "./session-history-table"
import { GestorRecommendations } from "./gestor-recommendations"

interface StudentProfileTabsProps {
  studentId: string
  initialData: StudentAnalyticsResponse
}

export function StudentProfileTabs({ studentId, initialData }: StudentProfileTabsProps) {
  const { data, isLoading, isError } = useQuery<StudentAnalyticsResponse>({
    queryKey: ["student-analytics", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/analytics/students/${studentId}`)
      if (!r.ok) throw new Error(`Student analytics fetch failed: ${r.status}`)
      return r.json()
    },
    initialData,
  })

  const currentData = data ?? initialData
  const isFetching = isLoading && !data

  const profile = currentData.learnerProfile ?? initialData.learnerProfile
  const patterns = currentData.cognitivePatterns ?? initialData.cognitivePatterns
  const divergence = currentData.divergence ?? initialData.divergence
  const recommendations = currentData.recommendations ?? initialData.recommendations
  const evolution = currentData.evolution ?? initialData.evolution
  const sessions = currentData.sessions ?? initialData.sessions
  const [activeTab, setActiveTab] = useState("perfil-ia")

  return (
    <div className="space-y-6">
      {isFetching && (
        <p className="text-center text-sm text-text-muted">Carregando dados...</p>
      )}
      {isError && (
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">
          Falha ao carregar dados do aluno. Tente novamente.
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="perfil-ia">Perfil IA</TabsTrigger>
          <TabsTrigger value="padroes">Padrões Cognitivos</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="sessoes">Sessões</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil-ia">
          <div className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <KolbScatterPlot
                aiGrasping={profile?.kolbGraspingAxis ?? null}
                aiTransforming={profile?.kolbTransformingAxis ?? null}
                aiStyle={profile?.kolbDominantStyle ?? null}
                aiConfidence={profile?.kolbStyleConfidence ?? null}
                testStyle={divergence?.kolbTestStyle ?? null}
              />
              <LearnerProfileCard profile={profile} />
            </div>
            {divergence && <DivergenceTable divergence={divergence} />}
          </div>
        </TabsContent>

        <TabsContent value="padroes">
          <div className="mt-6 space-y-6">
            <CognitivePatternBars patterns={patterns} />
          </div>
        </TabsContent>

        <TabsContent value="evolucao">
          <div className="mt-6">
            <DepthProgressionChart evolution={evolution} />
          </div>
        </TabsContent>

        <TabsContent value="sessoes">
          <div className="mt-6">
            <SessionHistoryTable sessions={sessions} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Recommendations below tabs */}
      <GestorRecommendations recommendations={recommendations} />
    </div>
  )
}
