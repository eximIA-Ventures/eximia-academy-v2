"use client"

import { Button } from "@eximia/ui"
import {
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Star,
  Target,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ConfettiBurst } from "./confetti-burst"
import { getAssignmentSubmission, saveAssignmentSubmission } from "./interaction-persistence"

interface RubricCriterion {
  id: string
  name: string
  description: string
  maxScore: number
}

interface AssignmentData {
  title: string
  description: string
  instructions: string[]
  deliverable: string
  estimatedTime: string
  rubric: RubricCriterion[]
}

interface AssignmentPlayerProps {
  assignment: AssignmentData
  chapterId: string
  courseId: string
  onComplete?: () => void
}

type Phase = "instructions" | "writing" | "evaluating" | "feedback"

interface CriterionScore {
  criterionId: string
  score: number
  comment: string
}

interface AssignmentFeedback {
  totalScore: number
  maxScore: number
  percentage: number
  criteriaScores: CriterionScore[]
  overallComment: string
  grade: string
}

const GRADES: Array<{ min: number; label: string; color: string }> = [
  { min: 90, label: "Excepcional", color: "text-semantic-success" },
  { min: 80, label: "Muito Bom", color: "text-semantic-success" },
  { min: 70, label: "Bom", color: "text-cerrado-600" },
  { min: 60, label: "Satisfatório", color: "text-amber-500" },
  { min: 0, label: "Precisa Melhorar", color: "text-semantic-error" },
]

function getGrade(percentage: number) {
  return GRADES.find((g) => percentage >= g.min) ?? GRADES[GRADES.length - 1]
}

export function AssignmentPlayer({ assignment, chapterId, courseId, onComplete }: AssignmentPlayerProps) {
  const [phase, setPhase] = useState<Phase>("instructions")
  const [content, setContent] = useState("")
  const [feedback, setFeedback] = useState<AssignmentFeedback | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [loadingPrevious, setLoadingPrevious] = useState(true)
  const [saving, setSaving] = useState(false)
  const hasMounted = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rubric = assignment?.rubric ?? []
  const instructions = assignment?.instructions ?? []
  const maxScore = rubric.reduce((sum, c) => sum + c.maxScore, 0)
  const wordCount = content.split(/\s+/).filter(Boolean).length

  // Load existing submission on mount
  useEffect(() => {
    if (hasMounted.current) return
    hasMounted.current = true

    async function loadSaved() {
      try {
        const saved = await getAssignmentSubmission(chapterId)
        if (!saved) return

        if (saved.content) setContent(saved.content as string)

        if (saved.status === "evaluated" && saved.evaluation) {
          const evalData = saved.evaluation as Record<string, unknown>
          setFeedback({
            totalScore: (evalData.overallScore as number) ?? 0,
            maxScore,
            percentage: Math.round(((evalData.overallScore as number) ?? 0) / maxScore * 100),
            criteriaScores: ((evalData.criteria as Array<{ name: string; score: number; comment: string }>) ?? []).map((c) => ({
              criterionId: rubric.find((r) => r.name === c.name)?.id ?? c.name,
              score: c.score,
              comment: c.comment,
            })),
            overallComment: (evalData.overallComment as string) ?? "",
            grade: (evalData.grade as string) ?? "",
          })
          setPhase("feedback")
        } else if (saved.status === "submitted") {
          // Already submitted, show feedback phase (re-evaluation needed)
          setPhase("writing")
        } else if (saved.content && (saved.content as string).trim().length > 0) {
          // Draft — resume writing
          setPhase("writing")
        }
      } finally {
        setLoadingPrevious(false)
      }
    }

    loadSaved()
  }, [chapterId, maxScore, rubric])

  // Debounced auto-save as draft when content changes (2s delay)
  useEffect(() => {
    // Skip auto-save when not in writing phase or content is empty
    if (phase !== "writing" || !content.trim() || loadingPrevious) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSaving(true)
      saveAssignmentSubmission(chapterId, {
        content,
        status: "draft",
      }).finally(() => setSaving(false))
    }, 2000)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [content, phase, chapterId, loadingPrevious])

  if (!assignment || rubric.length === 0) {
    return (
      <div className="rounded-md bg-bg-card p-8 text-center text-text-muted">
        Atividade ainda não configurada para este capítulo.
      </div>
    )
  }

  if (loadingPrevious) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={24} className="animate-spin text-text-muted" />
        <p className="text-sm text-text-muted">Carregando progresso...</p>
      </div>
    )
  }

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return
    setPhase("evaluating")
    setEvaluating(true)

    // Cancel any pending draft auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Save as submitted
    saveAssignmentSubmission(chapterId, {
      content,
      status: "submitted",
    })

    // Simulate AI evaluation
    setTimeout(() => {
      const criteriaScores: CriterionScore[] = rubric.map((c) => {
        const score = Math.floor(c.maxScore * (0.6 + Math.random() * 0.35))
        return {
          criterionId: c.id,
          score,
          comment: score >= c.maxScore * 0.8
            ? "Excelente abordagem. Demonstra domínio claro do critério."
            : score >= c.maxScore * 0.6
              ? "Abordagem adequada, com espaço para aprofundamento."
              : "Necessita de desenvolvimento. Considere expandir este aspecto.",
        }
      })

      const totalScore = criteriaScores.reduce((s, c) => s + c.score, 0)
      const percentage = Math.round((totalScore / maxScore) * 100)
      const grade = getGrade(percentage).label

      setFeedback({
        totalScore,
        maxScore,
        percentage,
        criteriaScores,
        overallComment: "Boa estruturação do trabalho. Você demonstrou capacidade analítica e aplicação prática da metodologia. Pontos-chave cobertos adequadamente, com oportunidade de aprofundamento em aspectos quantitativos.",
        grade,
      })
      setPhase("feedback")
      setEvaluating(false)

      // Persist evaluated result
      saveAssignmentSubmission(chapterId, {
        content,
        status: "evaluated",
        evaluation: {
          criteria: criteriaScores.map((cs) => {
            const criterion = rubric.find((c) => c.id === cs.criterionId)
            return {
              name: criterion?.name ?? cs.criterionId,
              score: cs.score,
              comment: cs.comment,
            }
          }),
          overallScore: totalScore,
          overallComment: "Boa estruturação do trabalho. Você demonstrou capacidade analítica e aplicação prática da metodologia. Pontos-chave cobertos adequadamente, com oportunidade de aprofundamento em aspectos quantitativos.",
          grade,
        },
      })
    }, 3000)
  }, [content, rubric, maxScore, chapterId])

  const passed = feedback && feedback.percentage >= 70

  // INSTRUCTIONS
  if (phase === "instructions") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 via-bg-card to-bg-card border border-purple-500/20 p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15">
              <FileText size={20} className="text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-500">Atividade</p>
              <h2 className="text-lg font-bold text-text-primary">{assignment.title}</h2>
            </div>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">{assignment.description}</p>

          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Instruções</p>
            <div className="space-y-2">
              {instructions.map((inst, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-[10px] font-bold text-purple-500">
                    {i + 1}
                  </span>
                  {inst}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-bg-surface shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-purple-400" />
              <p className="text-xs font-semibold text-text-primary">Entregável</p>
            </div>
            <p className="text-sm text-text-secondary">{assignment.deliverable}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {assignment.estimatedTime}
            </span>
            <span className="flex items-center gap-1.5">
              <Star size={12} />
              {maxScore} pontos
            </span>
            <span className="flex items-center gap-1.5">
              <Paperclip size={12} />
              {rubric.length} critérios
            </span>
          </div>

          {/* Rubric preview */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Critérios de Avaliação</p>
            <div className="space-y-1.5">
              {rubric.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-bg-surface shadow-card px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-text-primary">{c.name}</p>
                    <p className="text-[10px] text-text-muted">{c.description}</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-purple-400">{c.maxScore}pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={() => setPhase("writing")}>
          Começar Atividade
          <FileText size={16} className="ml-2" />
        </Button>
      </div>
    )
  }

  // EVALUATING
  if (phase === "evaluating") {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={32} className="animate-spin text-purple-500" />
        <p className="text-sm text-text-muted">Avaliando sua atividade...</p>
        <p className="text-xs text-text-muted/60">Analisando contra {rubric.length} critérios</p>
      </div>
    )
  }

  // FEEDBACK
  if (phase === "feedback" && feedback) {
    const gradeInfo = getGrade(feedback.percentage)
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <ConfettiBurst trigger={!!passed} />

        {/* Grade card */}
        <div className={`rounded-2xl border p-8 text-center space-y-5 ${
          passed
            ? "bg-gradient-to-b from-purple-500/5 to-bg-card border-purple-500/20"
            : "bg-bg-card border-border-subtle"
        }`}>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/10 ring-1 ring-purple-500/20">
            <Star size={36} className="text-purple-500" />
          </div>

          <div>
            <p className={`text-3xl font-bold ${gradeInfo.color}`}>{feedback.grade}</p>
            <p className="text-4xl font-bold text-text-primary mt-1">{feedback.percentage}%</p>
            <p className="mt-1 text-sm text-text-muted">{feedback.totalScore}/{feedback.maxScore} pontos</p>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">{feedback.overallComment}</p>
        </div>

        {/* Rubric scores */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Avaliação por Critério</h3>
          {feedback.criteriaScores.map((cs) => {
            const criterion = rubric.find((c) => c.id === cs.criterionId)
            if (!criterion) return null
            const pct = Math.round((cs.score / criterion.maxScore) * 100)
            return (
              <div key={cs.criterionId} className="rounded-xl bg-bg-card shadow-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{criterion.name}</span>
                  <span className={`text-sm font-bold ${pct >= 80 ? "text-semantic-success" : pct >= 60 ? "text-amber-500" : "text-semantic-error"}`}>
                    {cs.score}/{criterion.maxScore}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 80 ? "bg-semantic-success" : pct >= 60 ? "bg-amber-500" : "bg-semantic-error"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">{cs.comment}</p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => {
            setPhase("instructions")
            setContent("")
            setFeedback(null)
          }}>
            Refazer
          </Button>
          <Button className="flex-1" onClick={onComplete}>
            Concluir
          </Button>
        </div>
      </div>
    )
  }

  // WRITING
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl bg-bg-card shadow-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
            <FileText size={18} className="text-purple-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">{assignment.title}</h3>
            <p className="text-xs text-text-muted">{assignment.deliverable}</p>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          className="w-full rounded-xl shadow-card bg-bg-primary p-5 text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:border-purple-500/40 focus:outline-none focus:ring-1 focus:ring-purple-500/20 resize-y"
          placeholder="Escreva sua atividade aqui. Use parágrafos para organizar suas ideias..."
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>{wordCount} palavras</span>
            <span className="flex items-center gap-1.5">
              <Star size={10} />
              {maxScore} pontos possíveis
            </span>
            {saving && (
              <span className="flex items-center gap-1 text-text-muted/60">
                <Loader2 size={10} className="animate-spin" />
                Salvando...
              </span>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={wordCount < 20}>
            <Send size={14} className="mr-1.5" />
            Enviar Atividade
          </Button>
        </div>
      </div>

      {/* Rubric reminder */}
      <div className="rounded-xl bg-bg-surface shadow-card p-4">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Lembre-se dos critérios</p>
        <div className="flex flex-wrap gap-2">
          {rubric.map((c) => (
            <span key={c.id} className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400 ring-1 ring-purple-500/20">
              {c.name} ({c.maxScore}pts)
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
