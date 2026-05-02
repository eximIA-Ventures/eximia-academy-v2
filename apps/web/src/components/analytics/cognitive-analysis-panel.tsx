"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import type { CognitiveAnalysis } from "@/types/analytics"

interface CognitiveAnalysisPanelProps {
  analysis: CognitiveAnalysis
}

export function CognitiveAnalysisPanel({ analysis }: CognitiveAnalysisPanelProps) {
  return (
    <div className="mt-6 space-y-6">
      {/* Dominant patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padroes Dominantes</CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.dominantPatterns.length > 0 ? (
            <div className="space-y-3">
              {analysis.dominantPatterns.map((p) => (
                <div key={p.pattern} className="flex items-center justify-between rounded-md border border-border-subtle p-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{p.pattern}</p>
                    {p.evidence && (
                      <p className="mt-0.5 text-xs text-text-muted">{p.evidence}</p>
                    )}
                  </div>
                  <Badge
                    variant={p.frequency === "high" ? "error" : p.frequency === "medium" ? "warning" : "default"}
                    badgeSize="sm"
                  >
                    {p.frequency}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Nenhum padrao dominante identificado.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Implicit values */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valores Implicitos</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.implicitValues.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.implicitValues.map((v) => (
                  <Badge key={v} variant="info" badgeSize="sm">{v}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Nenhum valor implicito detectado.</p>
            )}
          </CardContent>
        </Card>

        {/* Cognitive loops / defense mechanisms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mecanismos de Defesa</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.cognitiveLoops.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.cognitiveLoops.map((c) => (
                  <Badge key={c} variant="warning" badgeSize="sm">{c}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Nenhum mecanismo de defesa detectado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Detection */}
      {analysis.aiDetection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deteccao de IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-text-secondary">
                Probabilidade: <strong className="text-text-primary">{Math.round(analysis.aiDetection.probability * 100)}%</strong>
              </span>
              <span className="text-text-secondary">
                Confianca: <strong className="text-text-primary">{analysis.aiDetection.confidence}</strong>
              </span>
              <Badge
                variant={analysis.aiDetection.verdict === "likely_ai" ? "error" : "success"}
              >
                {analysis.aiDetection.verdict === "likely_ai" ? "Provavel IA" : "Provavel Humano"}
              </Badge>
            </div>

            {analysis.aiDetection.indicators.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-text-secondary">Indicadores</p>
                {analysis.aiDetection.indicators.map((ind, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-border-subtle p-2 text-xs">
                    <div>
                      <span className="font-medium text-text-primary">{ind.type}</span>
                      <span className="ml-2 text-text-muted">{ind.description}</span>
                    </div>
                    <span className="text-text-secondary">peso: {ind.weight}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
