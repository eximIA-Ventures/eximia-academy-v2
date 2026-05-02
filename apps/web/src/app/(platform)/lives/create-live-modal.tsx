"use client"

import {
  Button,
  Input,
  Label,
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Textarea,
} from "@eximia/ui"
import { useState, useTransition } from "react"
import { createLiveEvent } from "./actions"

interface CreateLiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateLiveModal({ open, onOpenChange }: CreateLiveModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = new FormData(e.currentTarget)
    const title = form.get("title") as string
    const description = form.get("description") as string
    const hostName = form.get("hostName") as string
    const date = form.get("date") as string
    const time = form.get("time") as string
    const meetingUrl = form.get("meetingUrl") as string
    const maxParticipants = form.get("maxParticipants") as string

    if (!title || !hostName || !date || !time) {
      setError("Preencha os campos obrigatórios")
      return
    }

    const scheduledAt = new Date(`${date}T${time}`).toISOString()

    startTransition(async () => {
      const result = await createLiveEvent({
        title,
        description: description || undefined,
        hostName,
        scheduledAt,
        meetingUrl: meetingUrl || undefined,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
      })

      if (result.error) {
        setError(result.error)
      } else {
        onOpenChange(false)
      }
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent size="lg">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <ModalTitle>Nova Live</ModalTitle>
            <ModalClose />
          </div>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" name="title" placeholder="Ex: Workshop de Liderança" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Sobre o que será a live..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hostName">Apresentador *</Label>
            <Input id="hostName" name="hostName" placeholder="Nome do apresentador" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" name="date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Horário *</Label>
              <Input id="time" name="time" type="time" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meetingUrl">Link da reunião</Label>
            <Input
              id="meetingUrl"
              name="meetingUrl"
              placeholder="https://meet.google.com/..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxParticipants">Máx. participantes</Label>
            <Input
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min={1}
              placeholder="Sem limite"
            />
          </div>

          {error && (
            <p className="text-sm text-semantic-error">{error}</p>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando..." : "Criar Live"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
