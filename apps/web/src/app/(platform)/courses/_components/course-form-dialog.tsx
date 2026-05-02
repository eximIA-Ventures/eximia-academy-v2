"use client"

import {
  Button,
  FormField,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  Textarea,
  useToast,
} from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { createCourse, updateCourse } from "../actions"

interface CourseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  course?: {
    id: string
    title: string
    description?: string | null
    type?: string
    cover_image_url?: string | null
    deadline_days?: number | null
  }
}

export function CourseFormDialog({ open, onOpenChange, course }: CourseFormDialogProps) {
  const isEditing = !!course
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const action = isEditing ? updateCourse : createCourse
      const result = await action(formData)

      if (result.error) {
        toast({ variant: "error", title: result.error })
        return
      }

      toast({
        variant: "success",
        title: isEditing ? "Curso atualizado com sucesso" : "Curso criado com sucesso",
      })
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>{isEditing ? "Editar Curso" : "Criar Curso"}</ModalTitle>
          <ModalDescription>
            {isEditing
              ? "Atualize as informações do curso."
              : "Preencha as informações para criar um novo curso."}
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isEditing && <input type="hidden" name="id" value={course.id} />}

          <FormField label="Título" htmlFor="title" required error={errors.title}>
            <Input
              id="title"
              name="title"
              placeholder="Ex: Fundamentos de Inteligência Artificial"
              defaultValue={course?.title ?? ""}
              required
              minLength={10}
            />
          </FormField>

          <FormField label="Descrição" htmlFor="description" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              placeholder="Descreva o objetivo e conteúdo do curso..."
              rows={3}
              defaultValue={course?.description ?? ""}
            />
          </FormField>

          <FormField label="Tipo" htmlFor="type">
            <Select id="type" name="type" defaultValue={course?.type ?? "regular"}>
              <option value="regular">Regular</option>
              <option value="onboarding">Onboarding Corporativo</option>
            </Select>
          </FormField>

          <FormField label="Prazo de Conclusão (dias)" htmlFor="deadline_days">
            <Input
              id="deadline_days"
              name="deadline_days"
              type="number"
              min={1}
              max={365}
              placeholder="Ex: 14"
              defaultValue={course?.deadline_days ?? ""}
            />
          </FormField>

          <FormField label="Imagem de Capa (URL)" htmlFor="cover_image_url" error={errors.cover_image_url}>
            <Input
              id="cover_image_url"
              name="cover_image_url"
              type="url"
              placeholder="https://images.unsplash.com/..."
              defaultValue={course?.cover_image_url ?? ""}
            />
          </FormField>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar Curso"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
