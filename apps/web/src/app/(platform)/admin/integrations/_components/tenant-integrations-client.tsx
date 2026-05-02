"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { ArrowDown, ArrowUp, Check, Copy, Key, Link2, List, Plus, PlugZap, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface IntegrationKey {
  id: string
  app_name: string
  key_prefix: string
  scopes: string[]
  status: string
  last_used: string | null
  expires_at: string | null
  created_at: string
}

interface Connection {
  id: string
  remote_app: string
  remote_url: string
  status: string
  entities: string[]
  last_sync: string | null
  last_error: string | null
  created_at: string
}

interface Log {
  id: string
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
  tenantName: string
  integrationEnabled: boolean
  keys: IntegrationKey[]
  connections: Connection[]
  logs: Log[]
}

export function TenantIntegrationsClient({ tenantName, integrationEnabled, keys, connections, logs }: Props) {
  const [tab, setTab] = useState<"keys" | "connections" | "logs">("keys")

  if (!integrationEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Integrações</h1>
          <p className="text-sm text-text-muted mt-1">Contrato eximIA Integration v1</p>
        </div>
        <EmptyState
          title="Integrações não habilitadas"
          description="O contrato de integração não está ativo para sua empresa. Solicite ativação ao suporte."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Integrações</h1>
        <p className="text-sm text-text-muted mt-1">
          Contrato eximIA Integration v1 — {tenantName}
        </p>
      </div>

      {/* Contract info */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl bg-accent-blue-mid/5 p-3 sm:p-4 ring-1 ring-accent-blue-mid/15">
        <PlugZap size={18} className="text-accent-blue-light shrink-0" />
        <div className="text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Base URL:</span>{" "}
          <code className="font-mono text-accent-blue-light break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/v1/integration</code>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-bg-card p-1 ring-1 ring-white/[0.06] w-fit">
        {[
          { id: "keys" as const, label: "API Keys", icon: Key, count: keys.length },
          { id: "connections" as const, label: "Conexões", icon: Link2, count: connections.length },
          { id: "logs" as const, label: "Logs", icon: List, count: logs.length },
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
            {t.count > 0 && (
              <span className="ml-1 rounded-full bg-bg-elevated px-1.5 py-0.5 text-2xs">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "keys" && <KeysSection keys={keys} />}
      {tab === "connections" && <ConnectionsSection connections={connections} />}
      {tab === "logs" && <LogsSection logs={logs} />}
    </div>
  )
}

// --- Keys Section ---
function KeysSection({ keys }: { keys: IntegrationKey[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set(["read"]))
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

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
        body: JSON.stringify({ app_name: formData.get("app_name"), scopes }),
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">Chaves para apps externos acessarem seus dados</p>
        <Button size="sm" onClick={() => { setShowCreate(true); setNewKey(null); setSelectedScopes(new Set(["read"])) }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova Chave
        </Button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Nenhuma chave de API criada.</p>
      ) : (
        keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-xl bg-bg-card p-4 ring-1 ring-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <Key size={16} className={k.status === "active" ? "text-accent-blue-light" : "text-text-muted/40"} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{k.app_name}</p>
                  <Badge variant={k.status === "active" ? "success" : "error"} badgeSize="sm">{k.status}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-2xs text-text-muted font-mono">{k.key_prefix}...</code>
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
        ))
      )}

      {/* Create Key Modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{newKey ? "Chave Criada" : "Nova API Key"}</ModalTitle>
            <ModalDescription>
              {newKey ? "Copie a chave abaixo. Ela não será exibida novamente." : "Crie uma chave para integração com apps externos."}
            </ModalDescription>
          </ModalHeader>
          {newKey ? (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 rounded-lg bg-bg-elevated p-3 ring-1 ring-border-subtle">
                <code className="flex-1 text-xs font-mono text-accent-blue-light break-all">{newKey}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="shrink-0 p-1.5 rounded hover:bg-bg-card"
                >
                  {copied ? <Check size={14} className="text-semantic-success" /> : <Copy size={14} className="text-text-muted" />}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(new FormData(e.currentTarget)) }} className="px-6 pb-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-text-secondary">Nome do App</label>
                <input name="app_name" required className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary" placeholder="meu-app" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Permissões</label>
                <div className="mt-2 flex gap-2">
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

// --- Connections Section ---
function ConnectionsSection({ connections }: { connections: Connection[] }) {
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  const statusColors: Record<string, string> = {
    active: "bg-semantic-success",
    error: "bg-semantic-error",
    pending: "bg-semantic-warning",
    disabled: "bg-text-muted/30",
  }

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remote_app: formData.get("remote_app"),
          remote_url: formData.get("remote_url"),
          api_key: formData.get("api_key"),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: data.error ?? "Erro ao conectar" })
        return
      }
      toast({ variant: "success", title: "Conexão adicionada" })
      setShowAdd(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">Apps externos que você consulta</p>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova Conexão
        </Button>
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Nenhuma conexão outbound.</p>
      ) : (
        connections.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl bg-bg-card p-4 ring-1 ring-border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColors[c.status] ?? "bg-text-muted/30"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{c.remote_app}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-2xs text-text-muted font-mono truncate">{c.remote_url}</code>
                  <span className="text-2xs text-text-muted">· {c.status}</span>
                  {c.last_sync && (
                    <span className="text-2xs text-text-muted">· sync {new Date(c.last_sync).toLocaleDateString("pt-BR")}</span>
                  )}
                </div>
                {c.last_error && <p className="text-2xs text-semantic-error mt-0.5">{c.last_error}</p>}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Add Connection Modal */}
      <Modal open={showAdd} onOpenChange={setShowAdd}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Nova Conexão</ModalTitle>
            <ModalDescription>Conecte a um app eximIA externo.</ModalDescription>
          </ModalHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAdd(new FormData(e.currentTarget)) }} className="px-6 pb-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary">Nome do App</label>
              <input name="remote_app" required className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary" placeholder="eximia-forms" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">URL Base</label>
              <input name="remote_url" required type="url" className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary" placeholder="https://forms.eximiaventures.com.br" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">API Key</label>
              <input name="api_key" required className="mt-1 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary font-mono" placeholder="eximia_..." />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Conectando..." : "Adicionar Conexão"}
            </Button>
          </form>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

// --- Logs Section ---
function LogsSection({ logs }: { logs: Log[] }) {
  const methodColors: Record<string, string> = {
    GET: "bg-semantic-success/15 text-semantic-success",
    POST: "bg-accent-blue-mid/15 text-accent-blue-light",
    PUT: "bg-semantic-warning/15 text-semantic-warning",
    DELETE: "bg-semantic-error/15 text-semantic-error",
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted">{logs.length} registros (últimos 50)</p>

      {logs.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">Nenhum log de integração.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded-lg bg-bg-card px-3 py-2 ring-1 ring-border-subtle">
              {log.direction === "inbound" ? (
                <ArrowDown size={12} className="text-accent-blue-light shrink-0" />
              ) : (
                <ArrowUp size={12} className="text-semantic-warning shrink-0" />
              )}
              <span className={`rounded px-1.5 py-0.5 text-2xs font-mono font-bold ${methodColors[log.method] ?? "bg-bg-elevated text-text-muted"}`}>
                {log.method}
              </span>
              <span className="text-xs text-text-primary font-mono truncate flex-1">{log.endpoint}</span>
              <span className={`text-2xs font-mono ${log.status_code < 400 ? "text-semantic-success" : "text-semantic-error"}`}>
                {log.status_code}
              </span>
              <span className="text-2xs text-text-muted tabular-nums">{log.duration_ms}ms</span>
              {log.remote_app && <span className="text-2xs text-text-muted truncate max-w-[80px]">{log.remote_app}</span>}
              <span className="text-2xs text-text-muted/50">{new Date(log.created_at).toLocaleTimeString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
