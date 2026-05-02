"use client"

import { useRouter } from "next/navigation"
"use client"

import type { OrganizerOutput } from "@eximia/agents"
import {
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
import { useMemo, useState } from "react"
import { ChapterPreviewCard } from "./chapter-preview-card"

type ChapterWithModule = OrganizerOutput["chapters"][number] & { module_title?: string }

interface CoursePreviewProps {
  ingestionId: string
  output: OrganizerOutput
  onOutputChange: (output: OrganizerOutput) => void
  onBack: () => void
}

export function CoursePreview({ ingestionId, output, onOutputChange, onBack }: CoursePreviewProps) {
  const router = useRouter()
  const [title, setTitle] = useState(output.suggested_title)
  const [description, setDescription] = useState(output.suggested_description)
  const [isApproving, setIsApproving] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [showRegenModal, setShowRegenModal] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [regenInstructions, setRegenInstructions] = useState("")
  const { toast } = useToast()

  function handleDeleteChapter(index: number) {
    if (output.chapters.length <= 1) {
      toast({ variant: "error", title: "O curso deve ter pelo menos 1 capítulo." })
      return
    }
    const newChapters = output.chapters.filter((_, i) => i !== index)
    onOutputChange({
      ...output,
      chapters: newChapters.map((ch, i) => ({ ...ch, order: i })),
      metadata: { ...output.metadata, total_chapters: newChapters.length },
    })
  }

  function handleUpdateChapter(index: number, updates: Partial<(typeof output.chapters)[0]>) {
    const newChapters = [...output.chapters]
    newChapters[index] = { ...newChapters[index], ...updates }
    onOutputChange({ ...output, chapters: newChapters })
  }

  function handleMoveChapter(from: number, to: number) {
    if (to < 0 || to >= output.chapters.length) return
    const newChapters = [...output.chapters]
    const [moved] = newChapters.splice(from, 1)
    newChapters.splice(to, 0, moved)
    onOutputChange({
      ...output,
      chapters: newChapters.map((ch, i) => ({ ...ch, order: i })),
    })
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/ingestion/${ingestionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, chapters: output.chapters }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast({ variant: "error", title: data.error || "Erro ao criar curso." })
        return
      }

      toast({ variant: "success", title: `Curso criado com ${data.chaptersCreated} capítulos!` })
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
      // Reset ingestion to processing status first
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
        setTitle(data.output.suggested_title)
        setDescription(data.output.suggested_description)
        toast({ variant: "success", title: "Conteúdo reorganizado com sucesso!" })
      }
    } catch {
      toast({ variant: "error", title: "Erro de conexão. Tente novamente." })
    } finally {
      setIsRegenerating(false)
      setRegenInstructions("")
    }
  }

  async function handleDiscard() {
    setIsDiscarding(true)
    try {
      const res = await fetch(`/api/ingestion/${ingestionId}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        const data = await res.json()
        toast({ variant: "error", title: data.error || "Erro ao descartar." })
        return
      }
      toast({ variant: "success", title: "Conteúdo descartado." })
      router.push("/courses")
    } catch {
      toast({ variant: "error", title: "Erro de conexão." })
    } finally {
      setIsDiscarding(false)
      setShowDiscardConfirm(false)
    }
  }

  const complexityLabel: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
  }

  // Count unique modules for the metadata badges
  const moduleNames = useMemo(() => {
    const names = new Set<string>()
    for (const ch of output.chapters) {
      const mod = (ch as ChapterWithModule).module_title
      if (mod) names.add(mod)
    }
    return names
  }, [output.chapters])

  const hasModules = moduleNames.size > 0

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

      {/* Title & Description */}
      <div className="space-y-3">
        <div>
          <label
            htmlFor="course-title"
            className="mb-1 block text-sm font-medium text-text-secondary"
          >
            Título do Curso
          </label>
          <Input
            id="course-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold"
          />
        </div>
        <div>
          <label
            htmlFor="course-desc"
            className="mb-1 block text-sm font-medium text-text-secondary"
          >
            Descrição
          </label>
          <Textarea
            id="course-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{output.chapters.length} capítulos</Badge>
        {hasModules && <Badge variant="default">{moduleNames.size} módulos</Badge>}
        <Badge variant="default">
          Complexidade:{" "}
          {complexityLabel[output.metadata.content_complexity] ||
            output.metadata.content_complexity}
        </Badge>
        {output.metadata.main_topics.map((topic) => (
          <Badge key={topic} variant="info">
            {topic}
          </Badge>
        ))}
        {output.metadata.suggested_area && (
          <Badge variant="info">{output.metadata.suggested_area}</Badge>
        )}
      </div>

      {/* Chapters — grouped by module when available */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          {hasModules ? "Módulos & Capítulos" : "Capítulos"}
        </h3>
        <div className="space-y-3">
          {output.chapters.map((chapter, i) => {
            const currentModule = (chapter as ChapterWithModule).module_title
            const prevModule =
              i > 0 ? (output.chapters[i - 1] as ChapterWithModule).module_title : undefined
            const isNewModule = hasModules && currentModule && currentModule !== prevModule

            // Count chapters in this module for the badge
            const moduleChapterCount = currentModule
              ? output.chapters.filter(
                  (ch) => (ch as ChapterWithModule).module_title === currentModule,
                ).length
              : 0

            return (
              <div key={`${chapter.order}-${chapter.title}`}>
                {isNewModule && (
                  <div className="mt-4 mb-2 flex items-center gap-2 first:mt-0">
                    <div className="h-px flex-1 bg-bg-elevated" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      {currentModule}
                    </span>
                    <Badge variant="default" className="text-xs">
                      {moduleChapterCount}
                    </Badge>
                    <div className="h-px flex-1 bg-bg-elevated" />
                  </div>
                )}
                <ChapterPreviewCard
                  chapter={chapter}
                  index={i}
                  total={output.chapters.length}
                  onUpdate={(updates) => handleUpdateChapter(i, updates)}
                  onDelete={() => handleDeleteChapter(i)}
                  onMoveUp={() => handleMoveChapter(i, i - 1)}
                  onMoveDown={() => handleMoveChapter(i, i + 1)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bg-elevated pt-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Voltar
          </Button>
          <Button variant="outline" onClick={() => setShowDiscardConfirm(true)}>
            Descartar
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowRegenModal(true)}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Regenerando..." : "Regenerar"}
          </Button>
          <Button onClick={handleApprove} disabled={isApproving || !title.trim()}>
            {isApproving ? "Criando curso..." : "Criar Curso"}
          </Button>
        </div>
      </div>

      {/* Regenerate Modal */}
      <Modal open={showRegenModal} onOpenChange={setShowRegenModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Regenerar Conteúdo</ModalTitle>
            <ModalDescription>
              Adicione instruções para a IA reorganizar o conteúdo de forma diferente.
            </ModalDescription>
          </ModalHeader>
          <div className="mt-4">
            <Textarea
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
              placeholder="Ex: Divida em mais capítulos, foque na parte prática, combine os capítulos 3 e 4..."
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

      {/* Discard Confirmation Modal */}
      <Modal open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Descartar conteúdo?</ModalTitle>
            <ModalDescription>
              Todo o conteúdo processado será perdido. Esta ação não pode ser desfeita.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? "Descartando..." : "Descartar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
