"use client"

import { analytics } from "@/lib/analytics"
import {
  Button,
  Input,
  Label,
  Select,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
} from "@eximia/ui"
import { type FormEvent, useCallback, useState } from "react"
import { moveUserArea } from "./user-area-move"

/* --------------------------------- Types --------------------------------- */

interface AreaOption {
  id: string
  name: string
}

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  /**
   * Áreas do tenant. Sem elas o campo não aparece — melhor ausente do que um
   * select vazio que não explica por que está vazio.
   */
  areas?: AreaOption[]
}

/* ------------------------------- Component ------------------------------- */

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
  areas = [],
}: InviteUserDialogProps) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [reportName, setReportName] = useState("")
  const [role, setRole] = useState("student")
  const [areaId, setAreaId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const resetForm = useCallback(() => {
    setEmail("")
    setFullName("")
    setReportName("")
    setRole("student")
    setAreaId("")
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
          body: JSON.stringify({
            email,
            full_name: fullName,
            // Nome padronizado de relatório — opcional. Em branco, o backend deixa
            // null e as tabelas de análise caem no fallback para o nome completo.
            report_name: reportName.trim() || null,
            role,
          }),
        })

        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = typeof json.error === "string" ? json.error : "Erro ao enviar convite."
          throw new Error(msg)
        }

        // A área é OUTRA tabela (`user_areas`), então é outra escrita — feita
        // pela MESMA rota que a tela de Áreas usa, nunca por um caminho novo.
        // Vem depois do convite de propósito: se ela falhar, o convite já saiu e
        // a mensagem diz exatamente o que ficou pendente. A pessoa aparece na
        // lista com o sinal âmbar de "sem área", que é justamente o aviso certo.
        const newUserId = json?.data?.user?.id
        if (areaId && typeof newUserId === "string") {
          const linked = await moveUserArea({
            userId: newUserId,
            currentAreaIds: [],
            targetAreaId: areaId,
          })
          if (!linked.ok) {
            throw new Error(`Convite enviado, mas a área não foi vinculada: ${linked.message}`)
          }
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
    [email, fullName, reportName, role, areaId, onSuccess, handleClose],
  )

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetOverlay />
      <SheetContent
        side="right"
        aria-label="Convidar usuário"
        className="w-full max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Convidar usuário</SheetTitle>
            <SheetClose aria-label="Fechar" />
          </div>
          <SheetDescription>
            Envie um convite por email para adicionar um novo usuário ao tenant.
          </SheetDescription>
        </SheetHeader>

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

          {/* Report Name (optional, standardized display name for analytics tables) */}
          <div className="space-y-2">
            <Label htmlFor="invite-report-name">Nome para relatório</Label>
            <Input
              id="invite-report-name"
              placeholder="Ex: Maria S. (Comercial)"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-text-secondary">
              Nome padronizado exibido nas tabelas de análise e engajamento. Se ficar em branco, usa
              o nome completo.
            </p>
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

          {/* Área — convidar já com área é o que evita a pessoa nascer com o
              sinal âmbar de "sem área" aceso na lista. */}
          {areas.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="invite-area">Área</Label>
              <Select
                id="invite-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                disabled={submitting}
              >
                <option value="">Nenhuma</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
              <p className="text-text-secondary text-xs">
                Sem área, a pessoa entra sinalizada como pendente de vínculo na lista.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && <p className="text-sm text-semantic-error">{error}</p>}

          {/* Success message */}
          {success && <p className="text-sm text-semantic-success">Convite enviado com sucesso!</p>}

          <SheetFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || success}>
              {submitting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
