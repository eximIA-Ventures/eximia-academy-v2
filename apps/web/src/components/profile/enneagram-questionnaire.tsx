"use client"

import { saveAssessmentProgress, saveAssessmentResult } from "@/app/(platform)/perfil/actions"
import { Button } from "@eximia/ui"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { type EnneagramResult, scoreEnneagram } from "./scoring"

export type { EnneagramResult }
export { scoreEnneagram }

const ENNEAGRAM_PARAGRAPHS = [
  { typeNumber: 1, text: "Valorizo princípios e integridade. Procuro fazer a coisa certa e tenho altos padrões para mim e para os outros. Sou organizado, responsável e busco a excelência em tudo que faço." },
  { typeNumber: 2, text: "Sou caloroso e atencioso com as pessoas ao meu redor. Gosto de ajudar os outros e me sinto realizado quando percebo que fiz diferença na vida de alguém. Relacionamentos são muito importantes para mim." },
  { typeNumber: 3, text: "Sou orientado a resultados e gosto de ter sucesso. Trabalho duro para alcançar meus objetivos e me adapto facilmente a diferentes situações. Valorizo eficiência e realização." },
  { typeNumber: 4, text: "Sou uma pessoa sensível e criativa. Busco autenticidade e profundidade em tudo que faço. Tenho um mundo interior rico e valorizo a expressão das minhas emoções e individualidade." },
  { typeNumber: 5, text: "Sou curioso e observador. Gosto de entender como as coisas funcionam e valorizo conhecimento e competência. Preciso de tempo sozinho para processar informações e recarregar energias." },
  { typeNumber: 6, text: "Sou leal e responsável. Valorizo segurança e previsibilidade. Sou bom em antecipar problemas e me preparar para situações difíceis. Compromisso e confiança são fundamentais para mim." },
  { typeNumber: 7, text: "Sou entusiasta e otimista. Gosto de novas experiências e possibilidades. Tenho muita energia e ideias, e prefiro manter as opções em aberto. Busco alegria e satisfação na vida." },
  { typeNumber: 8, text: "Sou direto e decidido. Gosto de assumir o controle e proteger as pessoas ao meu redor. Valorizo força, justiça e independência. Não tenho medo de enfrentar desafios." },
  { typeNumber: 9, text: "Sou pacífico e compreensivo. Busco harmonia e evito conflitos. Consigo ver diferentes perspectivas e valorizo a estabilidade. Sou paciente e aceito as pessoas como elas são." },
]

interface EnneagramQuestionnaireProps {
  userId: string
  savedProgress?: { answers: Record<string, number> }
  onComplete: (result: EnneagramResult) => void
  onBack: () => void
}

export function EnneagramQuestionnaire({ userId, savedProgress, onComplete, onBack }: EnneagramQuestionnaireProps) {
  const [ranking, setRanking] = useState<number[]>(() => {
    if (!savedProgress?.answers) return []
    // Restore ranking from saved progress (answers stored as { position: typeNumber })
    const entries = Object.entries(savedProgress.answers)
      .map(([pos, type]) => ({ pos: Number(pos), type }))
      .sort((a, b) => a.pos - b.pos)
    return entries.map((e) => e.type)
  })

  const isComplete = ranking.length === 9

  const saveProgress = useCallback(async () => {
    if (ranking.length === 0) return
    const answers: Record<string, number> = {}
    ranking.forEach((type, index) => {
      answers[String(index)] = type
    })
    await saveAssessmentProgress({
      type: "enneagram",
      progress: { answers, completed: false as const },
    })
  }, [ranking])

  useEffect(() => {
    const handler = () => { saveProgress() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [saveProgress])

  const handleToggle = (typeNumber: number) => {
    setRanking((prev) => {
      if (prev.includes(typeNumber)) {
        return prev.filter((t) => t !== typeNumber)
      }
      const updated = [...prev, typeNumber]
      // Auto-save every 3 selections
      if (updated.length % 3 === 0) {
        const answers: Record<string, number> = {}
        updated.forEach((type, index) => { answers[String(index)] = type })
        saveAssessmentProgress({ type: "enneagram", progress: { answers, completed: false as const } })
      }
      return updated
    })
  }

  const handleSubmit = async () => {
    const result = scoreEnneagram(ranking)
    await saveAssessmentResult({ type: "enneagram", result })
    onComplete(result)
  }

  const getRankPosition = (typeNumber: number): number | null => {
    const index = ranking.indexOf(typeNumber)
    return index >= 0 ? index + 1 : null
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-bold text-text-primary">Eneagrama</h2>
      </div>

      <p className="mb-2 text-sm text-text-secondary">
        Leia cada parágrafo e clique neles na ordem de quanto você se identifica:
        o primeiro clique indica o parágrafo com que você MAIS se identifica.
      </p>
      <p className="mb-6 text-xs text-text-muted">
        {ranking.length} de 9 ordenados. Clique novamente para remover.
      </p>

      <div className="space-y-3">
        {ENNEAGRAM_PARAGRAPHS.map((para) => {
          const position = getRankPosition(para.typeNumber)
          const isRanked = position !== null
          return (
            <button
              key={para.typeNumber}
              type="button"
              onClick={() => handleToggle(para.typeNumber)}
              className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                isRanked
                  ? "border-cerrado-600 bg-cerrado-600/5"
                  : "border-border-medium bg-bg-card hover:border-border-light"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isRanked
                      ? "bg-cerrado-600 text-white"
                      : "bg-bg-surface text-text-muted"
                  }`}
                >
                  {isRanked ? position : "?"}
                </div>
                <p className="text-sm text-text-primary">{para.text}</p>
              </div>
            </button>
          )
        })}
      </div>

      {isComplete && (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit}>Ver Resultado</Button>
        </div>
      )}
    </div>
  )
}
