"use client"

import { useToast } from "@eximia/ui"
import { cn } from "@eximia/ui"
import { ArrowRight, Check, Sparkles, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { saveConsciousnessResponse } from "./actions"

/* ------------------------------------------------------------------ */
/*  Course-specific content                                            */
/* ------------------------------------------------------------------ */

interface ConsciousnessContent {
  introText: string
  introSubtext: string
  challengeQuestion: string
  challengePlaceholder: string
  ratingQuestion: string
  ratingLabels: Record<number, string>
  ratingDescriptions: Record<number, string>
  goalQuestion: string
  goalPlaceholder: string
  summaryTitle: string
}

const DEFAULT_CONTENT: ConsciousnessContent = {
  introText: "Antes de começar, vamos entender de onde você está partindo.",
  introSubtext: "São apenas 3 perguntas rápidas. Não existe resposta certa ou errada.",
  challengeQuestion: "Qual o maior desafio que você enfrenta nessa área?",
  challengePlaceholder: "Descreva uma situação real do seu dia a dia...",
  ratingQuestion: "De 1 a 5, quão preparado você se sente para lidar com esse desafio?",
  ratingLabels: { 1: "Iniciante", 2: "Básico", 3: "Intermediário", 4: "Avançado", 5: "Expert" },
  ratingDescriptions: {
    1: "Nunca tive contato com esse tema",
    2: "Conheço o básico, mas tenho dúvidas",
    3: "Tenho alguma experiência prática",
    4: "Me sinto confiante na maioria das situações",
    5: "Domino o tema e ensino outros",
  },
  goalQuestion: "O que você espera saber fazer ao final deste curso?",
  goalPlaceholder: "Pense em algo concreto que gostaria de aplicar...",
  summaryTitle: "Sua jornada começa aqui",
}

/**
 * Keys: normalized with removeDiacritics so "Análise e Solução" matches "analise e solucao".
 */
const COURSE_CONTENT_MAP: Record<string, Partial<ConsciousnessContent>> = {
  "analise e solucao de problemas": {
    introText: "Resolver problemas faz parte do seu dia a dia. Mas você já parou para pensar em COMO você resolve problemas?",
    introSubtext: "Vamos mapear seu ponto de partida. 3 perguntas rápidas — sem resposta certa ou errada.",
    challengeQuestion: "Pense num problema real do seu trabalho que você tentou resolver recentemente. O que aconteceu?",
    challengePlaceholder: "Ex: Um equipamento quebrou e a equipe não sabia por onde começar a investigar a causa...",
    ratingQuestion: "Quando um problema aparece no seu trabalho, quão confiante você se sente para analisá-lo de forma estruturada?",
    ratingLabels: { 1: "Reativo", 2: "Intuitivo", 3: "Estruturado", 4: "Analítico", 5: "Referência" },
    ratingDescriptions: {
      1: "Costumo apagar incêndios sem entender a causa raiz",
      2: "Resolvo pela experiência, mas sem método definido",
      3: "Já uso algumas ferramentas (5 Porquês, Ishikawa...)",
      4: "Analiso causas, priorizo e documento as soluções",
      5: "Ensino outros a resolver problemas de forma estruturada",
    },
    goalQuestion: "Ao final deste curso, que tipo de problema você gostaria de resolver com mais confiança?",
    goalPlaceholder: "Ex: Quero conseguir identificar a causa raiz de falhas de qualidade sem depender de tentativa e erro...",
    summaryTitle: "Seu diagnóstico está pronto",
  },
}

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

function resolveContent(courseTitle: string): ConsciousnessContent {
  const key = removeDiacritics(courseTitle)
  const custom = COURSE_CONTENT_MAP[key]
  return custom ? { ...DEFAULT_CONTENT, ...custom } : DEFAULT_CONTENT
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ConsciousnessWizardPageProps {
  courseId: string
  courseTitle: string
  courseDescription: string | null
}

export function ConsciousnessWizardPage({ courseId, courseTitle, courseDescription }: ConsciousnessWizardPageProps) {
  const c = resolveContent(courseTitle)
  const [step, setStep] = useState(0)
  const [challenge, setChallenge] = useState("")
  const [rating, setRating] = useState<number | null>(null)
  const [goal, setGoal] = useState("")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const canAdvance = step === 0 || (step === 1 && challenge.trim().length >= 20) || (step === 2 && rating !== null) || (step === 3 && goal.trim().length >= 20) || step === 4

  function go(dir: 1 | -1) { setStep((s) => Math.max(0, Math.min(4, s + dir))) }

  function submit() {
    startTransition(async () => {
      const res = await saveConsciousnessResponse({ courseId, phase: "pre", challengeText: challenge.trim(), selfRating: rating ?? undefined, learningGoal: goal.trim() })
      if (res.error) { toast({ variant: "error", title: res.error }); return }
      router.push(`/courses/${courseId}`)
    })
  }

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center p-4">
      {/* Backdrop — dark overlay, click to close */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      <div className="absolute inset-0 bg-black/50" onClick={() => router.push("/courses")} />

      {/* Card — Apple style */}
      <div className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-[28px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
        {/* Close */}
        <div className="flex justify-end px-5 pt-5">
          <button type="button" onClick={() => router.push("/courses")} className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600">
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 pb-2">
          {/* Step 0 — Intro */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cerrado-600/10">
                <Sparkles className="h-7 w-7 text-cerrado-600" />
              </div>
              <h1 className="text-[21px] font-bold tracking-tight text-stone-900">{courseTitle}</h1>
              {courseDescription && <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">{courseDescription}</p>}
              <div className="mt-5 w-full rounded-2xl bg-stone-50 px-5 py-4 text-center">
                <p className="text-[13px] font-medium leading-relaxed text-stone-700">{c.introText}</p>
                <p className="mt-1 text-[11px] text-stone-400">{c.introSubtext}</p>
              </div>
            </div>
          )}

          {/* Step 1 — Desafio */}
          {step === 1 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-cerrado-600">Pergunta 1 de 3</p>
              <h2 className="mb-4 text-[17px] font-semibold leading-snug text-stone-900">{c.challengeQuestion}</h2>
              <textarea value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder={c.challengePlaceholder} rows={4} className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[14px] text-stone-800 placeholder:text-stone-400 focus:border-cerrado-600 focus:outline-none focus:ring-2 focus:ring-cerrado-600/20" autoFocus />
              <p className={cn("mt-1.5 text-[11px]", challenge.trim().length >= 20 ? "text-emerald-500 font-medium" : "text-stone-400")}>{challenge.trim().length >= 20 ? "✓ Ótimo!" : `${challenge.trim().length}/20 caracteres`}</p>
            </div>
          )}

          {/* Step 2 — Rating */}
          {step === 2 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-cerrado-600">Pergunta 2 de 3</p>
              <h2 className="mb-4 text-[17px] font-semibold leading-snug text-stone-900">{c.ratingQuestion}</h2>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} className={cn("flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all", rating === n ? "bg-cerrado-600 shadow-lg shadow-cerrado-600/25" : "bg-stone-50 hover:bg-stone-100")}>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold", rating === n ? "bg-white/25 text-white" : "bg-white text-stone-500 shadow-sm")}>{n}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[13px] font-semibold", rating === n ? "text-white" : "text-stone-800")}>{c.ratingLabels[n]}</p>
                      <p className={cn("text-[11px] leading-tight", rating === n ? "text-white/75" : "text-stone-400")}>{c.ratingDescriptions[n]}</p>
                    </div>
                    {rating === n && <Check className="h-4 w-4 shrink-0 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Meta */}
          {step === 3 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-cerrado-600">Pergunta 3 de 3</p>
              <h2 className="mb-4 text-[17px] font-semibold leading-snug text-stone-900">{c.goalQuestion}</h2>
              <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={c.goalPlaceholder} rows={4} className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-[14px] text-stone-800 placeholder:text-stone-400 focus:border-cerrado-600 focus:outline-none focus:ring-2 focus:ring-cerrado-600/20" autoFocus />
              <p className={cn("mt-1.5 text-[11px]", goal.trim().length >= 20 ? "text-emerald-500 font-medium" : "text-stone-400")}>{goal.trim().length >= 20 ? "✓ Ótimo!" : `${goal.trim().length}/20 caracteres`}</p>
            </div>
          )}

          {/* Step 4 — Resumo */}
          {step === 4 && (
            <div>
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h2 className="text-[17px] font-semibold text-stone-900">{c.summaryTitle}</h2>
                <p className="mt-0.5 text-[11px] text-stone-400">Revisitaremos ao final do curso.</p>
              </div>

              {/* Summary card */}
              <div className="overflow-hidden rounded-2xl border border-stone-100">
                {/* Desafio */}
                <div className="border-b border-stone-100 px-5 py-4">
                  <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Seu desafio</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-stone-700">{challenge}</p>
                  </div>
                </div>

                {/* Nível */}
                <div className="flex items-center gap-4 border-b border-stone-100 bg-cerrado-600/[0.03] px-5 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cerrado-600 text-lg font-bold text-white shadow-sm">{rating}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Nível atual</p>
                    <p className="text-[15px] font-semibold text-stone-800">{c.ratingLabels[rating as number]}</p>
                    <p className="text-[11px] text-stone-400">{c.ratingDescriptions[rating as number]}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="px-5 py-4">
                  <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Sua meta</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-stone-700">{goal}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 pb-7 pt-5">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn("h-[6px] rounded-full transition-all duration-500", i === step ? "w-7 bg-cerrado-600" : i < step ? "w-[6px] bg-cerrado-600/40" : "w-[6px] bg-stone-200")} />
            ))}
          </div>
          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => go(-1)} disabled={isPending} className="rounded-full px-4 py-2.5 text-[13px] font-medium text-stone-500 transition hover:text-stone-800 disabled:opacity-40">
                Voltar
              </button>
            )}
            {step < 4 ? (
              <button type="button" onClick={() => go(1)} disabled={!canAdvance} className="rounded-full bg-stone-900 px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-30">
                {step === 0 ? "Começar" : "Próximo"}
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={isPending} className="rounded-full bg-stone-900 px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-30">
                {isPending ? "Salvando..." : "Iniciar curso →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
