"use client"

import {
  Badge,
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
  useToast,
} from "@eximia/ui"
import { ArrowRight, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface TenantRow {
  id: string
  name: string
  slug: string
  created_at: string
  user_count: number
  area_count: number
  areas: Array<{ id: string; name: string; slug: string }>
}

interface TenantsManagementClientProps {
  tenants: TenantRow[]
}

export function TenantsManagementClient({ tenants }: TenantsManagementClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [showCreate, setShowCreate] = useState(false)
  const [editTenant, setEditTenant] = useState<TenantRow | null>(null)
  const [deleteTenant, setDeleteTenant] = useState<TenantRow | null>(null)

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  function resetForm() {
    setName("")
    setSlug("")
  }

  function autoSlug(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  async function handleCreate() {
    startTransition(async () => {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao criar" })
        return
      }
      toast({ variant: "success", title: "Empresa criada!" })
      setShowCreate(false)
      resetForm()
      router.refresh()
    })
  }

  async function handleUpdate() {
    if (!editTenant) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/tenants/${editTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao atualizar" })
        return
      }
      toast({ variant: "success", title: "Empresa atualizada!" })
      setEditTenant(null)
      resetForm()
      router.refresh()
    })
  }

  async function handleDelete() {
    if (!deleteTenant) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/tenants/${deleteTenant.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao excluir" })
        return
      }
      toast({ variant: "success", title: "Empresa excluida!" })
      setDeleteTenant(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            resetForm()
            setShowCreate(true)
          }}
        >
          <Plus size={16} />
          Nova Empresa
        </Button>
      </div>

      <div className="space-y-3">
        {tenants.map((tenant) => {
          const initials = tenant.name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()

          return (
            <div
              key={tenant.id}
              className="rounded-2xl bg-bg-card shadow-card p-5 transition-all hover:shadow-elevated"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10 text-sm font-bold text-cerrado-600">
                  {initials}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-text-primary">{tenant.name}</h3>
                    <span className="text-xs text-text-muted font-mono">/{tenant.slug}</span>
                    <Badge badgeSize="sm" variant="success">
                      Ativo
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Users size={12} />
                      {tenant.user_count} usuario{tenant.user_count !== 1 ? "s" : ""}
                    </span>
                    {tenant.area_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                        <MapPin size={12} />
                        {tenant.area_count} unidade{tenant.area_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      Criado{" "}
                      {new Date(tenant.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setName(tenant.name)
                      setSlug(tenant.slug)
                      setEditTenant(tenant)
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTenant(tenant)}>
                    <Trash2 size={14} />
                  </Button>
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-card transition-all hover:shadow-elevated"
                  >
                    Gerenciar
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              {/* Areas preview */}
              {tenant.areas.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {tenant.areas.map((area) => (
                    <span
                      key={area.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-bg-surface px-2.5 py-1 text-xs text-text-secondary"
                    >
                      <MapPin size={10} className="text-varzea" />
                      {area.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Nova Empresa</ModalTitle>
            <ModalDescription>Cadastre uma nova empresa na plataforma.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome da empresa">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!slug || slug === autoSlug(name)) {
                    setSlug(autoSlug(e.target.value))
                  }
                }}
                placeholder="Ex: Empresa XPTO"
              />
            </FormField>
            <FormField label="Slug (URL)">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: empresa-xpto"
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
        open={!!editTenant}
        onOpenChange={() => {
          setEditTenant(null)
          resetForm()
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Editar Empresa</ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Slug">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </FormField>
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditTenant(null)
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

      {/* Delete Confirmation */}
      <Modal open={!!deleteTenant} onOpenChange={() => setDeleteTenant(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Excluir Empresa</ModalTitle>
            <ModalDescription>
              Tem certeza que deseja excluir <strong>{deleteTenant?.name}</strong>?
              {deleteTenant && deleteTenant.user_count > 0 && (
                <span className="mt-2 block text-semantic-error">
                  Esta empresa possui {deleteTenant.user_count} usuario(s). Remova todos os
                  usuarios antes de excluir.
                </span>
              )}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteTenant(null)}>
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
