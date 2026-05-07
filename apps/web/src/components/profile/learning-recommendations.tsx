"use client"

import { generateLearningRecommendations } from "@/app/(platform)/perfil/actions"
import { Button, Card, CardContent } from "@eximia/ui"
import { BookOpen, GraduationCap, Loader2, MonitorPlay, RefreshCw } from "lucide-react"
import { useState } from "react"

interface Recommendations {
  recommended_courses: Array<{ course_title: string; reason: string }>
  study_strategies: string[]
  preferred_content_format: string
  generated_at: string
}

interface LearningRecommendationsProps {
  profile: Record<string, unknown>
}

export function LearningRecommendations({ profile }: LearningRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(
    (profile.ai_recommendations as Recommendations) ?? null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasAiProfile = !!profile.ai_profile

  if (!hasAiProfile) return null

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await generateLearningRecommendations()
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setRecommendations(result.data as Recommendations)
      }
    } catch {
      setError("Erro inesperado ao gerar recomendações")
    } finally {
      setLoading(false)
    }
  }

  if (!recommendations) {
    return (
      <Card className="border-dashed border-cerrado-600/20 bg-cerrado-600/5">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10 text-cerrado-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Recomendações de Aprendizado</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Gere recomendações personalizadas de cursos e estrategias de estudo baseadas no seu perfil.
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
              "Gerar Recomendações"
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

  const generatedDate = new Date(recommendations.generated_at).toLocaleDateString("pt-BR")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-cerrado-600" />
          <h3 className="text-lg font-bold text-text-primary">Recomendações de Aprendizado</h3>
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

      {/* Recommended Courses */}
      {recommendations.recommended_courses.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cerrado-600" />
              <h4 className="text-sm font-semibold text-text-primary">Cursos Recomendados</h4>
            </div>
            <div className="space-y-3">
              {recommendations.recommended_courses.map((course, i) => (
                <div key={i} className="rounded-lg bg-bg-surface p-3">
                  <p className="text-sm font-medium text-text-primary">{course.course_title}</p>
                  <p className="mt-1 text-xs text-text-muted">{course.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Study Strategies */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-accent-gold" />
              <h4 className="text-sm font-semibold text-text-primary">Estrategias de Estudo</h4>
            </div>
            <ul className="space-y-2">
              {recommendations.study_strategies.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-gold" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Content Format */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <MonitorPlay className="h-4 w-4 text-accent-green" />
              <h4 className="text-sm font-semibold text-text-primary">Formato Preferido</h4>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              {recommendations.preferred_content_format}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
