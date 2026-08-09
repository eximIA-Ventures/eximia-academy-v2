"use client"

import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  buttonVariants,
} from "@eximia/ui"
import { Download, ScrollText } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

const PAGE_SIZE = 50

const PERIOD_OPTIONS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
]

const TYPE_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "user", label: "Usuários" },
  { value: "area", label: "Áreas" },
  { value: "api_key", label: "API Keys" },
  { value: "webhook", label: "Webhooks" },
  { value: "sso", label: "SSO" },
  { value: "integration", label: "Integrações" },
  { value: "settings", label: "Configurações" },
  { value: "tenant", label: "Organização" },
]

const ACTION_LABELS: Record<string, string> = {
  "user.invited": "Usuário convidado",
  "user.updated": "Usuário atualizado",
  "user.deactivated": "Usuário desativado",
  "user.password_reset_requested": "Reset de senha solicitado",
  "area.created": "Área criada",
  "area.updated": "Área atualizada",
  "area.deleted": "Área excluída",
  "area.user_added": "Usuário vinculado à área",
  "area.user_removed": "Usuário desvinculado da área",
  "area.course_added": "Curso vinculado à área",
  "area.course_removed": "Curso desvinculado da área",
  "api_key.created": "API key criada",
  "api_key.rotated": "API key rotacionada",
  "api_key.revoked": "API key revogada",
  "webhook.created": "Webhook criado",
  "webhook.deleted": "Webhook excluído",
  "sso.configured": "SSO configurado",
  "sso.removed": "SSO removido",
  "integration.key_created": "Chave de integração criada",
  "integration.key_revoked": "Chave de integração revogada",
  "integration.connection_created": "Conexão de integração criada",
  "settings.updated": "Configurações atualizadas",
  "settings.whitelabel_updated": "Whitelabel atualizado",
}

interface AuditEntry {
  id: string
  actor_id: string
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown> | null
  created_at: string
  actor: { id: string; full_name: string | null; email: string | null } | null
  ip: string | null
}

interface AuditLogClientProps {
  initialUserFilter?: string
}

function detailSummary(details: Record<string, unknown> | null): string {
  if (!details) return ""
  return Object.entries(details)
    .filter(([key]) => key !== "tenant_id" && key !== "ip")
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" · ")
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AuditLogClient({ initialUserFilter = "" }: AuditLogClientProps) {
  const [period, setPeriod] = useState("30")
  const [type, setType] = useState("")
  const [userFilter, setUserFilter] = useState(initialUserFilter)
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams({ period, ...extra })
      if (type) params.set("type", type)
      if (userFilter.trim()) params.set("user", userFilter.trim())
      return params.toString()
    },
    [period, type, userFilter],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const query = buildQuery({ page: String(page), pageSize: String(PAGE_SIZE) })
        const res = await fetch(`/api/admin/audit-log?${query}`)
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? "Falha ao carregar auditoria")
        }
        const body = await res.json()
        if (!cancelled) {
          setEntries(body.data ?? [])
          setTotal(body.total ?? 0)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [buildQuery, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const csvHref = `/api/admin/audit-log?${buildQuery({ format: "csv" })}`

  const applyFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select
              selectSize="sm"
              value={period}
              onChange={(e) => applyFilter(setPeriod)(e.target.value)}
              aria-label="Período"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select
              selectSize="sm"
              value={type}
              onChange={(e) => applyFilter(setType)(e.target.value)}
              aria-label="Tipo"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-72">
            <Input
              inputSize="sm"
              placeholder="Filtrar por pessoa (ID do usuário)"
              value={userFilter}
              onChange={(e) => applyFilter(setUserFilter)(e.target.value)}
              aria-label="Pessoa"
            />
          </div>
          <div className="ml-auto">
            <a
              href={csvHref}
              download
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Download size={14} />
              Exportar CSV
            </a>
          </div>
        </div>

        {error && <p className="text-sm text-semantic-error">{error}</p>}

        {!loading && !error && entries.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ScrollText size={32} className="mb-3 text-text-muted" />
            <h3 className="text-lg font-medium text-text-primary">Nenhuma ação registrada</h3>
            <p className="mt-1 max-w-sm text-sm text-text-secondary">
              Nenhuma ação administrativa encontrada para os filtros selecionados.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="font-medium text-text-primary">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </div>
                    {detailSummary(entry.details) && (
                      <div className="mt-0.5 max-w-md truncate text-xs text-text-muted">
                        {detailSummary(entry.details)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-text-primary">
                      {entry.actor?.full_name ?? entry.actor_id}
                    </div>
                    {entry.actor?.email && (
                      <div className="text-xs text-text-muted">{entry.actor.email}</div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatWhen(entry.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-text-muted">{entry.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-text-muted">
              Página {page} de {totalPages} · {total} registros
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
