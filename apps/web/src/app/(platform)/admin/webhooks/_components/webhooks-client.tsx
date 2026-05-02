"use client"

import { WEBHOOK_EVENTS } from "@eximia/shared"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eximia/ui"
import { Check, Copy, Play, Plus, Trash2, Webhook } from "lucide-react"
import { useCallback, useState } from "react"

interface WebhookItem {
  id: string
  url: string
  events: string[]
  is_active: boolean
  failure_count: number
  created_at: string
  updated_at: string
}

interface WebhooksClientProps {
  initialWebhooks: WebhookItem[]
}

export function WebhooksClient({ initialWebhooks }: WebhooksClientProps) {
  const [hooks, setHooks] = useState<WebhookItem[]>(initialWebhooks)
  const [showCreate, setShowCreate] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; code?: number } | null>(
    null,
  )

  // Form state
  const [url, setUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  const resetForm = useCallback(() => {
    setUrl("")
    setSelectedEvents([])
  }, [])

  const handleCreate = async () => {
    if (!url || selectedEvents.length === 0) return
    setLoading(true)

    try {
      const res = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      })

      if (!res.ok) return

      const { data } = await res.json()
      setNewSecret(data.secret)
      setHooks((prev) => [data, ...prev])
      resetForm()
      setShowCreate(false)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (hookId: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/webhooks/${hookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    })

    if (res.ok) {
      setHooks((prev) => prev.map((h) => (h.id === hookId ? { ...h, is_active: !isActive } : h)))
    }
  }

  const handleDelete = async (hookId: string) => {
    const res = await fetch(`/api/admin/webhooks/${hookId}`, { method: "DELETE" })
    if (res.ok) {
      setHooks((prev) => prev.filter((h) => h.id !== hookId))
    }
  }

  const handleTest = async (hookId: string) => {
    setTestResult(null)
    const res = await fetch(`/api/admin/webhooks/${hookId}/test`, { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      setTestResult({ id: hookId, ok: data.success, code: data.status_code })
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    )
  }

  return (
    <>
      {/* Secret revealed modal */}
      {newSecret && (
        <Modal open onOpenChange={() => setNewSecret(null)}>
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-text-primary">Webhook criado</h2>
            <p className="text-sm text-text-secondary">
              Copie o secret abaixo para validar assinaturas HMAC. Ele nao sera exibido novamente.
            </p>
            <div className="flex items-center gap-2 rounded-md bg-bg-surface p-3">
              <code className="flex-1 break-all text-sm text-accent-teal">{newSecret}</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newSecret)}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal open onOpenChange={() => setShowCreate(false)}>
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-text-primary">Novo Webhook</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">URL do endpoint</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Eventos</label>
              <div className="grid grid-cols-2 gap-2">
                {WEBHOOK_EVENTS.map((event: string) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <Checkbox
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading || !url || selectedEvents.length === 0}
              >
                {loading ? "Criando..." : "Criar webhook"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Main content */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border-medium p-4">
            <h2 className="text-sm font-semibold text-text-primary">Webhooks</h2>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1" />
              Novo webhook
            </Button>
          </div>

          {hooks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Webhook size={40} className="text-text-muted" />
              <p className="text-sm text-text-secondary">Nenhum webhook configurado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hooks.map((hook) => (
                  <TableRow key={hook.id}>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {hook.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {hook.events.slice(0, 2).map((e) => (
                          <Badge key={e} variant="info" className="text-[10px]">
                            {e}
                          </Badge>
                        ))}
                        {hook.events.length > 2 && (
                          <Badge variant="info" className="text-[10px]">
                            +{hook.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={hook.is_active ? "success" : "error"}
                        className="cursor-pointer"
                        onClick={() => handleToggle(hook.id, hook.is_active)}
                      >
                        {hook.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hook.failure_count > 0 ? (
                        <span className="text-sm text-status-error">{hook.failure_count}</span>
                      ) : (
                        <span className="text-sm text-text-muted">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(hook.id)}
                          title="Testar webhook"
                        >
                          <Play size={14} />
                          {testResult?.id === hook.id && (
                            <span
                              className={`ml-1 text-xs ${testResult.ok ? "text-status-success" : "text-status-error"}`}
                            >
                              {testResult.ok ? testResult.code : "Erro"}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(hook.id)}
                          title="Excluir webhook"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
