"use client"

import { analytics } from "@/lib/analytics"
import {
  Button,
  Input,
  Label,
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
} from "@eximia/ui"
import { type FormEvent, useCallback, useState } from "react"

/* --------------------------------- Types --------------------------------- */

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/* ------------------------------- Component ------------------------------- */

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("student")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const resetForm = useCallback(() => {
    setEmail("")
    setFullName("")
    setRole("student")
    setError(null)
    setSuccess(false)
  }, [])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    },
    [onOpenChange, resetForm],
  )

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      setSubmitting(true)

      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, full_name: fullName, role }),
        })

        if (!res.ok) {
          const json = await res.json()
          const msg = typeof json.error === "string" ? json.error : "Erro ao enviar convite."
          throw new Error(msg)
        }

        setSuccess(true)
        analytics.userInvited(role)
        onSuccess()

        // Close dialog after brief success feedback
        setTimeout(() => {
          handleClose(false)
        }, 1200)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido"
        setError(message)
      } finally {
        setSubmitting(false)
      }
    },
    [email, fullName, role, onSuccess, handleClose],
  )

  return (
    <Modal open={open} onOpenChange={handleClose}>
      <ModalOverlay />
      <ModalContent size="md">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <ModalTitle>Convidar Usuário</ModalTitle>
            <ModalClose />
          </div>
          <ModalDescription>
            Envie um convite por email para adicionar um novo usuário ao tenant.
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="invite-name" required>
              Nome completo
            </Label>
            <Input
              id="invite-name"
              placeholder="Ex: Maria Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="invite-email" required>
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="invite-role" required>
              Papel
            </Label>
            <Select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={submitting}
            >
              <option value="student">Estudante</option>
              <option value="instructor">Instrutor</option>
              <option value="manager">Gestor</option>
              <option value="admin">Administrador</option>
            </Select>
          </div>

          {/* Error message */}
          {error && <p className="text-sm text-semantic-error">{error}</p>}

          {/* Success message */}
          {success && <p className="text-sm text-semantic-success">Convite enviado com sucesso!</p>}

          <ModalFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || success}>
              {submitting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
