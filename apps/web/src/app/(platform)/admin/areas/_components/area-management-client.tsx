"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  FormField,
  Input,
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
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface Area {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
  user_count?: number
  course_count?: number
}

interface AreaManagementClientProps {
  initialAreas: Area[]
}

export function AreaManagementClient({ initialAreas }: AreaManagementClientProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [editArea, setEditArea] = useState<Area | null>(null)
  const [deleteArea, setDeleteArea] = useState<Area | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")

  function resetForm() {
    setName("")
    setSlug("")
    setDescription("")
  }

  function openEdit(area: Area) {
    setName(area.name)
    setSlug(area.slug)
    setDescription(area.description ?? "")
    setEditArea(area)
  }

  async function handleCreate() {
    startTransition(async () => {
      const res = await fetch("/api/admin/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description: description || undefined }),
      })

      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao criar unidade" })
        return
      }

      toast({ variant: "success", title: "Unidade criada com sucesso!" })
      setShowCreate(false)
      resetForm()
      router.refresh()
    })
  }

  async function handleUpdate() {
    if (!editArea) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/areas/${editArea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description: description || null }),
      })

      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao atualizar unidade" })
        return
      }

      toast({ variant: "success", title: "Unidade atualizada!" })
      setEditArea(null)
      resetForm()
      router.refresh()
    })
  }

  async function handleDelete() {
    if (!deleteArea) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/areas/${deleteArea.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao excluir unidade" })
        return
      }

      toast({ variant: "success", title: "Unidade excluída!" })
      setDeleteArea(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={() => {
            resetForm()
            setShowCreate(true)
          }}
        >
          <Plus size={16} />
          Nova Unidade
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Cursos</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialAreas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted py-8">
                    Nenhuma unidade cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                initialAreas.map((area) => (
                  <TableRow key={area.id}>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell>
                      <Badge variant="draft" badgeSize="sm">
                        {area.slug}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{area.user_count ?? 0}</TableCell>
                    <TableCell className="text-sm tabular-nums">{area.course_count ?? 0}</TableCell>
                    <TableCell className="text-text-secondary text-sm">
                      {area.description || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Link
                          href={`/admin/areas/${area.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary shadow-card transition-all hover:shadow-elevated"
                        >
                          Gerenciar <ArrowRight size={12} />
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(area)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteArea(area)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Nova Unidade</ModalTitle>
            <ModalDescription>Crie uma nova unidade gerencial.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Tecnologia"
              />
            </FormField>
            <FormField label="Slug">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: tecnologia"
              />
            </FormField>
            <FormField label="Descrição (opcional)">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição da área"
              />
            </FormField>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !name || !slug}>
              {isPending ? "Criando..." : "Criar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editArea}
        onOpenChange={() => {
          setEditArea(null)
          resetForm()
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Editar Unidade</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Slug">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </FormField>
            <FormField label="Descrição">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditArea(null)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isPending || !name || !slug}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteArea} onOpenChange={() => setDeleteArea(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Excluir Unidade</ModalTitle>
            <ModalDescription>
              Tem certeza que deseja excluir a unidade <strong>{deleteArea?.name}</strong>? Usuários e
              cursos associados perderao a vinculacao.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteArea(null)}>
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
