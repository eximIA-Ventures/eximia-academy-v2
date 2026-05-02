"use client"

import { useState, useTransition } from "react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, useToast } from "@eximia/ui"
import { BookOpen, Clock, GraduationCap, Sparkles, TrendingUp, Users } from "lucide-react"
import { selfEnrollInTrail } from "@/app/(platform)/trails/actions"
import type { TrailSuggestion } from "@/lib/trails/recommendations"

const RELEVANCE_CONFIG: Record<
  TrailSuggestion["relevance_label"],
  { label: string; variant: "info" | "success" | "default"; icon: typeof Sparkles }
> = {
  role_match: { label: "Para seu cargo", variant: "info", icon: Sparkles },
  adjacent: { label: "Proximo nivel", variant: "success", icon: TrendingUp },
  popular: { label: "Popular", variant: "default", icon: Users },
}

interface TrailSuggestionsProps {
  suggestions: TrailSuggestion[]
}

export function TrailSuggestions({ suggestions }: TrailSuggestionsProps) {
  const [isPending, startTransition] = useTransition()
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  function handleEnroll(trailId: string, trailTitle: string) {
    setEnrollingId(trailId)
    startTransition(async () => {
      const result = await selfEnrollInTrail(trailId)
      setEnrollingId(null)

      if ("error" in result && result.error) {
        toast({
          variant: "error",
          title: "Erro ao inscrever",
          description: result.error,
        })
        return
      }

      setEnrolledIds((prev) => new Set(prev).add(trailId))
      toast({
        variant: "success",
        title: "Inscrito com sucesso",
        description: `Você foi inscrito na trilha "${trailTitle}"`,
      })
    })
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-gold" />
          <CardTitle className="text-base">Trilhas Recomendadas</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((trail) => {
          const config = RELEVANCE_CONFIG[trail.relevance_label]
          const RelevanceIcon = config.icon
          const isEnrolled = enrolledIds.has(trail.id)
          const isThisEnrolling = enrollingId === trail.id && isPending

          return (
            <div
              key={trail.id}
              className="flex items-start gap-4 rounded-md border border-border-subtle bg-bg-surface p-4 transition-colors hover:bg-bg-hover"
            >
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-blue-deep/50">
                <BookOpen className="h-5 w-5 text-accent-blue-light" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-text-primary line-clamp-1">
                    {trail.title}
                  </h4>
                  <Badge variant={config.variant} badgeSize="sm" className="shrink-0">
                    <RelevanceIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>

                {trail.description && (
                  <p className="text-xs text-text-secondary line-clamp-2">{trail.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  {trail.target_role_name && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {trail.target_role_name}
                      {trail.target_seniority && (
                        <span className="text-text-muted">({trail.target_seniority})</span>
                      )}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {trail.course_count} curso{trail.course_count !== 1 ? "s" : ""}
                  </span>
                  {trail.estimated_hours != null && trail.estimated_hours > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {trail.estimated_hours}h
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="shrink-0">
                {isEnrolled ? (
                  <Badge variant="success" badgeSize="sm">
                    Inscrito
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isThisEnrolling}
                    onClick={() => handleEnroll(trail.id, trail.title)}
                  >
                    {isThisEnrolling ? "Inscrevendo..." : "Inscrever-me"}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
