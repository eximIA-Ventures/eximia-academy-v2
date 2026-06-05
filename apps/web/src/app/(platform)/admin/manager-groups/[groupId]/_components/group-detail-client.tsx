"use client"

import {
  Badge,
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
import { Building2, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { GroupFormDialog } from "../../_components/group-form-dialog"
import { MembersManager } from "../../_components/members-manager"
import {
  type ManagerGroupRow,
  type ManagerOption,
  type StudentOption,
  type UnitOption,
  setManagerGroupUnits,
} from "../../actions"

interface GroupDetailClientProps {
  group: ManagerGroupRow
  members: Array<{ id: string; full_name: string; email: string }>
  availableStudents: StudentOption[]
  gestores: ManagerOption[]
  allUnits: UnitOption[]
  isAdmin: boolean
}

export function GroupDetailClient({
  group,
  members,
  availableStudents,
  gestores,
  allUnits,
  isAdmin,
}: GroupDetailClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)
  const [showManageUnits, setShowManageUnits] = useState(false)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(group.units.map((u) => u.id))

  function toggleUnit(id: string) {
    if (group.is_corporate) {
      setSelectedUnitIds((prev) =>
        prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id],
      )
    } else {
      setSelectedUnitIds((prev) => (prev[0] === id ? [] : [id]))
    }
  }

  async function handleSaveUnits() {
    startTransition(async () => {
      const res = await setManagerGroupUnits(group.id, selectedUnitIds)
      if (res.error) {
        toast({ variant: "error", title: res.error })
        return
      }
      toast({ variant: "success", title: "Unidades atualizadas!" })
      setShowManageUnits(false)
      router.refresh()
    })
  }

  function openManageUnits() {
    setSelectedUnitIds(group.units.map((u) => u.id))
    setShowManageUnits(true)
  }

  return (
    <div className="space-y-6">
      {/* Group info card */}
      <div className="rounded-2xl bg-bg-card shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Informações do grupo</h2>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil size={14} />
            Editar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-0.5">
              Gestor
            </p>
            <p className="text-text-primary">
              {group.manager_name ?? (
                <span className="text-text-muted italic">Sem gestor atribuído</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-0.5">
              Tipo
            </p>
            <Badge variant={group.is_corporate ? "success" : "draft"} badgeSize="sm">
              {group.is_corporate ? "Corporativo" : "Padrão"}
            </Badge>
          </div>
          {group.description && (
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-0.5">
                Descrição
              </p>
              <p className="text-text-secondary">{group.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Linked Units section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Unidades vinculadas ({group.units.length})
          </h2>
          <Button size="sm" variant="outline" onClick={openManageUnits}>
            <Building2 size={14} />
            Gerenciar unidades
          </Button>
        </div>
        {group.units.length === 0 ? (
          <p className="rounded-2xl bg-bg-card shadow-card p-6 text-center text-sm text-text-muted">
            Nenhuma unidade vinculada a este grupo.
          </p>
        ) : (
          <div className="space-y-2">
            {group.units.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-4 rounded-2xl bg-bg-card shadow-card p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
                  <Building2 size={18} className="text-cerrado-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-muted">{u.slug}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Members section */}
      <MembersManager groupId={group.id} members={members} availableStudents={availableStudents} />

      {/* Edit group dialog */}
      <GroupFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        group={group}
        gestores={gestores}
        units={allUnits}
        isAdmin={isAdmin}
      />

      {/* Manage units modal */}
      <Modal open={showManageUnits} onOpenChange={setShowManageUnits}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Gerenciar unidades</ModalTitle>
            <ModalDescription>
              {group.is_corporate
                ? "Selecione uma ou mais unidades para este grupo corporativo."
                : "Selecione a unidade para este grupo."}
            </ModalDescription>
          </ModalHeader>
          <div className="py-4">
            {allUnits.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">
                Nenhuma unidade disponível.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {allUnits.map((u) => {
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
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked ? "border-cerrado-600 bg-cerrado-600" : "border-border-subtle"
                        }`}
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
            )}
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowManageUnits(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveUnits} disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
