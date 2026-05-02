"use client"

import { Badge, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { useState } from "react"
import type { SessionAnalyticsResponse } from "@/types/analytics"
import { CognitiveAnalysisPanel } from "./cognitive-analysis-panel"
import { SessionJourneyChart } from "./session-journey-chart"
import { SessionMetricsPanel } from "./session-metrics-panel"
import { AnnotatedTranscript } from "./annotated-transcript"
import { Calendar, Hash, Layers, MessageSquare, User } from "lucide-react"

interface SessionDetailViewProps {
  initialData: SessionAnalyticsResponse
}

export function SessionDetailView({ initialData }: SessionDetailViewProps) {
  const [activeTab, setActiveTab] = useState("analise")
  const { header } = initialData

  const dateStr = new Date(header.date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const verdictVariant =
    header.aiDetectionVerdict === "likely_ai"
      ? "error"
      : header.aiDetectionVerdict === "likely_human"
        ? "success"
        : "default"

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-text-primary">
                {header.courseTitle} — {header.chapterTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  {header.studentName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  {dateStr}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={14} />
                  {header.turnCount} turnos
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers size={14} />
                  Profundidade: {header.depthReached}/7
                </span>
                <span className="flex items-center gap-1.5">
                  <Hash size={14} />
                  {header.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {header.aiDetectionVerdict && (
                <Badge variant={verdictVariant}>
                  {header.aiDetectionVerdict === "likely_ai" ? "Provável IA" : "Provável Humano"}
                </Badge>
              )}
              {header.qaScore != null && (
                <Badge variant={header.qaScore >= 70 ? "success" : "warning"}>
                  QA: {header.qaScore}%
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analise">Análise Cognitiva</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="conversa">Conversa</TabsTrigger>
        </TabsList>

        <TabsContent value="analise">
          <CognitiveAnalysisPanel analysis={initialData.cognitiveAnalysis} />
        </TabsContent>

        <TabsContent value="jornada">
          <SessionJourneyChart journey={initialData.journey} />
        </TabsContent>

        <TabsContent value="metricas">
          <SessionMetricsPanel metrics={initialData.metrics} />
        </TabsContent>

        <TabsContent value="conversa">
          <AnnotatedTranscript messages={initialData.transcript} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
