"use client"

import type { OrganizerOutput } from "@eximia/agents"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Textarea,
  useToast,
} from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface ChapterPreviewProps {
  courseId: string
  ingestionId: string
  output: OrganizerOutput
  onOutputChange: (output: OrganizerOutput) => void
  onBack: () => void
}

export function ChapterPreview({
  courseId,
  ingestionId,
  output,
  onOutputChange,
  onBack,
}: ChapterPreviewProps) {
  const chapter = output.chapters[0]

  if (!chapter) {
    return (
      <div className="rounded-md border border-semantic-error/30 bg-semantic-error/10 p-4 text-sm text-semantic-error">
        A IA não conseguiu gerar um capítulo a partir deste conteúdo. Tente novamente com
        instruções diferentes.
      </div>
    )
  }

  const [title, setTitle] = useState(chapter.title)
  const [learningObjective, setLearningObjective] = useState(chapter.learning_objective)
  const [isApproving, setIsApproving] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [regenInstructions, setRegenInstructions] = useState("")
  const { toast } = useToast()
  const router = useRouter()

  async function handleApprove() {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/ingestion/${ingestionId}/approve-chapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: chapter.content,
          learning_objective: learningObjective,
          key_concepts: chapter.key_concepts,
          estimated_reading_time_min: chapter.estimated_reading_time_min,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ variant: "error", title: data.error || "Erro ao criar capítulo." })
        return
      }

      toast({ variant: "success", title: "Capítulo criado com sucesso!" })
      router.push(`/courses/${data.courseId}`)
    } catch {
      toast({ variant: "error", title: "Erro de conexão. Tente novamente." })
    } finally {
      setIsApproving(false)
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true)
    setShowRegenModal(false)

    try {
      const res = await fetch(`/api/ingestion/${ingestionId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: regenInstructions || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ variant: "error", title: data.error || "Erro ao regenerar." })
        return
      }

      if (data.output) {
        onOutputChange(data.output)
        const newChapter = data.output.chapters[0]
        setTitle(newChapter.title)
        setLearningObjective(newChapter.learning_objective)
        toast({ variant: "success", title: "Capítulo regenerado com sucesso!" })
      }
    } catch {
      toast({ variant: "error", title: "Erro de conexão. Tente novamente." })
    } finally {
      setIsRegenerating(false)
      setRegenInstructions("")
    }
  }

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {output.warnings && output.warnings.length > 0 && (
        <div className="rounded-md border border-semantic-warning/30 bg-semantic-warning/10 p-3">
          {output.warnings.map((w) => (
            <p key={w} className="text-sm text-semantic-warning">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="chapter-title"
          className="mb-1 block text-sm font-medium text-text-secondary"
        >
          Título do Capítulo
        </label>
        <Input
          id="chapter-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold"
        />
      </div>

      {/* Learning Objective */}
      <div>
        <label
          htmlFor="chapter-objective"
          className="mb-1 block text-sm font-medium text-text-secondary"
        >
          Objetivo de Aprendizagem
        </label>
        <Textarea
          id="chapter-objective"
          value={learningObjective}
          onChange={(e) => setLearningObjective(e.target.value)}
          rows={2}
        />
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{chapter.estimated_reading_time_min} min de leitura</Badge>
        {chapter.key_concepts.map((concept) => (
          <Badge key={concept} variant="info">
            {concept}
          </Badge>
        ))}
      </div>

      {/* Content */}
      <Accordion type="single" defaultValue="content">
        <AccordionItem value="content" className="rounded-lg border border-bg-elevated">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-text-primary">
            Conteúdo do Capítulo
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="prose prose-sm prose-invert max-h-96 overflow-y-auto text-sm text-text-secondary">
              {chapter.content.split("\n").map((line, i) => (
                <p key={`line-${i}`}>{line || "\u00A0"}</p>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bg-elevated pt-4">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowRegenModal(true)}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Regenerando..." : "Regenerar"}
          </Button>
          <Button onClick={handleApprove} disabled={isApproving || !title.trim()}>
            {isApproving ? "Criando capítulo..." : "Criar Capítulo"}
          </Button>
        </div>
      </div>

      {/* Regenerate Modal */}
      <Modal open={showRegenModal} onOpenChange={setShowRegenModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Regenerar Capítulo</ModalTitle>
            <ModalDescription>
              Adicione instruções para a IA reorganizar o conteúdo de forma diferente.
            </ModalDescription>
          </ModalHeader>
          <div className="mt-4">
            <Textarea
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
              placeholder="Ex: Foque mais na parte prática, simplifique a linguagem, adicione mais exemplos..."
              rows={4}
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowRegenModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegenerate}>Regenerar com IA</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
