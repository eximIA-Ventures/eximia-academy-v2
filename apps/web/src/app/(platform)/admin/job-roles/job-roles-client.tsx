"use client"

import {
  Button,
  Card,
  CardContent,
  Input,
  Modal,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@eximia/ui"
import { Briefcase, Edit2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { createJobRole, deleteJobRole, updateJobRole } from "./actions"

interface JobRole {
  id: string
  name: string
  slug: string
  description: string | null
  seniority_level: string
  area_id: string | null
  area_name: string | null
  active_trails_count: number
  created_at: string
}

interface Area {
  id: string
  name: string
}

const SENIORITY_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Pleno",
  senior: "Senior",
  lead: "Lead",
  manager: "Gestor",
}

export function JobRolesClient({
  roles: initialRoles,
  areas,
}: { roles: JobRole[]; areas: Area[] }) {
  const router = useRouter()
  const [roles, setRoles] = useState(initialRoles)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState<JobRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JobRole | null>(null)
  const [isPending, startTransition] = useTransition()

  const [formName, setFormName] = useState("")
  const [formAreaId, setFormAreaId] = useState<string>("")
  const [formSeniority, setFormSeniority] = useState("mid")
  const [formDescription, setFormDescription] = useState("")
  const [formError, setFormError] = useState("")

  function openCreate() {
    setEditingRole(null)
    setFormName("")
    setFormAreaId("")
    setFormSeniority("mid")
    setFormDescription("")
    setFormError("")
    setShowModal(true)
  }

  function openEdit(role: JobRole) {
    setEditingRole(role)
    setFormName(role.name)
    setFormAreaId(role.area_id ?? "")
    setFormSeniority(role.seniority_level)
    setFormDescription(role.description ?? "")
    setFormError("")
    setShowModal(true)
  }

  function handleSubmit() {
    setFormError("")
    const payload = {
      name: formName,
      area_id: formAreaId || null,
      seniority_level: formSeniority,
      description: formDescription || null,
    }

    startTransition(async () => {
      const result = editingRole
        ? await updateJobRole(editingRole.id, payload)
        : await createJobRole(payload)

      if ("error" in result && result.error) {
        setFormError(result.error)
        return
      }

      setShowModal(false)
      router.refresh()
    })
  }

  function handleDelete(role: JobRole) {
    setDeleteTarget(role)
  }

  function confirmDelete() {
    if (!deleteTarget) return

    startTransition(async () => {
      const result = await deleteJobRole(deleteTarget.id)
      if ("error" in result && result.error) {
        setFormError(result.error)
        setDeleteTarget(null)
        return
      }
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    })
  }

  // Group by area
  const grouped = new Map<string, JobRole[]>()
  for (const role of roles) {
    const key = role.area_name ?? "Sem área"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)?.push(role)
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cargo
        </Button>
      </div>

      {roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-text-secondary mb-4" />
            <p className="text-text-secondary">Nenhum cargo cadastrado</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Criar primeiro cargo
            </Button>
          </CardContent>
        </Card>
      ) : (
        [...grouped.entries()].map(([areaName, areaRoles]) => (
          <div key={areaName}>
            <h2 className="text-lg font-semibold text-text-primary mb-3">{areaName}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Senioridade</TableHead>
                  <TableHead>Trilhas Ativas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areaRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-text-primary">{role.name}</p>
                        {role.description && (
                          <p className="text-xs text-text-secondary mt-0.5">{role.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-bg-card px-2.5 py-0.5 text-xs font-medium text-text-primary">
                        {SENIORITY_LABELS[role.seniority_level] ?? role.seniority_level}
                      </span>
                    </TableCell>
                    <TableCell>{role.active_trails_count}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(role)}
                        aria-label="Editar cargo"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(role)}
                        aria-label="Excluir cargo"
                      >
                        <Trash2 className="h-4 w-4 text-semantic-error" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}

      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-text-primary">Confirmar exclusão</h2>
            <p className="text-sm text-text-secondary">
              Excluir cargo &quot;{deleteTarget.name}&quot;?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
                {isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal open={showModal} onOpenChange={setShowModal}>
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-text-primary">
              {editingRole ? "Editar Cargo" : "Novo Cargo"}
            </h2>

            {formError && (
              <p className="text-sm text-semantic-error bg-semantic-error/10 rounded-md p-2">
                {formError}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="role-name"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Nome
                </label>
                <Input
                  id="role-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Analista de Dados"
                />
              </div>

              <div>
                <label
                  htmlFor="role-area"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Área
                </label>
                <Select
                  id="role-area"
                  value={formAreaId}
                  onChange={(e) => setFormAreaId(e.target.value)}
                  selectSize="default"
                >
                  <option value="">Nenhuma área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label
                  htmlFor="role-seniority"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Senioridade
                </label>
                <Select
                  id="role-seniority"
                  value={formSeniority}
                  onChange={(e) => setFormSeniority(e.target.value)}
                  selectSize="default"
                >
                  {Object.entries(SENIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label
                  htmlFor="role-description"
                  className="block text-sm font-medium text-text-primary mb-1"
                >
                  Descrição
                </label>
                <Textarea
                  id="role-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição opcional do cargo"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending || !formName.trim()}>
                {isPending ? "Salvando..." : editingRole ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
