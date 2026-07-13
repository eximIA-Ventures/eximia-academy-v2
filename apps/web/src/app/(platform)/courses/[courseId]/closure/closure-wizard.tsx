"use client"

import { Button, useToast } from "@eximia/ui"
import { cn } from "@eximia/ui"
import { ArrowLeft, ArrowRight, Award, Check, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { saveConsciousnessResponse } from "@/app/(platform)/consciousness/[courseId]/actions"

interface ClosureWizardProps {
  courseId: string
  courseTitle: string
  enrollmentId: string
  preResponse: {
    challengeText: string | null
    selfRating: number | null
    learningGoal: string | null
  } | null
}

const RATING_LABELS: Record<number, string> = {
  1: "Iniciante",
  2: "Basico",
  3: "Intermediario",
  4: "Avancado",
  5: "Expert",
}

export function ClosureWizard({
  courseId,
  courseTitle,
  enrollmentId,
  preResponse,
}: ClosureWizardProps) {
  const [step, setStep] = useState(0)
  const [newRating, setNewRating] = useState<number | null>(null)
  const [commitment, setCommitment] = useState("")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const ratingDelta =
    newRating && preResponse?.selfRating ? newRating - preResponse.selfRating : null

  function handleNext() {
    if (step < 3) setStep(step + 1)
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await saveConsciousnessResponse({
        courseId,
        phase: "post",
        selfRating: newRating ?? undefined,
        commitment: commitment.trim() || undefined,
        ratingChange: ratingDelta ?? undefined,
      })

      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }

      // Navigate to certificate
      router.push(`/certificates/${enrollmentId}`)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-surface">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-semantic-success/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cerrado-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col px-6 py-8">
        {/* Progress indicator */}
        <div className="mb-12 flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i === step
                  ? "w-8 bg-semantic-success"
                  : i < step
                    ? "w-4 bg-semantic-success/40"
                    : "w-4 bg-border-subtle",
              )}
            />
          ))}
        </div>

        {/* Steps */}
        <div className="flex-1">
          {/* Step 0: Revisit Pre-Course Responses */}
          {step === 0 && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-semantic-success/10">
                    <Award className="h-8 w-8 text-semantic-success" />
                  </div>
                </div>
                <h1 className="mb-2 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                  Parabens! Voce concluiu
                </h1>
                <p className="text-base font-medium text-cerrado-600">{courseTitle}</p>
                <p className="mt-3 text-sm text-text-muted">
                  Antes de receber seu certificado, vamos revisitar sua jornada.
                </p>
              </div>

              {preResponse ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
                    <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
                      Seu desafio era
                    </p>
                    <p className="text-sm text-text-primary">
                      {preResponse.challengeText || "Nao informado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
                    <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
                      Voce se avaliou como
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cerrado-600/10 text-sm font-bold text-cerrado-600">
                        {preResponse.selfRating ?? "?"}
                      </div>
                      <p className="text-sm font-medium text-text-primary">
                        {preResponse.selfRating
                          ? RATING_LABELS[preResponse.selfRating]
                          : "Nao informado"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
                    <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
                      Sua meta era
                    </p>
                    <p className="text-sm text-text-primary">
                      {preResponse.learningGoal || "Nao informado"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border-subtle bg-bg-card p-5 text-center">
                  <p className="text-sm text-text-muted">
                    Voce nao preencheu a fase de consciencia antes de comecar o curso.
                    <br />
                    Ainda assim, vamos refletir sobre sua jornada.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: New Self-Assessment */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="mb-2 text-xl font-semibold text-text-primary md:text-2xl">
                E agora, como voce se avalia?
              </h2>
              <p className="mb-8 text-sm text-text-muted">
                Pense no mesmo desafio que descreveu no inicio.
              </p>
              <div className="grid gap-3">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setNewRating(rating)}
                    className={cn(
                      "group flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-200",
                      newRating === rating
                        ? "border-semantic-success/40 bg-semantic-success/10 ring-2 ring-semantic-success/20"
                        : "border-border-subtle bg-bg-card hover:border-border-medium hover:bg-bg-elevated",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all",
                        newRating === rating
                          ? "bg-semantic-success text-white"
                          : "bg-bg-elevated text-text-muted group-hover:bg-bg-hover",
                      )}
                    >
                      {rating}
                    </div>
                    <p
                      className={cn(
                        "text-sm font-medium transition-colors",
                        newRating === rating ? "text-semantic-success" : "text-text-primary",
                      )}
                    >
                      {RATING_LABELS[rating]}
                    </p>
                    {newRating === rating && (
                      <Check className="ml-auto h-5 w-5 text-semantic-success" />
                    )}
                  </button>
                ))}
              </div>

              {/* Delta indicator */}
              {ratingDelta !== null && (
                <div
                  className={cn(
                    "mt-6 flex items-center justify-center gap-2 rounded-xl border px-5 py-4",
                    ratingDelta > 0
                      ? "border-semantic-success/30 bg-semantic-success/5"
                      : ratingDelta === 0
                        ? "border-cerrado-600/30 bg-cerrado-600/5"
                        : "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  <TrendingUp
                    size={18}
                    className={cn(
                      ratingDelta > 0
                        ? "text-semantic-success"
                        : ratingDelta === 0
                          ? "text-cerrado-600"
                          : "text-amber-500 rotate-180",
                    )}
                  />
                  <p
                    className={cn(
                      "text-sm font-medium",
                      ratingDelta > 0
                        ? "text-semantic-success"
                        : ratingDelta === 0
                          ? "text-cerrado-600"
                          : "text-amber-500",
                    )}
                  >
                    {ratingDelta > 0
                      ? `Voce evoluiu de ${preResponse?.selfRating} para ${newRating} (+${ratingDelta})`
                      : ratingDelta === 0
                        ? `Seu nivel se manteve em ${newRating}`
                        : `Sua percepcao mudou de ${preResponse?.selfRating} para ${newRating} (${ratingDelta})`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Action Commitment */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="mb-2 text-xl font-semibold text-text-primary md:text-2xl">
                O que voce vai fazer diferente na segunda-feira?
              </h2>
              <p className="mb-6 text-sm text-text-muted">
                Aprendizado so se concretiza na acao. Descreva algo concreto que voce vai aplicar.
              </p>
              <textarea
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                placeholder="Ex: Vou aplicar a tecnica X na proxima reuniao com minha equipe..."
                rows={5}
                className="w-full resize-none rounded-xl border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-semantic-success/50 focus:outline-none focus:ring-2 focus:ring-semantic-success/20 transition-all"
                // biome-ignore lint/a11y/noAutofocus: wizard step transition UX
                autoFocus
              />
              <p className="mt-2 text-xs text-text-muted">
                Opcional, mas recomendado. A acao transforma conhecimento em competencia.
              </p>
            </div>
          )}

          {/* Step 3: Summary + Certificate */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8 text-center">
                <h2 className="mb-2 text-xl font-semibold text-text-primary md:text-2xl">
                  Sua jornada completa
                </h2>
                <p className="text-sm text-text-muted">Resumo da sua evolucao ao longo do curso.</p>
              </div>

              <div className="space-y-4">
                {/* Evolution card */}
                {preResponse?.selfRating && newRating && (
                  <div className="rounded-xl border border-semantic-success/20 bg-gradient-to-br from-semantic-success/5 to-transparent p-5">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
                      Evolucao
                    </p>
                    <div className="flex items-center justify-center gap-6">
                      <div className="text-center">
                        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated text-lg font-bold text-text-muted">
                          {preResponse.selfRating}
                        </div>
                        <p className="text-xs text-text-muted">Antes</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-semantic-success" />
                      <div className="text-center">
                        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-semantic-success/15 text-lg font-bold text-semantic-success">
                          {newRating}
                        </div>
                        <p className="text-xs text-semantic-success">Depois</p>
                      </div>
                      {ratingDelta !== null && ratingDelta > 0 && (
                        <div className="ml-4 rounded-lg bg-semantic-success/10 px-3 py-1.5 text-sm font-bold text-semantic-success">
                          +{ratingDelta}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {commitment.trim() && (
                  <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
                    <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-muted">
                      Seu compromisso
                    </p>
                    <p className="text-sm text-text-primary">{commitment}</p>
                  </div>
                )}

                <div className="rounded-xl border border-cerrado-600/15 bg-cerrado-600/5 p-5 text-center">
                  <p className="text-sm text-text-secondary">
                    Seu certificado esta pronto. Clique abaixo para visualiza-lo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={handleBack} disabled={isPending}>
              <ArrowLeft size={16} className="mr-1.5" />
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button onClick={handleNext} disabled={step === 1 && newRating === null}>
              Proximo
              <ArrowRight size={16} className="ml-1.5" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Salvando..." : "Ver meu certificado"}
              <Award size={16} className="ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
