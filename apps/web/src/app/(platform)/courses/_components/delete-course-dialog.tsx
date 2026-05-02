"use client"

import {
  Button,
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
import { useTransition } from "react"
import { deleteCourse } from "../actions"

interface DeleteCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  courseTitle: string
}

export function DeleteCourseDialog({
  open,
  onOpenChange,
  courseId,
  courseTitle,
}: DeleteCourseDialogProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCourse(courseId)

      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }

      toast({ variant: "success", title: "Curso excluido com sucesso" })
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Excluir Curso</ModalTitle>
          <ModalDescription>
            Tem certeza que deseja excluir o curso &ldquo;{courseTitle}&rdquo;? Esta acao nao pode
            ser desfeita.
          </ModalDescription>
        </ModalHeader>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
