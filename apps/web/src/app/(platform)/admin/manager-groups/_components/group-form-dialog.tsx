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
  useToast,
} from "@eximia/ui"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import {
  type ManagerGroupRow,
  type ManagerOption,
  type UnitOption,
  createManagerGroup,
  updateManagerGroup,
} from "../actions"

interface GroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, dialog is in "edit" mode */
  group?: ManagerGroupRow | null
  gestores: ManagerOption[]
  units: UnitOption[]
  isAdmin: boolean
}

export function GroupFormDialog({
  open,
  onOpenChange,
  group,
  gestores,
  units,
  isAdmin,
}: GroupFormDialogProps) {
  const isEditing = !!group
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [managerId, setManagerId] = useState("")
  const [isCorporate, setIsCorporate] = useState(false)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])

  // Sync form when opening/switching target
  useEffect(() => {
    if (open) {
      setName(group?.name ?? "")
      setDescription(group?.description ?? "")
      setManagerId(group?.manager_id ?? "")
      setIsCorporate(group?.is_corporate ?? false)
      setSelectedUnitIds((group?.units ?? []).map((u) => u.id))
    }
  }, [open, group])

  function toggleUnit(id: string) {
    if (isCorporate) {
      // corporate = multi-select
      setSelectedUnitIds((prev) =>
        prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id],
      )
    } else {
      // non-corporate = single select
      setSelectedUnitIds((prev) => (prev[0] === id ? [] : [id]))
    }
  }

  function handleClose() {
    onOpenChange(false)
  }

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ variant: "error", title: "Nome é obrigatório" })
      return
    }

    startTransition(async () => {
      if (isEditing && group) {
        const res = await updateManagerGroup({
          id: group.id,
          name: trimmed,
          description: description.trim() || null,
          isCorporate,
          ...(isAdmin ? { managerId: managerId || null } : {}),
        })
        if (res.error) {
          toast({ variant: "error", title: res.error })
          return
        }
        toast({ variant: "success", title: "Grupo atualizado!" })
      } else {
        const res = await createManagerGroup({
          name: trimmed,
          description: description.trim() || null,
          isCorporate,
          managerId: isAdmin ? managerId || null : undefined,
          unitIds: selectedUnitIds,
        })
        if (res.error) {
          toast({ variant: "error", title: res.error })
          return
        }
        toast({ variant: "success", title: "Grupo criado com sucesso!" })
      }
      handleClose()
      router.refresh()
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{isEditing ? "Editar Grupo" : "Novo Grupo de Gestor"}</ModalTitle>
          <ModalDescription>
            {isEditing
              ? "Atualize as informações do grupo."
              : "Crie um time de alunos gerenciado por um gestor."}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <FormField label="Nome do grupo">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Time Comercial SP"
            />
          </FormField>

          {/* Description */}
          <FormField label="Descrição (opcional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do grupo"
            />
          </FormField>

          {/* Gestor — only admin can assign/reassign */}
          {isAdmin && (
            <FormField label="Gestor responsável">
              <Select
                selectSize="sm"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                <option value="">Sem gestor atribuído</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.full_name} ({g.role})
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {/* Corporativo toggle */}
          <div className="flex items-center gap-3 rounded-xl bg-bg-surface px-4 py-3">
            <button
              type="button"
              role="switch"
              aria-checked={isCorporate}
              onClick={() => {
                setIsCorporate((v) => !v)
                if (!isCorporate) {
                  // switching to non-corporate — keep only first selected unit
                  setSelectedUnitIds((prev) => prev.slice(0, 1))
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600 ${
                isCorporate ? "bg-cerrado-600" : "bg-bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  isCorporate ? "translate-x-4" : "translate-x-0.5"
                } mt-0.5`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-text-primary">Grupo corporativo</p>
              <p className="text-xs text-text-muted">
                {isCorporate
                  ? "Pode conter alunos de múltiplas unidades."
                  : "Restrito a uma única unidade."}
              </p>
            </div>
          </div>

          {/* Units — only visible on create */}
          {!isEditing && units.length > 0 && (
            <FormField label={isCorporate ? "Unidades (múltiplas)" : "Unidade"}>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border-subtle p-2">
                {units.map((u) => {
                  const checked = selectedUnitIds.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUnit(u.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "bg-cerrado-600/10 text-cerrado-600"
                          : "hover:bg-bg-hover text-text-primary"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                          isCorporate ? "rounded" : "rounded-full"
                        } border ${checked ? "border-cerrado-600 bg-cerrado-600" : "border-border-subtle"}`}
                      >
                        {checked && (
                          <svg
                            viewBox="0 0 10 10"
                            className="h-2.5 w-2.5 text-white fill-current"
                            aria-hidden="true"
                          >
                            <path
                              d="M1.5 5l2.5 2.5 4.5-4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 text-left">{u.name}</span>
                      <span className="text-xs text-text-muted">{u.slug}</span>
                    </button>
                  )
                })}
              </div>
            </FormField>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending
              ? isEditing
                ? "Salvando..."
                : "Criando..."
              : isEditing
                ? "Salvar"
                : "Criar"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
