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
  useToast,
} from "@eximia/ui"
import { ArrowDown, ArrowUp, Check, Copy, Key, List, Plug, Plus, Shield, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface Tenant {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown> | null
  status: string
}

interface IntegrationKey {
  id: string
  tenant_id: string
  app_name: string
  key_prefix: string
  scopes: string[]
  status: string
  last_used: string | null
  expires_at: string | null
  created_at: string
}

interface Log {
  id: string
  tenant_id: string
  direction: string
  method: string
  endpoint: string
  entity: string | null
  status_code: number
  duration_ms: number
  remote_app: string | null
  created_at: string
}

interface Props {
  tenants: Tenant[]
  keys: IntegrationKey[]
  logs: Log[]
}

export function IntegrationsClient({ tenants, keys, logs }: Props) {
  const [tab, setTab] = useState<"tenants" | "keys" | "logs">("tenants")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Integrações</h1>
        <p className="text-sm text-text-muted mt-1">Contrato eximIA Integration v1 — gestão cross-tenant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-bg-card p-1 ring-1 ring-white/[0.06] w-fit">
        {[
          { id: "tenants" as const, label: "Tenants", icon: Shield },
          { id: "keys" as const, label: "API Keys", icon: Key },
          { id: "logs" as const, label: "Logs", icon: List },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === t.id
                ? "bg-accent-blue-mid/10 text-accent-blue-light ring-1 ring-accent-blue-mid/30"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tenants" && <TenantsTab tenants={tenants} />}
      {tab === "keys" && <KeysTab keys={keys} tenants={tenants} />}
      {tab === "logs" && <LogsTab logs={logs} tenants={tenants} />}
    </div>
  )
}

// --- Tenants Tab ---
function TenantsTab({ tenants }: { tenants: Tenant[] }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function toggleIntegration(tenantId: string, currentlyEnabled: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { integration_enabled: !currentlyEnabled } }),
      })
      if (!res.ok) {
        toast({ variant: "error", title: "Erro ao atualizar tenant" })
        return
      }
      toast({ variant: "success", title: currentlyEnabled ? "Integração desabilitada" : "Integração habilitada" })
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">Habilite ou desabilite o contrato de integração por tenant.</p>
      {tenants.map((t) => {
        const enabled = !!(t.settings as Record<string, unknown>)?.integration_enabled
        return (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl bg-bg-card p-4 ring-1 ring-border-subtle"
          >
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-semantic-success" : "bg-text-muted/30"}`} />
              <div>
                <p className="text-sm font-medium text-text-primary">{t.name}</p>
                <p className="text-xs text-text-muted">{t.slug}</p>
              </div>
            </div>
            <Button
              variant={enabled ? "outline" : "default"}
              size="sm"
              onClick={() => toggleIntegration(t.id, enabled)}
              disabled={isPending}
            >
              {enabled ? "Desabilitar" : "Habilitar"}
            </Button>
          </div>
        )
      })}
    </div>
  )
}

// --- Keys Tab ---
function KeysTab({ keys, tenants }: { keys: IntegrationKey[]; tenants: Tenant[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(["read"]))
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]))

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const scopes = [...selectedScopes]
      if (scopes.length === 0) scopes.push("read")
      const res = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: formData.get("app_name"),
          scopes,
          tenant_id: formData.get("tenant_id"),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: data.error })
        return
      }
      setNewKey(data.data.api_key)
      router.refresh()
    })
  }

  function handleRevoke(keyId: string) {
    startTransition(async () => {
      await fetch(`/api/integrations/keys/${keyId}`, { method: "DELETE" })
      toast({ variant: "success", title: "Chave revogada" })
      router.refresh()
    })
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{keys.length} chave{keys.length !== 1 ? "s" : ""} registrada{keys.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => { setShowCreate(true); setNewKey(null) }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova Chave
        </Button>
      </div>

      {keys.map((k) => (
        <div
          key={k.id}
          className="flex items-center justify-between rounded-xl bg-bg-card p-4 ring-1 ring-border-subtle"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Key size={16} className={k.status === "active" ? "text-accent-blue-light" : "text-text-muted/40"} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{k.app_name}</p>
                <Badge variant={k.status === "active" ? "success" : "error"} badgeSize="sm">{k.status}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-2xs text-text-muted font-mono">{k.key_prefix}...</code>
                <span className="text-2xs text-text-muted">· {k.tenant_id ? (tenantMap.get(k.tenant_id) ?? "?") : "Plataforma"}</span>
                <span className="text-2xs text-text-muted">· {k.scopes.join(", ")}</span>
                {k.last_used && (
                  <span className="text-2xs text-text-muted">· usado {new Date(k.last_used).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
            </div>
          </div>
          {k.status === "active" && (
            <Button variant="ghost" size="sm" onClick={() => handleRevoke(k.id)} disabled={isPending}>
              <Trash2 size={14} className="text-semantic-error" />
            </Button>
          )}
        </div>
      ))}

      {/* Create Key Modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{newKey ? "Chave Criada" : "Nova API Key"}</ModalTitle>
            <ModalDescription>
              {newKey
                ? "Copie a chave abaixo. Ela não será exibida novamente."
                : "Crie uma chave de API para integração inbound."}
            </ModalDescription>
          </ModalHeader>

          {newKey ? (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 rounded-lg bg-bg-elevated p-3 ring-1 ring-border-subtle">
                <code className="flex-1 text-xs font-mono text-accent-blue-light break-all">{newKey}</code>
                <button type="button" onClick={copyKey} className="shrink-0 p-1.5 rounded hover:bg-bg-card">
                  {copied ? <Check size={14} className="text-semantic-success" /> : <Copy size={14} className="text-text-muted" />}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate(new FormData(e.currentTarget))
              }}
              className="px-6 pb-4 space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-text-secondary">App Name</label>
                <input name="app_name" required className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary" placeholder="eximia-forms" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Permissões</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { id: "read", label: "Leitura", desc: "GET" },
                    { id: "write", label: "Escrita", desc: "POST/PUT" },
                    { id: "admin", label: "Admin", desc: "Full access" },
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => toggleScope(scope.id)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-all ${
                        selectedScopes.has(scope.id)
                          ? "border-accent-blue-mid/50 bg-accent-blue-mid/10 ring-1 ring-accent-blue-mid/30"
                          : "border-border-subtle bg-bg-elevated hover:border-border-medium"
                      }`}
                    >
                      <p className={`text-xs font-medium ${selectedScopes.has(scope.id) ? "text-accent-blue-light" : "text-text-primary"}`}>{scope.label}</p>
                      <p className="text-2xs text-text-muted mt-0.5">{scope.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Escopo</label>
                <select name="tenant_id" required className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary">
                  <option value="platform">Plataforma (cross-tenant)</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Criando..." : "Gerar Chave"}
              </Button>
            </form>
          )}

          <ModalFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Fechar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

// --- Logs Tab ---
function LogsTab({ logs, tenants }: { logs: Log[]; tenants: Tenant[] }) {
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]))

  const methodColors: Record<string, string> = {
    GET: "bg-semantic-success/15 text-semantic-success",
    POST: "bg-accent-blue-mid/15 text-accent-blue-light",
    PUT: "bg-semantic-warning/15 text-semantic-warning",
    DELETE: "bg-semantic-error/15 text-semantic-error",
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">{logs.length} registros (últimos 100)</p>

      {logs.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Nenhum log de integração.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg bg-bg-card px-3 py-2 ring-1 ring-border-subtle">
              {log.direction === "inbound" ? (
                <ArrowDown size={12} className="text-accent-blue-light shrink-0" />
              ) : (
                <ArrowUp size={12} className="text-semantic-warning shrink-0" />
              )}
              <span className={`rounded px-1.5 py-0.5 text-2xs font-mono font-bold ${methodColors[log.method] ?? "bg-bg-elevated text-text-muted"}`}>
                {log.method}
              </span>
              <span className="text-xs text-text-primary font-mono truncate flex-1 min-w-[80px]">{log.endpoint}</span>
              <span className={`text-2xs font-mono ${log.status_code < 400 ? "text-semantic-success" : "text-semantic-error"}`}>
                {log.status_code}
              </span>
              <span className="text-2xs text-text-muted tabular-nums">{log.duration_ms}ms</span>
              <span className="hidden sm:inline text-2xs text-text-muted truncate max-w-[100px]">{tenantMap.get(log.tenant_id) ?? "?"}</span>
              <span className="text-2xs text-text-muted/50">{new Date(log.created_at).toLocaleTimeString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
