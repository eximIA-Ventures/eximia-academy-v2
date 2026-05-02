"use client"

import { API_SCOPES } from "@eximia/shared"
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
import { Check, Copy, Key, Plus, RotateCcw, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit_rpm: number
  rate_limit_rpd: number
  cors_origins: string[]
  expires_at: string | null
  last_used_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ApiKeysClientProps {
  initialKeys: ApiKey[]
}

export function ApiKeysClient({ initialKeys }: ApiKeysClientProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [showCreate, setShowCreate] = useState(false)
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [corsOrigins, setCorsOrigins] = useState("")
  const [rpmLimit, setRpmLimit] = useState(60)
  const [rpdLimit, setRpdLimit] = useState(10000)

  const resetForm = useCallback(() => {
    setName("")
    setSelectedScopes([])
    setCorsOrigins("")
    setRpmLimit(60)
    setRpdLimit(10000)
  }, [])

  const handleCreate = async () => {
    if (!name || selectedScopes.length === 0) return
    setLoading(true)

    try {
      const origins = corsOrigins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)

      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scopes: selectedScopes,
          rate_limit_rpm: rpmLimit,
          rate_limit_rpd: rpdLimit,
          cors_origins: origins,
        }),
      })

      if (!res.ok) return

      const { data } = await res.json()
      setNewRawKey(data.raw_key)
      setKeys((prev) => [data, ...prev])
      resetForm()
      setShowCreate(false)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (keyId: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/api-keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    })

    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, is_active: !isActive } : k)))
    }
  }

  const handleRevoke = async (keyId: string) => {
    const res = await fetch(`/api/admin/api-keys/${keyId}`, { method: "DELETE" })
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, is_active: false } : k)))
    }
  }

  const handleRotate = async (keyId: string) => {
    const res = await fetch(`/api/admin/api-keys/${keyId}/rotate`, { method: "POST" })
    if (res.ok) {
      const { data } = await res.json()
      setNewRawKey(data.raw_key)
      setKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, key_prefix: data.key_prefix } : k)),
      )
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  return (
    <>
      {/* New key revealed modal */}
      {newRawKey && (
        <Modal open onOpenChange={() => setNewRawKey(null)}>
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-bold text-text-primary">Chave API criada</h2>
            <p className="text-sm text-text-secondary">
              Copie a chave abaixo. Ela nao sera exibida novamente.
            </p>
            <div className="flex items-center gap-2 rounded-md bg-bg-surface p-3">
              <code className="flex-1 break-all text-sm text-accent-blue-mid">{newRawKey}</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newRawKey)}>
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
            <h2 className="text-lg font-bold text-text-primary">Nova API Key</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Integracao LMS"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Scopes</label>
              <div className="grid grid-cols-2 gap-2">
                {API_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <Checkbox
                      checked={selectedScopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Limite/min</label>
                <Input
                  type="number"
                  value={rpmLimit}
                  onChange={(e) => setRpmLimit(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Limite/dia</label>
                <Input
                  type="number"
                  value={rpdLimit}
                  onChange={(e) => setRpdLimit(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                Origens CORS (separadas por virgula)
              </label>
              <Input
                value={corsOrigins}
                onChange={(e) => setCorsOrigins(e.target.value)}
                placeholder="https://example.com, https://app.example.com"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading || !name || selectedScopes.length === 0}
              >
                {loading ? "Criando..." : "Criar chave"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Main content */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border-medium p-4">
            <h2 className="text-sm font-semibold text-text-primary">Chaves de API</h2>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1" />
              Nova chave
            </Button>
          </div>

          {keys.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Key size={40} className="text-text-muted" />
              <p className="text-sm text-text-secondary">Nenhuma chave de API criada ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prefixo</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ultimo uso</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs text-text-muted">{key.key_prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.slice(0, 2).map((s) => (
                          <Badge key={s} variant="info" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                        {key.scopes.length > 2 && (
                          <Badge variant="info" className="text-[10px]">
                            +{key.scopes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={key.is_active ? "success" : "error"}
                        className="cursor-pointer"
                        onClick={() => handleToggle(key.id, key.is_active)}
                      >
                        {key.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString("pt-BR")
                        : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRotate(key.id)}
                          title="Rotacionar chave"
                        >
                          <RotateCcw size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(key.id)}
                          title="Revogar chave"
                          disabled={!key.is_active}
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
