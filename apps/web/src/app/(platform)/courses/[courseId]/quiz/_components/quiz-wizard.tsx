"use client"

import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Checkbox } from "@eximia/ui"
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, useTransition } from "react"
import { createQuizSession, listCourseChapters, listCourseQuestions } from "../actions"

/* --------------------------------- Types --------------------------------- */

interface Question {
  id: string
  text: string
  skill: string | null
  status: string
  chapter_id: string
}

interface Chapter {
  id: string
  title: string
  order: number
}

interface QuizWizardProps {
  courseId: string
}

/* -------------------------------- Component ------------------------------- */

export function QuizWizard({ courseId }: QuizWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic info
  const [title, setTitle] = useState("")
  const [quizType, setQuizType] = useState<"practice" | "exam" | "diagnostic">("practice")
  const [chapterId, setChapterId] = useState<string | null>(null)

  // Step 2: Question selection
  const [questions, setQuestions] = useState<Question[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterChapter, setFilterChapter] = useState<string>("")
  const [searchText, setSearchText] = useState("")
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  // Step 3: Rules
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(null)
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [passingScore, setPassingScore] = useState(70)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [showAnswersAfter, setShowAnswersAfter] = useState<"completion" | "never" | "always">("completion")

  // Load chapters on mount
  useEffect(() => {
    listCourseChapters(courseId).then((res) => {
      if (res.data) setChapters(res.data)
    })
  }, [courseId])

  // Load questions when entering step 2
  useEffect(() => {
    if (step !== 2) return
    setLoadingQuestions(true)
    listCourseQuestions(courseId, filterChapter || undefined).then((res) => {
      if (res.data) setQuestions(res.data)
      setLoadingQuestions(false)
    })
  }, [courseId, step, filterChapter])

  const toggleQuestion = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const filteredQuestions = questions.filter((q) => {
    if (searchText && !q.text.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  const canNext = () => {
    if (step === 1) return title.trim().length >= 3
    if (step === 2) return selectedIds.size > 0
    return true
  }

  const handleSubmit = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const result = await createQuizSession(courseId, {
        title,
        quiz_type: quizType,
        chapter_id: chapterId,
        question_ids: Array.from(selectedIds),
        time_limit_minutes: timeLimitMinutes,
        max_attempts: maxAttempts,
        passing_score: passingScore,
        shuffle_questions: shuffleQuestions,
        show_answers_after: showAnswersAfter,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      router.push(`/courses/${courseId}`)
    })
  }, [
    courseId,
    title,
    quizType,
    chapterId,
    selectedIds,
    timeLimitMinutes,
    maxAttempts,
    passingScore,
    shuffleQuestions,
    showAnswersAfter,
    router,
    startTransition,
  ])

  const quizTypeLabels = {
    practice: { label: "Pratica", desc: "Sem nota, para estudo", color: "info" as const },
    exam: { label: "Exame", desc: "Nota oficial, tentativas limitadas", color: "error" as const },
    diagnostic: { label: "Diagnostico", desc: "Avaliacao inicial de nivel", color: "warning" as const },
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s <= step
                  ? "bg-cerrado-600 text-white"
                  : "bg-bg-surface text-text-muted"
              }`}
            >
              {s === 4 ? <Check size={14} /> : s}
            </div>
            {s < 4 && (
              <div className={`h-0.5 w-8 ${s < step ? "bg-cerrado-600" : "bg-bg-surface"}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-text-muted">
          {step === 1 && "Informações basicas"}
          {step === 2 && "Selecao de questões"}
          {step === 3 && "Regras do quiz"}
          {step === 4 && "Preview"}
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-semantic-error/10 px-4 py-3 text-sm text-semantic-error">
          {error}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Informações do Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Titulo *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Quiz Final — Capítulo 3"
                className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-cerrado-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Tipo *</label>
              <div className="grid grid-cols-3 gap-3">
                {(["practice", "exam", "diagnostic"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setQuizType(type)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      quizType === type
                        ? "border-cerrado-600 bg-cerrado-600/10"
                        : "border-border-medium bg-bg-card hover:border-cerrado-600/50"
                    }`}
                  >
                    <Badge variant={quizTypeLabels[type].color} badgeSize="sm">
                      {quizTypeLabels[type].label}
                    </Badge>
                    <p className="mt-1 text-xs text-text-muted">{quizTypeLabels[type].desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Capítulo (opcional)
              </label>
              <select
                value={chapterId ?? ""}
                onChange={(e) => setChapterId(e.target.value || null)}
                className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
              >
                <option value="">Todos os capítulos</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.order}. {ch.title}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Question Selection */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Questoes ({selectedIds.size} selecionadas)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar questões..."
                  className="w-full rounded-md border border-border bg-bg-card py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-cerrado-600 focus:outline-none"
                />
              </div>
              <select
                value={filterChapter}
                onChange={(e) => setFilterChapter(e.target.value)}
                className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
              >
                <option value="">Todos capítulos</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.order}. {ch.title}
                  </option>
                ))}
              </select>
            </div>

            {loadingQuestions ? (
              <p className="py-8 text-center text-sm text-text-muted">Carregando questões...</p>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-text-muted">Nenhuma questao encontrada para este curso.</p>
                <p className="mt-1 text-xs text-text-muted">
                  Gere questões primeiro na pagina do capítulo.
                </p>
              </div>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                      selectedIds.has(q.id)
                        ? "border-cerrado-600 bg-cerrado-600/5"
                        : "border-border-medium bg-bg-card hover:border-cerrado-600/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(q.id)}
                      onCheckedChange={() => toggleQuestion(q.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary">{q.text}</p>
                      {q.skill && (
                        <span className="mt-1 inline-block text-xs text-text-muted">{q.skill}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Rules */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Regras do Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Tempo limite (minutos)
                </label>
                <input
                  type="number"
                  value={timeLimitMinutes ?? ""}
                  onChange={(e) =>
                    setTimeLimitMinutes(e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="Sem limite"
                  min={1}
                  max={300}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-cerrado-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Max tentativas
                </label>
                <input
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value) || 1)}
                  min={1}
                  max={100}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Nota minima (%)
                </label>
                <input
                  type="number"
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Mostrar respostas
                </label>
                <select
                  value={showAnswersAfter}
                  onChange={(e) =>
                    setShowAnswersAfter(e.target.value as "completion" | "never" | "always")
                  }
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary focus:border-cerrado-600 focus:outline-none"
                >
                  <option value="completion">Apos completar</option>
                  <option value="always">Sempre</option>
                  <option value="never">Nunca</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={shuffleQuestions}
                onCheckedChange={(checked) => setShuffleQuestions(checked === true)}
              />
              <span className="text-sm text-text-primary">Embaralhar questões</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview do Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                <Badge variant={quizTypeLabels[quizType].color} badgeSize="sm">
                  {quizTypeLabels[quizType].label}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                <span>{selectedIds.size} questões</span>
                {timeLimitMinutes && <span>{timeLimitMinutes} min</span>}
                <span>Max {maxAttempts} tentativa(s)</span>
                <span>Nota minima: {passingScore}%</span>
                {shuffleQuestions && <span>Embaralhado</span>}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Questoes selecionadas:</p>
              {questions
                .filter((q) => selectedIds.has(q.id))
                .map((q, i) => (
                  <div key={q.id} className="rounded-md border border-border bg-bg-card p-3">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium text-text-muted">{i + 1}.</span> {q.text}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <CardFooter className="flex justify-between px-0">
        <Button
          variant="outline"
          onClick={() => (step === 1 ? router.back() : setStep(step - 1))}
          disabled={isPending}
        >
          <ArrowLeft size={14} className="mr-1" />
          {step === 1 ? "Cancelar" : "Anterior"}
        </Button>

        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Proximo
            <ArrowRight size={14} className="ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Criando..." : "Criar Quiz"}
            <Check size={14} className="ml-1" />
          </Button>
        )}
      </CardFooter>
    </div>
  )
}
