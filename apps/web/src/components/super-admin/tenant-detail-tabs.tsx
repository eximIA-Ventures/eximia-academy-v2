"use client"

import { updateTenantSchema } from "@eximia/shared"
import type { TenantPlan } from "@eximia/shared"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toggle,
  useToast,
} from "@eximia/ui"
import { Check, Copy, ExternalLink, Image, Loader2, Save, Search, UserCheck2, UserPlus, UserX, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import React, { useMemo, useState } from "react"

/* ---------------------------------- Types --------------------------------- */

interface TenantData {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: string
  branding: Record<string, unknown>
  settings: Record<string, unknown>
  whitelabel_enabled: boolean
  whitelabel_config: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface TenantStats {
  user_count: number
  session_count: number
  course_count: number
  enrollment_count?: number
  reflection_count?: number
}

interface UserRow {
  id: string
  full_name: string
  email: string
  role: string
  status: string
  created_at: string
}

interface UserMetrics {
  totalSessions: number
  completedSessions: number
  coursesEnrolled: number
  lastSessionDate: string | null
}

interface TenantDetailTabsProps {
  tenant: TenantData
  stats: TenantStats
  initialUsers: UserRow[]
  userMetrics?: Record<string, UserMetrics>
}

/* -------------------------------- Helpers -------------------------------- */

function roleBadgeLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    student: "Aluno",
  }
  return labels[role] || role
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/* ================================ Component =============================== */

export function TenantDetailTabs({ tenant, stats, initialUsers, userMetrics }: TenantDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("geral")

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center justify-end gap-2">
        <Badge variant={tenant.status === "active" ? "default" : "draft"}>
          {tenant.status === "active" ? "Ativo" : "Inativo"}
        </Badge>
        <Badge variant="draft">{tenant.plan}</Badge>
        {tenant.status === "active" && (
          <Button
            size="sm"
            onClick={() => {
              document.cookie = `x-sa-active-tenant=${tenant.id};path=/;max-age=86400`
              window.location.href = `/${tenant.slug}/dashboard`
            }}
          >
            Gerenciar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="usuários">Usuários</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <GeneralTab tenant={tenant} />
        </TabsContent>

        <TabsContent value="usuários">
          <UsersTab tenantId={tenant.id} initialUsers={initialUsers} userMetrics={userMetrics} />
        </TabsContent>

        <TabsContent value="metricas">
          <MetricsTab stats={stats} tenant={tenant} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ============================== General Tab =============================== */

function GeneralTab({ tenant }: { tenant: TenantData }) {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [name, setName] = useState(tenant.name)
  const [plan, setPlan] = useState(tenant.plan)
  const [aiModel, setAiModel] = useState(
    (tenant.settings as Record<string, string>)?.ai_model || "gpt-4o-mini",
  )
  const [maxInteractions, setMaxInteractions] = useState(
    (tenant.settings as Record<string, number>)?.max_interactions_per_session || 3,
  )
  const [whitelabelEnabled, setWhitelabelEnabled] = useState(tenant.whitelabel_enabled)
  const [partnerName, setPartnerName] = useState(
    (tenant.settings as Record<string, string>)?.partner_name ?? "",
  )
  const [partnerLogoUrl, setPartnerLogoUrl] = useState(
    (tenant.settings as Record<string, string>)?.partner_logo_url ?? "",
  )
  const [showWhitelabelConfirm, setShowWhitelabelConfirm] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  async function handleSave() {
    const payload = {
      name,
      plan,
      settings: {
        ai_model: aiModel,
        max_interactions_per_session: maxInteractions,
        partner_name: partnerName,
        partner_logo_url: partnerLogoUrl || undefined,
      },
      whitelabel_enabled: whitelabelEnabled,
    }

    const parsed = updateTenantSchema.safeParse(payload)
    if (!parsed.success) {
      toast({ title: "Erro de validacao", description: "Verifique os campos.", variant: "error" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      if (!res.ok) {
        const json = await res.json()
        toast({
          title: "Erro",
          description: typeof json.error === "string" ? json.error : "Falha ao salvar.",
          variant: "error",
        })
        return
      }

      toast({ title: "Sucesso", description: "Dados atualizados.", variant: "success" })
      router.refresh()
    } catch {
      toast({ title: "Erro", description: "Falha na conexão.", variant: "error" })
    } finally {
      setSaving(false)
    }
  }

  function handleWhitelabelToggle() {
    if (!whitelabelEnabled) {
      // Turning on: show confirm
      setShowWhitelabelConfirm(true)
    } else {
      // Turning off: just toggle
      setWhitelabelEnabled(false)
    }
  }

  function confirmWhitelabel() {
    setWhitelabelEnabled(true)
    setShowWhitelabelConfirm(false)
  }

  async function handleDeactivate() {
    setDeactivating(true)
    try {
      const newStatus = tenant.status === "active" ? "inactive" : "active"
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const json = await res.json()
        toast({
          title: "Erro",
          description: typeof json.error === "string" ? json.error : "Falha ao atualizar status.",
          variant: "error",
        })
        return
      }

      toast({
        title: "Sucesso",
        description: newStatus === "inactive" ? "Empresa desativada." : "Empresa reativada.",
        variant: "success",
      })
      setShowDeactivateConfirm(false)
      router.refresh()
    } catch {
      toast({ title: "Erro", description: "Falha na conexão.", variant: "error" })
    } finally {
      setDeactivating(false)
    }
  }

  async function copyTenantUrl() {
    const url = `${window.location.origin}/${tenant.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setUrlCopied(true)
      toast({ title: "URL copiada", description: url, variant: "success" })
      setTimeout(() => setUrlCopied(false), 2000)
    } catch {
      toast({ title: "Erro", description: "Falha ao copiar URL.", variant: "error" })
    }
  }

  const logoUrl = (tenant.branding as Record<string, string>)?.logo_url ?? ""

  return (
    <div className="space-y-6 mt-4">
      {/* Tenant URL */}
      <Card>
        <CardHeader>
          <CardTitle>URL do Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-bg-elevated px-4 py-3 font-mono text-sm text-text-primary ring-1 ring-white/[0.06]">
              {typeof window !== "undefined" ? window.location.origin : "academy.eximiaventures.com.br"}/{tenant.slug}
            </div>
            <button
              type="button"
              onClick={copyTenantUrl}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] ring-1 ring-white/[0.06] transition-colors"
              title="Copiar URL"
            >
              {urlCopied ? <Check size={16} className="text-semantic-success" /> : <Copy size={16} />}
            </button>
            <a
              href={`/${tenant.slug}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-accent-blue-light hover:text-text-primary ring-1 ring-white/[0.06] hover:bg-white/[0.06] transition-colors"
            >
              <ExternalLink size={14} />
              Abrir Login
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image size={18} />
            Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-40 items-center justify-center rounded-xl bg-bg-elevated ring-1 ring-white/[0.06] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={`Logo ${tenant.name}`} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="text-xs text-text-muted">
                <p>Configurado via branding</p>
                <p className="font-mono mt-1 break-all">{logoUrl}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Nenhuma logo configurada. Defina <span className="font-mono text-text-secondary">branding.logo_url</span> nas configuracoes do tenant.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>

          <FormField label="Plano">
            <Select value={plan} onChange={(e) => setPlan(e.target.value as TenantPlan)}>
              <option value="essencial">Essencial</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </Select>
          </FormField>

          <FormField label="Modelo de IA">
            <Select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
              <option value="claude-haiku-4-20250514">Claude Haiku 4</option>
            </Select>
          </FormField>

          <FormField label={`Interacoes por Sessao: ${maxInteractions}`}>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={maxInteractions}
              onChange={(e) => setMaxInteractions(Number(e.target.value))}
              className="w-full accent-accent-blue-mid"
            />
          </FormField>

          <div className="flex items-center justify-between rounded-xl ring-1 ring-white/[0.06] p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Whitelabel</p>
              <p className="text-xs text-text-muted">
                Ativar personalizacao avancada de marca
              </p>
            </div>
            <Toggle checked={whitelabelEnabled} onCheckedChange={handleWhitelabelToggle} />
          </div>

          {/* Partner / Co-branding */}
          <div className="rounded-xl ring-1 ring-white/[0.06] p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Logo Parceiro (sidebar)</p>
              <p className="text-xs text-text-muted">
                Exibida no rodapé do menu lateral. Deixe o nome vazio para ocultar.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nome do Parceiro">
                <Input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Ex: Argos Consultoria (vazio = ocultar)"
                />
              </FormField>
              <FormField label="URL da Logo">
                <Input
                  value={partnerLogoUrl}
                  onChange={(e) => setPartnerLogoUrl(e.target.value)}
                  placeholder="/logos/parceiro.png ou https://..."
                />
              </FormField>
            </div>
            {partnerLogoUrl && partnerName && (
              <div className="flex items-center gap-3 rounded-lg bg-bg-elevated p-3">
                <span className="text-[8px] font-medium uppercase tracking-wider text-text-muted">Preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partnerLogoUrl} alt={partnerName} className="h-8 opacity-60" />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deactivate Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {tenant.status === "active" ? "Desativar Empresa" : "Reativar Empresa"}
              </p>
              <p className="text-xs text-text-muted">
                {tenant.status === "active"
                  ? "A empresa e todos os seus usuários serao desativados."
                  : "A empresa e seus usuários serao reativados."}
              </p>
            </div>
            <Button
              variant={tenant.status === "active" ? "destructive" : "outline"}
              onClick={() => setShowDeactivateConfirm(true)}
            >
              <UserX size={16} className="mr-2" />
              {tenant.status === "active" ? "Desativar" : "Reativar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Whitelabel Confirm Modal */}
      <Modal open={showWhitelabelConfirm} onOpenChange={setShowWhitelabelConfirm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Ativar Whitelabel</ModalTitle>
            <ModalDescription>
              Tem certeza que deseja ativar o whitelabel para esta empresa? Isso permitira
              personalizacao completa da marca.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowWhitelabelConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmWhitelabel}>Confirmar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Deactivate Confirm Modal */}
      <Modal open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              {tenant.status === "active" ? "Desativar Empresa" : "Reativar Empresa"}
            </ModalTitle>
            <ModalDescription>
              {tenant.status === "active"
                ? "Tem certeza que deseja desativar esta empresa? Os usuários nao poderao mais acessar a plataforma."
                : "Tem certeza que deseja reativar esta empresa? Os usuários voltarao a ter acesso."}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowDeactivateConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant={tenant.status === "active" ? "destructive" : "default"}
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : null}
              {tenant.status === "active" ? "Desativar" : "Reativar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

/* =============================== Users Tab ================================ */

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  if (diffDays < 30) return `${diffDays}d atrás`
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}m atrás`
  }
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function UsersTab({
  tenantId,
  initialUsers,
  userMetrics,
}: {
  tenantId: string
  initialUsers: UserRow[]
  userMetrics?: Record<string, UserMetrics>
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "", role: "student" })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const hasMetrics = userMetrics && Object.keys(userMetrics).length > 0

  const filtered = useMemo(() => {
    let result = users
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    if (roleFilter) result = result.filter((u) => u.role === roleFilter)
    return result
  }, [users, search, roleFilter])

  async function handleInvite() {
    setInviteLoading(true)
    setInviteError(null)
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao convidar")
      }
      setInviteSuccess(true)
      const data = await res.json()
      if (data.data) {
        setUsers((prev) => [{ ...data.data, status: "active", created_at: new Date().toISOString() }, ...prev])
      }
      setTimeout(() => { setShowInvite(false); setInviteSuccess(false); setInviteForm({ full_name: "", email: "", role: "student" }) }, 1200)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Erro")
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
      }
    } catch {}
  }

  async function handleToggleStatus(userId: string, currentStatus: string) {
    try {
      if (currentStatus === "active") {
        await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: "inactive" } : u))
      } else {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        })
        if (res.ok) setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: "active" } : u))
      }
    } catch {}
  }

  const roleColors: Record<string, string> = {
    admin: "bg-purple-500/15 text-purple-400 ring-purple-500/20",
    manager: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
    instructor: "bg-accent-teal/15 text-accent-teal ring-accent-teal/20",
    student: "bg-white/[0.06] text-text-muted ring-white/[0.08]",
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-secondary"
        >
          <option value="">Todos os papéis</option>
          <option value="student">Aluno</option>
          <option value="instructor">Instrutor</option>
          <option value="manager">Gestor</option>
          <option value="admin">Admin</option>
        </select>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus size={14} className="mr-1.5" /> Convidar
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-2 text-xs text-text-muted">
        <span>{filtered.length} de {users.length} usuários</span>
        {search || roleFilter ? <span>· filtrado</span> : null}
      </div>

      {/* Invite Dialog */}
      {showInvite && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-text-primary">Convidar Novo Usuário</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="Nome completo" value={inviteForm.full_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))} />
              <Input placeholder="Email" type="email" value={inviteForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
              <select value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))} className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-secondary">
                <option value="student">Aluno</option>
                <option value="instructor">Instrutor</option>
                <option value="manager">Gestor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {inviteError && <p className="text-xs text-semantic-error">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-semantic-success">✓ Convite enviado</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleInvite} disabled={inviteLoading || !inviteForm.email || !inviteForm.full_name}>
                {inviteLoading ? "Enviando..." : "Enviar Convite"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                {hasMetrics && <TableHead>Sessões</TableHead>}
                {hasMetrics && <TableHead>Último Acesso</TableHead>}
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasMetrics ? 7 : 5} className="text-center text-text-muted py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => {
                  const metrics = userMetrics?.[user.id]
                  const isExpanded = expandedUserId === user.id
                  return (
                    <React.Fragment key={user.id}>
                      <TableRow className="hover:bg-white/[0.02] transition-colors">
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-text-secondary text-sm">{user.email}</TableCell>
                        <TableCell>
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`rounded-md px-2 py-1 text-xs font-medium ring-1 cursor-pointer ${roleColors[user.role] ?? roleColors.student}`}
                          >
                            <option value="student">Aluno</option>
                            <option value="instructor">Instrutor</option>
                            <option value="manager">Gestor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 text-xs ${user.status === "active" ? "text-semantic-success" : "text-semantic-error"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${user.status === "active" ? "bg-semantic-success" : "bg-semantic-error"}`} />
                            {user.status === "active" ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        {hasMetrics && (
                          <TableCell className="text-sm">
                            {metrics ? (
                              <span>
                                <span className="font-medium text-text-primary">{metrics.completedSessions}</span>
                                <span className="text-text-muted">/{metrics.totalSessions}</span>
                              </span>
                            ) : <span className="text-text-muted">—</span>}
                          </TableCell>
                        )}
                        {hasMetrics && (
                          <TableCell className="text-text-secondary text-xs">
                            {metrics ? formatRelativeTime(metrics.lastSessionDate) : "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${isExpanded ? "bg-accent-blue-mid/10 text-accent-blue-mid" : "text-text-muted hover:text-text-primary ring-1 ring-white/[0.08] hover:bg-white/[0.04]"}`}
                          >
                            Ações {isExpanded ? "▾" : "›"}
                          </button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={hasMetrics ? 7 : 5} className="px-4 py-3 bg-white/[0.01]">
                            <div className="flex gap-2 pl-2">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(user.id, user.status)}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-white/[0.06] hover:bg-white/[0.04] transition-colors"
                              >
                                {user.status === "active" ? (
                                  <><UserX size={13} className="text-semantic-error" /> Desativar</>
                                ) : (
                                  <><UserCheck2 size={13} className="text-semantic-success" /> Reativar</>
                                )}
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/* ============================== Metrics Tab =============================== */

function MetricsTab({
  stats,
  tenant,
}: {
  stats: TenantStats
  tenant: TenantData
}) {
  const s = stats as TenantStats & {
    users_by_role?: Record<string, number>
    sessions_completed?: number
    sessions_7d?: number
    sessions_30d?: number
    active_users_7d?: number
    enrollment_count?: number
    reflection_count?: number
  }

  const completionRate = s.session_count > 0 && s.sessions_completed
    ? Math.round((s.sessions_completed / s.session_count) * 100)
    : 0

  const engagementRate = s.user_count > 0 && s.active_users_7d
    ? Math.round((s.active_users_7d / s.user_count) * 100)
    : 0

  return (
    <div className="space-y-6 mt-4">
      {/* Primary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Usuários" value={s.user_count} />
        <StatCard label="Cursos" value={s.course_count} />
        <StatCard label="Matrículas" value={s.enrollment_count ?? 0} />
        <StatCard label="Reflexões" value={s.reflection_count ?? 0} />
      </div>

      {/* Engagement metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Engajamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.active_users_7d ?? 0}</p>
              <p className="text-xs text-text-muted mt-1">Usuários ativos (7 dias)</p>
              {s.user_count > 0 && (
                <p className="text-xs text-accent-teal mt-0.5">{engagementRate}% engajamento</p>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.sessions_7d ?? 0}</p>
              <p className="text-xs text-text-muted mt-1">Sessões (7 dias)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.sessions_30d ?? 0}</p>
              <p className="text-xs text-text-muted mt-1">Sessões (30 dias)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{s.session_count}</p>
              <p className="text-xs text-text-muted mt-1">Sessões totais</p>
              {s.session_count > 0 && (
                <p className="text-xs text-accent-teal mt-0.5">{completionRate}% concluídas</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users by role */}
      {s.users_by_role && Object.keys(s.users_by_role).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usuários por Papel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(s.users_by_role).sort(([,a], [,b]) => b - a).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between rounded-lg bg-bg-surface p-3">
                  <span className="text-sm text-text-secondary capitalize">{role === "student" ? "Alunos" : role === "instructor" ? "Instrutores" : role === "manager" ? "Gestores" : role === "admin" ? "Admins" : role}</span>
                  <span className="text-sm font-semibold text-text-primary">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-text-secondary">Slug</dt>
              <dd className="font-mono text-text-primary">{tenant.slug}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-text-secondary">Plano</dt>
              <dd className="text-text-primary">{tenant.plan}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-text-secondary">Whitelabel</dt>
              <dd className="text-text-primary">
                {tenant.whitelabel_enabled ? "Ativo" : "Inativo"}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-text-secondary">Criado em</dt>
              <dd className="text-text-primary">{formatDate(tenant.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
