"use client"

import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  useToast,
} from "@eximia/ui"
import { ArrowRight, BarChart3, BookOpen, MapPin, MessageSquare, Plus, Search, Trash2, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface UserRow {
  id: string
  full_name: string
  email: string
  role: string
  status?: string
}

interface CourseRow {
  id: string
  title: string
  status: string
  area_id?: string | null
}

interface AreaDetailClientProps {
  areaId: string
  users: UserRow[]
  courses: CourseRow[]
  allCourses: CourseRow[]
  unassignedUsers: UserRow[]
  sessionCount: number
}

const roleLabels: Record<string, string> = {
  student: "Aluno",
  manager: "Gestor",
  admin: "Admin",
  instructor: "Instrutor",
  super_admin: "Super Admin",
}

export function AreaDetailClient({
  areaId,
  users,
  courses,
  allCourses,
  unassignedUsers,
  sessionCount,
}: AreaDetailClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [showAssignCourse, setShowAssignCourse] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [userSearch, setUserSearch] = useState("")

  const unassignedCourses = allCourses.filter((c) => c.area_id !== areaId)

  const filteredUnassignedUsers = unassignedUsers.filter(
    (u) => !userSearch || u.full_name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()),
  )

  async function assignCourse() {
    if (!selectedCourseId) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/areas/${areaId}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: selectedCourseId }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro" })
        return
      }
      toast({ variant: "success", title: "Curso atribuido a unidade!" })
      setShowAssignCourse(false)
      setSelectedCourseId("")
      router.refresh()
    })
  }

  async function removeCourse(courseId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/areas/${areaId}/courses`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro" })
        return
      }
      toast({ variant: "success", title: "Curso removido da unidade" })
      router.refresh()
    })
  }

  async function addUser() {
    if (!selectedUserId) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/areas/${areaId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro" })
        return
      }
      toast({ variant: "success", title: "Usuario adicionado!" })
      setShowAddUser(false)
      setSelectedUserId("")
      setUserSearch("")
      router.refresh()
    })
  }

  async function removeUser(userId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/areas/${areaId}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: json.error ?? "Erro" })
        return
      }
      toast({ variant: "success", title: "Usuario removido da unidade" })
      router.refresh()
    })
  }

  const stats = [
    { icon: Users, label: "Usuarios", value: users.length, iconBg: "bg-blue-500/15", iconColor: "text-blue-500" },
    { icon: BookOpen, label: "Cursos", value: courses.length, iconBg: "bg-cerrado-600/15", iconColor: "text-cerrado-600" },
    { icon: MessageSquare, label: "Sessoes", value: sessionCount, iconBg: "bg-purple-500/15", iconColor: "text-purple-500" },
    { icon: MapPin, label: "Status", value: "Ativa", iconBg: "bg-varzea/15", iconColor: "text-varzea" },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
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

      {/* Analytics */}
      <Link
        href={`/analytics?areaId=${areaId}`}
        className="flex items-center gap-4 rounded-2xl bg-bg-card shadow-card p-5 transition-all hover:shadow-elevated hover:-translate-y-0.5 group"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
          <BarChart3 size={22} className="text-blue-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-primary group-hover:text-blue-500 transition-colors">
            Analytics da Unidade
          </h3>
          <p className="text-xs text-text-muted">
            {sessionCount} sessoes · Metricas de profundidade, breakthroughs e desempenho
          </p>
        </div>
        <ArrowRight size={16} className="text-text-muted group-hover:text-blue-500 transition-colors" />
      </Link>

      {/* Courses */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Cursos ({courses.length})</h2>
          <Button size="sm" onClick={() => setShowAssignCourse(true)}>
            <Plus size={14} />
            Atribuir Curso
          </Button>
        </div>
        {courses.length === 0 ? (
          <p className="rounded-2xl bg-bg-card shadow-card p-6 text-center text-sm text-text-muted">
            Nenhum curso atribuido. Cursos sem unidade sao acessiveis por todos.
          </p>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-bg-card shadow-card p-4">
                <Link href={`/courses/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
                    <BookOpen size={18} className="text-cerrado-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate group-hover:text-cerrado-600 transition-colors">{c.title}</p>
                  </div>
                </Link>
                <Badge badgeSize="sm" variant={c.status === "published" ? "success" : "draft"}>
                  {c.status === "published" ? "Publicado" : "Rascunho"}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => removeCourse(c.id)} disabled={isPending}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Usuarios ({users.length})</h2>
          <Button size="sm" onClick={() => setShowAddUser(true)}>
            <UserPlus size={14} />
            Adicionar
          </Button>
        </div>
        {users.length === 0 ? (
          <p className="rounded-2xl bg-bg-card shadow-card p-6 text-center text-sm text-text-muted">Nenhum usuario nesta unidade.</p>
        ) : (
          <div className="rounded-2xl bg-bg-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Papel</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Acao</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-bg-hover">
                    <td className="px-4 py-3 text-text-primary font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge badgeSize="sm" variant="default">{roleLabels[u.role] ?? u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeUser(u.id)} disabled={isPending}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Course Modal */}
      <Modal open={showAssignCourse} onOpenChange={setShowAssignCourse}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Atribuir Curso a Unidade</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <Select selectSize="sm" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              <option value="">Selecione um curso...</option>
              {unassignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.area_id ? "(em outra unidade)" : "(sem unidade)"}
                </option>
              ))}
            </Select>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowAssignCourse(false)}>Cancelar</Button>
            <Button onClick={assignCourse} disabled={isPending || !selectedCourseId}>
              {isPending ? "Atribuindo..." : "Atribuir"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add User Modal */}
      <Modal open={showAddUser} onOpenChange={setShowAddUser}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Adicionar Usuario a Unidade</ModalTitle>
          </ModalHeader>
          <div className="py-4 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-xl bg-bg-surface pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredUnassignedUsers.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedUserId === u.id ? "bg-cerrado-600/10 text-cerrado-600" : "hover:bg-bg-hover text-text-primary"
                  }`}
                >
                  <span className="flex-1 text-left truncate">{u.full_name}</span>
                  <span className="text-xs text-text-muted truncate">{u.email}</span>
                </button>
              ))}
              {filteredUnassignedUsers.length === 0 && (
                <p className="py-4 text-center text-xs text-text-muted">Nenhum usuario disponivel</p>
              )}
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancelar</Button>
            <Button onClick={addUser} disabled={isPending || !selectedUserId}>
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
