"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@eximia/ui"
import { ArrowRight, Building2, Pencil, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  type ManagerGroupRow,
  type ManagerOption,
  type UnitOption,
  deleteManagerGroup,
} from "../actions"
import { GroupFormDialog } from "./group-form-dialog"

interface GroupListProps {
  groups: ManagerGroupRow[]
  gestores: ManagerOption[]
  units: UnitOption[]
  isAdmin: boolean
  onCreateClick: () => void
}

export function GroupList({ groups, gestores, units, isAdmin, onCreateClick }: GroupListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editGroup, setEditGroup] = useState<ManagerGroupRow | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<ManagerGroupRow | null>(null)

  async function handleDelete() {
    if (!deleteGroup) return
    startTransition(async () => {
      const res = await deleteManagerGroup(deleteGroup.id)
      if (res.error) {
        toast({ variant: "error", title: res.error })
        return
      }
      toast({ variant: "success", title: "Grupo excluído." })
      setDeleteGroup(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={onCreateClick}>
          <Users size={16} />
          Novo grupo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gestor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted py-10">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={28} className="text-text-muted/40" />
                      <span>Nenhum grupo de gestor cadastrado.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium text-text-primary">
                      {group.name}
                      {group.description && (
                        <p className="text-xs text-text-muted font-normal truncate max-w-[200px]">
                          {group.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {group.manager_name ?? (
                        <span className="text-text-muted italic">Sem gestor</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.is_corporate ? "success" : "draft"} badgeSize="sm">
                        {group.is_corporate ? "Corporativo" : "Padrão"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {group.units.length === 0 ? (
                        <span className="text-xs text-text-muted italic">Nenhuma</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {group.units.slice(0, 2).map((u) => (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1 text-xs bg-bg-surface rounded-md px-2 py-0.5 text-text-secondary"
                            >
                              <Building2 size={10} className="shrink-0" />
                              {u.name}
                            </span>
                          ))}
                          {group.units.length > 2 && (
                            <span className="text-xs text-text-muted">
                              +{group.units.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{group.member_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Link
                          href={`/admin/manager-groups/${group.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary shadow-card transition-all hover:shadow-elevated"
                        >
                          Gerenciar <ArrowRight size={12} />
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => setEditGroup(group)}>
                          <Pencil size={14} />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteGroup(group)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <GroupFormDialog
        open={!!editGroup}
        onOpenChange={(v) => {
          if (!v) setEditGroup(null)
        }}
        group={editGroup}
        gestores={gestores}
        units={units}
        isAdmin={isAdmin}
      />

      {/* Delete Confirmation */}
      <Modal open={!!deleteGroup} onOpenChange={() => setDeleteGroup(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Excluir grupo</ModalTitle>
            <ModalDescription>
              Tem certeza que deseja excluir o grupo <strong>{deleteGroup?.name}</strong>? Todos os
              membros serão desvinculados. Esta ação não pode ser desfeita.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteGroup(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
