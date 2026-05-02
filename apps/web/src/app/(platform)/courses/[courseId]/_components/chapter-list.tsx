"use client"

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  Button,
  EmptyState,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { deleteChapter, reorderChapters, toggleChapterStatus } from "../chapters/actions"
import { ChapterListItem } from "./chapter-list-item"

interface Chapter {
  id: string
  title: string
  status: string
  order: number
}

interface ChapterListProps {
  courseId: string
  chapters: Chapter[]
  pendingPerChapter?: Record<string, number>
}

export function ChapterList({ courseId, chapters: initialChapters, pendingPerChapter = {} }: ChapterListProps) {
  const [chapters, setChapters] = useState(initialChapters)
  useEffect(() => { setChapters(initialChapters) }, [initialChapters])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = chapters.findIndex((c) => c.id === active.id)
    const newIndex = chapters.findIndex((c) => c.id === over.id)

    const reordered = arrayMove(chapters, oldIndex, newIndex)
    const withNewOrder = reordered.map((c, i) => ({ ...c, order: i }))

    setChapters(withNewOrder)

    startTransition(async () => {
      const result = await reorderChapters(
        courseId,
        withNewOrder.map((c) => ({ id: c.id, order: c.order })),
      )
      if (result.error) {
        toast({ variant: "error", title: result.error })
        setChapters(initialChapters)
      }
    })
  }

  function handleEdit(chapterId: string) {
    router.push(`/courses/${courseId}/chapters/${chapterId}/edit`)
  }

  function handleToggleStatus(chapterId: string) {
    startTransition(async () => {
      const result = await toggleChapterStatus(chapterId, courseId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({
        variant: "success",
        title: result.status === "published" ? "Capítulo publicado" : "Capítulo despublicado",
      })
      router.refresh()
    })
  }

  function handleDelete(chapterId: string) {
    setDeletingId(chapterId)
  }

  function confirmDelete() {
    if (!deletingId) return
    startTransition(async () => {
      const result = await deleteChapter(deletingId, courseId)
      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }
      toast({ variant: "success", title: "Capítulo excluido" })
      setDeletingId(null)
      router.refresh()
    })
  }

  function handleViewQuestions(chapterId: string) {
    router.push(`/courses/${courseId}/chapters/${chapterId}/questions`)
  }

  if (chapters.length === 0) {
    return (
      <EmptyState
        title="Nenhum capítulo"
        description="Adicione capítulos para estruturar o conteúdo do curso."
        actionLabel="Adicionar Capítulo"
        onAction={() => router.push(`/courses/${courseId}/chapters/new`)}
      />
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Capítulos</h2>
        <Button onClick={() => router.push(`/courses/${courseId}/chapters/new`)}>
          Adicionar Capítulo
        </Button>
      </div>

      <DndContext id="chapter-list-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {chapters.map((chapter, index) => (
              <ChapterListItem
                key={chapter.id}
                id={chapter.id}
                title={chapter.title}
                status={chapter.status}
                index={index}
                courseId={courseId}
                pendingQuestions={pendingPerChapter[chapter.id] ?? 0}
                onEdit={handleEdit}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                onViewQuestions={handleViewQuestions}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Delete confirmation */}
      <Modal open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <ModalOverlay />
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Excluir Capítulo</ModalTitle>
            <ModalDescription>
              Excluir capítulo tambem remove todas as perguntas associadas. Esta acao nao pode ser
              desfeita.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
