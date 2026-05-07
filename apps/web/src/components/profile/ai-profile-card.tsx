"use client"

import { Button, Card, CardContent } from "@eximia/ui"
import { Loader2, RefreshCw, Sparkles, Target, TrendingUp, Users, Zap } from "lucide-react"
import { useState } from "react"

interface AiProfile {
  summary: string
  strengths: string[]
  learning_style: string
  collaboration_style: string
  growth_areas: string[]
  generated_at: string
}

interface AiProfileCardProps {
  profile: Record<string, unknown>
}

export function AiProfileCard({ profile }: AiProfileCardProps) {
  const [aiProfile, setAiProfile] = useState<AiProfile | null>(
    (profile.ai_profile as AiProfile) ?? null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Count completed assessments
  const assessmentTypes = ["big_five", "enneagram", "disc", "multiple_intelligences", "career_anchors"]
  const completedCount = assessmentTypes.filter((type) => profile[type]).length
  const canGenerate = completedCount >= 2

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/profile/generate", { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Erro ao gerar perfil")
      }
      const data = await res.json()
      setAiProfile(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  // Not enough assessments
  if (!canGenerate && !aiProfile) {
    return (
      <Card className="border-dashed border-accent-gold/20 bg-accent-gold/5">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-gold/10 text-accent-gold">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Como a IA me ve</h3>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              Complete pelo menos 2 assessments para desbloquear seu perfil gerado por IA.
              Você completou {completedCount} de 2 necessarios.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Can generate but hasn't yet
  if (!aiProfile) {
    return (
      <Card className="border-accent-gold/20 bg-accent-gold/5">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-gold/10 text-accent-gold">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Como a IA me ve</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Com {completedCount} assessments completos, a IA pode gerar um perfil integrado sobre você.
              </p>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar meu perfil IA
              </>
            )}
          </Button>
        </CardContent>
        {error && (
          <div className="border-t border-semantic-error/20 px-6 py-3">
            <p className="text-sm text-semantic-error">{error}</p>
          </div>
        )}
      </Card>
    )
  }

  // Profile generated — show results
  const generatedDate = new Date(aiProfile.generated_at).toLocaleDateString("pt-BR")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-gold" />
          <h3 className="text-lg font-bold text-text-primary">Perfil IA</h3>
          <span className="text-xs text-text-muted">Gerado em {generatedDate}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          Regerar
        </Button>
      </div>

      {error && (
        <Card className="border-semantic-error/20 bg-semantic-error/5">
          <CardContent className="p-4">
            <p className="text-sm text-semantic-error">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm leading-relaxed text-text-secondary">{aiProfile.summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Strengths */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent-gold" />
              <h4 className="text-sm font-semibold text-text-primary">Pontos Fortes</h4>
            </div>
            <ul className="space-y-2">
              {aiProfile.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Growth Áreas */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cerrado-600" />
              <h4 className="text-sm font-semibold text-text-primary">Areas de Crescimento</h4>
            </div>
            <ul className="space-y-2">
              {aiProfile.growth_areas.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cerrado-600" />
                  {g}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Learning Style */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-accent-purple" />
              <h4 className="text-sm font-semibold text-text-primary">Estilo de Aprendizagem</h4>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">{aiProfile.learning_style}</p>
          </CardContent>
        </Card>

        {/* Collaboration Style */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent-green" />
              <h4 className="text-sm font-semibold text-text-primary">Estilo de Colaboracao</h4>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">{aiProfile.collaboration_style}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
