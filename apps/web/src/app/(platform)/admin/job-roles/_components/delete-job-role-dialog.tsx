"use client"

// ---------------------------------------------------------------------------
// Excluir cargo COM reatribuição (CFG-3.1, AC8).
// ---------------------------------------------------------------------------
// Antes desta story a exclusão tinha duas faces, e as duas eram ruins:
//   • bloqueio duro quando havia trilha ativa (com a mensagem exata mantida —
//     essa regra NÃO muda nesta story);
//   • silêncio total quando havia PESSOAS: o `ON DELETE SET NULL` do FK zerava
//     `users.job_role_id` de N pessoas sem ninguém decidir isso.
// O que muda aqui é só a segunda: pessoa vinculada agora exige destino
// explícito. O botão de excluir fica desabilitado enquanto sobrar alguém sem
// destino — o gate é da UI e também do servidor, porque a UI é conveniência e
// o servidor é a garantia.
// ---------------------------------------------------------------------------

import { Button, Modal } from "@eximia/ui"
import { AlertTriangle } from "lucide-react"
import { useState, useTransition } from "react"
import { deleteJobRoleWithReassignment } from "../actions"
import type { JobRoleWithStats } from "../types"
import { ReassignPeopleFields, toReassignments, undecidedPeople } from "./reassign-people-fields"

export interface DeleteJobRoleDialogProps {
  role: JobRoleWithStats
  /** Todos os cargos, para montar os destinos possíveis (menos o que morre). */
  allRoles: JobRoleWithStats[]
  onClose: () => void
  onDeleted: () => void
}

export function DeleteJobRoleDialog({
  role,
  allRoles,
  onClose,
  onDeleted,
}: DeleteJobRoleDialogProps) {
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const people = role.people
  const destinations = allRoles
    .filter((r) => r.id !== role.id)
    .map((r) => ({ id: r.id, name: r.name }))
  const pendingDecision = undecidedPeople(assignments, people)
  const blockedByTrail = role.active_trails_count > 0

  function confirm() {
    setError("")
    startTransition(async () => {
      const result = await deleteJobRoleWithReassignment(
        role.id,
        toReassignments(assignments, people),
      )

      if ("error" in result && result.error) {
        setError(result.error)
        return
      }

      onDeleted()
    })
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <div className="space-y-4 p-6" data-testid="delete-job-role-dialog">
        <h2 className="text-lg font-semibold text-text-primary">Excluir cargo</h2>
        <p className="text-sm text-text-secondary">
          Excluir &quot;{role.name}&quot;? Esta ação não pode ser desfeita.
        </p>

        {blockedByTrail && (
          <div
            className="flex items-start gap-2 rounded-md bg-semantic-warning/10 p-3 text-sm text-semantic-warning"
            data-testid="delete-blocked-by-trail"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {role.active_trails_count} trilha(s) ativa(s) ainda apontam para este cargo.
              Desvincule ou arquive essas trilhas antes de excluir.
            </span>
          </div>
        )}

        {people.length > 0 && (
          <div className="space-y-3" data-testid="delete-reassign-block">
            <div className="flex items-start gap-2 rounded-md bg-semantic-warning/10 p-3 text-sm text-semantic-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {people.length} pessoa(s) têm este cargo. Escolha o destino de cada uma antes de
                excluir.
              </span>
            </div>

            <ReassignPeopleFields
              people={people}
              destinations={destinations}
              value={assignments}
              onChange={setAssignments}
              disabled={isPending || blockedByTrail}
            />
          </div>
        )}

        {error && (
          <p className="rounded-md bg-semantic-error/10 p-2 text-sm text-semantic-error">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            disabled={isPending || blockedByTrail || pendingDecision.length > 0}
          >
            {isPending ? "Excluindo..." : "Excluir cargo"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
