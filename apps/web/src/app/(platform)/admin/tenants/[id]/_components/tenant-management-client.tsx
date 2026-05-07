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
  Select,
  useToast,
} from "@eximia/ui"
import {
  BookOpen,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/* --------------------------------- Types --------------------------------- */

interface UserRow {
  id: string
  full_name: string
  email: string
  role: string
  status: string
  created_at: string
}

interface AreaRow {
  id: string
  name: string
  slug: string
  description: string | null
  user_count: number
  course_count: number
}

interface CourseRow {
  id: string
  title: string
  status: string
  area_id: string | null
  area_name: string | null
}

interface TenantManagementClientProps {
  tenantId: string
  tenantName: string
  stats: { users: number; areas: number; courses: number; sessions: number }
  initialUsers: UserRow[]
  initialAreas: AreaRow[]
  initialCourses: CourseRow[]
}

/* --------------------------------- Tabs ---------------------------------- */

type Tab = "overview" | "areas" | "users" | "courses"

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Visao Geral", icon: MessageSquare },
  { id: "areas", label: "Unidades", icon: MapPin },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "courses", label: "Cursos", icon: BookOpen },
]

/* ------------------------------- Component ------------------------------- */

export function TenantManagementClient({
  tenantId,
  tenantName,
  stats,
  initialUsers,
  initialAreas,
  initialCourses,
}: TenantManagementClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("")

  const filteredUsers = initialUsers.filter((u) => {
    const matchSearch =
      !userSearch ||
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    const matchRole = !userRoleFilter || u.role === userRoleFilter
    return matchSearch && matchRole
  })

  const roleLabels: Record<string, string> = {
    student: "Aluno",
    manager: "Gestor",
    admin: "Admin",
    instructor: "Instrutor",
    super_admin: "Super Admin",
  }

  const statCards = [
    { icon: Users, label: "Usuarios", value: stats.users, iconBg: "bg-blue-500/15", iconColor: "text-blue-500" },
    { icon: MapPin, label: "Unidades", value: stats.areas, iconBg: "bg-varzea/15", iconColor: "text-varzea" },
    { icon: BookOpen, label: "Cursos", value: stats.courses, iconBg: "bg-cerrado-600/15", iconColor: "text-cerrado-600" },
    { icon: MessageSquare, label: "Sessoes", value: stats.sessions, iconBg: "bg-purple-500/15", iconColor: "text-purple-500" },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-2xl bg-bg-card shadow-card p-5">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stat.iconBg}`}>
                  <Icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.label}</p>
                  <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-bg-surface p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-bg-card shadow-card text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab areas={initialAreas} users={initialUsers} courses={initialCourses} roleLabels={roleLabels} />
      )}

      {activeTab === "areas" && (
        <AreasTab areas={initialAreas} tenantId={tenantId} />
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="max-w-xs flex-1">
              <Input
                placeholder="Buscar por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                leadingIcon={<Search size={16} />}
                inputSize="sm"
              />
            </div>
            <div className="w-40">
              <Select selectSize="sm" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="student">Aluno</option>
                <option value="manager">Gestor</option>
                <option value="admin">Admin</option>
                <option value="instructor">Instrutor</option>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl bg-bg-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Papel</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Desde</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      Nenhum usuario encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-bg-hover">
                      <td className="px-4 py-3 text-text-primary font-medium">{u.full_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge badgeSize="sm" variant="default">{roleLabels[u.role] ?? u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge badgeSize="sm" variant={u.status === "active" ? "success" : "warning"}>
                          {u.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-text-muted">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "courses" && (
        <div className="space-y-4">
          {initialCourses.length === 0 ? (
            <p className="rounded-2xl bg-bg-card shadow-card p-8 text-center text-sm text-text-muted">
              Nenhum curso cadastrado neste tenant.
            </p>
          ) : (
            <div className="space-y-2">
              {initialCourses.map((course) => (
                <div key={course.id} className="flex items-center gap-4 rounded-2xl bg-bg-card shadow-card p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
                    <BookOpen size={18} className="text-cerrado-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{course.title}</p>
                    {course.area_name && (
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />
                        {course.area_name}
                      </p>
                    )}
                  </div>
                  <Badge badgeSize="sm" variant={course.status === "published" ? "success" : "draft"}>
                    {course.status === "published" ? "Publicado" : course.status === "draft" ? "Rascunho" : course.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Overview Tab ------------------------------ */

function OverviewTab({
  areas,
  users,
  courses,
  roleLabels,
}: {
  areas: AreaRow[]
  users: UserRow[]
  courses: CourseRow[]
  roleLabels: Record<string, string>
}) {
  // Role distribution
  const roleCounts: Record<string, number> = {}
  for (const u of users) {
    roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Areas summary */}
      <div className="rounded-2xl bg-bg-card shadow-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary flex items-center gap-2">
          <MapPin size={15} className="text-varzea" />
          Unidades ({areas.length})
        </h3>
        {areas.length === 0 ? (
          <p className="text-xs text-text-muted">Nenhuma unidade cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {areas.map((area) => (
              <div key={area.id} className="flex items-center gap-3 rounded-xl bg-bg-surface p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{area.name}</p>
                  <p className="text-xs text-text-muted">
                    {area.user_count} usuario{area.user_count !== 1 ? "s" : ""} · {area.course_count} curso{area.course_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role distribution */}
      <div className="rounded-2xl bg-bg-card shadow-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary flex items-center gap-2">
          <Users size={15} className="text-blue-500" />
          Distribuicao por Papel
        </h3>
        <div className="space-y-3">
          {Object.entries(roleCounts).sort(([,a], [,b]) => b - a).map(([role, count]) => (
            <div key={role} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{roleLabels[role] ?? role}</span>
              <div className="flex items-center gap-3">
                <div className="h-2 w-24 rounded-full bg-bg-surface overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cerrado-600"
                    style={{ width: `${Math.round((count / users.length) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-text-primary tabular-nums w-8 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent courses */}
      <div className="rounded-2xl bg-bg-card shadow-card p-5 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-text-primary flex items-center gap-2">
          <BookOpen size={15} className="text-cerrado-600" />
          Cursos ({courses.length})
        </h3>
        {courses.length === 0 ? (
          <p className="text-xs text-text-muted">Nenhum curso cadastrado.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {courses.slice(0, 6).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-bg-surface p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{c.title}</p>
                  {c.area_name && (
                    <p className="text-xs text-text-muted mt-0.5">{c.area_name}</p>
                  )}
                </div>
                <Badge badgeSize="sm" variant={c.status === "published" ? "success" : "draft"}>
                  {c.status === "published" ? "Pub" : "Draft"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Areas Tab ------------------------------- */

function AreasTab({ areas, tenantId }: { areas: AreaRow[]; tenantId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [editArea, setEditArea] = useState<AreaRow | null>(null)
  const [deleteArea, setDeleteArea] = useState<AreaRow | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")

  function resetForm() {
    setName("")
    setSlug("")
    setDescription("")
  }

  async function handleCreate() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description: description || undefined }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao criar unidade" })
        return
      }
      toast({ variant: "success", title: "Unidade criada!" })
      setShowCreate(false)
      resetForm()
      router.refresh()
    })
  }

  async function handleUpdate() {
    if (!editArea) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/tenants/${tenantId}/areas/${editArea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, description: description || null }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao atualizar" })
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
      const res = await fetch(`/api/admin/tenants/${tenantId}/areas/${deleteArea.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro ao excluir" })
        return
      }
      toast({ variant: "success", title: "Unidade excluida!" })
      setDeleteArea(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true) }}>
          <Plus size={16} />
          Nova Unidade
        </Button>
      </div>

      {areas.length === 0 ? (
        <p className="rounded-2xl bg-bg-card shadow-card p-8 text-center text-sm text-text-muted">
          Nenhuma unidade cadastrada.
        </p>
      ) : (
        <div className="space-y-2">
          {areas.map((area) => (
            <div key={area.id} className="flex items-center gap-4 rounded-2xl bg-bg-card shadow-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-varzea/10">
                <MapPin size={18} className="text-varzea" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{area.name}</p>
                <p className="text-xs text-text-muted">
                  /{area.slug} · {area.user_count} usuario{area.user_count !== 1 ? "s" : ""} · {area.course_count} curso{area.course_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setName(area.name); setSlug(area.slug); setDescription(area.description ?? ""); setEditArea(area) }}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteArea(area)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Nova Unidade</ModalTitle>
            <ModalDescription>Criar unidade para este tenant.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ribeirao Preto" /></FormField>
            <FormField label="Slug"><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Ex: ribeirao-preto" /></FormField>
            <FormField label="Descricao"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" /></FormField>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isPending || !name || !slug}>{isPending ? "Criando..." : "Criar"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editArea} onOpenChange={() => { setEditArea(null); resetForm() }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader><ModalTitle>Editar Unidade</ModalTitle></ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} /></FormField>
            <FormField label="Slug"><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></FormField>
            <FormField label="Descricao"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></FormField>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => { setEditArea(null); resetForm() }}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={isPending || !name || !slug}>{isPending ? "Salvando..." : "Salvar"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteArea} onOpenChange={() => setDeleteArea(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Excluir Unidade</ModalTitle>
            <ModalDescription>Tem certeza que deseja excluir <strong>{deleteArea?.name}</strong>?</ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setDeleteArea(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending ? "Excluindo..." : "Excluir"}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
