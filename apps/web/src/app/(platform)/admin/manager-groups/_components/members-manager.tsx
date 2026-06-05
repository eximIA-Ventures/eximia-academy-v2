"use client"

import {
  Button,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { Search, Trash2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { type StudentOption, addManagerGroupMembers, removeManagerGroupMember } from "../actions"

interface MemberRow {
  id: string
  full_name: string
  email: string
}

interface MembersManagerProps {
  groupId: string
  members: MemberRow[]
  availableStudents: StudentOption[]
}

export function MembersManager({ groupId, members, availableStudents }: MembersManagerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const memberSet = new Set(members.map((m) => m.id))
  const filteredStudents = availableStudents
    .filter((s) => !memberSet.has(s.id))
    .filter(
      (s) =>
        !search ||
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()),
    )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleCloseAdd() {
    setShowAdd(false)
    setSearch("")
    setSelectedIds([])
  }

  async function handleAdd() {
    if (selectedIds.length === 0) return
    startTransition(async () => {
      const res = await addManagerGroupMembers(groupId, selectedIds)
      if (!res.success) {
        toast({ variant: "error", title: res.error ?? "Erro ao adicionar alunos" })
        return
      }
      const added = res.added
      toast({
        variant: "success",
        title: `${added} aluno${added !== 1 ? "s" : ""} adicionado${added !== 1 ? "s" : ""}!`,
      })
      handleCloseAdd()
      router.refresh()
    })
  }

  async function handleRemove(studentId: string) {
    startTransition(async () => {
      const res = await removeManagerGroupMember(groupId, studentId)
      if (res.error) {
        toast({ variant: "error", title: res.error })
        return
      }
      toast({ variant: "success", title: "Aluno removido do grupo." })
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Membros ({members.length})</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <UserPlus size={14} />
          Adicionar alunos
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="rounded-2xl bg-bg-card shadow-card p-6 text-center text-sm text-text-muted">
          Nenhum aluno neste grupo ainda.
        </p>
      ) : (
        <div className="rounded-2xl bg-bg-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Email
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-bg-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">{m.full_name}</td>
                  <td className="px-4 py-3 text-text-secondary">{m.email}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(m.id)}
                      disabled={isPending}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Members Modal */}
      <Modal
        open={showAdd}
        onOpenChange={(v) => {
          if (!v) handleCloseAdd()
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Adicionar alunos ao grupo</ModalTitle>
          </ModalHeader>
          <div className="py-4 space-y-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl bg-bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none"
              />
            </div>
            {selectedIds.length > 0 && (
              <p className="text-xs text-cerrado-600 font-medium">
                {selectedIds.length} aluno{selectedIds.length !== 1 ? "s" : ""} selecionado
                {selectedIds.length !== 1 ? "s" : ""}
              </p>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredStudents.slice(0, 30).map((s) => {
                const selected = selectedIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSelect(s.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "bg-cerrado-600/10 text-cerrado-600"
                        : "hover:bg-bg-hover text-text-primary"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selected ? "border-cerrado-600 bg-cerrado-600" : "border-border-subtle"
                      }`}
                    >
                      {selected && (
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
                    <span className="flex-1 text-left truncate">{s.full_name}</span>
                    <span className="text-xs text-text-muted truncate">{s.email}</span>
                  </button>
                )
              })}
              {filteredStudents.length === 0 && (
                <p className="py-4 text-center text-xs text-text-muted">Nenhum aluno disponível</p>
              )}
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={handleCloseAdd} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={isPending || selectedIds.length === 0}>
              {isPending
                ? "Adicionando..."
                : `Adicionar${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
